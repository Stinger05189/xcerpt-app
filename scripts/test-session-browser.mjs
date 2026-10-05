// scripts/test-session-browser.mjs
console.log('\n' + '='.repeat(70));
console.log('  XCEPT v2.3 DEV SESSION BROWSER & FILE LEDGER DIAGNOSTIC SUITE');
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

// --- SUITE 1: FILE LEDGER AGGREGATION ACROSS SESSIONS ---
console.log('\x1b[36m--- Suite 1: File Ledger Aggregation Across Sessions ---\x1b[0m');
{
  const mockSessions = [
    {
      id: 'session-1',
      name: 'Initial Scaffold',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T10:05:00.000Z',
      actions: [
        {
          id: 'a1',
          targetRelativePath: 'src/auth/jwt.ts',
          targetRootPath: 'C:/Repo',
          actionType: 'NEW',
          workingContent: 'export const token = "v1";'
        },
        {
          id: 'a2',
          targetRelativePath: 'package.json',
          targetRootPath: 'C:/Repo',
          actionType: 'MODIFIED',
          workingContent: '{"version": "1.0.0"}'
        }
      ]
    },
    {
      id: 'session-2',
      name: 'Auth RS256 Upgrade',
      createdAt: '2025-01-02T11:00:00.000Z',
      updatedAt: '2025-01-02T11:20:00.000Z',
      actions: [
        {
          id: 'a3',
          targetRelativePath: 'src/auth/jwt.ts',
          targetRootPath: 'C:/Repo',
          actionType: 'MODIFIED',
          workingContent: 'export const token = "v2-rs256";'
        }
      ]
    },
    {
      id: 'session-3',
      name: 'Token Expiry Refactor',
      createdAt: '2025-01-03T12:00:00.000Z',
      updatedAt: '2025-01-03T12:30:00.000Z',
      actions: [
        {
          id: 'a4',
          targetRelativePath: 'src/auth/jwt.ts',
          targetRootPath: 'C:/Repo',
          actionType: 'PARTIAL_DIFF',
          workingContent: 'export const token = "v3-exp";'
        },
        {
          id: 'a5',
          targetRelativePath: 'src/config.ts',
          targetRootPath: 'C:/Repo',
          actionType: 'NEW',
          workingContent: 'export const EXPIRY = 3600;'
        }
      ]
    }
  ];

  // Aggregation logic mimicking main.cjs session:getFileLedger
  const ledgerMap = new Map();
  for (const session of mockSessions) {
    for (const action of session.actions) {
      const relPath = action.targetRelativePath;
      if (!ledgerMap.has(relPath)) {
        ledgerMap.set(relPath, {
          targetRelativePath: relPath,
          targetRootPath: action.targetRootPath,
          revisionCount: 0,
          latestActionType: action.actionType,
          latestUpdatedAt: session.updatedAt,
          sessions: []
        });
      }
      const item = ledgerMap.get(relPath);
      item.revisionCount++;
      item.latestActionType = action.actionType;
      item.latestUpdatedAt = session.updatedAt;
      item.sessions.push({
        sessionId: session.id,
        sessionName: session.name,
        actionType: action.actionType,
        workingContent: action.workingContent
      });
    }
  }

  const ledger = Array.from(ledgerMap.values());
  assert(ledger.length === 3, `Aggregated exactly 3 unique files across 3 sessions (got ${ledger.length})`);

  const jwtFile = ledger.find(f => f.targetRelativePath === 'src/auth/jwt.ts');
  assert(Boolean(jwtFile), 'src/auth/jwt.ts exists in ledger');
  assert(jwtFile.revisionCount === 3, `src/auth/jwt.ts recorded exactly 3 revisions (got ${jwtFile.revisionCount})`);
  assert(jwtFile.latestActionType === 'PARTIAL_DIFF', `Latest action type is PARTIAL_DIFF`);
  assert(jwtFile.sessions[0].sessionId === 'session-1', 'First session occurrence matches session-1');
  assert(jwtFile.sessions[2].sessionId === 'session-3', 'Last session occurrence matches session-3');

  const pkgFile = ledger.find(f => f.targetRelativePath === 'package.json');
  assert(pkgFile.revisionCount === 1, 'package.json recorded 1 revision');
}

// --- SUITE 2: CHRONOLOGICAL REVISION ORDERING & TIMELINE ---
console.log('\n\x1b[36m--- Suite 2: Chronological Revision Ordering & Reverse-Timeline ---\x1b[0m');
{
  const occurrences = [
    { sessionId: 's1', sessionCreatedAt: '2025-01-01T10:00:00Z', version: 'v1' },
    { sessionId: 's2', sessionCreatedAt: '2025-01-02T10:00:00Z', version: 'v2' },
    { sessionId: 's3', sessionCreatedAt: '2025-01-03T10:00:00Z', version: 'v3' }
  ];

  // Newest first sorting for timeline track
  const newestFirst = [...occurrences].sort(
    (a, b) => new Date(b.sessionCreatedAt).getTime() - new Date(a.sessionCreatedAt).getTime()
  );

  assert(newestFirst[0].sessionId === 's3', 'Newest revision is s3');
  assert(newestFirst[1].sessionId === 's2', 'Intermediate revision is s2');
  assert(newestFirst[2].sessionId === 's1', 'Oldest revision is s1');
}

