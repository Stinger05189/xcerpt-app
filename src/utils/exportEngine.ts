// src/utils/exportEngine.ts
import type { FileNode, ExportPayload, ExportFile } from '../types/ipc';
import type { CompressionRule } from '../store/workspaceStore';
import { getFileStatus } from './filterEngine';

export function generateEphemeralPayload(
  rootPath: string,
  tree: FileNode,
  selectedFiles: Set<string>,
  compressions: Record<string, CompressionRule[]>,
  extensionOverrides: Record<string, string>
) {
  const exportFiles: ExportFile[] = [];
  const rootName = rootPath.split(/[/\\]/).pop() || 'root';

  let mdTree = `# Ephemeral Quick Export\n\n> **Note:** This is a partial export containing only explicitly selected files.\n> (Exported as [filename]) : File extension was modified to bypass upload filters. Treat the file as its original type.\n\n## File Tree\n\`\`\`text\n`;

  const traverse = (node: FileNode, prefix: string, isLast: boolean, relativePath: string, isParentSelected: boolean): string => {
    const isDir = node.type === 'directory';
    const pattern = isDir ? (relativePath ? `${relativePath}/` : '') : relativePath;
    const isSelected = selectedFiles.has(pattern) || isParentSelected;
    
    // Fast-Fail: Pre-calculate if this branch has ANY selected descendants
    const hasSelectedDescendant = (n: FileNode, currRel: string, parentSel: boolean): boolean => {
      const dir = n.type === 'directory';
      const pat = dir ? (currRel ? `${currRel}/` : '') : currRel;
      const sel = selectedFiles.has(pat) || parentSel;
      if (!dir && sel) return true;
      if (n.children) {
        return n.children.some(c => hasSelectedDescendant(c, currRel ? `${currRel}/${c.name}` : c.name, sel));
      }
      return false;
    };
    
    if (!hasSelectedDescendant(node, relativePath, isParentSelected)) return "";
    
    let result = "";
    const connector = isLast ? "└── " : "├── ";
    const newPrefix = prefix + (isLast ? "    " : "│   ");
    
    if (relativePath === "") {
      result += `${node.name}/\n`;
    } else {
      if (isDir) {
        result += `${prefix}${connector}${node.name}/\n`;
      } else {
        if (isSelected) {
          let flatFileName = `${rootName}_${relativePath.replace(/[/\\]/g, '_')}`;
          let exportNote = "";
        
        for (const [orig, override] of Object.entries(extensionOverrides)) {
          if (flatFileName.endsWith(orig)) {
            flatFileName = flatFileName.slice(0, -orig.length) + override;
            exportNote = ` (Exported as ${flatFileName})`;
            break;
          }
        }
      
        const fileComps = compressions[relativePath] || [];
      
        exportFiles.push({
          absolutePath: `${rootPath}/${relativePath}`.replace(/\\/g, '/'),
          relativePath: `${rootName}/${relativePath}`,
          flatFileName,
          compressions: fileComps,
          size: node.size
        });
      
        const compCount = fileComps.length;
          const compStr = compCount > 0 ? ` [${compCount} skips]` : "";
          result += `${prefix}${connector}${node.name}${compStr}${exportNote}\n`;
        }
      }
    }
    
    if (isDir && node.children) {
      const relevantChildren = node.children.filter(c => {
        const childRel = relativePath ? `${relativePath}/${c.name}` : c.name;
        return hasSelectedDescendant(c, childRel, isSelected);
      });
    
      relevantChildren.forEach((child, index) => {
        const childRel = relativePath ? `${relativePath}/${child.name}` : child.name;
        result += traverse(
          child,
          relativePath === "" ? "" : newPrefix,
          index === relevantChildren.length - 1,
          childRel,
          isSelected
        );
      });
    }
    
    return result;
  };

  mdTree += traverse(tree, "", true, "", false);
  mdTree += "```\n";

  return { files: exportFiles, treeMarkdown: mdTree };
}

