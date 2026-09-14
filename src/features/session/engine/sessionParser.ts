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

const PROTOCOL_TAG_REGEX = /^\s*(\/\/|#|<!--|--)\s*\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*(.*)$/i;

export function stripProtocolScaffolding(rawCode: string, targetPath?: string): string {
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

export function extractActionAndPath(
  firstLine: string,
  fenceInfo: string
): { actionType: FileActionType | null; targetPath: string | null } {
  let actionType: FileActionType | null = null;
  let targetPath: string | null = null;

  const line = firstLine.trim();
  const protocolMatch = line.match(/\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*([^\s\->]+)/i);
  if (protocolMatch) {
    actionType = protocolMatch[1].toUpperCase() as FileActionType;
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
    warning?: string
  ) => {
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

    let actionType: FileActionType = extractedAction || (originalContent === null ? 'NEW' : 'MODIFIED');
    if (firstNonEmpty.includes('[DELETED]')) {
      actionType = 'DELETED';
    }

    const warnings: string[] = [];
    if (warning) warnings.push(warning);
    if (!extractedAction) {
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