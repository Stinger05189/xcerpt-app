// scripts/test-session-parser.mjs
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

const B3 = '`' + '`' + '`';
const B4 = '`' + '`' + '`' + '`';

const PROTOCOL_TAG_REGEX = /^\s*(\/\/|#|<!--|--)\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*(.*)$/i;

function stripProtocolScaffolding(rawCode, targetPath) {
  const lines = rawCode.split('\n');
  if (lines.length === 0) return rawCode;

  const firstNonEmptyIndex = lines.findIndex(l => l.trim().length > 0);
  if (firstNonEmptyIndex === -1) return rawCode;

  const candidateLine = lines[firstNonEmptyIndex];
  const tagMatch = candidateLine.match(PROTOCOL_TAG_REGEX);

  if (tagMatch) {
    const commentPrefix = tagMatch[1];
    let remainder = tagMatch[3].trim();

    if (commentPrefix === '<!--' && remainder.endsWith('-->')) {
      remainder = remainder.slice(0, -3).trim();
    }

    if (remainder.length > 0) {
      lines[firstNonEmptyIndex] = commentPrefix === '<!--'
        ? `<!-- ${remainder} -->`
        : `${commentPrefix} ${remainder}`;
    } else if (targetPath) {
      lines[firstNonEmptyIndex] = commentPrefix === '<!--'
        ? `<!-- ${targetPath} -->`
        : `${commentPrefix} ${targetPath}`;
    } else {
      lines.splice(firstNonEmptyIndex, 1);
    }
  }

  return lines.join('\n');
}

function extractActionAndPath(firstLine, fenceInfo) {
  let actionType = null;
  let targetPath = null;

  const line = firstLine.trim();
  const protocolMatch = line.match(/\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*([^\s\->]+)/i);
  if (protocolMatch) {
    actionType = protocolMatch[1].toUpperCase();
    targetPath = protocolMatch[2].replace(/-->$/, '').replace(/[->]+$/, '').trim();
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

function inferSessionTitle(rawMarkdown, actions, explanations) {
  const wpMatch = rawMarkdown.match(/^#+\s*\[?WORK PACKET(?:\s*\d+)?\]?:?\s*(.*)$/im);
  if (wpMatch && wpMatch[1].trim().length > 0) {
    const clean = wpMatch[1].replace(/[*_#`[\]]/g, '').trim();
    if (clean.length > 0) return clean;
  }

  const headerMatch = rawMarkdown.match(/^#+\s+(.+)$/m);
  if (headerMatch) {
    const cleanHeader = headerMatch[1].replace(/[*_#`[\]]/g, '').trim();
    if (cleanHeader.length > 0 && !cleanHeader.toLowerCase().includes('pre-code summary')) {
      return cleanHeader;
    }
  }

  if (explanations && explanations.length > 0) {
    const namedSec = explanations.find(e => e.title && !e.title.toLowerCase().includes('intent') && !e.title.toLowerCase().includes('context'));
    if (namedSec) return namedSec.title;
  }

  if (actions.length > 0) {
    const firstTwo = actions.slice(0, 2).map(a => `${a.actionType} ${a.targetRelativePath.split('/').pop()}`);
    const suffix = actions.length > 2 ? ` (+${actions.length - 2} more)` : '';
    return `${firstTwo.join(', ')}${suffix}`;
  }

  return `Dev Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function inferSessionDescription(rawMarkdown, explanations) {
  const intentMatch = rawMarkdown.match(/(?:Architectural Intent|Intent|Objective):\s*(.*)/i);
  if (intentMatch && intentMatch[1].trim()) {
    return intentMatch[1].replace(/[*_#`[\]-]/g, '').trim();
  }

  const preambleSec = explanations.find(e => e.kind === 'preamble' || e.title.toLowerCase().includes('intent'));
  if (preambleSec && preambleSec.content.trim()) {
    const firstParagraph = preambleSec.content
      .split('\n\n')[0]
      .replace(/[*_#`[\]-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (firstParagraph.length > 0) {
      return firstParagraph.length > 200 ? `${firstParagraph.slice(0, 200)}...` : firstParagraph;
    }
  }

  return 'LLM Batch Work Packet Integration';
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
  let currentSectionKind = 'preamble';

  let inCodeBlock = false;
  let codeFenceChar = '';
  let codeFenceLength = 0;
  let codeFenceInfo = '';
  let codeBuffer = [];
  let codeStartLineIdx = 0;
  let innerFenceDepth = 0;

  const flushCurrentSection = (nextActionId) => {
    if (currentSectionLines.length > 0) {
      const sectionText = currentSectionLines.join('\n').trim();
      if (sectionText) {
        const lastSec = explanations[explanations.length - 1];
        if (lastSec && lastSec.title === currentSectionTitle && lastSec.level === currentSectionLevel && lastSec.kind === currentSectionKind) {
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
            associatedActionIds: nextActionId ? [nextActionId] : [],
            kind: currentSectionKind
          });
        }
      }
      currentSectionLines = [];
    }
  };

  const processCompletedCodeBlock = (rawLines, fenceInfo, startLine, endLine, warning) => {
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

    const isIdenticalToDisk = originalContent !== null && originalContent === proposedContent;
    let reviewStatus = 'PENDING';
    if (isIdenticalToDisk && actionType !== 'DELETED') {
      reviewStatus = 'MERGED';
      warnings.push('Identical to file on disk (no changes detected; auto-completed).');
    }

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
      reviewStatus,
      originalContent,
      proposedContent,
      workingContent: proposedContent,
      rawPayloadContent,
      hunks: [],
      hasSkipBlocks,
      skipBlockCount,
      isIdenticalToDisk,
      parseWarnings: warnings,
      orderIndex: actions.length,
      fenceLineStart: startLine,
      fenceLineEnd: endLine
    });

    currentSectionKind = 'interstitial';
    currentSectionTitle = `Context for Action ${actions.length + 1}`;
    currentSectionLevel = 3;
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
        codeStartLineIdx = i;
        innerFenceDepth = 0;
      } else {
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) {
          flushCurrentSection();
          currentSectionLevel = headerMatch[1].length;
          currentSectionTitle = headerMatch[2].trim();
          currentSectionKind = actions.length === 0 ? 'preamble' : 'interstitial';
        } else {
          currentSectionLines.push(line);
        }
      }
    } else {
      const isTargetMarkdown = Boolean(
        codeFenceInfo.toLowerCase().includes('markdown') ||
        codeFenceInfo.toLowerCase().includes('md') ||
        codeBuffer.some(l => /\.(md|mdx)-->?$/i.test(l.trim()))
      );

      if (isTargetMarkdown && codeFenceLength === 3 && fenceMatch && fenceMatch[1].length === 3) {
        const hasInfo = fenceMatch[2].trim().length > 0;
        if (hasInfo && innerFenceDepth === 0) {
          innerFenceDepth = 1;
          codeBuffer.push(line);
          continue;
        } else if (!hasInfo && innerFenceDepth > 0) {
          innerFenceDepth = 0;
          codeBuffer.push(line);
          continue;
        }
      }

      const meetsLengthInvariant = Boolean(fenceMatch && fenceMatch[1].length >= codeFenceLength);

      const isClosingFence = Boolean(
        fenceMatch &&
        meetsLengthInvariant && 
        fenceMatch[1][0] === codeFenceChar && 
        fenceMatch[2].trim().length === 0 &&
        innerFenceDepth === 0
      );

      const isNewOpeningFenceWhileUnclosed = Boolean(
        fenceMatch &&
        meetsLengthInvariant &&
        fenceMatch[2].trim().length > 0 &&
        innerFenceDepth === 0
      );

      const isHeaderBoundary = Boolean(
        line.trim().startsWith('# [WORK PACKET]') || 
        line.trim().startsWith('### Pre-Code Summary') || 
        /^\s*#+\s+\[WORK PACKET/i.test(line)
      );

      if (isClosingFence) {
        inCodeBlock = false;
        processCompletedCodeBlock(codeBuffer, codeFenceInfo, codeStartLineIdx, i);
        codeBuffer = [];
      } else if (isNewOpeningFenceWhileUnclosed && fenceMatch) {
        processCompletedCodeBlock(codeBuffer, codeFenceInfo, codeStartLineIdx, i - 1, 'Auto-closed unterminated code fence at new fence boundary.');
        codeFenceChar = fenceMatch[1][0];
        codeFenceLength = fenceMatch[1].length;
        codeFenceInfo = fenceMatch[2].trim();
        codeBuffer = [];
        codeStartLineIdx = i;
        innerFenceDepth = 0;
        inCodeBlock = true;
      } else if (isHeaderBoundary) {
        inCodeBlock = false;
        processCompletedCodeBlock(codeBuffer, codeFenceInfo, codeStartLineIdx, i - 1, 'Auto-closed unterminated code fence at primary header boundary.');
        codeBuffer = [];
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        currentSectionLevel = headerMatch ? headerMatch[1].length : 2;
        currentSectionTitle = headerMatch ? headerMatch[2].trim() : 'Pre-Code Summary';
        currentSectionKind = actions.length === 0 ? 'preamble' : 'interstitial';
      } else {
        codeBuffer.push(line);
      }
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    processCompletedCodeBlock(codeBuffer, codeFenceInfo, codeStartLineIdx, lines.length - 1, 'Auto-closed unterminated code fence at End of Output.');
  }

  if (actions.length > 0 && currentSectionLines.length > 0) {
    currentSectionKind = 'epilogue';
    if (currentSectionTitle.startsWith('Context for Action')) {
      currentSectionTitle = 'Post-Code Instructions & Next Steps';
    }
  }
  flushCurrentSection();

  const actionsCount = {
    NEW: actions.filter(a => a.actionType === 'NEW').length,
    MODIFIED: actions.filter(a => a.actionType === 'MODIFIED').length,
    DELETED: actions.filter(a => a.actionType === 'DELETED').length,
    PARTIAL_DIFF: actions.filter(a => a.actionType === 'PARTIAL_DIFF').length,
  };

  const architecturalIntent = inferSessionDescription(rawMarkdown, explanations);
  const sessionName = inferSessionTitle(rawMarkdown, actions, explanations);

  const summary = {
    architecturalIntent,
    totalFiles: actions.length,
    actionsCount,
    filePaths: actions.map(a => a.targetRelativePath)
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
    name: sessionName,
    description: architecturalIntent,
    status: 'IN_PROGRESS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawMarkdown,
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

// --- SUITE 1: NESTED BACKTICK ISOLATION ---
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
  assert(action.proposedContent.startsWith('<!-- docs/instructions.md -->'), 'Line 1 action prefix stripped while retaining commented file path');
}

// --- SUITE 2: MULTI-SYNTAX PROTOCOL ACTION PREFIX STRIPPING ---
console.log('\n\x1b[36m--- Suite 2: Multi-Syntax Protocol Action Prefix Stripping ---\x1b[0m');
{
  const tsRaw = '// [MODIFIED] src/auth/token.ts\nexport const rotate = () => {};';
  const pyRaw = '# [NEW] app/config.py\nTIMEOUT = 5.0';
  const htmlRaw = '<!-- [DELETED] public/legacy.html -->\n';
  const sqlRaw = '-- [MODIFIED] db/migration.sql\nSELECT 1;';
  const luaRaw = '-- [NEW] scripts/player.lua\nlocal player = {}';
  const cleanPathRaw = '// src/utils/api.ts\nexport const fetcher = () => {};';

  assert(stripProtocolScaffolding(tsRaw, 'src/auth/token.ts').startsWith('// src/auth/token.ts'), 'Stripped C-style [MODIFIED] tag while preserving "// src/auth/token.ts"');
  assert(stripProtocolScaffolding(pyRaw, 'app/config.py').startsWith('# app/config.py'), 'Stripped Python [NEW] tag while preserving "# app/config.py"');
  assert(stripProtocolScaffolding(htmlRaw, 'public/legacy.html').startsWith('<!-- public/legacy.html -->'), 'Stripped HTML [DELETED] tag while preserving "<!-- public/legacy.html -->"');
  assert(stripProtocolScaffolding(sqlRaw, 'db/migration.sql').startsWith('-- db/migration.sql'), 'Stripped SQL [MODIFIED] tag while preserving "-- db/migration.sql"');
  assert(stripProtocolScaffolding(luaRaw, 'scripts/player.lua').startsWith('-- scripts/player.lua'), 'Stripped Lua [NEW] tag while preserving "-- scripts/player.lua"');
  assert(stripProtocolScaffolding(cleanPathRaw, 'src/utils/api.ts').startsWith('// src/utils/api.ts'), 'Preserved pre-existing clean path comment unchanged');
}

// --- SUITE 3: EXTENSION-PRESERVING DEDUPLICATION ---
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
  assert(session.actions[1].targetRelativePath === 'src/largeComponent.Part2.tsx', `Second part injects suffix before .tsx extension`);
}

// --- SUITE 4: UNCLOSED FENCE AUTO-RECOVERY ---
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
  assert(session.actions.length === 2, `Recovered both actions despite missing closing fence on first block`);
  assert(session.actions[0].parseWarnings.some(w => w.includes('Auto-closed')), 'Appended parse warning for auto-closed fence');
  assert(session.actions[1].targetRelativePath === 'script.py', 'Second action extracted accurately');
}

