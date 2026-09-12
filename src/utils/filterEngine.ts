// src/utils/filterEngine.ts
import ignore from 'ignore';
import type { ScopedPathKey, FileNode } from '../types/ipc';

export type FileStatus = 'included' | 'excluded' | 'tree-only';

export function canonicalizePath(p: string): string {
  if (!p) return '';
  let normalized = p.includes('\\') ? p.replace(/\\/g, '/') : p;
  const code0 = normalized.charCodeAt(0);
  if (code0 >= 97 && code0 <= 122 && normalized.charCodeAt(1) === 58 /* ':' */) {
    normalized = String.fromCharCode(code0 - 32) + normalized.slice(1);
  }
  normalized = normalized.replace(/\/+/g, '/');
  const len = normalized.length;
  if (len > 0 && normalized.charCodeAt(len - 1) === 47 /* '/' */) {
    normalized = normalized.replace(/\/+$/, '');
  }
  return normalized;
}

export function normalizePath(pathStr: string, isDirectory?: boolean): string {
  if (!pathStr) return '';
  let clean = pathStr.includes('\\') ? pathStr.replace(/\\/g, '/') : pathStr;
  clean = clean.replace(/\/+/g, '/');
  if (clean.charCodeAt(0) === 47 /* '/' */) {
    clean = clean.replace(/^\/+/, '');
  }
  const len = clean.length;
  if (len === 0) return '';

  const endsWithSlash = clean.charCodeAt(len - 1) === 47;
  if (isDirectory === true) {
    return endsWithSlash ? clean : clean + '/';
  }
  if (isDirectory === false) {
    return endsWithSlash ? clean.slice(0, -1) : clean;
  }
  return clean;
}

export function toScopedPathKey(rootId: string, relativePath: string, isDirectory?: boolean): ScopedPathKey {
  const cleanRoot = canonicalizePath(rootId);
  const cleanRelative = normalizePath(relativePath, isDirectory);
  return `${cleanRoot}::${cleanRelative}`;
}

export function isScopedKey(key: string): key is ScopedPathKey {
  return typeof key === 'string' && key.includes('::');
}

export function parseScopedPathKey(key: string): { rootId: string; relativePath: string; isDirectory: boolean } {
  const idx = key.indexOf('::');
  if (idx === -1) {
    const clean = normalizePath(key);
    return { rootId: '', relativePath: clean, isDirectory: clean.endsWith('/') };
  }
  const rootId = canonicalizePath(key.slice(0, idx));
  const relativePath = normalizePath(key.slice(idx + 2));
  return {
    rootId,
    relativePath,
    isDirectory: relativePath.endsWith('/')
  };
}

export function hasGlobWildcards(str: string): boolean {
  return /[*?[\]{}]/.test(str);
}

export function migrateLegacyRules(rules: string[], rootPaths: string[]): string[] {
  if (!rules || rules.length === 0) return [];
  const normalizedRoots = rootPaths.map(r => canonicalizePath(r)).filter(Boolean);
  const result = new Set<string>();

  for (const rule of rules) {
    if (!rule) continue;
    if (isScopedKey(rule)) {
      const { rootId, relativePath, isDirectory } = parseScopedPathKey(rule);
      result.add(toScopedPathKey(rootId, relativePath, isDirectory));
    } else {
      const isDir = rule.endsWith('/') || !rule.includes('.');
      const cleanRel = normalizePath(rule, isDir);
      if (normalizedRoots.length > 0) {
        for (const root of normalizedRoots) {
          result.add(toScopedPathKey(root, cleanRel, isDir));
        }
      } else {
        result.add(`*::${cleanRel}`);
      }
    }
  }

  return Array.from(result);
}

