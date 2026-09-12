// scripts/test-session-parser.mjs
import { performance } from 'node:perf_hooks';

console.log('\n' + '='.repeat(70));
console.log('  XCEPT v2.0 DEV SESSION PARSER DIAGNOSTIC & SPEC COMPLIANCE SUITE');
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

// Fence builder constants preventing premature markdown code block termination
const B3 = '`' + '`' + '`';
const B4 = '`' + '`' + '`' + '`';

const PROTOCOL_HEADER_PATTERNS = [
  /^\s*\/\/\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s+[^\r\n]+/i,
  /^\s*#\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s+[^\r\n]+/i,
  /^\s*<!--\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s+.*-->/i,
  /^\s*--\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s+[^\r\n]+/i,
];

function stripProtocolScaffolding(rawCode, targetPath) {
  const lines = rawCode.split('\n');
  if (lines.length === 0) return rawCode;

  const firstNonEmptyIndex = lines.findIndex(l => l.trim().length > 0);
  if (firstNonEmptyIndex === -1) return rawCode;

  const candidateLine = lines[firstNonEmptyIndex].trim();
  let shouldStrip = PROTOCOL_HEADER_PATTERNS.some(pattern => pattern.test(candidateLine));

  if (!shouldStrip && targetPath) {
    const normalizedTarget = targetPath.replace(/\\/g, '/');
    const commentPrefixes = ['//', '#', '<!--', '--'];
    for (const cp of commentPrefixes) {
      if (candidateLine.startsWith(cp) && candidateLine.includes(normalizedTarget)) {
        shouldStrip = true;
        break;
      }
    }
  }

  if (shouldStrip) {
    lines.splice(firstNonEmptyIndex, 1);
    if (lines[firstNonEmptyIndex]?.trim() === '') {
      lines.splice(firstNonEmptyIndex, 1);
    }
  }

  return lines.join('\n');
}

