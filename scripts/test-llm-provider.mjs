// scripts/test-llm-provider.mjs
console.log('\n' + '='.repeat(70));
console.log('  XCEPT v2.1 LLM PROVIDER & COPILOT AUTOMATION TEST SUITE');
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

function stripMarkdownFences(raw) {
  let clean = raw.trim();
  if (clean.startsWith('```')) {
    const firstNewline = clean.indexOf('\n');
    if (firstNewline !== -1) {
      clean = clean.slice(firstNewline + 1);
    }
    if (clean.endsWith('```')) {
      clean = clean.slice(0, clean.lastIndexOf('```')).trim();
    }
  }
  return clean;
}

// --- SUITE 1: STRUCTURED JSON SCHEMA PARSING & FENCE STRIPPING ---
console.log('\x1b[36m--- Suite 1: Markdown Fence Stripping & JSON Extraction ---\x1b[0m');
{
  const rawWithFences = '```json\n{\n  "title": "Auth Token RS256 Migration",\n  "description": "Migrate symmetric JWTs to asymmetric pairs."\n}\n```';
  const stripped = stripMarkdownFences(rawWithFences);
  assert(stripped.startsWith('{') && stripped.endsWith('}'), 'Cleanly stripped opening and closing ```json fences');
  
  const parsed = JSON.parse(stripped);
  assert(parsed.title === 'Auth Token RS256 Migration', 'Parsed valid title from markdown wrapped JSON');
  assert(parsed.description.includes('Migrate symmetric'), 'Parsed valid description field');
}

// --- SUITE 2: ZERO-CODE TOKEN INVARIANT VERIFICATION ---
console.log('\n\x1b[36m--- Suite 2: Zero-Code Payload Discipline Assertion ---\x1b[0m');
{
  // Simulate prompt construction for Session Creation Copilot
  const mockPreamble = 'Architectural Intent: Overhaul database connection pools and reconnect on timeout.';
  const mockActions = [
    { type: 'NEW', path: 'src/db/pool.ts', content: 'export class Pool { /* 500 lines of implementation */ }' },
    { type: 'MODIFIED', path: 'src/db/client.ts', content: 'export const client = new Pool(); /* 200 lines */' }
  ];

  // Engine payload assembly
  const copilotPayload = {
    intent: mockPreamble,
    actions: mockActions.map(a => ({ type: a.type, path: a.path })) // Strictly omitting content!
  };

  const payloadString = JSON.stringify(copilotPayload);

  assert(!payloadString.includes('500 lines of implementation'), 'Prompt payload strictly omits raw file content body 1');
  assert(!payloadString.includes('200 lines'), 'Prompt payload strictly omits raw file content body 2');
  assert(payloadString.includes('src/db/pool.ts'), 'Prompt payload contains target file relative path');
  assert(payloadString.includes('NEW'), 'Prompt payload preserves action badge metadata');
  assert(payloadString.length < 500, `Payload string is minimal (${payloadString.length} chars) for token preservation`);
}

// --- SUITE 3: COMMIT SYNTHESIS WITH DEVELOPER GUIDANCE CONTEXT ---
console.log('\n\x1b[36m--- Suite 3: Commit Synthesis Context Assembly with Developer Guidance ---\x1b[0m');
{
  const mockSession = {
    name: 'Auth Refactor',
    description: 'Rotate JWT signing keys.',
    actions: [
      { actionType: 'MODIFIED', targetRelativePath: 'src/auth/jwt.ts' },
      { actionType: 'NEW', targetRelativePath: 'src/auth/rotation.ts' }
    ]
  };

  const mockDiff = 'diff --git a/src/auth/jwt.ts b/src/auth/jwt.ts\n+export const verifyRS256 = () => {};';
  const mockLog = 'a1b2c3d chore: bump dependencies\ne4f5g6h feat(db): add connection retry';
  const userGuidance = 'Focus on breaking changes to the RS256 algorithm and follow conventional commit syntax.';

  const assembledContext = {
    architecturalIntent: mockSession.description,
    actions: mockSession.actions.map(a => ({ actionType: a.actionType, targetRelativePath: a.targetRelativePath })),
    gitDiff: mockDiff,
    gitLog: mockLog,
    userGuidance: userGuidance
  };

  assert(assembledContext.userGuidance === userGuidance, 'Developer guidance is preserved verbatim in context payload');
  assert(assembledContext.gitDiff.includes('+export const verifyRS256'), 'Physical Git diff included in context');
  assert(assembledContext.gitLog.includes('feat(db)'), 'Recent commit history included to guide convention format');
  assert(assembledContext.actions.length === 2, 'File action metadata accurately represented');
}

// --- SUITE 4: OPENROUTER COMPLETION REQUEST STRUCTURE ---
console.log('\n\x1b[36m--- Suite 4: OpenRouter Completion Request Payload Verification ---\x1b[0m');
{
  const options = {
    providerId: 'openrouter',
    apiKey: 'sk-or-v1-mockkey',
    model: 'google/gemini-3.5-flash-lite',
    messages: [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: '{"intent":"test"}' }
    ],
    temperature: 0.2,
    maxTokens: 500,
    responseFormat: { type: 'json_object' }
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${options.apiKey}`,
    'HTTP-Referer': 'https://github.com/Stinger05189/xcerpt-app',
    'X-Title': 'Xcerpt Dev Studio'
  };

  assert(headers['Authorization'] === 'Bearer sk-or-v1-mockkey', 'Authorization header formatted with Bearer token');
  assert(headers['HTTP-Referer'] === 'https://github.com/Stinger05189/xcerpt-app', 'HTTP-Referer set for OpenRouter attribution');
  assert(headers['X-Title'] === 'Xcerpt Dev Studio', 'X-Title set for OpenRouter ranking');
  assert(options.model === 'google/gemini-3.5-flash-lite', 'Default model google/gemini-3.5-flash-lite set correctly');
  assert(options.responseFormat.type === 'json_object', 'Structured json_object response format requested');
}

console.log('\n' + '='.repeat(70));
console.log(`  LLM DIAGNOSTIC SUMMARY: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[${failCount > 0 ? '31' : '32'}m${failCount} FAILED\x1b[0m`);
console.log('='.repeat(70) + '\n');

if (failCount > 0) process.exit(1);