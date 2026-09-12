// src/features/session/engine/diffHunkEngine.ts
import type { DiffHunk } from '../types/session';

export function generateDiffHunks(originalContent: string | null, proposedContent: string): DiffHunk[] {
  if (originalContent === null) {
    const lines = proposedContent.split('\n');
    return [{
      id: 'hunk-1',
      originalStartLine: 1,
      originalLineCount: 0,
      modifiedStartLine: 1,
      modifiedLineCount: lines.length,
      content: proposedContent,
      isMerged: false
    }];
  }

  const origLines = originalContent.split('\n');
  const propLines = proposedContent.split('\n');

  if (originalContent === proposedContent) {
    return [];
  }

  return [{
    id: 'hunk-1',
    originalStartLine: 1,
    originalLineCount: origLines.length,
    modifiedStartLine: 1,
    modifiedLineCount: propLines.length,
    content: proposedContent,
    isMerged: false
  }];
}

export function countSkipBlocks(code: string): number {
  const matches = code.match(/(\/\/|#|<!--|--)\s*\.\.\.\s*\[Skipped.*\]\s*\.\.\./gi);
  return matches ? matches.length : 0;
}