function extractActionAndPath(firstLine, fenceInfo) {
  let actionType = null;
  let targetPath = null;

  const line = firstLine.trim();
  const protocolMatch = line.match(/\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*([^\s->]+)/i);
  if (protocolMatch) {
    actionType = protocolMatch[1].toUpperCase();
    targetPath = protocolMatch[2].replace(/[->]+$/, '').trim();
    return { actionType, targetPath };
  }

  const commentClean = line
    .replace(/^(\/\/|#|<!--|--)\s*/, '')
    .replace(/\s*(-->)$/, '')
    .trim();

  const pathCandidateMatch = commentClean.match(/^([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9_-]+)/);
  if (pathCandidateMatch) {
    targetPath = pathCandidateMatch[1].trim();
  }

  if (!targetPath && fenceInfo) {
    const infoClean = fenceInfo.replace(/^```+/, '').trim();
    const infoColon = infoClean.split(/[:\s]/);
    if (infoColon.length > 1 && infoColon[1].includes('.')) {
      targetPath = infoColon[1].trim();
    }
  }

  return { actionType, targetPath };
}

function parseSessionMarkdown(rawMarkdown, workspaceId, rootPaths, existingFilesMap = {}) {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const actions = [];
  const explanations = [];
  const pathCounts = {};

  let currentSectionTitle = 'Architectural Intent';
  let currentSectionLevel = 2;
  let currentSectionLines = [];

  let inCodeBlock = false;
  let codeFenceChar = '';
  let codeFenceLength = 0;
  let codeFenceInfo = '';
  let codeBuffer = [];

  const flushCurrentSection = (nextActionId) => {
    if (currentSectionLines.length > 0) {
      const sectionText = currentSectionLines.join('\n').trim();
      if (sectionText) {
        const lastSec = explanations[explanations.length - 1];
        if (lastSec && lastSec.title === currentSectionTitle && lastSec.level === currentSectionLevel) {
          lastSec.content += `\n\n${sectionText}`;
          if (nextActionId && !lastSec.associatedActionIds.includes(nextActionId)) {
            lastSec.associatedActionIds.push(nextActionId);
          }
        } else {
          explanations.push({
            id: `sec-${explanations.length + 1}`,
            title: currentSectionTitle,
            level: currentSectionLevel,
            content: sectionText,
            associatedActionIds: nextActionId ? [nextActionId] : []
          });
        }
      }
      currentSectionLines = [];
    }
  };

  const processCompletedCodeBlock = (rawLines, fenceInfo, warning) => {
    const rawPayloadContent = rawLines.join('\n');
    const firstNonEmpty = rawLines.find(l => l.trim().length > 0) || '';
    const { actionType: extractedAction, targetPath: extractedPath } = extractActionAndPath(firstNonEmpty, fenceInfo);

    let targetRelativePath = extractedPath || `unnamed_snippet_${actions.length + 1}.txt`;
    targetRelativePath = targetRelativePath.replace(/\\/g, '/').replace(/^\/+/, '');

    pathCounts[targetRelativePath] = (pathCounts[targetRelativePath] || 0) + 1;
    if (pathCounts[targetRelativePath] > 1) {
      const parts = targetRelativePath.split('.');
      if (parts.length > 1) {
        const ext = parts.pop();
        targetRelativePath = `${parts.join('.')}.Part${pathCounts[targetRelativePath]}.${ext}`;
      } else {
        targetRelativePath = `${targetRelativePath}.Part${pathCounts[targetRelativePath]}`;
      }
    }

    const defaultRoot = rootPaths[0] || '';
    let targetRoot = defaultRoot;
    for (const root of rootPaths) {
      const key = `${root}/${targetRelativePath}`.replace(/\\/g, '/');
      if (existingFilesMap[key] !== undefined) {
        targetRoot = root;
        break;
      }
    }

    const absKey = `${targetRoot}/${targetRelativePath}`.replace(/\\/g, '/');
    const originalContent = existingFilesMap[absKey] !== undefined ? existingFilesMap[absKey] : null;

    let actionType = extractedAction || (originalContent === null ? 'NEW' : 'MODIFIED');
    if (firstNonEmpty.includes('[DELETED]')) {
      actionType = 'DELETED';
    }

    const warnings = [];
    if (warning) warnings.push(warning);
    if (!extractedAction) {
      warnings.push(`Action tag omitted in response; inferred as [${actionType}].`);
    }

    const proposedContent = stripProtocolScaffolding(rawPayloadContent, targetRelativePath);

    const skipBlockMatches = proposedContent.match(/(\/\/|#|<!--|--)\s*\.\.\.\s*\[Skipped.*\]\s*\.\.\./gi);
    const skipBlockCount = skipBlockMatches ? skipBlockMatches.length : 0;
    const hasSkipBlocks = skipBlockCount > 0;

    const actionId = `act-${actions.length + 1}`;
    flushCurrentSection(actionId);

    actions.push({
      id: actionId,
      targetRootPath: targetRoot,
      targetRelativePath,
      actionType,
      reviewStatus: 'PENDING',
      originalContent,
      proposedContent,
      rawPayloadContent,
      hunks: [],
      hasSkipBlocks,
      skipBlockCount,
      parseWarnings: warnings,
      orderIndex: actions.length
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^([`~]{3,})(.*)$/);

    if (!inCodeBlock) {
      if (fenceMatch) {
        inCodeBlock = true;
        codeFenceChar = fenceMatch[1][0];
        codeFenceLength = fenceMatch[1].length;
        codeFenceInfo = fenceMatch[2].trim();
        codeBuffer = [];
      } else {
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
          flushCurrentSection();
          currentSectionLevel = headerMatch[1].length;
          currentSectionTitle = headerMatch[2].trim();
        } else {
          currentSectionLines.push(line);
        }
      }
    } else {
      const isClosingFence = Boolean(
        fenceMatch && 
        fenceMatch[1][0] === codeFenceChar && 
        fenceMatch[1].length >= codeFenceLength &&
        fenceMatch[2].trim().length === 0
      );

      const isNewOpeningFenceWhileUnclosed = Boolean(
        fenceMatch &&
        fenceMatch[2].trim().length > 0
      );

      const isHeaderBoundary = Boolean(
        line.trim().startsWith('# [WORK PACKET]') || 
        line.trim().startsWith('### Pre-Code Summary') || 
        /^\s*#+\s+\[WORK PACKET/i.test(line)
      );

      if (isClosingFence) {
        inCodeBlock = false;
        processCompletedCodeBlock(codeBuffer, codeFenceInfo);
        codeBuffer = [];
      } else if (isNewOpeningFenceWhileUnclosed) {
        processCompletedCodeBlock(codeBuffer, codeFenceInfo, 'Auto-closed unterminated code fence at new fence boundary.');
        codeFenceChar = fenceMatch[1][0];
        codeFenceLength = fenceMatch[1].length;
        codeFenceInfo = fenceMatch[2].trim();
        codeBuffer = [];
        inCodeBlock = true;
      } else if (isHeaderBoundary) {
        inCodeBlock = false;
        processCompletedCodeBlock(codeBuffer, codeFenceInfo, 'Auto-closed unterminated code fence at primary header boundary.');
        codeBuffer = [];
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        currentSectionLevel = headerMatch ? headerMatch[1].length : 2;
        currentSectionTitle = headerMatch ? headerMatch[2].trim() : 'Pre-Code Summary';
      } else {
        codeBuffer.push(line);
      }
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    processCompletedCodeBlock(codeBuffer, codeFenceInfo, 'Auto-closed unterminated code fence at End of Output.');
  }

  flushCurrentSection();

  const actionsCount = {
    NEW: actions.filter(a => a.actionType === 'NEW').length,
    MODIFIED: actions.filter(a => a.actionType === 'MODIFIED').length,
    DELETED: actions.filter(a => a.actionType === 'DELETED').length,
    PARTIAL_DIFF: actions.filter(a => a.actionType === 'PARTIAL_DIFF').length,
  };

  const intentSection = explanations.find(e => 
    e.title.toLowerCase().includes('intent') || 
    e.title.toLowerCase().includes('summary') || 
    e.content.toLowerCase().includes('architectural intent')
  );

  let architecturalIntent = intentSection?.content || 'LLM Batch Work Packet Integration';
  if (architecturalIntent.length > 300) {
    architecturalIntent = architecturalIntent.slice(0, 300).trim() + '...';
  }

  const summary = {
    architecturalIntent,
    totalFiles: actions.length,
    actionsCount
  };

  const sessionId = `session-${Date.now()}`;
  const checkpointFiles = {};
  for (const act of actions) {
    const absPath = `${act.targetRootPath}/${act.targetRelativePath}`.replace(/\\/g, '/');
    checkpointFiles[absPath] = act.originalContent;
  }

  return {
    id: sessionId,
    workspaceId,
    name: intentSection?.title || 'Dev Session',
    summary,
    actions,
    explanations,
    checkpoint: {
      id: `chk-${sessionId}`,
      timestamp: new Date().toISOString(),
      snapshotFiles: checkpointFiles
    }
  };
}

