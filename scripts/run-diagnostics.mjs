// scripts/run-diagnostics.mjs
import { performance } from 'node:perf_hooks';
import ignore from 'ignore';

function canonicalizePath(p) {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = normalized[0].toUpperCase() + normalized.slice(1);
  }
  return normalized.replace(/\/+$/, '');
}

function normalizePath(p) {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function toScopedPathKey(rootId, relativePath) {
  return `${canonicalizePath(rootId)}::${normalizePath(relativePath)}`;
}

function isScopedKey(key) {
  return typeof key === 'string' && key.includes('::');
}

function parseScopedPathKey(key) {
  const idx = key.indexOf('::');
  if (idx === -1) return { rootId: '', relativePath: normalizePath(key) };
  return {
    rootId: canonicalizePath(key.slice(0, idx)),
    relativePath: normalizePath(key.slice(idx + 2)),
  };
}

function hasGlobWildcards(str) {
  return /[*?[\]{}]/.test(str);
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

class ScopedRuleIndex {
  constructor(includes = [], excludes = [], treeOnly = []) {
    this.excludeExact = new Set();
    this.treeOnlyExact = new Set();
    this.includeExact = new Set();

    this.excludeDirPrefixSet = new Set();
    this.treeOnlyDirPrefixSet = new Set();

    this.excludeIgnores = new Map();
    this.treeOnlyIgnores = new Map();
    this.includeIgnores = new Map();

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
        const { rootId, relativePath } = parseScopedPathKey(rule);
        const canonicalRoot = canonicalizePath(rootId);
        const canonicalKey = `${canonicalRoot}::${relativePath}`;
        exactSet.add(canonicalKey);

        const isDir = relativePath.endsWith('/');
        if (isDir) {
          exactSet.add(canonicalKey.slice(0, -1));
          if (dirPrefixSet) {
            dirPrefixSet.add(canonicalKey);
          }
        } else {
          exactSet.add(`${canonicalKey}/`);
        }

        if (hasGlobWildcards(relativePath) && rulesByRoot) {
          const list = rulesByRoot.get(canonicalRoot) || [];
          list.push(relativePath);
          rulesByRoot.set(canonicalRoot, list);
        }
      } else {
        const cleanRel = normalizePath(rule);
        const isDir = rule.endsWith('/') || cleanRel.endsWith('/');
        if (dirPrefixSet && isDir) {
          const prefix = cleanRel.endsWith('/') ? cleanRel : `${cleanRel}/`;
          dirPrefixSet.add(`*::${prefix}`);
        }

        if (hasGlobWildcards(cleanRel) && rulesByRoot) {
          const list = rulesByRoot.get('*') || [];
          list.push(cleanRel);
          rulesByRoot.set('*', list);
        }
      }
    };

    excludes.forEach(e => processRule(e, this.excludeExact, this.excludeDirPrefixSet, rootExcludesMap));
    treeOnly.forEach(t => processRule(t, this.treeOnlyExact, this.treeOnlyDirPrefixSet, rootTreeOnlyMap));
    includes.forEach(i => {
      processRule(i, this.includeExact, null, rootIncludesMap);
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
    if (globalIncludes.length > 0) {
      this.includeIgnores.set('*', ignore().add(globalIncludes));
    }
  }

  getStatus(rootId, relativePath, isDirectory) {
    const cleanRel = normalizePath(relativePath);
    if (cleanRel === '') return 'included';

    const canonicalRoot = canonicalizePath(rootId);
    const scopedKey = `${canonicalRoot}::${cleanRel}`;
    const pathToCheck = isDirectory && !cleanRel.endsWith('/') ? `${cleanRel}/` : cleanRel;

    // 1. Explicit child inclusion takes priority
    if (this.includeExact.has(scopedKey)) {
      return 'included';
    }

    // 2. Direct exact match in excludes
    if (this.excludeExact.has(scopedKey) || this.excludeExact.has(`${scopedKey}/`)) {
      return 'excluded';
    }

    // 3. Fast O(depth) ancestor prefix lookup via Set
    let slashIdx = cleanRel.indexOf('/');
    while (slashIdx !== -1) {
      const ancestor = cleanRel.slice(0, slashIdx + 1);
      const ancestorKey = `${canonicalRoot}::${ancestor}`;
      if (this.excludeDirPrefixSet.has(ancestorKey) || this.excludeDirPrefixSet.has(`*::${ancestor}`)) {
        return 'excluded';
      }
      slashIdx = cleanRel.indexOf('/', slashIdx + 1);
    }

    // 4. Glob pattern fallback (only evaluated if wildcards exist)
    const igExclude = this.excludeIgnores.get(canonicalRoot) || this.excludeIgnores.get('*');
    if (igExclude && igExclude.ignores(pathToCheck)) {
      return 'excluded';
    }

    // 5. Tree-only checks
    if (this.treeOnlyExact.has(scopedKey) || this.treeOnlyExact.has(`${scopedKey}/`)) {
      return 'tree-only';
    }
    slashIdx = cleanRel.indexOf('/');
    while (slashIdx !== -1) {
      const ancestor = cleanRel.slice(0, slashIdx + 1);
      const ancestorKey = `${canonicalRoot}::${ancestor}`;
      if (this.treeOnlyDirPrefixSet.has(ancestorKey) || this.treeOnlyDirPrefixSet.has(`*::${ancestor}`)) {
        return 'tree-only';
      }
      slashIdx = cleanRel.indexOf('/', slashIdx + 1);
    }
    const igTree = this.treeOnlyIgnores.get(canonicalRoot) || this.treeOnlyIgnores.get('*');
    if (igTree && igTree.ignores(pathToCheck)) {
      return 'tree-only';
    }

    // 6. Whitelist Inclusions Check
    const hasInc = this.rootHasInclusions.get(canonicalRoot) || this.rootHasInclusions.get('*');
    if (hasInc) {
      if (isDirectory) return 'included';
      const igInc = this.includeIgnores.get(canonicalRoot) || this.includeIgnores.get('*');
      if (igInc && !igInc.ignores(pathToCheck)) {
        return 'excluded';
      }
      if (!igInc && !this.includeExact.has(scopedKey)) {
        return 'excluded';
      }
    }

    return 'included';
  }
}

console.log('\n' + '='.repeat(70));
console.log('  XCEPT v1.6.0 ENGINE DIAGNOSTICS & PERFORMANCE BENCHMARK');
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

// --- SUITE 1: FOLDER EXCLUSION INHERITANCE ---
console.log('\x1b[36m--- Suite 1: Folder Exclude & Tree-Only Inheritance ---\x1b[0m');
{
  const rootWindows = 'C:\\Projects\\MyApp';
  const rootPosix = 'C:/Projects/MyApp';

  const excludes = [
    toScopedPathKey(rootWindows, 'src/components/'),
    toScopedPathKey(rootPosix, 'dist/'),
  ];
  const treeOnly = [
    toScopedPathKey(rootPosix, 'docs/specs/')
  ];

  const index = new ScopedRuleIndex([], excludes, treeOnly);

  assert(index.getStatus(rootWindows, 'src/components', true) === 'excluded', 'Direct folder match with Windows backslash root');
  assert(index.getStatus(rootWindows, 'src/components/Button.tsx', false) === 'excluded', 'Child file inherits folder exclusion');
  assert(index.getStatus(rootPosix, 'src/components/sub/DeepNested.tsx', false) === 'excluded', 'Deep descendant inherits folder exclusion');
  assert(index.getStatus(rootWindows, 'docs/specs/spec.md', false) === 'tree-only', 'Child file inherits tree-only directory status');
  assert(index.getStatus(rootWindows, 'src/App.tsx', false) === 'included', 'Sibling file outside excluded folder remains included');

  // Test explicit child inclusion overriding parent exclusion
  const withInclusion = new ScopedRuleIndex(
    [toScopedPathKey(rootWindows, 'src/components/SpecialIncluded.tsx')],
    excludes,
    treeOnly
  );
  assert(withInclusion.getStatus(rootWindows, 'src/components/SpecialIncluded.tsx', false) === 'included', 'Explicit child inclusion overrides parent folder exclusion');
}

// --- SUITE 2: RULE COMPACTION (PREVENTING HUGE SIDEBAR LISTS) ---
console.log('\n\x1b[36m--- Suite 2: Rule Compaction & Pruning Test ---\x1b[0m');
{
  const root = 'C:/Projects/MyApp';
  const uncompacted = [
    toScopedPathKey(root, 'src/components/'),
    toScopedPathKey(root, 'src/components/Button.tsx'),
    toScopedPathKey(root, 'src/components/Header.tsx'),
    toScopedPathKey(root, 'src/components/sub/Nav.tsx'),
    toScopedPathKey(root, 'src/utils/api.ts'),
  ];

  const compacted = compactRules(uncompacted);

  assert(compacted.length === 2, `Compacted 5 rules down to 2 (got ${compacted.length})`);
  assert(compacted.includes(toScopedPathKey(root, 'src/components/')), 'Preserved ancestor directory rule');
  assert(compacted.includes(toScopedPathKey(root, 'src/utils/api.ts')), 'Preserved independent file rule');
  assert(!compacted.includes(toScopedPathKey(root, 'src/components/Button.tsx')), 'Pruned redundant child file rule');
}

// --- SUITE 3: HIGH-THROUGHPUT O(depth) BENCHMARK (< 25ms SLA) ---
console.log('\n\x1b[36m--- Suite 3: 10,000-Node Throughput Benchmark (O(depth) Ancestor Lookups) ---\x1b[0m');
{
  const root = 'C:/Projects/MassiveRepo';
  const ruleCount = 100;
  const nodeCount = 10000;

  const mockExcludes = [];
  for (let i = 0; i < ruleCount; i++) {
    mockExcludes.push(toScopedPathKey(root, `vendor/pkg_${i}/`));
  }
  mockExcludes.push(toScopedPathKey(root, 'node_modules/'));
  mockExcludes.push(toScopedPathKey(root, 'build/'));

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
  console.log(`  Duration:  \x1b[32m${duration.toFixed(2)} ms\x1b[0m`);
  console.log(`  Velocity:  \x1b[32m${opsPerSec.toLocaleString()} ops/sec\x1b[0m`);

  assert(duration < 25, `Throughput SLA met (< 25ms for 10,000 nodes; got ${duration.toFixed(2)}ms)`);
  assert(excludedCount > 0, `Correctly filtered excluded nodes (count: ${excludedCount})`);
}

console.log('\n' + '='.repeat(70));
console.log(`  DIAGNOSTIC SUMMARY: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[${failCount > 0 ? '31' : '32'}m${failCount} FAILED\x1b[0m`);
console.log('='.repeat(70) + '\n');

if (failCount > 0) process.exit(1);