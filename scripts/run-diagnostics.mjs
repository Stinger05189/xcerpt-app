// scripts/run-diagnostics.mjs
import { performance } from 'node:perf_hooks';
import ignore from 'ignore';

function canonicalizePath(p) {
  if (!p) return '';
  let normalized = p.includes('\\') ? p.replace(/\\/g, '/') : p;
  const code0 = normalized.charCodeAt(0);
  if (code0 >= 97 && code0 <= 122 && normalized.charCodeAt(1) === 58) {
    normalized = String.fromCharCode(code0 - 32) + normalized.slice(1);
  }
  normalized = normalized.replace(/\/+/g, '/');
  const len = normalized.length;
  if (len > 0 && normalized.charCodeAt(len - 1) === 47) {
    normalized = normalized.replace(/\/+$/, '');
  }
  return normalized;
}

function normalizePath(pathStr, isDirectory) {
  if (!pathStr) return '';
  let clean = pathStr.includes('\\') ? pathStr.replace(/\\/g, '/') : pathStr;
  clean = clean.replace(/\/+/g, '/');
  if (clean.charCodeAt(0) === 47) {
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

function toScopedPathKey(rootId, relativePath, isDirectory) {
  const cleanRoot = canonicalizePath(rootId);
  const cleanRelative = normalizePath(relativePath, isDirectory);
  return `${cleanRoot}::${cleanRelative}`;
}

function isScopedKey(key) {
  return typeof key === 'string' && key.includes('::');
}

function parseScopedPathKey(key) {
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

function hasGlobWildcards(str) {
  return /[*?[\]{}]/.test(str);
}

function migrateLegacyRules(rules, rootPaths) {
  if (!rules || rules.length === 0) return [];
  const normalizedRoots = rootPaths.map(r => canonicalizePath(r)).filter(Boolean);
  const result = new Set();

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

function compactRules(rules) {
  if (!rules || rules.length <= 1) return rules || [];

  const scopedByRoot = new Map();
  const globalRules = [];

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

  const pruneList = (pathList) => {
    const dirPrefixes = new Set();
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

  const compacted = [];
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

function isNodeSelected(root, relativePath, isDir, selectedSet) {
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

function hasSelectedDescendant(root, node, currentRel, selectedSet) {
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

function generateExclusionsForSelection(rootPaths, rawTrees, selectedSet) {
  const exclusions = [];

  for (const root of rootPaths) {
    const tree = rawTrees[root];
    if (!tree || !tree.children) continue;

    const walk = (node, currentRel) => {
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
          exclusions.push(toScopedPathKey(root, cleanRel, false));
        }
      }
    };

    walk(tree, '');
  }

  return compactRules(exclusions);
}

class ScopedRuleIndex {
  constructor(includes = [], excludes = [], treeOnly = [], isWhitelistMode = false) {
    this.excludeExact = new Set();
    this.treeOnlyExact = new Set();
    this.includeExact = new Set();

    this.excludeDirPrefixSet = new Set();
    this.treeOnlyDirPrefixSet = new Set();
    this.includeDirPrefixSet = new Set();

    this.excludeIgnores = new Map();
    this.treeOnlyIgnores = new Map();
    this.includeIgnores = new Map();

    this.isWhitelistMode = isWhitelistMode;
    this.rootHasInclusions = new Map();

    this.build(includes, excludes, treeOnly);
  }

  build(includes, excludes, treeOnly) {
    const rootExcludesMap = new Map();
    const rootTreeOnlyMap = new Map();
    const rootIncludesMap = new Map();

    const processRule = (rule, exactSet, dirPrefixSet, rulesByRoot) => {
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

  getStatus(rootId, relativePath, isDirectory) {
    const cleanRel = isDirectory
      ? normalizePath(relativePath, true)
      : normalizePath(relativePath, false);

    if (cleanRel === '') return 'included';

    const canonicalRoot = canonicalizePath(rootId);
    const rootPrefix = canonicalRoot + '::';
    const scopedKey = rootPrefix + cleanRel;
    const globalKey = '*::' + cleanRel;

    // 1. Exact match for target path takes ABSOLUTE HIGHEST priority
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

    // 4. Whitelist Mode Check
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

function calculateTrueSize(fileSizeBytes, totalLines, skippedLines) {
  if (totalLines <= 0 || fileSizeBytes <= 0) return fileSizeBytes;
  const remainingLines = Math.max(0, totalLines - skippedLines);
  return Math.round(fileSizeBytes * (remainingLines / totalLines));
}

function runMockExportGraph(rootPath, tree, includes, excludes, treeOnly, compressions = {}) {
  const ruleIndex = new ScopedRuleIndex(includes, excludes, treeOnly, false);
  const virtualNodes = [];
  const exportFiles = [];
  let totalSize = 0;
  let totalTrueSize = 0;

  const buildNode = (node, relativePath) => {
    const isDir = node.type === 'directory';
    const cleanRelative = normalizePath(relativePath, isDir);
    const scopedKey = toScopedPathKey(rootPath, cleanRelative, isDir);
    const status = ruleIndex.getStatus(rootPath, cleanRelative, isDir);

    const fileComps = compressions[scopedKey] || compressions[cleanRelative] || [];
    const skippedLines = fileComps.reduce((sum, c) => sum + (c.lineCount || 0), 0);
    const estimatedTotalLines = Math.max(1, Math.round(node.size / 40));
    const trueSize = isDir ? 0 : calculateTrueSize(node.size, estimatedTotalLines, skippedLines);
    const tokens = isDir ? 0 : Math.round(trueSize / 4);

    if (isDir) {
      const childNodes = [];
      if (node.children) {
        for (const child of node.children) {
          const childRel = cleanRelative ? `${cleanRelative}${child.name}` : child.name;
          const builtChild = buildNode(child, childRel);
          if (builtChild) childNodes.push(builtChild);
        }
      }

      return {
        id: scopedKey,
        relativePath: cleanRelative,
        scopedKey,
        isDirectory: true,
        status,
        children: childNodes
      };
    }

    const isIncluded = status === 'included';
    if (isIncluded) {
      totalSize += node.size;
      totalTrueSize += trueSize;
      const cleanRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
      exportFiles.push({
        absolutePath: `${cleanRoot}/${cleanRelative}`,
        relativePath: cleanRelative,
        compressions: fileComps,
        size: node.size,
        trueSize,
        tokens
      });
    }

    return {
      id: scopedKey,
      relativePath: cleanRelative,
      scopedKey,
      isDirectory: false,
      status,
      skipCount: fileComps.length,
      skippedLines
    };
  };

  const rootVirtualNode = buildNode(tree, '');
  if (rootVirtualNode) virtualNodes.push(rootVirtualNode);

  const joinChild = (parentRel, childName) => {
    if (!parentRel) return childName;
    return parentRel.endsWith('/') ? `${parentRel}${childName}` : `${parentRel}/${childName}`;
  };

  const renderMarkdownTree = (node, prefix, isLast, relPath) => {
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
      out += `MyApp/\n`;
    } else if (isDir) {
      out += `${prefix}${connector}${collapsedName}/\n`;
    } else {
      if (status === 'tree-only') {
        out += `${prefix}${connector}${collapsedName} [-]\n`;
      } else {
        const fileComps = compressions[toScopedPathKey(rootPath, currRel, false)] || compressions[currRel] || [];
        const compStr = fileComps.length > 0 ? ` [${fileComps.length} skips]` : '';
        out += `${prefix}${connector}${collapsedName}${compStr}\n`;
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

  const treeMarkdown = renderMarkdownTree(tree, '', true, '');
  const savedBytes = Math.max(0, totalSize - totalTrueSize);

  return {
    nodes: virtualNodes,
    exportFiles,
    treeMarkdown,
    savedBytes
  };
}

console.log('\n' + '='.repeat(70));
console.log('  XCEPT v1.6.1 DIAGNOSTICS & THROUGHPUT SLA BENCHMARK');
console.log('='.repeat(70) + '\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [\x1b[32mPASS\x1b[0m] ${message}`);
    passCount++;
  } else {
    console.error(`  [\x1b[31mFAIL\x1b[0m] ${message}`);
    failCount++;
  }
}

// --- SUITE 1: FOLDER EXCLUSION & INHERITANCE ---
console.log('\x1b[36m--- Suite 1: Folder Exclude & Tree-Only Inheritance ---\x1b[0m');
{
  const rootWindows = 'C:\\Projects\\MyApp';
  const rootPosix = 'C:/Projects/MyApp';

  const excludes = [
    toScopedPathKey(rootWindows, 'src/components/', true),
    toScopedPathKey(rootPosix, 'dist/', true),
  ];
  const treeOnly = [
    toScopedPathKey(rootPosix, 'docs/specs/', true)
  ];

  const index = new ScopedRuleIndex([], excludes, treeOnly);

  assert(index.getStatus(rootWindows, 'src/components/', true) === 'excluded', 'Direct folder match with Windows backslash root');
  assert(index.getStatus(rootWindows, 'src/components/Button.tsx', false) === 'excluded', 'Child file inherits folder exclusion');
  assert(index.getStatus(rootPosix, 'src/components/sub/DeepNested.tsx', false) === 'excluded', 'Deep descendant inherits folder exclusion');
  assert(index.getStatus(rootWindows, 'docs/specs/spec.md', false) === 'tree-only', 'Child file inherits tree-only directory status');
  assert(index.getStatus(rootWindows, 'src/App.tsx', false) === 'included', 'Sibling file outside excluded folder remains included');
}

// --- SUITE 2: INCLUSION PUNCH-THROUGH WITHOUT WHITELIST INVERSION ---
console.log('\n\x1b[36m--- Suite 2: Inclusion Punch-Throughs without Inverting Workspace ---\x1b[0m');
{
  const root = 'C:/Projects/MyApp';
  const excludes = [toScopedPathKey(root, 'src/legacy/', true)];
  const includes = [toScopedPathKey(root, 'src/legacy/Keeper.tsx', false)];

  const indexDefault = new ScopedRuleIndex(includes, excludes, [], false);
  assert(indexDefault.getStatus(root, 'src/legacy/Keeper.tsx', false) === 'included', 'Included child punches through excluded ancestor directory');
  assert(indexDefault.getStatus(root, 'src/legacy/Old.tsx', false) === 'excluded', 'Other children in excluded ancestor remain excluded');
  assert(indexDefault.getStatus(root, 'src/main.tsx', false) === 'included', 'Untouched sibling outside excluded folder remains included (No whitelist trap)');
}

// --- SUITE 3: RE-INCLUDE FOLDER THEN CHILD TREE-ONLY SPECIFICITY ---
console.log('\n\x1b[36m--- Suite 3: Folder Tree-Only -> Re-Include -> Child Tree-Only Override ---\x1b[0m');
{
  const root = 'C:/Projects/MyApp';
  
  const initialTreeOnly = [toScopedPathKey(root, 'src/components/', true)];
  const indexStep1 = new ScopedRuleIndex([], [], initialTreeOnly, false);
  assert(indexStep1.getStatus(root, 'src/components/', true) === 'tree-only', 'Folder is tree-only');
  assert(indexStep1.getStatus(root, 'src/components/Button.tsx', false) === 'tree-only', 'Child file inherits tree-only');

  const reIncluded = [toScopedPathKey(root, 'src/components/', true)];
  const indexStep2 = new ScopedRuleIndex(reIncluded, [], [], false);
  assert(indexStep2.getStatus(root, 'src/components/', true) === 'included', 'Folder re-included');
  assert(indexStep2.getStatus(root, 'src/components/Button.tsx', false) === 'included', 'Child file is included');

  const childTreeOnly = [toScopedPathKey(root, 'src/components/Button.tsx', false)];
  const indexStep3 = new ScopedRuleIndex(reIncluded, [], childTreeOnly, false);
  assert(indexStep3.getStatus(root, 'src/components/Button.tsx', false) === 'tree-only', 'Child file is tree-only despite parent inclusion');
  assert(indexStep3.getStatus(root, 'src/components/Header.tsx', false) === 'included', 'Sibling file remains included under parent');

  const subFolderTreeOnly = [
    toScopedPathKey(root, 'src/components/Button.tsx', false),
    toScopedPathKey(root, 'src/components/sub/', true)
  ];
  const indexStep4 = new ScopedRuleIndex(reIncluded, [], subFolderTreeOnly, false);
  assert(indexStep4.getStatus(root, 'src/components/sub/Deep.tsx', false) === 'tree-only', 'Subfolder child inherits subfolder tree-only over parent inclusion');
}

// --- SUITE 4: LEGACY UNSCOPED RULE MIGRATION ---
console.log('\n\x1b[36m--- Suite 4: Legacy Unscoped Rule Migration & Ghost Rule Prevention ---\x1b[0m');
{
  const roots = ['C:/RepoA', 'D:/RepoB'];
  const legacyRules = ['src/components/', 'package.json'];

  const migrated = migrateLegacyRules(legacyRules, roots);
  assert(migrated.length === 4, `Promoted 2 unscoped rules across 2 roots into 4 scoped rules (got ${migrated.length})`);
  assert(migrated.includes('C:/RepoA::src/components/'), 'Emitted canonical scoped dir key with trailing slash for Root A');
  assert(migrated.includes('D:/RepoB::package.json'), 'Emitted canonical scoped file key without trailing slash for Root B');

  const parsed = parseScopedPathKey('C:/RepoA::src/components/');
  assert(parsed.isDirectory === true, 'Parsed directory invariant correctly identified');
  assert(parsed.relativePath === 'src/components/', 'Parsed canonical POSIX path retained trailing slash');
}

// --- SUITE 5: RULE COMPACTION ---
console.log('\n\x1b[36m--- Suite 5: Rule Compaction & Pruning Test ---\x1b[0m');
{
  const root = 'C:/Projects/MyApp';
  const uncompacted = [
    toScopedPathKey(root, 'src/components/', true),
    toScopedPathKey(root, 'src/components/Button.tsx', false),
    toScopedPathKey(root, 'src/components/Header.tsx', false),
    toScopedPathKey(root, 'src/components/sub/Nav.tsx', false),
    toScopedPathKey(root, 'src/utils/api.ts', false),
  ];

  const compacted = compactRules(uncompacted);
  assert(compacted.length === 2, `Compacted 5 rules down to 2 (got ${compacted.length})`);
  assert(compacted.includes(toScopedPathKey(root, 'src/components/', true)), 'Preserved ancestor directory rule');
  assert(compacted.includes(toScopedPathKey(root, 'src/utils/api.ts', false)), 'Preserved independent file rule');
}

// --- SUITE 6: HIGH-THROUGHPUT O(depth) BENCHMARK (< 25ms SLA) ---
console.log('\n\x1b[36m--- Suite 6: 10,000-Node Throughput Benchmark (O(depth) Ancestor Lookups) ---\x1b[0m');
{
  const root = 'C:/Projects/MassiveRepo';
  const ruleCount = 100;
  const nodeCount = 10000;

  const mockExcludes = [];
  for (let i = 0; i < ruleCount; i++) {
    mockExcludes.push(toScopedPathKey(root, `vendor/pkg_${i}/`, true));
  }
  mockExcludes.push(toScopedPathKey(root, 'node_modules/', true));
  mockExcludes.push(toScopedPathKey(root, 'build/', true));

  const index = new ScopedRuleIndex([], mockExcludes, []);

  const testPaths = [];
  for (let i = 0; i < nodeCount; i++) {
    if (i % 3 === 0) testPaths.push({ path: `vendor/pkg_${i % ruleCount}/lib/file_${i}.ts`, isDir: false });
    else if (i % 5 === 0) testPaths.push({ path: `node_modules/dep_${i}/index.js`, isDir: false });
    else testPaths.push({ path: `src/feature_${i % 20}/component_${i}.tsx`, isDir: false });
  }

  const start = performance.now();
  let excludedCount = 0;
  for (let i = 0; i < nodeCount; i++) {
    const item = testPaths[i];
    const status = index.getStatus(root, item.path, item.isDir);
    if (status === 'excluded') excludedCount++;
  }
  const duration = performance.now() - start;
  const opsPerSec = Math.round((nodeCount / duration) * 1000);

  console.log(`  Processed: \x1b[33m${nodeCount.toLocaleString()} nodes\x1b[0m against \x1b[33m${ruleCount} rules\x1b[0m`);
  console.log(`  Duration:  \x1b[32m${duration.toFixed(2)} ms\x1b[0m (Target: < 25.00 ms)`);
  console.log(`  Velocity:  \x1b[32m${opsPerSec.toLocaleString()} ops/sec\x1b[0m`);

  assert(duration < 25, `Throughput SLA met (< 25ms for 10,000 nodes; got ${duration.toFixed(2)}ms)`);
  assert(excludedCount > 0, `Correctly filtered excluded nodes (count: ${excludedCount})`);
}

// --- SUITE 7: CREATE PRESET FROM SELECTION EXCLUSION SYNTHESIS ---
console.log('\n\x1b[36m--- Suite 7: Create Preset from Selection Exclusion Synthesis ---\x1b[0m');
{
  const root = 'C:/Projects/MyApp';
  const mockTree = {
    path: root,
    name: 'MyApp',
    type: 'directory',
    size: 0,
    children: [
      {
        path: `${root}/src`,
        name: 'src',
        type: 'directory',
        size: 0,
        children: [
          {
            path: `${root}/src/components`,
            name: 'components',
            type: 'directory',
            size: 0,
            children: [
              { path: `${root}/src/components/Button.tsx`, name: 'Button.tsx', type: 'file', size: 100, children: [] },
              { path: `${root}/src/components/Header.tsx`, name: 'Header.tsx', type: 'file', size: 200, children: [] },
            ]
          },
          {
            path: `${root}/src/utils`,
            name: 'utils',
            type: 'directory',
            size: 0,
            children: [
              { path: `${root}/src/utils/api.ts`, name: 'api.ts', type: 'file', size: 300, children: [] }
            ]
          }
        ]
      },
      {
        path: `${root}/docs`,
        name: 'docs',
        type: 'directory',
        size: 0,
        children: [
          { path: `${root}/docs/readme.md`, name: 'readme.md', type: 'file', size: 400, children: [] }
        ]
      },
      { path: `${root}/package.json`, name: 'package.json', type: 'file', size: 50, children: [] }
    ]
  };

  const selectedSet = new Set([toScopedPathKey(root, 'src/components/Button.tsx', false)]);
  const generatedExclusions = generateExclusionsForSelection([root], { [root]: mockTree }, selectedSet);

  assert(generatedExclusions.includes(toScopedPathKey(root, 'docs/', true)), 'Entire unselected docs/ folder is excluded at folder level');
  assert(generatedExclusions.includes(toScopedPathKey(root, 'package.json', false)), 'Unselected package.json file is excluded');
  assert(generatedExclusions.includes(toScopedPathKey(root, 'src/utils/', true)), 'Entire unselected src/utils/ folder is excluded at folder level');
  assert(generatedExclusions.includes(toScopedPathKey(root, 'src/components/Header.tsx', false)), 'Unselected sibling Header.tsx is excluded');
  assert(!generatedExclusions.includes(toScopedPathKey(root, 'src/components/Button.tsx', false)), 'Selected Button.tsx is NOT excluded');

  const presetIndex = new ScopedRuleIndex([], generatedExclusions, [], false);
  assert(presetIndex.getStatus(root, 'src/components/Button.tsx', false) === 'included', 'Selected Button.tsx evaluates to included');
  assert(presetIndex.getStatus(root, 'src/components/Header.tsx', false) === 'excluded', 'Unselected Header.tsx evaluates to excluded');
  assert(presetIndex.getStatus(root, 'docs/readme.md', false) === 'excluded', 'Descendant of unselected docs/ evaluates to excluded');
  assert(presetIndex.getStatus(root, 'package.json', false) === 'excluded', 'Unselected package.json evaluates to excluded');
}

// --- SUITE 8: EXPORT ENGINE TRAVERSAL & PATH NORMALIZATION ---
console.log('\n\x1b[36m--- Suite 8: Export Engine Traversal & Path Normalization ---\x1b[0m');
{
  const root = 'C:/Projects/MyApp';
  const mockTree = {
    path: root,
    name: 'MyApp',
    type: 'directory',
    size: 0,
    children: [
      {
        path: `${root}/src`,
        name: 'src',
        type: 'directory',
        size: 0,
        children: [
          {
            path: `${root}/src/components`,
            name: 'components',
            type: 'directory',
            size: 0,
            children: [
              {
                path: `${root}/src/components/sub`,
                name: 'sub',
                type: 'directory',
                size: 0,
                children: [
                  { path: `${root}/src/components/sub/DeepButton.tsx`, name: 'DeepButton.tsx', type: 'file', size: 1000, children: [] }
                ]
              },
              { path: `${root}/src/components/Header.tsx`, name: 'Header.tsx', type: 'file', size: 500, children: [] }
            ]
          }
        ]
      },
      {
        path: `${root}/docs`,
        name: 'docs',
        type: 'directory',
        size: 0,
        children: [
          {
            path: `${root}/docs/specs`,
            name: 'specs',
            type: 'directory',
            size: 0,
            children: [
              { path: `${root}/docs/specs/spec.md`, name: 'spec.md', type: 'file', size: 400, children: [] }
            ]
          }
        ]
      },
      {
        path: `${root}/build`,
        name: 'build',
        type: 'directory',
        size: 0,
        children: [
          { path: `${root}/build/bundle.js`, name: 'bundle.js', type: 'file', size: 5000, children: [] }
        ]
      }
    ]
  };

  const deepButtonScopedKey = toScopedPathKey(root, 'src/components/sub/DeepButton.tsx', false);
  const specScopedKey = toScopedPathKey(root, 'docs/specs/spec.md', false);
  const buildScopedKey = toScopedPathKey(root, 'build/', true);

  const compressions = {
    [deepButtonScopedKey]: [
      { id: 'c1', startLine: 10, endLine: 20, lineCount: 11, signature: 'export const DeepButton = () => {' }
    ]
  };

  const treeOnlyRules = [specScopedKey];
  const excludeRules = [buildScopedKey];

  const graph = runMockExportGraph(root, mockTree, [], excludeRules, treeOnlyRules, compressions);

  // 1. Assert zero double slashes in any node's relativePath
  const checkPaths = (nodes) => {
    for (const n of nodes) {
      assert(!n.relativePath.includes('//'), `Node relativePath contains no double slashes: "${n.relativePath}"`);
      if (n.children) checkPaths(n.children);
    }
  };
  checkPaths(graph.nodes);

  // 2. Assert zero double slashes in exportFiles
  for (const f of graph.exportFiles) {
    assert(!f.relativePath.includes('//'), `Export file relativePath has no double slashes: "${f.relativePath}"`);
    assert(!f.absolutePath.includes('//'), `Export file absolutePath has no double slashes: "${f.absolutePath}"`);
  }

  // 3. Assert compressions key matched accurately on deepButton
  const exportedButton = graph.exportFiles.find(f => f.relativePath === 'src/components/sub/DeepButton.tsx');
  assert(Boolean(exportedButton), 'DeepButton.tsx is present in exportFiles');
  assert(exportedButton.compressions.length === 1, 'DeepButton.tsx matched compression rule via canonical scoped key');
  assert(graph.savedBytes > 0, `Saved bytes successfully computed from skips: ${graph.savedBytes} B`);

  // 4. Assert tree-only file is omitted from exportFiles but rendered in treeMarkdown with [-]
  const exportedSpec = graph.exportFiles.find(f => f.relativePath === 'docs/specs/spec.md');
  assert(!exportedSpec, 'docs/specs/spec.md is strictly omitted from exportFiles (tree-only)');
  assert(graph.treeMarkdown.includes('spec.md [-]'), 'docs/specs/spec.md is rendered with [-] badge in markdown tree');

  // 5. Assert excluded file and directory are omitted from both exportFiles and treeMarkdown
  const exportedBundle = graph.exportFiles.find(f => f.relativePath.includes('bundle.js'));
  assert(!exportedBundle, 'build/bundle.js is strictly omitted from exportFiles (excluded directory)');
  assert(!graph.treeMarkdown.includes('bundle.js'), 'build/bundle.js is omitted from markdown file tree');
  assert(!graph.treeMarkdown.includes('build/'), 'build/ folder is omitted from markdown file tree');
}

console.log('\n' + '='.repeat(70));
console.log(`  DIAGNOSTIC SUMMARY: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[${failCount > 0 ? '31' : '32'}m${failCount} FAILED\x1b[0m`);
console.log('='.repeat(70) + '\n');

if (failCount > 0) process.exit(1);