export function generateExportPayload(
  rootPaths: string[],
  rawTrees: Record<string, FileNode>,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  compressions: Record<string, CompressionRule[]>,
  maxFilesPerChunk: number,
  extensionOverrides: Record<string, string>
): ExportPayload {
  const exportFiles: ExportFile[] = [];
  const metrics = { excluded: 0, treeOnly: 0, size: 0, tokens: 0 };

  let mdTree = `# Exported Workspace Context

> **Mapping Rule:** The provided codebase has been flattened for export. A file's path corresponds to its exported filename by replacing slashes with underscores (e.g., \`src/utils/api.ts\` is exported as \`src_utils_api.ts\`).
> **Legend:**
> \`[-]\` : File is visible in the tree for structural context, but its contents were not exported.
> \`[X skips]\` : File was exported, but X sections of code were removed to save context.
> \`(Exported as [filename])\` : File extension was modified to bypass upload filters. Treat the file as its original type.

## File Tree
\`\`\`text
`;

  rootPaths.forEach(rootPath => {
    const tree = rawTrees[rootPath];
    if (!tree) return;
    
    const rootName = rootPath.split(/[/\\]/).pop() || 'root';
    
    const traverse = (node: FileNode, prefix: string, isLast: boolean, relativePath: string): string => {
      let currNode = node;
      let currRelative = relativePath;
      let isDir = currNode.type === 'directory';
      
      // Compute the included children for the current node
      let includedChildren = isDir && currNode.children ? currNode.children.filter(c => {
        const childRel = currRelative ? `${currRelative}/${c.name}` : c.name;
        return getFileStatus(childRel, c.type === 'directory', includes, excludes, treeOnly) !== 'excluded';
      }) : [];
    
      // --- The Single-Child Collapse Algorithm ---
      // If this is a directory and it only has EXACTLY ONE included child,
      // we fast-forward and collapse the names together (e.g., "src" + "utils" -> "src/utils")
      // We do not collapse the very root node (currRelative === "") to keep the top-level distinct.
      let collapsedName = currNode.name;
      
      while (isDir && includedChildren.length === 1 && currRelative !== "") {
        const singleChild = includedChildren[0];
        const childRel = currRelative ? `${currRelative}/${singleChild.name}` : singleChild.name;
        
        collapsedName += `/${singleChild.name}`;
        currNode = singleChild;
        currRelative = childRel;
        isDir = currNode.type === 'directory';
        
        if (isDir && currNode.children) {
          includedChildren = currNode.children.filter(c => {
            const nextChildRel = currRelative ? `${currRelative}/${c.name}` : c.name;
            return getFileStatus(nextChildRel, c.type === 'directory', includes, excludes, treeOnly) !== 'excluded';
          });
        } else {
          includedChildren = [];
        }
      }
      
      const status = getFileStatus(currRelative, isDir, includes, excludes, treeOnly);
      if (status === 'excluded') {
        if (!isDir) metrics.excluded++;
        return "";
      }
    
      let result = "";
      const connector = isLast ? "└── " : "├── ";
      const newPrefix = prefix + (isLast ? "    " : "│   ");
    
      // Root Node (Special Formatting)
      if (relativePath === "") {
        result += `${collapsedName}/\n`;
      } else {
        if (isDir) {
          result += `${prefix}${connector}${collapsedName}/\n`;
        } else {
          if (status === 'tree-only') {
            metrics.treeOnly++;
            result += `${prefix}${connector}${collapsedName} [-]\n`;
          } else {
            let flatFileName = `${rootName}_${currRelative.replace(/[/\\]/g, '_')}`;
            let exportNote = "";
            
            for (const [orig, override] of Object.entries(extensionOverrides)) {
              if (flatFileName.endsWith(orig)) {
                flatFileName = flatFileName.slice(0, -orig.length) + override;
                exportNote = ` (Exported as ${flatFileName})`;
                break;
              }
            }
            
            const fileComps = compressions[currRelative] || [];
            
            metrics.size += currNode.size;
            exportFiles.push({
              absolutePath: `${rootPath}/${currRelative}`.replace(/\\/g, '/'),
              relativePath: `${rootName}/${currRelative}`,
              flatFileName,
              compressions: fileComps,
              size: currNode.size
            });
            
            const compCount = fileComps.length;
            const compStr = compCount > 0 ? ` [${compCount} skips]` : "";
            
            result += `${prefix}${connector}${collapsedName}${compStr}${exportNote}\n`;
          }
        }
      }
    
      if (isDir && includedChildren.length > 0) {
        includedChildren.forEach((child, index) => {
          const childRel = currRelative ? `${currRelative}/${child.name}` : child.name;
          result += traverse(
            child, 
            relativePath === "" ? "" : newPrefix, 
            index === includedChildren.length - 1, 
            childRel
          );
        });
      }
    
      return result;
    };
    
    mdTree += traverse(tree, "", true, "");
  });

  mdTree += "```\n";

  const chunks = [];
  const limit = maxFilesPerChunk >= 100000 ? exportFiles.length || 1 : maxFilesPerChunk;

  for (let i = 0; i < exportFiles.length; i += limit) {
    chunks.push({
      id: (i / limit) + 1,
      files: exportFiles.slice(i, i + limit)
    });
  }

  metrics.tokens = Math.round(metrics.size / 4);

  return { chunks, treeMarkdown: mdTree, metrics };
}