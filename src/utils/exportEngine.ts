// src/utils/exportEngine.ts
import type { 
  FileNode, 
  ExportPayload, 
  ExportFile, 
  VirtualPayloadGraph, 
  VirtualPayloadNode, 
  ExportChunk,
  ScopedPathKey 
} from '../types/ipc';
import type { CompressionRule } from '../store/workspaceStore';
import { ScopedRuleIndex, toScopedPathKey, normalizePath } from './filterEngine';

export const CODE_GENERATION_PROTOCOL_INSTRUCTION = `
### System Instruction: Structured Batch Code Generation Protocol

When generating code replacements, diffs, or new files, you MUST adhere to the deterministic extraction contract:
1. **Zero Interstitial Chatter:** Once the first code block begins, emit NO conversational text or commentary between code blocks. Each code block must immediately follow the previous.
2. **Deterministic Line 1 Action Header:** The first line inside EVERY code block must declare the target action tag followed by the relative path using standard language comment syntax:
   - Valid Action Tags: \`[NEW]\`, \`[MODIFIED]\`, \`[DELETED]\`, or \`[PARTIAL_DIFF]\`
   - C-Style/TS/JS/Go/Rust: \`// [ACTION] path/to/file.ext\`
   - Python/Bash/YAML: \`# [ACTION] path/to/file.ext\`
   - SQL/Lua: \`-- [ACTION] path/to/file.ext\`
   - Markdown/HTML: \`<!-- [ACTION] path/to/file.ext -->\`
   *Concrete Examples:*
     - \`// [MODIFIED] src/utils/exportEngine.ts\`
     - \`# [NEW] scripts/worker.py\`
     - \`<!-- [DELETED] public/legacy.html -->\`
     - \`// [PARTIAL_DIFF] src/features/session/engine/sessionParser.ts\`
3. **Action Taxonomy & Scope Selection (\`[MODIFIED]\` vs \`[PARTIAL_DIFF]\`):**
   - **\`[MODIFIED]\` (Full File Output):** Use for new files, small files under ~300 lines, or files where the majority of lines are being refactored. Provide the complete, unabridged file content.
   - **\`[PARTIAL_DIFF]\` (Targeted Slices):** REQUIRED when modifying large files where large sections (>50 lines) remain unchanged. Do NOT emit thousands of lines of untouched code. Instead, use \`[PARTIAL_DIFF]\`, provide natural structural anchors (class/function headers and boundary lines), and replace unchanged regions with the standardized skip taxonomy. This keeps output fast, token-efficient, and under 1,000 lines instead of 5,000+ lines.
   - **\`[NEW]\`:** For brand new files. Provide complete file content.
   - **\`[DELETED]\`:** For files to be deleted from disk.
4. **Natural Structural Anchors:** When providing partial modifications, include enclosing class/function headers and boundary lines rather than synthetic comments.
5. **Standardized Skip Taxonomy:** Preserve unchanged regions using:
   \`// ... [Skipped: Unchanged logic] ...\`
`;

export function resolveManifestFileName(rootPaths: string[]): string {
  if (rootPaths.length === 0) return 'Xcerpt_Manifest.md';
  const cleanNames = rootPaths.map(rp => rp.split(/[/\\]/).pop() || 'Root');
  if (cleanNames.length === 1) {
    return `Xcerpt_Manifest_${cleanNames[0]}.md`;
  }
  return `Xcerpt_Manifest_${cleanNames.slice(0, 3).join('_')}.md`;
}

export function calculateTrueSize(fileSizeBytes: number, totalLines: number, skippedLines: number): number {
  if (totalLines <= 0 || fileSizeBytes <= 0) return fileSizeBytes;
  const remainingLines = Math.max(0, totalLines - skippedLines);
  return Math.round(fileSizeBytes * (remainingLines / totalLines));
}

