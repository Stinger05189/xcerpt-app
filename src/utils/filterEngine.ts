// src/utils/filterEngine.ts
import ignore from 'ignore';

export type FileStatus = 'included' | 'excluded' | 'tree-only';

export function getFileStatus(
  relativePath: string,
  isDirectory: boolean,
  includes: string[],
  excludes: string[],
  treeOnly: string[]
): FileStatus {
  const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  if (cleanPath === '') return 'included';

  const pathToCheck = isDirectory && !cleanPath.endsWith('/') ? `${cleanPath}/` : cleanPath;

  // 1. Exclusions (Overrides everything)
  if (excludes.length > 0) {
    const igExclude = ignore().add(excludes);
    if (igExclude.ignores(pathToCheck)) return 'excluded';
  }

  // 2. Tree-Only (Overrides included files)
  if (treeOnly.length > 0) {
    const igTree = ignore().add(treeOnly);
    // Directories are just visual wrappers; if a directory matches tree-only, we treat it as tree-only
    // but ultimately it's the file type that determines if it gets written to disk.
    if (igTree.ignores(pathToCheck)) return 'tree-only';
  }

  // 3. Inclusions
  if (includes.length > 0) {
    const igInclude = ignore().add(includes);
    if (isDirectory) return 'included';
    if (!igInclude.ignores(pathToCheck)) return 'excluded'; 
  }

  return 'included';
}