// --- TEST SUITE 1: NESTED BACKTICK ISOLATION (BUG-02 RESOLUTION) ---
console.log('\x1b[36m--- Suite 1: Nested Code Fence & 4-Backtick Isolation ---\x1b[0m');
{
  const nestedMarkdown = [
    '# [WORK PACKET 1]: Documentation Sync',
    '',
    '### Pre-Code Summary',
    '- Architectural Intent: Update documentation and instructions.',
    '',
    B4 + 'markdown',
    '<!-- [NEW] docs/instructions.md -->',
    '# Setup Guide',
    '',
    'Run this script in your terminal:',
    B3 + 'bash',
    'npm run build',
    'npm test',
    B3,
    'This concludes setup.',
    B4
  ].join('\n');

  const session = parseSessionMarkdown(nestedMarkdown, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 1, `Extracted exactly 1 file action from 4-backtick fence (got ${session.actions.length})`);
  const action = session.actions[0];
  assert(action.targetRelativePath === 'docs/instructions.md', `Target path is correct: ${action.targetRelativePath}`);
  assert(action.actionType === 'NEW', `Action type identified as [NEW]`);
  assert(action.proposedContent.includes(B3 + 'bash'), 'Inner 3-backtick bash block preserved without breaking outer fence');
  assert(!action.proposedContent.startsWith('<!-- [NEW]'), 'Protocol scaffolding line stripped from proposed content');
}

// --- TEST SUITE 2: MULTI-SYNTAX PROTOCOL SCAFFOLDING STRIPPING ---
console.log('\n\x1b[36m--- Suite 2: Multi-Syntax Protocol Comment Header Stripping ---\x1b[0m');
{
  const tsRaw = '// [MODIFIED] src/auth/token.ts\nexport const rotate = () => {};';
  const pyRaw = '# [NEW] app/config.py\nTIMEOUT = 5.0';
  const htmlRaw = '<!-- [DELETED] public/legacy.html -->\n';
  const sqlRaw = '-- [MODIFIED] db/migration.sql\nSELECT 1;';
  const cleanPathRaw = '// src/utils/api.ts\nexport const fetcher = () => {};';

  assert(stripProtocolScaffolding(tsRaw, 'src/auth/token.ts') === 'export const rotate = () => {};', 'Stripped C-style // [MODIFIED] header');
  assert(stripProtocolScaffolding(pyRaw, 'app/config.py') === 'TIMEOUT = 5.0', 'Stripped Python # [NEW] header');
  assert(stripProtocolScaffolding(htmlRaw, 'public/legacy.html') === '', 'Stripped HTML <!-- [DELETED] --> tombstone');
  assert(stripProtocolScaffolding(sqlRaw, 'db/migration.sql') === 'SELECT 1;', 'Stripped SQL -- [MODIFIED] header');
  assert(stripProtocolScaffolding(cleanPathRaw, 'src/utils/api.ts') === 'export const fetcher = () => {};', 'Stripped line-1 path-only comment matching filename');
}