export function generateVirtualPayloadGraph(
  rootPaths: string[],
  rawTrees: Record<string, FileNode>,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  compressions: Record<string, CompressionRule[]>,
  extensionOverrides: Record<string, string>,
  _mergeToSingleFile: boolean,
  embedProtocol: boolean,
  isWhitelistMode: boolean = false
): VirtualPayloadGraph {
  const ruleIndex = new ScopedRuleIndex(includes, excludes, treeOnly, isWhitelistMode);
  const manifestFileName = resolveManifestFileName(rootPaths);
  const virtualNodes: VirtualPayloadNode[] = [];
  const exportFiles: ExportFile[] = [];

  let totalFiles = 0;
  let totalSize = 0;
  let totalTrueSize = 0;

  const rootNameCounts: Record<string, number> = {};
  rootPaths.forEach(rp => {
    const name = rp.split(/[/\\]/).pop() || 'root';
    rootNameCounts[name] = (rootNameCounts[name] || 0) + 1;
  });
  const rootNameOccurrences: Record<string, number> = {};

  let treeMarkdown = `# Exported Workspace Context\n\n`;

  if (embedProtocol) {
    treeMarkdown += `${CODE_GENERATION_PROTOCOL_INSTRUCTION}\n---\n\n`;
  }

  treeMarkdown += `> **Mapping Rule:** The codebase is flattened for export. A file's path corresponds to its exported filename by replacing slashes with underscores (e.g., \`src/utils/api.ts\` -> \`src_utils_api.ts\`).\n`;
  treeMarkdown += `> **Legend:**\n`;
  treeMarkdown += `> \`[-]\` : File visible for spatial awareness; contents omitted from export.\n`;
  treeMarkdown += `> \`[X skips]\` : File exported with X sections compressed to save context.\n`;
  treeMarkdown += `> \`(Exported as [filename])\` : File extension modified to bypass upload filters.\n\n`;
  treeMarkdown += `## File Tree\n\`\`\`text\n`;

  rootPaths.forEach(rootPath => {
    const tree = rawTrees[rootPath];
    if (!tree) return;

    const baseName = rootPath.split(/[/\\]/).pop() || 'root';
    let rootName = baseName;
    if (rootNameCounts[baseName] > 1) {
      rootNameOccurrences[baseName] = (rootNameOccurrences[baseName] || 0) + 1;
      rootName = `${baseName}_${rootNameOccurrences[baseName]}`;
    }

    const buildNode = (node: FileNode, relativePath: string): VirtualPayloadNode | null => {
      const isDir = node.type === 'directory';
      const cleanRelative = normalizePath(relativePath, isDir);
      const scopedKey: ScopedPathKey = toScopedPathKey(rootPath, cleanRelative, isDir);
      const status = ruleIndex.getStatus(rootPath, cleanRelative, isDir);
      const isIncluded = status === 'included';

      const fileComps = compressions[scopedKey] || compressions[cleanRelative] || [];
      const skippedLines = fileComps.reduce((sum, c) => sum + (c.lineCount || 0), 0);
      const estimatedTotalLines = Math.max(1, Math.round(node.size / 40));
      const trueSize = (isDir || !isIncluded) ? 0 : calculateTrueSize(node.size, estimatedTotalLines, skippedLines);
      const tokens = (isDir || !isIncluded) ? 0 : Math.round(trueSize / 4);

      if (isDir) {
        const childNodes: VirtualPayloadNode[] = [];
        if (node.children) {
          for (const child of node.children) {
            const childRel = cleanRelative ? `${cleanRelative}${child.name}` : child.name;
            const builtChild = buildNode(child, childRel);
            if (builtChild) childNodes.push(builtChild);
          }
        }

        const aggSize = childNodes.reduce((acc, c) => acc + c.size, 0);
        const aggTrueSize = childNodes.reduce((acc, c) => acc + c.trueSize, 0);
        const aggTokens = childNodes.reduce((acc, c) => acc + c.tokens, 0);
        const aggIncludedFiles = childNodes.reduce((acc, c) => acc + c.includedFilesCount, 0);
        const aggTotalFiles = childNodes.reduce((acc, c) => acc + c.totalFilesCount, 0);

        return {
          id: scopedKey,
          rootPath,
          relativePath: cleanRelative,
          scopedKey,
          name: node.name,
          isDirectory: true,
          size: aggSize,
          trueSize: aggTrueSize,
          tokens: aggTokens,
          status,
          skipCount: 0,
          skippedLines: 0,
          includedFilesCount: aggIncludedFiles,
          totalFilesCount: aggTotalFiles,
          children: childNodes
        };
      }

      if (isIncluded) {
        let flatFileName = `${rootName}_${cleanRelative.replace(/[/\\]/g, '_')}`;
        for (const [orig, override] of Object.entries(extensionOverrides)) {
          if (flatFileName.endsWith(orig)) {
            flatFileName = flatFileName.slice(0, -orig.length) + override;
            break;
          }
        }

        totalFiles++;
        totalSize += node.size;
        totalTrueSize += trueSize;

        const cleanRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
        exportFiles.push({
          absolutePath: `${cleanRoot}/${cleanRelative}`,
          relativePath: `${rootName}/${cleanRelative}`,
          flatFileName,
          compressions: fileComps,
          size: node.size,
          trueSize,
          tokens,
          rootPath
        });
      }

      return {
        id: scopedKey,
        rootPath,
        relativePath: cleanRelative,
        scopedKey,
        name: node.name,
        isDirectory: false,
        size: isIncluded ? node.size : 0,
        trueSize,
        tokens,
        status,
        skipCount: isIncluded ? fileComps.length : 0,
        skippedLines: isIncluded ? skippedLines : 0,
        includedFilesCount: isIncluded ? 1 : 0,
        totalFilesCount: 1
      };
    };

    const rootVirtualNode = buildNode(tree, '');
    if (rootVirtualNode) virtualNodes.push(rootVirtualNode);

    const joinChild = (parentRel: string, childName: string) => {
      if (!parentRel) return childName;
      return parentRel.endsWith('/') ? `${parentRel}${childName}` : `${parentRel}/${childName}`;
    };

    const renderMarkdownTree = (node: FileNode, prefix: string, isLast: boolean, relPath: string): string => {
      let currNode = node;
      let currRel = relPath;
      let isDir = currNode.type === 'directory';

      let includedChildren = isDir && currNode.children ? currNode.children.filter(c => {
        const childRel = joinChild(currRel, c.name);
        return ruleIndex.getStatus(rootPath, childRel, c.type === 'directory') !== 'excluded';
      }) : [];

      let collapsedName = currNode.name;
      while (isDir && includedChildren.length === 1 && currRel !== '') {
        const singleChild = includedChildren[0];
        const childRel = joinChild(currRel, singleChild.name);
        collapsedName += `/${singleChild.name}`;
        currNode = singleChild;
        currRel = childRel;
        isDir = currNode.type === 'directory';
        includedChildren = isDir && currNode.children ? currNode.children.filter(c => {
          const nextChildRel = joinChild(currRel, c.name);
          return ruleIndex.getStatus(rootPath, nextChildRel, c.type === 'directory') !== 'excluded';
        }) : [];
      }

      const status = ruleIndex.getStatus(rootPath, currRel, isDir);
      if (status === 'excluded') return '';

      let out = '';
      const connector = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      if (relPath === '') {
        out += `${rootName}/\n`;
      } else if (isDir) {
        out += `${prefix}${connector}${collapsedName}/\n`;
      } else {
        if (status === 'tree-only') {
          out += `${prefix}${connector}${collapsedName} [-]\n`;
        } else {
          let flatFileName = `${rootName}_${currRel.replace(/[/\\]/g, '_')}`;
          let exportNote = '';
          for (const [orig, override] of Object.entries(extensionOverrides)) {
            if (flatFileName.endsWith(orig)) {
              flatFileName = flatFileName.slice(0, -orig.length) + override;
              exportNote = ` (Exported as ${flatFileName})`;
              break;
            }
          }

          const fileComps = compressions[toScopedPathKey(rootPath, currRel, false)] || compressions[currRel] || [];
          const compStr = fileComps.length > 0 ? ` [${fileComps.length} skips]` : '';
          out += `${prefix}${connector}${collapsedName}${compStr}${exportNote}\n`;
        }
      }

      if (isDir && includedChildren.length > 0) {
        includedChildren.forEach((child, index) => {
          const childRel = joinChild(currRel, child.name);
          out += renderMarkdownTree(child, relPath === '' ? '' : nextPrefix, index === includedChildren.length - 1, childRel);
        });
      }

      return out;
    };

    treeMarkdown += renderMarkdownTree(tree, '', true, '');
  });

  treeMarkdown += `\`\`\`\n`;

  const totalTokens = Math.round(totalTrueSize / 4);
  const savedBytes = Math.max(0, totalSize - totalTrueSize);
  const savedTokens = Math.round(savedBytes / 4);

  const chunks: ExportChunk[] = [
    { id: 1, files: exportFiles }
  ];

  return {
    nodes: virtualNodes,
    manifestFileName,
    treeMarkdown,
    totalFiles,
    totalSize,
    totalTrueSize,
    totalTokens,
    savedBytes,
    savedTokens,
    chunks
  };
}

