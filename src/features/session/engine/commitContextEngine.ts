// src/features/session/engine/commitContextEngine.ts
import { LLMService } from '../../llm/engine/llmService';
import type { DevSession, ParsedFileAction } from '../types/session';

export interface CommitContextPayload {
  architecturalIntent: string;
  actions: Array<{ actionType: string; targetRelativePath: string }>;
  gitDiff?: string;
  gitLog?: string;
  userGuidance?: string;
}

export async function buildAndSynthesizeCommit(
  session: DevSession,
  activeRootPath: string,
  userGuidance?: string
): Promise<{ subject: string; body: string }> {
  let gitDiff = '';
  let gitLog = '';

  // 1. Gather target file relative paths
  const filePaths = session.actions.map((a: ParsedFileAction) => a.targetRelativePath);

  // 2. Fetch live git diff & log via IPC
  if (window.api?.getGitDiff && activeRootPath) {
    try {
      gitDiff = await window.api.getGitDiff(activeRootPath, filePaths);
    } catch (e) {
      console.warn('Could not fetch git diff:', e);
    }
  }

  if (window.api?.getGitLog && activeRootPath) {
    try {
      gitLog = await window.api.getGitLog(activeRootPath, 5);
    } catch (e) {
      console.warn('Could not fetch git log:', e);
    }
  }

  // 3. Assemble structured context
  const payload: CommitContextPayload = {
    architecturalIntent: session.description || session.summary.architecturalIntent || session.name,
    actions: session.actions.map(a => ({
      actionType: a.actionType,
      targetRelativePath: a.targetRelativePath
    })),
    gitDiff: gitDiff ? gitDiff.slice(0, 15000) : undefined,
    gitLog: gitLog ? gitLog.slice(0, 1000) : undefined,
    userGuidance: userGuidance?.trim() ? userGuidance.trim() : undefined
  };

  return LLMService.synthesizeCommitMessage(payload);
}