export function compactRules(rules: string[]): string[] {
  if (!rules || rules.length <= 1) return rules || [];

  const scopedByRoot = new Map<string, string[]>();
  const globalRules: string[] = [];

  for (const rule of rules) {
    if (!rule) continue;
    if (isScopedKey(rule)) {
      const { rootId, relativePath } = parseScopedPathKey(rule);
      const list = scopedByRoot.get(rootId) || [];
      list.push(relativePath);
      scopedByRoot.set(rootId, list);
    } else {
      globalRules.push(normalizePath(rule));
    }
  }

  const pruneList = (pathList: string[]): string[] => {
    const dirPrefixes = new Set<string>();
    for (const p of pathList) {
      if (p.endsWith('/')) {
        dirPrefixes.add(p);
      }
    }

    return pathList.filter(p => {
      let slashIdx = p.indexOf('/');
      while (slashIdx !== -1) {
        const ancestor = p.slice(0, slashIdx + 1);
        if (ancestor !== p && dirPrefixes.has(ancestor)) {
          return false;
        }
        slashIdx = p.indexOf('/', slashIdx + 1);
      }
      return true;
    });
  };

  const compacted: string[] = [];
  for (const [rootId, pathList] of scopedByRoot.entries()) {
    const pruned = pruneList(pathList);
    for (const p of pruned) {
      compacted.push(`${rootId}::${p}`);
    }
  }

  const prunedGlobals = pruneList(globalRules);
  compacted.push(...prunedGlobals);

  return compacted;
}

export function isNodeSelected(
  root: string,
  relativePath: string,
  isDir: boolean,
  selectedSet: Set<string>
): boolean {
  const cleanRel = normalizePath(relativePath, isDir);
  const scopedKey = toScopedPathKey(root, cleanRel, isDir);
  const globalKey = `*::${cleanRel}`;

  if (selectedSet.has(scopedKey) || selectedSet.has(globalKey) || selectedSet.has(cleanRel)) {
    return true;
  }

  const altRel = isDir ? cleanRel.slice(0, -1) : `${cleanRel}/`;
  if (
    selectedSet.has(toScopedPathKey(root, altRel, !isDir)) ||
    selectedSet.has(`*::${altRel}`) ||
    selectedSet.has(altRel)
  ) {
    return true;
  }

  // Check if an ancestor folder was selected
  let slashIdx = cleanRel.lastIndexOf('/', isDir ? cleanRel.length - 2 : cleanRel.length - 1);
  while (slashIdx !== -1) {
    const ancestor = cleanRel.slice(0, slashIdx + 1);
    if (
      selectedSet.has(toScopedPathKey(root, ancestor, true)) ||
      selectedSet.has(`*::${ancestor}`) ||
      selectedSet.has(ancestor)
    ) {
      return true;
    }
    slashIdx = cleanRel.lastIndexOf('/', slashIdx - 1);
  }

  return false;
}

export function hasSelectedDescendant(
  root: string,
  node: FileNode,
  currentRel: string,
  selectedSet: Set<string>
): boolean {
  const isDir = node.type === 'directory';
  const cleanRel = normalizePath(currentRel, isDir);

  if (isNodeSelected(root, cleanRel, isDir, selectedSet)) {
    return true;
  }

  if (isDir && node.children) {
    for (const child of node.children) {
      const childRel = cleanRel ? `${cleanRel}${child.name}` : child.name;
      if (hasSelectedDescendant(root, child, childRel, selectedSet)) {
        return true;
      }
    }
  }

  return false;
}

export function generateExclusionsForSelection(
  rootPaths: string[],
  rawTrees: Record<string, FileNode>,
  selectedSet: Set<string>
): string[] {
  const exclusions: string[] = [];

  for (const root of rootPaths) {
    const tree = rawTrees[root];
    if (!tree || !tree.children) continue;

    const walk = (node: FileNode, currentRel: string) => {
      const isDir = node.type === 'directory';
      const cleanRel = normalizePath(currentRel, isDir);
      if (cleanRel === '') {
        if (node.children) {
          for (const child of node.children) {
            walk(child, child.name);
          }
        }
        return;
      }

      if (isDir) {
        if (!hasSelectedDescendant(root, node, cleanRel, selectedSet)) {
          // Entire folder contains zero selections: exclude as a single directory rule
          exclusions.push(toScopedPathKey(root, cleanRel, true));
          return;
        }

        if (node.children) {
          for (const child of node.children) {
            const childRel = `${cleanRel}${child.name}`;
            walk(child, childRel);
          }
        }
      } else {
        if (!isNodeSelected(root, cleanRel, false, selectedSet)) {
          // File is not selected: exclude it
          exclusions.push(toScopedPathKey(root, cleanRel, false));
        }
      }
    };

    walk(tree, '');
  }

  return compactRules(exclusions);
}