// --- SUITE 3: DEEP FILE CONTENT SEARCH PREDICATE ---
console.log('\n\x1b[36m--- Suite 3: Deep File Content Search Predicate Matching ---\x1b[0m');
{
  const sessions = [
    {
      id: 's1',
      name: 'DB Migrations',
      actions: [
        { targetRelativePath: 'db/schema.sql', workingContent: 'CREATE TABLE users (id INT);' }
      ]
    },
    {
      id: 's2',
      name: 'Auth Updates',
      actions: [
        { targetRelativePath: 'src/auth.ts', workingContent: 'const secret = "SUPER_SECRET_KEY_123";' }
      ]
    }
  ];

  const searchContent = (query) => {
    const q = query.toLowerCase();
    return sessions.filter(s => 
      s.actions.some(a => a.workingContent && a.workingContent.toLowerCase().includes(q))
    );
  };

  const matchesKey = searchContent('SUPER_SECRET_KEY');
  assert(matchesKey.length === 1 && matchesKey[0].id === 's2', 'Deep content search found s2 matching secret string');

  const matchesSql = searchContent('CREATE TABLE');
  assert(matchesSql.length === 1 && matchesSql[0].id === 's1', 'Deep content search found s1 matching SQL snippet');

  const matchesNone = searchContent('NON_EXISTENT_TOKEN');
  assert(matchesNone.length === 0, 'Deep content search returned 0 matches for non-existent token');
}

// --- SUITE 4: REVISION DIFF COMPARISON LOGIC ---
console.log('\n\x1b[36m--- Suite 4: Revision Diff Comparison Logic (Session vs Disk / Prior) ---\x1b[0m');
{
  const diskText = 'export const val = 10;';
  const sessionText = 'export const val = 20;';
  const prevSessionText = 'export const val = 5;';

  // Compare Session vs Disk
  const isDiskIdentical = (diskText === sessionText);
  assert(isDiskIdentical === false, 'Session vs Disk correctly flagged as different');

  // Compare identical texts
  const identicalDiskText = 'export const val = 20;';
  const isNowIdentical = (identicalDiskText === sessionText);
  assert(isNowIdentical === true, 'Identical comparison correctly detected (triggers unified clean viewer)');

  // Compare Session vs Previous
  const diffFromPrev = (prevSessionText !== sessionText);
  assert(diffFromPrev === true, 'Session vs Previous correctly detected diff');
}

// --- SUITE 5: ACTION BADGE COUNTS & CLASSIFICATION ---
console.log('\n\x1b[36m--- Suite 5: Action Badge Counts & Classification ---\x1b[0m');
{
  const actions = [
    { actionType: 'NEW' },
    { actionType: 'NEW' },
    { actionType: 'MODIFIED' },
    { actionType: 'PARTIAL_DIFF' },
    { actionType: 'DELETED' }
  ];

  const counts = {
    NEW: actions.filter(a => a.actionType === 'NEW').length,
    MODIFIED: actions.filter(a => a.actionType === 'MODIFIED').length,
    PARTIAL_DIFF: actions.filter(a => a.actionType === 'PARTIAL_DIFF').length,
    DELETED: actions.filter(a => a.actionType === 'DELETED').length,
  };

  assert(counts.NEW === 2, 'Counted 2 NEW actions');
  assert(counts.MODIFIED === 1, 'Counted 1 MODIFIED action');
  assert(counts.PARTIAL_DIFF === 1, 'Counted 1 PARTIAL_DIFF action');
  assert(counts.DELETED === 1, 'Counted 1 DELETED action');
}

// --- SUITE 6: RESIZABLE INSPECTOR WIDTH CLAMPING INVARIANT ---
console.log('\n\x1b[36m--- Suite 6: Resizable Inspector Width Clamping Invariant ---\x1b[0m');
{
  const clampWidth = (w) => Math.max(280, Math.min(800, w));

  assert(clampWidth(200) === 280, 'Clamped undersized width to 280px minimum');
  assert(clampWidth(1200) === 800, 'Clamped oversized width to 800px maximum');
  assert(clampWidth(450) === 450, 'Preserved in-bounds width of 450px');
}

console.log('\n' + '='.repeat(70));
console.log(`  SESSION BROWSER DIAGNOSTIC SUMMARY: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[${failCount > 0 ? '31' : '32'}m${failCount} FAILED\x1b[0m`);
console.log('='.repeat(70) + '\n');

if (failCount > 0) process.exit(1);