export function generateEphemeralPayload(
  rootPath: string,
  tree: FileNode,
  selectedFiles: Set<string>,
  compressions: Record<string, CompressionRule[]>,
  extensionOverrides: Record<string, string>,
  mergeToSingleFile: boolean,
  embedProtocol: boolean = false,
  multiRoots: { rootPath: string; tree: FileNode }[] = []
) {
  const exportFiles: ExportFile[] = [];
  const manifestFileName = resolveManifestFileName(multiRoots.length > 0 ? multiRoots.map(r => r.rootPath) : [rootPath]);

  let mdTree = `# Ephemeral Quick Export\n\n`;
  if (embedProtocol) {
    mdTree += `${CODE_GENERATION_PROTOCOL_INSTRUCTION}\n---\n\n`;
  }
  mdTree += `> **Note:** This partial export contains only explicitly curated files.\n\n## File Tree\n\`\`\`text\n`;

  const rootsToProcess = multiRoots.length > 0 ? multiRoots : [{ rootPath, tree }];

  const joinChild = (parentRel: string, childName: string) => {
    if (!parentRel) return childName;
    return parentRel.endsWith('/') ? `${parentRel}${childName}` : `${parentRel}/${childName}`;
  };

  rootsToProcess.forEach(({ rootPath: currentRoot, tree: currentTree }) => {
    const rootName = currentRoot.split(/[/\\]/).pop() || 'root';

    const traverse = (node: FileNode, prefix: string, isLast: boolean, relativePath: string): string => {
      const isDir = node.type === 'directory';
      const cleanRelative = normalizePath(relativePath, isDir);
      const scopedKey = toScopedPathKey(currentRoot, cleanRelative, isDir);
      const isSelected = selectedFiles.has(scopedKey) || selectedFiles.has(cleanRelative);

      const hasDescendant = (n: FileNode, curRel: string): boolean => {
        const cRel = normalizePath(curRel, n.type === 'directory');
        const sKey = toScopedPathKey(currentRoot, cRel, n.type === 'directory');
        if (selectedFiles.has(sKey) || selectedFiles.has(cRel)) return true;
        if (n.children) {
          for (const c of n.children) {
            const nextRel = joinChild(curRel, c.name);
            if (hasDescendant(c, nextRel)) return true;
          }
        }
        return false;
      };

      if (!isSelected && !hasDescendant(node, relativePath)) return '';

      let result = '';
      const connector = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      if (relativePath === '') {
        result += `${rootName}/\n`;
      } else if (isDir) {
        result += `${prefix}${connector}${node.name}/\n`;
      } else if (isSelected) {
        let flatFileName = `${rootName}_${cleanRelative.replace(/[/\\]/g, '_')}`;
        let exportNote = '';
        for (const [orig, override] of Object.entries(extensionOverrides)) {
          if (flatFileName.endsWith(orig)) {
            flatFileName = flatFileName.slice(0, -orig.length) + override;
            exportNote = ` (Exported as ${flatFileName})`;
            break;
          }
        }

        const fileComps = compressions[scopedKey] || compressions[cleanRelative] || [];
        const cleanRoot = currentRoot.replace(/\\/g, '/').replace(/\/+$/, '');
        exportFiles.push({
          absolutePath: `${cleanRoot}/${cleanRelative}`,
          relativePath: `${rootName}/${cleanRelative}`,
          flatFileName,
          compressions: fileComps,
          size: node.size,
          rootPath: currentRoot
        });

        const compCount = fileComps.length;
        const compStr = compCount > 0 ? ` [${compCount} skips]` : '';
        result += `${prefix}${connector}${node.name}${compStr}${exportNote}\n`;
      }

      if (isDir && node.children) {
        const matchingChildren = node.children.filter(c => {
          const childRel = joinChild(relativePath, c.name);
          return hasDescendant(c, childRel);
        });

        matchingChildren.forEach((child, idx) => {
          const childRel = joinChild(relativePath, child.name);
          result += traverse(child, relativePath === '' ? '' : nextPrefix, idx === matchingChildren.length - 1, childRel);
        });
      }

      return result;
    };

    mdTree += traverse(currentTree, '', true, '');
  });

  mdTree += '```\n';

  return {
    files: exportFiles,
    treeMarkdown: mdTree,
    manifestFileName,
    mergeToSingleFile,
    embedProtocol
  };
}

