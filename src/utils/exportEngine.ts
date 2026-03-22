// src/utils/exportEngine.ts
import type { FileNode, ExportPayload, ExportFile } from '../types/ipc';
import type { CompressionRule } from '../store/workspaceStore';
import { getFileStatus } from './filterEngine';

export function generateExportPayload(
  rootPaths: string[],
  rawTrees: Record<string, FileNode>,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  compressions: Record<string, CompressionRule[]>,
  maxFilesPerChunk: number
): ExportPayload {
  const exportFiles: ExportFile[] = [];
  let mdTree = "# Exported Workspace Context\n\n## File Tree\n```text\n";

  rootPaths.forEach(rootPath => {
    const tree = rawTrees[rootPath];
    if (!tree) return;
    
    const rootName = rootPath.split(/[/\\]/).pop() || 'root';
    
    const traverse = (node: FileNode, prefix: string, isLast: boolean, relativePath: string): string => {
      const isDir = node.type === 'directory';
      const status = getFileStatus(relativePath, isDir, includes, excludes, treeOnly);
      
      if (status === 'excluded') return "";
    
      let result = "";
      const connector = isLast ? "└── " : "├── ";
      const newPrefix = prefix + (isLast ? "    " : "│   ");
    
      if (relativePath === "") {
        result += `${node.name}/\n`;
      } else {
        if (isDir) {
          result += `${prefix}${connector}${node.name}/\n`;
        } else {
          // If tree-only, document it in the Markdown but do not add to physical payload
          if (status === 'tree-only') {
            result += `${prefix}${connector}${node.name} [Content Omitted]\n`;
          } else {
            const fileRelative = relativePath;
            const flatFileName = `${rootName}_${fileRelative.replace(/[/\\]/g, '_')}`;
            const fileComps = compressions[fileRelative] || [];
            
            exportFiles.push({
              absolutePath: `${rootPath}/${fileRelative}`.replace(/\\/g, '/'),
              relativePath: `${rootName}/${fileRelative}`,
              flatFileName,
              compressions: fileComps
            });
            
            const compCount = fileComps.length;
            const compStr = compCount > 0 ? ` *[${compCount} skips]*` : "";
            result += `${prefix}${connector}${node.name} (Exported as ${flatFileName})${compStr}\n`;
          }
        }
      }
    
      if (isDir && node.children) {
        const includedChildren = node.children.filter(c => {
          const childRel = relativePath ? `${relativePath}/${c.name}` : c.name;
          return getFileStatus(childRel, c.type === 'directory', includes, excludes, treeOnly) !== 'excluded';
        });
        
        includedChildren.forEach((child, index) => {
          const childRel = relativePath ? `${relativePath}/${child.name}` : child.name;
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

  return { chunks, treeMarkdown: mdTree };
}