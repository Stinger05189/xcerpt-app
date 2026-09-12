// src/features/session/engine/checkpointEngine.ts
import type { SessionCheckpoint, ParsedFileAction } from '../types/session';

export function createSessionCheckpoint(
  sessionId: string,
  actions: ParsedFileAction[]
): SessionCheckpoint {
  const snapshotFiles: Record<string, string | null> = {};

  for (const action of actions) {
    const absPath = `${action.targetRootPath}/${action.targetRelativePath}`.replace(/\\/g, '/');
    snapshotFiles[absPath] = action.originalContent;
  }

  return {
    id: `chk-${sessionId}`,
    timestamp: new Date().toISOString(),
    snapshotFiles
  };
}

export async function rollbackCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
  if (!window.api?.revertCheckpointFiles) return;
  await window.api.revertCheckpointFiles(checkpoint.snapshotFiles);
}