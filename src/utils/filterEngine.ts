// src/utils/filterEngine.ts
import ignore from 'ignore';

/**
 * Translates the legacy Python FilterEngine to TypeScript.
 * Evaluates whether a file is included or excluded based on the current rules.
 */
export function getFileStatus(
  relativePath: string,
  isDirectory: boolean,
  includes: string[],
  excludes: string[]
): 'included' | 'excluded' {
  // Normalize path for the ignore package (forward slashes, no leading slash)
  const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  if (cleanPath === '') return 'included'; // Root is always included

  // Ensure directories end with a slash for accurate directory matching rules
  const pathToCheck = isDirectory && !cleanPath.endsWith('/') ? `${cleanPath}/` : cleanPath;

  // 1. Exclusions take precedence
  if (excludes.length > 0) {
    const igExclude = ignore().add(excludes);
    if (igExclude.ignores(pathToCheck)) {
      return 'excluded';
    }
  }

  // 2. Inclusions (If no includes are defined, everything not excluded is included)
  if (includes.length > 0) {
    const igInclude = ignore().add(includes);
    
    // For UI purposes, we tentatively include directories unless explicitly excluded.
    // Empty directories will be pruned during the actual export phase.
    if (isDirectory) return 'included';
    
    // If the ignore parser "ignores" it, that means it matched our include pattern.
    if (!igInclude.ignores(pathToCheck)) {
      return 'excluded'; 
    }
  }

  return 'included';
}