export class ScopedRuleIndex {
  private excludeExact = new Set<string>();
  private treeOnlyExact = new Set<string>();
  private includeExact = new Set<string>();

  private excludeDirPrefixSet = new Set<string>();
  private treeOnlyDirPrefixSet = new Set<string>();
  private includeDirPrefixSet = new Set<string>();

  private excludeIgnores = new Map<string, ReturnType<typeof ignore>>();
  private treeOnlyIgnores = new Map<string, ReturnType<typeof ignore>>();
  private includeIgnores = new Map<string, ReturnType<typeof ignore>>();

  private isWhitelistMode: boolean;
  private rootHasInclusions = new Map<string, boolean>();

  constructor(
    includes: string[] = [],
    excludes: string[] = [],
    treeOnly: string[] = [],
    isWhitelistMode: boolean = false
  ) {
    this.isWhitelistMode = isWhitelistMode;
    this.build(includes, excludes, treeOnly);
  }

  private build(includes: string[], excludes: string[], treeOnly: string[]) {
    const rootExcludesMap = new Map<string, string[]>();
    const rootTreeOnlyMap = new Map<string, string[]>();
    const rootIncludesMap = new Map<string, string[]>();

    const processRule = (
      rule: string,
      exactSet: Set<string>,
      dirPrefixSet: Set<string>,
      rulesByRoot: Map<string, string[]>
    ) => {
      if (!rule) return;
      if (isScopedKey(rule)) {
        const { rootId, relativePath, isDirectory } = parseScopedPathKey(rule);
        const canonicalRoot = canonicalizePath(rootId);
        const canonicalKey = `${canonicalRoot}::${relativePath}`;
        exactSet.add(canonicalKey);

        if (isDirectory) {
          exactSet.add(canonicalKey.slice(0, -1));
          dirPrefixSet.add(canonicalKey);
        } else {
          exactSet.add(`${canonicalKey}/`);
        }

        if (hasGlobWildcards(relativePath)) {
          const list = rulesByRoot.get(canonicalRoot) || [];
          list.push(relativePath);
          rulesByRoot.set(canonicalRoot, list);
        }
      } else {
        const isDir = rule.endsWith('/');
        const cleanRel = normalizePath(rule, isDir);
        const globalKey = `*::${cleanRel}`;
        exactSet.add(globalKey);

        if (isDir) {
          exactSet.add(globalKey.slice(0, -1));
          dirPrefixSet.add(globalKey);
        } else {
          exactSet.add(`${globalKey}/`);
        }

        if (hasGlobWildcards(cleanRel)) {
          const list = rulesByRoot.get('*') || [];
          list.push(cleanRel);
          rulesByRoot.set('*', list);
        }
      }
    };

    excludes.forEach(e => processRule(e, this.excludeExact, this.excludeDirPrefixSet, rootExcludesMap));
    treeOnly.forEach(t => processRule(t, this.treeOnlyExact, this.treeOnlyDirPrefixSet, rootTreeOnlyMap));
    includes.forEach(i => {
      processRule(i, this.includeExact, this.includeDirPrefixSet, rootIncludesMap);
      if (isScopedKey(i)) {
        this.rootHasInclusions.set(canonicalizePath(parseScopedPathKey(i).rootId), true);
      } else {
        this.rootHasInclusions.set('*', true);
      }
    });

    const allRoots = new Set([
      ...rootExcludesMap.keys(),
      ...rootTreeOnlyMap.keys(),
      ...rootIncludesMap.keys()
    ]);

    const globalExcludes = rootExcludesMap.get('*') || [];
    const globalTreeOnly = rootTreeOnlyMap.get('*') || [];
    const globalIncludes = rootIncludesMap.get('*') || [];

    allRoots.forEach(root => {
      if (root === '*') return;
      const ex = [...globalExcludes, ...(rootExcludesMap.get(root) || [])];
      if (ex.length > 0) this.excludeIgnores.set(root, ignore().add(ex));

      const to = [...globalTreeOnly, ...(rootTreeOnlyMap.get(root) || [])];
      if (to.length > 0) this.treeOnlyIgnores.set(root, ignore().add(to));

      const inc = [...globalIncludes, ...(rootIncludesMap.get(root) || [])];
      if (inc.length > 0) {
        this.includeIgnores.set(root, ignore().add(inc));
      }
    });

    if (globalExcludes.length > 0) this.excludeIgnores.set('*', ignore().add(globalExcludes));
    if (globalTreeOnly.length > 0) this.treeOnlyIgnores.set('*', ignore().add(globalTreeOnly));
    if (globalIncludes.length > 0) this.includeIgnores.set('*', ignore().add(globalIncludes));
  }

