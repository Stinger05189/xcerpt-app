// src/features/session/engine/sessionParser.ts
import type { 
  DevSession, 
  ParsedFileAction, 
  FileActionType, 
  ActionReviewStatus,
  MarkdownExplanationSection, 
  DevSessionSummary,
  SectionKind
} from '../types/session';

export const PROTOCOL_TAG_REGEX = /^\s*(\/\/|#|<!--|--)\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*(.*)$/i;

export const FILE_START_TOKEN_REGEX = /^\s*(?:<<<|<!--\s*<<<|\[)\s*(?:FILE_START|START_FILE)[:\s]+(?:\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*)?["'`]?([^"'`>\]\n]+?)["'`]?(?:\s+\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\])?\s*(?:>>>|>>>\s*-->|\])\s*$/i;

export const FILE_END_TOKEN_REGEX = /^\s*(?:<<<|<!--\s*<<<|\[)\s*(?:FILE_END|END_FILE)(?:[:\s]+[^\s>\]\n]+)?\s*(?:>>>|>>>\s*-->|\])\s*$/i;

export function cleanRelativePath(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\/g, '/')
    .replace(/\s*-->.*$/, '')
    .replace(/-->$/, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^[./\\]+/, '')
    .replace(/^\/+/, '')
    .trim();
}

export function stripOuterCodeFence(lines: string[]): { lines: string[]; detectedFenceInfo: string } {
  if (!lines || lines.length === 0) return { lines: [], detectedFenceInfo: '' };

  const firstNonEmptyIdx = lines.findIndex(l => l.trim().length > 0);
  if (firstNonEmptyIdx === -1) return { lines, detectedFenceInfo: '' };

  const firstLine = lines[firstNonEmptyIdx].trim();
  const openFenceMatch = firstLine.match(/^([`~]{3,})(.*)$/);

  if (!openFenceMatch) {
    return { lines, detectedFenceInfo: '' };
  }

  const fenceChar = openFenceMatch[1][0];
  const fenceLen = openFenceMatch[1].length;
  const detectedFenceInfo = openFenceMatch[2].trim();

  let lastNonEmptyIdx = -1;
  for (let i = lines.length - 1; i > firstNonEmptyIdx; i--) {
    if (lines[i].trim().length > 0) {
      lastNonEmptyIdx = i;
      break;
    }
  }

  if (lastNonEmptyIdx !== -1) {
    const lastLine = lines[lastNonEmptyIdx].trim();
    const closeFenceMatch = lastLine.match(/^([`~]{3,})$/);
    if (closeFenceMatch && closeFenceMatch[1][0] === fenceChar && closeFenceMatch[1].length >= fenceLen) {
      const sliced = lines.slice(firstNonEmptyIdx + 1, lastNonEmptyIdx);
      return { lines: sliced, detectedFenceInfo };
    }
  }

  if (detectedFenceInfo.length > 0) {
    const sliced = lines.slice(firstNonEmptyIdx + 1);
    return { lines: sliced, detectedFenceInfo };
  }

  return { lines, detectedFenceInfo: '' };
}

export function stripProtocolScaffolding(rawCode: string, targetPath?: string): string {
  let lines = rawCode.split('\n');
  if (lines.length === 0) return rawCode;

  lines = lines.filter(l => !FILE_START_TOKEN_REGEX.test(l) && !FILE_END_TOKEN_REGEX.test(l));
  if (lines.length === 0) return '';

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

export function extractActionAndPath(
  firstLine: string,
  fenceInfo: string
): { actionType: FileActionType | null; targetPath: string | null } {
  let actionType: FileActionType | null = null;
  let targetPath: string | null = null;

  const line = firstLine.trim();

  const tokenMatch = line.match(FILE_START_TOKEN_REGEX);
  if (tokenMatch) {
    const rawAction = tokenMatch[1] || tokenMatch[3];
    if (rawAction) {
      actionType = rawAction.toUpperCase() as FileActionType;
    }
    targetPath = cleanRelativePath(tokenMatch[2]);
    return { actionType, targetPath };
  }

  const protocolMatch = line.match(/\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*([^\s]+)/i);
  if (protocolMatch) {
    actionType = protocolMatch[1].toUpperCase() as FileActionType;
    targetPath = cleanRelativePath(protocolMatch[2]);
    return { actionType, targetPath };
  }

  const commentClean = line
    .replace(/^(\/\/|#|<!--|--)\s*/, '')
    .replace(/\s*(-->)$/, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^[./\\]+/, '')
    .trim();

  const pathCandidateMatch = commentClean.match(/^([-a-zA-Z0-9_./\\]+\.[a-zA-Z0-9_-]+)/);
  if (pathCandidateMatch) {
    targetPath = pathCandidateMatch[1].trim();
  }

  if (!targetPath && fenceInfo) {
    const infoClean = fenceInfo.replace(/^```+/, '').trim();
    const infoColon = infoClean.split(/[:\s]/);
    if (infoColon.length > 1 && infoColon[1].includes('.')) {
      targetPath = cleanRelativePath(infoColon[1]);
    }
  }

  return { actionType, targetPath };
}

export function inferSessionTitle(
  rawMarkdown: string, 
  actions: ParsedFileAction[], 
  explanations?: MarkdownExplanationSection[]
): string {
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

export function inferSessionDescription(
  rawMarkdown: string, 
  explanations: MarkdownExplanationSection[]
): string {
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

function isInnerUnadornedFence(lines: string[], currentIdx: number): boolean {
  for (let j = currentIdx + 1; j < lines.length; j++) {
    const l = lines[j];
    if (
      l.trim().startsWith('# [WORK PACKET]') ||
      l.trim().startsWith('### Pre-Code Summary') ||
      FILE_START_TOKEN_REGEX.test(l)
    ) {
      return false;
    }
    const fMatch = l.match(/^([`~]{3,})(.*)$/);
    if (fMatch) {
      return true;
    }
  }
  return false;
}

export function parseSessionMarkdown(
  rawMarkdown: string,
  workspaceId: string,
  rootPaths: string[],
  existingFilesMap: Record<string, string | null> = {}
): DevSession {
  const normalized = rawMarkdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const actions: ParsedFileAction[] = [];
  const explanations: MarkdownExplanationSection[] = [];
  const pathCounts: Record<string, number> = {};

  let currentSectionTitle = 'Architectural Intent';
  let currentSectionLevel = 2;
  let currentSectionLines: string[] = [];
  let currentSectionKind: SectionKind = 'preamble';

  let inTokenBlock = false;
  let tokenAction: FileActionType | null = null;
  let tokenPath: string | null = null;
  let tokenBuffer: string[] = [];
  let tokenStartLineIdx = 0;

  let inCodeBlock = false;
  let codeFenceChar = '';
  let codeFenceLength = 0;
  let codeFenceInfo = '';
  let codeBuffer: string[] = [];
  let codeStartLineIdx = 0;
  let innerFenceDepth = 0;

  const flushCurrentSection = (nextActionId?: string) => {
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

  const processCompletedCodeBlock = (
    rawLines: string[], 
    fenceInfo: string, 
    startLine: number, 
    endLine: number, 
    warning?: string,
    explicitAction?: FileActionType | null,
    explicitPath?: string | null
  ) => {
    const rawPayloadContent = rawLines.join('\n');
    const firstNonEmpty = rawLines.find(l => l.trim().length > 0) || '';
    const { actionType: extractedAction, targetPath: extractedPath } = extractActionAndPath(firstNonEmpty, fenceInfo);

    let targetRelativePath = explicitPath || extractedPath || `unnamed_snippet_${actions.length + 1}.txt`;
    targetRelativePath = cleanRelativePath(targetRelativePath);

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
    let matchedOriginalContent: string | null = null;
    let resolvedRelPath = targetRelativePath;

    for (const root of rootPaths) {
      const cleanRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
      const rootBase = cleanRoot.split('/').pop() || '';

      const keyDirect = `${cleanRoot}/${targetRelativePath}`.replace(/\\/g, '/');
      if (existingFilesMap[keyDirect] !== undefined && existingFilesMap[keyDirect] !== null) {
        targetRoot = root;
        matchedOriginalContent = existingFilesMap[keyDirect];
        resolvedRelPath = targetRelativePath;
        break;
      }

      if (rootBase && targetRelativePath.startsWith(`${rootBase}/`)) {
        const strippedRel = targetRelativePath.slice(rootBase.length + 1);
        const keyStripped = `${cleanRoot}/${strippedRel}`.replace(/\\/g, '/');
        if (existingFilesMap[keyStripped] !== undefined && existingFilesMap[keyStripped] !== null) {
          targetRoot = root;
          matchedOriginalContent = existingFilesMap[keyStripped];
          resolvedRelPath = strippedRel;
          break;
        }
      }
    }

    if (matchedOriginalContent === null) {
      for (const root of rootPaths) {
        const cleanRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
        const rootBase = cleanRoot.split('/').pop() || '';

        const keyDirect = `${cleanRoot}/${targetRelativePath}`.replace(/\\/g, '/');
        if (existingFilesMap[keyDirect] !== undefined) {
          targetRoot = root;
          break;
        }

        if (rootBase && targetRelativePath.startsWith(`${rootBase}/`)) {
          const strippedRel = targetRelativePath.slice(rootBase.length + 1);
          const keyStripped = `${cleanRoot}/${strippedRel}`.replace(/\\/g, '/');
          if (existingFilesMap[keyStripped] !== undefined) {
            targetRoot = root;
            resolvedRelPath = strippedRel;
            break;
          }
        }
      }
    }

    targetRelativePath = resolvedRelPath;
    const originalContent = matchedOriginalContent;

    let actionType: FileActionType = explicitAction || extractedAction || (originalContent === null ? 'NEW' : 'MODIFIED');
    if (firstNonEmpty.includes('[DELETED]') || explicitAction === 'DELETED') {
      actionType = 'DELETED';
    } else if (firstNonEmpty.includes('[PARTIAL_DIFF]') || explicitAction === 'PARTIAL_DIFF') {
      actionType = 'PARTIAL_DIFF';
    }

    const warnings: string[] = [];
    if (warning) warnings.push(warning);
    if (!explicitAction && !extractedAction) {
      warnings.push(`Action tag omitted in response; inferred as [${actionType}].`);
    }

    const proposedContent = stripProtocolScaffolding(rawPayloadContent, targetRelativePath);

    const isIdenticalToDisk = originalContent !== null && originalContent === proposedContent;
    let reviewStatus: ActionReviewStatus = 'PENDING';
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
    const startTokenMatch = line.match(FILE_START_TOKEN_REGEX);
    const endTokenMatch = line.match(FILE_END_TOKEN_REGEX);
    const fenceMatch = line.match(/^([`~]{3,})(.*)$/);

    if (inTokenBlock) {
      if (endTokenMatch) {
        inTokenBlock = false;
        const { lines: contentLines, detectedFenceInfo } = stripOuterCodeFence(tokenBuffer);
        processCompletedCodeBlock(
          contentLines,
          detectedFenceInfo,
          tokenStartLineIdx,
          i,
          undefined,
          tokenAction,
          tokenPath
        );
        tokenBuffer = [];
        tokenAction = null;
        tokenPath = null;
        continue;
      }

      if (startTokenMatch) {
        const { lines: contentLines, detectedFenceInfo } = stripOuterCodeFence(tokenBuffer);
        processCompletedCodeBlock(
          contentLines,
          detectedFenceInfo,
          tokenStartLineIdx,
          i - 1,
          'Auto-closed unterminated file boundary at new FILE_START token.',
          tokenAction,
          tokenPath
        );

        tokenAction = (startTokenMatch[1] || startTokenMatch[3] || null) as FileActionType | null;
        tokenPath = cleanRelativePath(startTokenMatch[2]);
        tokenStartLineIdx = i;
        tokenBuffer = [];
        continue;
      }

      const isHeaderBoundary = Boolean(
        line.trim().startsWith('# [WORK PACKET]') || 
        line.trim().startsWith('### Pre-Code Summary') || 
        /^\s*#+\s+\[WORK PACKET/i.test(line)
      );

      if (isHeaderBoundary) {
        inTokenBlock = false;
        const { lines: contentLines, detectedFenceInfo } = stripOuterCodeFence(tokenBuffer);
        processCompletedCodeBlock(
          contentLines,
          detectedFenceInfo,
          tokenStartLineIdx,
          i - 1,
          'Auto-closed unterminated file boundary at primary header boundary.',
          tokenAction,
          tokenPath
        );
        tokenBuffer = [];
        tokenAction = null;
        tokenPath = null;

        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        currentSectionLevel = headerMatch ? headerMatch[1].length : 2;
        currentSectionTitle = headerMatch ? headerMatch[2].trim() : 'Pre-Code Summary';
        currentSectionKind = actions.length === 0 ? 'preamble' : 'interstitial';
        continue;
      }

      tokenBuffer.push(line);
      continue;
    }

    if (startTokenMatch) {
      if (inCodeBlock && codeBuffer.length > 0) {
        processCompletedCodeBlock(codeBuffer, codeFenceInfo, codeStartLineIdx, i - 1, 'Auto-closed unclosed code fence at FILE_START token.');
        inCodeBlock = false;
        codeBuffer = [];
      }
      inTokenBlock = true;
      tokenAction = (startTokenMatch[1] || startTokenMatch[3] || null) as FileActionType | null;
      tokenPath = cleanRelativePath(startTokenMatch[2]);
      tokenStartLineIdx = i;
      tokenBuffer = [];
      continue;
    }

    if (endTokenMatch) {
      continue;
    }

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
        if (hasInfo) {
          innerFenceDepth++;
          codeBuffer.push(line);
          continue;
        } else if (!hasInfo && innerFenceDepth > 0) {
          innerFenceDepth--;
          codeBuffer.push(line);
          continue;
        } else if (!hasInfo && innerFenceDepth === 0) {
          if (isInnerUnadornedFence(lines, i)) {
            innerFenceDepth = 1;
            codeBuffer.push(line);
            continue;
          }
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

  if (inTokenBlock && tokenBuffer.length > 0) {
    const { lines: contentLines, detectedFenceInfo } = stripOuterCodeFence(tokenBuffer);
    processCompletedCodeBlock(
      contentLines,
      detectedFenceInfo,
      tokenStartLineIdx,
      lines.length - 1,
      'Auto-closed unterminated file boundary at End of Output.',
      tokenAction,
      tokenPath
    );
  } else if (inCodeBlock && codeBuffer.length > 0) {
    processCompletedCodeBlock(codeBuffer, codeFenceInfo, codeStartLineIdx, lines.length - 1, 'Auto-closed unterminated code fence at End of Output.');
  }

  if (actions.length > 0 && currentSectionLines.length > 0) {
    currentSectionKind = 'epilogue';
    if (currentSectionTitle.startsWith('Context for Action')) {
      currentSectionTitle = 'Post-Code Instructions & Next Steps';
    }
  }
  flushCurrentSection();

  const actionsCount: Record<FileActionType, number> = {
    NEW: actions.filter(a => a.actionType === 'NEW').length,
    MODIFIED: actions.filter(a => a.actionType === 'MODIFIED').length,
    DELETED: actions.filter(a => a.actionType === 'DELETED').length,
    PARTIAL_DIFF: actions.filter(a => a.actionType === 'PARTIAL_DIFF').length,
  };

  const architecturalIntent = inferSessionDescription(rawMarkdown, explanations);
  const sessionName = inferSessionTitle(rawMarkdown, actions, explanations);

  const summary: DevSessionSummary = {
    architecturalIntent,
    totalFiles: actions.length,
    actionsCount,
    filePaths: actions.map(a => a.targetRelativePath)
  };

  const sessionId = `session-${Date.now()}`;
  const checkpointFiles: Record<string, string | null> = {};
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