export function generateExportPayload(
  rootPaths: string[],
  rawTrees: Record<string, FileNode>,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  compressions: Record<string, CompressionRule[]>,
  maxFilesPerChunk: number,
  extensionOverrides: Record<string, string>,
  mergeToSingleFile: boolean,
  embedProtocol: boolean = false,
  isWhitelistMode: boolean = false
): ExportPayload {
  const graph = generateVirtualPayloadGraph(
    rootPaths,
    rawTrees,
    includes,
    excludes,
    treeOnly,
    compressions,
    extensionOverrides,
    mergeToSingleFile,
    embedProtocol,
    isWhitelistMode
  );

  const allFiles = graph.chunks.flatMap(c => c.files);
  const chunks: ExportChunk[] = [];
  const limit = (mergeToSingleFile || maxFilesPerChunk >= 100000) ? allFiles.length || 1 : maxFilesPerChunk;

  for (let i = 0; i < allFiles.length; i += limit) {
    chunks.push({
      id: Math.floor(i / limit) + 1,
      files: allFiles.slice(i, i + limit)
    });
  }

  return {
    chunks,
    treeMarkdown: graph.treeMarkdown,
    manifestFileName: graph.manifestFileName,
    metrics: {
      excluded: 0,
      treeOnly: 0,
      size: graph.totalSize,
      trueSize: graph.totalTrueSize,
      tokens: graph.totalTokens
    },
    mergeToSingleFile,
    embedProtocol,
    isWhitelistMode
  };
}