// --- SUITE 5: SKIP BLOCK DETECTION ---
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
  assert(action.skipBlockCount === 2, `Detected exactly 2 skip blocks`);
  assert(action.proposedContent.includes('// ... [Skipped: Unchanged state initializers] ...'), 'Preserved transparent skip marker');
}

// --- SUITE 6: INTER-PACKET EXPLANATION & INTENT ---
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

// --- SUITE 7: NO-OP IDENTICAL FILE AUTO-COMPLETION ---
console.log('\n\x1b[36m--- Suite 7: No-Op Identical File Auto-Completion ---\x1b[0m');
{
  const identicalCode = '// src/unchanged.ts\nexport const unchanged = () => 42;';
  const existingMap = {
    'C:/Repo/src/unchanged.ts': identicalCode
  };

  const noOpMarkdown = [
    '# [WORK PACKET]: Refactor Run',
    B3 + 'typescript',
    '// [MODIFIED] src/unchanged.ts',
    'export const unchanged = () => 42;',
    B3
  ].join('\n');

  const session = parseSessionMarkdown(noOpMarkdown, 'ws-test', ['C:/Repo'], existingMap);
  assert(session.actions.length === 1, 'Parsed 1 modification action');
  const action = session.actions[0];
  assert(action.isIdenticalToDisk === true, 'Identified isIdenticalToDisk as true');
  assert(action.reviewStatus === 'MERGED', 'Auto-completed reviewStatus initialized directly as MERGED');
  assert(action.parseWarnings.some(w => w.includes('Identical to file on disk')), 'Captured no-op auto-completed warning');
}