  public getStatus(
    rootId: string,
    relativePath: string,
    isDirectory: boolean
  ): FileStatus {
    const cleanRel = isDirectory
      ? normalizePath(relativePath, true)
      : normalizePath(relativePath, false);

    if (cleanRel === '') return 'included';

    const canonicalRoot = canonicalizePath(rootId);
    const rootPrefix = canonicalRoot + '::';
    const scopedKey = rootPrefix + cleanRel;
    const globalKey = '*::' + cleanRel;

    // 1. Exact match on target path takes ABSOLUTE HIGHEST priority (Overrides all ancestors)
    if (this.includeExact.has(scopedKey) || this.includeExact.has(globalKey)) {
      return 'included';
    }
    if (this.treeOnlyExact.has(scopedKey) || this.treeOnlyExact.has(globalKey)) {
      return 'tree-only';
    }
    if (this.excludeExact.has(scopedKey) || this.excludeExact.has(globalKey)) {
      return 'excluded';
    }

    // 2. Hierarchical Ancestor Lookups (Bottom-up: Deepest/closest ancestor wins)
    if (this.excludeDirPrefixSet.size > 0 || this.treeOnlyDirPrefixSet.size > 0 || this.includeDirPrefixSet.size > 0) {
      let slashIdx = cleanRel.lastIndexOf('/', isDirectory ? cleanRel.length - 2 : cleanRel.length - 1);
      while (slashIdx !== -1) {
        const ancestor = cleanRel.slice(0, slashIdx + 1);
        const scopedAncestor = rootPrefix + ancestor;
        const globalAncestor = '*::' + ancestor;

        if (this.includeDirPrefixSet.has(scopedAncestor) || this.includeDirPrefixSet.has(globalAncestor)) {
          return 'included';
        }
        if (this.treeOnlyDirPrefixSet.has(scopedAncestor) || this.treeOnlyDirPrefixSet.has(globalAncestor)) {
          return 'tree-only';
        }
        if (this.excludeDirPrefixSet.has(scopedAncestor) || this.excludeDirPrefixSet.has(globalAncestor)) {
          return 'excluded';
        }

        slashIdx = cleanRel.lastIndexOf('/', slashIdx - 1);
      }
    }

    // 3. Glob/Regex pattern fallback
    const igTree = this.treeOnlyIgnores.get(canonicalRoot) || this.treeOnlyIgnores.get('*');
    if (igTree && igTree.ignores(cleanRel)) {
      return 'tree-only';
    }
    const igExclude = this.excludeIgnores.get(canonicalRoot) || this.excludeIgnores.get('*');
    if (igExclude && igExclude.ignores(cleanRel)) {
      return 'excluded';
    }

    // 4. Whitelist Mode Check (Strict Curation Presets only)
    if (this.isWhitelistMode) {
      if (isDirectory) return 'included';
      const igInc = this.includeIgnores.get(canonicalRoot) || this.includeIgnores.get('*');
      if (igInc && igInc.ignores(cleanRel)) {
        return 'included';
      }
      return 'excluded';
    }

    return 'included';
  }
}

export function getScopedFileStatus(
  rootId: string,
  relativePath: string,
  isDirectory: boolean,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  isWhitelistMode: boolean = false
): FileStatus {
  const index = new ScopedRuleIndex(includes, excludes, treeOnly, isWhitelistMode);
  return index.getStatus(rootId, relativePath, isDirectory);
}

export function getFileStatus(
  relativePath: string,
  isDirectory: boolean,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  isWhitelistMode: boolean = false
): FileStatus {
  return getScopedFileStatus('*', relativePath, isDirectory, includes, excludes, treeOnly, isWhitelistMode);
}