// --- TEST SUITE 3: EXTENSION-PRESERVING DEDUPLICATION (BUG-01 RESOLUTION) ---
console.log('\n\x1b[36m--- Suite 3: Extension-Preserving Filename Deduplication ---\x1b[0m');
{
  const multiPartMarkdown = [
    B3 + 'typescript',
    '// [MODIFIED] src/largeComponent.tsx',
    'export const Part1 = () => null;',
    B3,
    '',
    B3 + 'typescript',
    '// [MODIFIED] src/largeComponent.tsx',
    'export const Part2 = () => null;',
    B3
  ].join('\n');

  const session = parseSessionMarkdown(multiPartMarkdown, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 2, `Extracted 2 actions from repeated filename`);
  assert(session.actions[0].targetRelativePath === 'src/largeComponent.tsx', `First part retains original path`);
  assert(session.actions[1].targetRelativePath === 'src/largeComponent.Part2.tsx', `Second part injects suffix before .tsx extension (got: ${session.actions[1].targetRelativePath})`);
}

// --- TEST SUITE 4: UNCLOSED FENCE AUTO-RECOVERY AT HEADER / EOF BOUNDARY ---
console.log('\n\x1b[36m--- Suite 4: Unclosed Code Fence Heuristic Recovery ---\x1b[0m');
{
  const unclosedAtHeader = [
    B3 + 'typescript',
    '// [MODIFIED] src/service.ts',
    'export class Service {}',
    '',
    '# [WORK PACKET 2]: Secondary Task',
    B3 + 'python',
    '# [NEW] script.py',
    'print("hello")'
  ].join('\n');

  const session = parseSessionMarkdown(unclosedAtHeader, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 2, `Recovered both actions despite missing closing fence on first block (got ${session.actions.length})`);
  assert(session.actions[0].parseWarnings.some(w => w.includes('Auto-closed')), 'Appended parse warning for auto-closed fence');
  assert(session.actions[1].targetRelativePath === 'script.py', 'Second action extracted accurately');
}

// --- TEST SUITE 5: SKIP BLOCK DETECTION & TRANSPARENCY ---
console.log('\n\x1b[36m--- Suite 5: Skip Block Detection & Accounting ---\x1b[0m');
{
  const skipMarkdown = [
    B3 + 'typescript',
    '// [MODIFIED] src/store.ts',
    '// ... [Skipped: Unchanged state initializers] ...',
    'export const useStore = create(() => ({}));',
    '// ... [Skipped: 50 lines of utility methods] ...',
    B3
  ].join('\n');

  const session = parseSessionMarkdown(skipMarkdown, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 1, 'Extracted action with skip blocks');
  const action = session.actions[0];
  assert(action.hasSkipBlocks === true, 'Detected hasSkipBlocks: true');
  assert(action.skipBlockCount === 2, `Detected exactly 2 skip blocks (got: ${action.skipBlockCount})`);
  assert(action.proposedContent.includes('// ... [Skipped: Unchanged state initializers] ...'), 'Preserved transparent skip marker in proposed content');
}

// --- TEST SUITE 6: INTER-PACKET EXPLANATION & INTENT ASSOCIATION ---
console.log('\n\x1b[36m--- Suite 6: Inter-Packet Prose & Intent Association ---\x1b[0m');
{
  const packetMarkdown = [
    '# [WORK PACKET 1]: Auth Modernization',
    '',
    '### Pre-Code Summary',
    '- Architectural Intent: Migrate to asymmetric RS256 token pairs.',
    '',
    'Here is the new token definition:',
    '',
    B3 + 'typescript',
    '// [NEW] src/auth/types.ts',
    'export interface Token {}',
    B3,
    '',
    'Now we modify the validator middleware to support the refresh cycle:',
    '',
    B3 + 'typescript',
    '// [MODIFIED] src/auth/validator.ts',
    'export function validate() {}',
    B3
  ].join('\n');

  const session = parseSessionMarkdown(packetMarkdown, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 2, 'Parsed 2 actions across multiple prose sections');
  assert(session.explanations.length > 0, 'Extracted explanation sections');
  assert(session.summary.architecturalIntent.includes('Migrate to asymmetric RS256'), 'Captured Pre-Code Summary architectural intent');
  assert(session.explanations.some(e => e.associatedActionIds.length > 0), 'Associated prose sections to corresponding file actions');
}

console.log('\n' + '='.repeat(70));
console.log(`  PARSER DIAGNOSTIC SUMMARY: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[${failCount > 0 ? '31' : '32'}m${failCount} FAILED\x1b[0m`);
console.log('='.repeat(70) + '\n');

if (failCount > 0) process.exit(1);