// --- SUITE 8: MULTI-LOCATION REASONING (PREAMBLE, INTERSTITIAL, EPILOGUE) ---
console.log('\n\x1b[36m--- Suite 8: Multi-Location Reasoning (Preamble, Interstitial, Epilogue) ---\x1b[0m');
{
  const multiLocationMarkdown = [
    '# [WORK PACKET]: Full Pipeline Refactor',
    '',
    'Preamble: We begin by introducing the core database migration schema.',
    '',
    B3 + 'sql',
    '-- [NEW] db/schema.sql',
    'CREATE TABLE users (id INT PRIMARY KEY);',
    B3,
    '',
    'Next, we update the data access layer to interact with this new table:',
    '',
    B3 + 'typescript',
    '// [NEW] src/db/client.ts',
    'export const db = {};',
    B3,
    '',
    'Epilogue: Run `npm run migrate` and verify the test suite passes.',
  ].join('\n');

  const session = parseSessionMarkdown(multiLocationMarkdown, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 2, 'Parsed 2 actions from multi-location packet');
  
  const preambleSec = session.explanations.find(e => e.kind === 'preamble');
  assert(Boolean(preambleSec), 'Captured preamble explanation section');
  
  const interstitialSec = session.explanations.find(e => e.kind === 'interstitial');
  assert(Boolean(interstitialSec), 'Captured interstitial explanation section between file blocks');
  
  const epilogueSec = session.explanations.find(e => e.kind === 'epilogue');
  assert(Boolean(epilogueSec), 'Captured epilogue explanation section following the final file');
  assert(epilogueSec.content.includes('npm run migrate'), 'Epilogue section contains post-code execution instructions');
}

