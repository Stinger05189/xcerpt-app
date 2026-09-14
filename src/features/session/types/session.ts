// src/features/session/types/session.ts
export type FileActionType = 'NEW' | 'MODIFIED' | 'DELETED' | 'PARTIAL_DIFF';
export type ActionReviewStatus = 'PENDING' | 'REVIEWED' | 'MERGED' | 'REJECTED';
export type SectionKind = 'preamble' | 'interstitial' | 'epilogue';
export type DevSessionStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface DiffHunk {
  id: string;
  originalStartLine: number;
  originalLineCount: number;
  modifiedStartLine: number;
  modifiedLineCount: number;
  content: string;
  isMerged: boolean;
}

export interface ParsedFileAction {
  id: string;
  targetRootPath: string;
  targetRelativePath: string;
  actionType: FileActionType;
  reviewStatus: ActionReviewStatus;
  originalContent: string | null;
  proposedContent: string;
  workingContent: string;
  rawPayloadContent: string;
  hunks: DiffHunk[];
  hasSkipBlocks: boolean;
  skipBlockCount: number;
  isIdenticalToDisk?: boolean;
  parseWarnings: string[];
  orderIndex: number;
  fenceLineStart?: number;
  fenceLineEnd?: number;
}

export interface MarkdownExplanationSection {
  id: string;
  title: string;
  level: number;
  content: string;
  associatedActionIds: string[];
  kind?: SectionKind;
}

export interface DevSessionSummary {
  architecturalIntent: string;
  totalFiles: number;
  actionsCount: Record<FileActionType, number>;
  filePaths?: string[];
}

export interface SessionCheckpoint {
  id: string;
  timestamp: string;
  gitCommitHash?: string;
  gitStashRef?: string;
  snapshotFiles: Record<string, string | null>;
}

export interface DevSession {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: DevSessionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  rawMarkdown: string;
  summary: DevSessionSummary;
  actions: ParsedFileAction[];
  explanations: MarkdownExplanationSection[];
  checkpoint: SessionCheckpoint;
}