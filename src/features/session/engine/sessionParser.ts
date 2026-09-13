// src/features/session/engine/sessionParser.ts
import type { 
  DevSession, 
  ParsedFileAction, 
  FileActionType, 
  ActionReviewStatus,
  MarkdownExplanationSection, 
  DevSessionSummary 
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

    // Clean HTML comment closing tags if present on the single line
    if (commentPrefix === '<!--' && remainder.endsWith('-->')) {
      remainder = remainder.slice(0, -3).trim();
    }

    if (remainder.length > 0) {
      // Retain the comment prefix with the path intact
      lines[firstNonEmptyIndex] = commentPrefix === '<!--'
        ? `<!-- ${remainder} -->`
        : `${commentPrefix} ${remainder}`;
    } else if (targetPath) {
      // If action had no inline path, retain canonical commented relative path
      lines[firstNonEmptyIndex] = commentPrefix === '<!--'
        ? `<!-- ${targetPath} -->`
        : `${commentPrefix} ${targetPath}`;
    } else {
      // Prune line if empty action tag with no path
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
  const protocolMatch = line.match(/\[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)\]\s*([^\s->]+)/i);
  if (protocolMatch) {
    actionType = protocolMatch[1].toUpperCase() as FileActionType;
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

  let inCodeBlock = false;
  let codeFenceChar = '';
  let codeFenceLength = 0;
  let codeFenceInfo = '';
  let codeBuffer: string[] = [];

  const flushCurrentSection = (nextActionId?: string) => {
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

  const processCompletedCodeBlock = (rawLines: string[], fenceInfo: string, warning?: string) => {
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

    // No-Op Auto-Detection: Identical contents to disk are pre-marked as MERGED
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
      const meetsLengthInvariant = Boolean(fenceMatch && fenceMatch[1].length >= codeFenceLength);

      const isClosingFence = Boolean(
        meetsLengthInvariant && 
        fenceMatch![1][0] === codeFenceChar && 
        fenceMatch![2].trim().length === 0
      );

      const isNewOpeningFenceWhileUnclosed = Boolean(
        meetsLengthInvariant &&
        fenceMatch![2].trim().length > 0
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
        codeFenceChar = fenceMatch![1][0];
        codeFenceLength = fenceMatch![1].length;
        codeFenceInfo = fenceMatch![2].trim();
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

  const actionsCount: Record<FileActionType, number> = {
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

  const summary: DevSessionSummary = {
    architecturalIntent,
    totalFiles: actions.length,
    actionsCount
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
    name: intentSection?.title || `Dev Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
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