// --- SUITE 9: 3-BACKTICK NESTED MARKDOWN FILE RECOVERY ---
console.log('\n\x1b[36m--- Suite 9: 3-Backtick Nested Markdown Code Block Shielding ---\x1b[0m');
{
  const nested3BacktickMarkdown = [
    '# [WORK PACKET]: Update Readme Guide',
    '',
    B3 + 'markdown',
    '<!-- [NEW] docs/guide.md -->',
    '# Developer Guide',
    '',
    'Here is how you execute the build:',
    B3 + 'bash',
    'npm install',
    'npm test',
    B3,
    '',
    'This is the end of the guide.',
    B3
  ].join('\n');

  const session = parseSessionMarkdown(nested3BacktickMarkdown, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 1, `Shielded inner 3-backtick block inside 3-backtick markdown fence (actions: ${session.actions.length})`);
  const act = session.actions[0];
  assert(act.targetRelativePath === 'docs/guide.md', `Target path accurately identified: ${act.targetRelativePath}`);
  assert(act.proposedContent.includes('npm install'), 'Retained inner bash script commands intact');
  assert(act.proposedContent.includes('This is the end of the guide.'), 'Preserved code block trailing markdown text');
}

// --- SUITE 10: AUTO-INFERRED TITLE, DESCRIPTION & BOUNDARY PARSING ---
console.log('\n\x1b[36m--- Suite 10: Multi-Segment Paths & Path Separation Invariant ---\x1b[0m');
{
  const multiSegmentPacket = [
    B3 + 'lua',
    '-- [NEW] src/plugins/renderer_svg/templates.lua',
    'local Templates = {}',
    'return Templates',
    B3
  ].join('\n');

  const session = parseSessionMarkdown(multiSegmentPacket, 'ws-test', ['C:/Repo']);
  assert(session.actions.length === 1, 'Parsed multi-segment Lua action');
  assert(session.actions[0].targetRelativePath === 'src/plugins/renderer_svg/templates.lua', `Extracted full path without stopping at slash: "${session.actions[0].targetRelativePath}"`);
  assert(session.actions[0].actionType === 'NEW', 'Accurately recognized action as NEW');
}

console.log('\n' + '='.repeat(70));
console.log(`  PARSER DIAGNOSTIC SUMMARY: \x1b[32m${passCount} PASSED\x1b[0m, \x1b[${failCount > 0 ? '31' : '32'}m${failCount} FAILED\x1b[0m`);
console.log('='.repeat(70) + '\n');

if (failCount > 0) process.exit(1);