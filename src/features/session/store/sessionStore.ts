// src/features/session/store/sessionStore.ts
import { create } from 'zustand';
import type { DevSession, ActionReviewStatus } from '../types/session';
import { parseSessionMarkdown } from '../engine/sessionParser';
import { rollbackCheckpoint } from '../engine/checkpointEngine';

interface SessionState {
  currentWorkspaceId: string | null;
  sessionsByWorkspace: Record<string, DevSession | null>;
  activeActionIdsByWorkspace: Record<string, string | null>;
  openStudioByWorkspace: Record<string, boolean>;
  openIngestionByWorkspace: Record<string, boolean>;

  activeSession: DevSession | null;
  activeActionId: string | null;
  isStudioOpen: boolean;
  isIngestionModalOpen: boolean;
  isBrowserModalOpen: boolean;
  isApplying: boolean;
  error: string | null;
  planScrollTop: number;

  syncWorkspaceContext: (workspaceId: string) => void;
  setIngestionModalOpen: (open: boolean, workspaceId?: string) => void;
  setStudioOpen: (open: boolean, workspaceId?: string) => void;
  setBrowserModalOpen: (open: boolean) => void;
  setActiveActionId: (id: string | null, workspaceId?: string) => void;
  setPlanScrollTop: (scrollTop: number) => void;

  initSessionFromMarkdown: (
    rawMarkdown: string,
    workspaceId: string,
    rootPaths: string[],
    customTitle?: string,
    customDescription?: string
  ) => Promise<DevSession>;

  updateWorkingContent: (actionId: string, newContent: string) => void;
  saveActionEdits: (actionId: string) => Promise<void>;
  resetActionWorkingContent: (actionId: string) => void;

  applyCurrentAction: () => Promise<void>;
  revertAction: (actionId: string) => Promise<void>;
  rejectCurrentAction: () => void;
  restoreActionToPending: (actionId: string) => void;

  applyAllPendingActions: () => Promise<void>;
  revertCurrentSession: () => Promise<void>;
  completeCurrentSession: () => Promise<void>;
  exitCurrentSession: () => void;

  loadSession: (workspaceId: string, sessionId: string) => Promise<void>;
  deleteSession: (workspaceId: string, sessionId: string) => Promise<void>;
  batchDeleteSessions: (workspaceId: string, sessionIds: string[]) => Promise<void>;
  discardCurrentSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentWorkspaceId: null,
  sessionsByWorkspace: {},
  activeActionIdsByWorkspace: {},
  openStudioByWorkspace: {},
  openIngestionByWorkspace: {},

  activeSession: null,
  activeActionId: null,
  isStudioOpen: false,
  isIngestionModalOpen: false,
  isBrowserModalOpen: false,
  isApplying: false,
  error: null,
  planScrollTop: 0,

  syncWorkspaceContext: (workspaceId: string) => {
    const { sessionsByWorkspace, activeActionIdsByWorkspace, openStudioByWorkspace, openIngestionByWorkspace } = get();
    const wsSession = sessionsByWorkspace[workspaceId] || null;
    const wsActionId = activeActionIdsByWorkspace[workspaceId] || (wsSession?.actions[0]?.id || null);
    const wsStudioOpen = openStudioByWorkspace[workspaceId] || false;
    const wsIngestionOpen = openIngestionByWorkspace[workspaceId] || false;

    set({
      currentWorkspaceId: workspaceId,
      activeSession: wsSession,
      activeActionId: wsActionId,
      isStudioOpen: wsStudioOpen,
      isIngestionModalOpen: wsIngestionOpen,
      error: null
    });
  },

  setIngestionModalOpen: (open: boolean, workspaceId?: string) => {
    const wsId = workspaceId || get().currentWorkspaceId;
    if (wsId) {
      set(state => ({
        isIngestionModalOpen: open,
        isStudioOpen: open ? false : state.isStudioOpen,
        isBrowserModalOpen: false,
        error: null,
        openIngestionByWorkspace: { ...state.openIngestionByWorkspace, [wsId]: open },
        openStudioByWorkspace: open ? { ...state.openStudioByWorkspace, [wsId]: false } : state.openStudioByWorkspace
      }));
    } else {
      set(state => ({ 
        isIngestionModalOpen: open, 
        isStudioOpen: open ? false : state.isStudioOpen,
        isBrowserModalOpen: false,
        error: null 
      }));
    }
  },

  setStudioOpen: (open: boolean, workspaceId?: string) => {
    const wsId = workspaceId || get().currentWorkspaceId;
    if (wsId) {
      set(state => ({
        isStudioOpen: open,
        isIngestionModalOpen: open ? false : state.isIngestionModalOpen,
        isBrowserModalOpen: false,
        openStudioByWorkspace: { ...state.openStudioByWorkspace, [wsId]: open },
        openIngestionByWorkspace: open ? { ...state.openIngestionByWorkspace, [wsId]: false } : state.openIngestionByWorkspace
      }));
    } else {
      set(state => ({ 
        isStudioOpen: open,
        isIngestionModalOpen: open ? false : state.isIngestionModalOpen,
        isBrowserModalOpen: false
      }));
    }
  },

  setBrowserModalOpen: (open: boolean) => {
    set(state => ({ 
      isBrowserModalOpen: open,
      isIngestionModalOpen: open ? false : state.isIngestionModalOpen
    }));
  },

  setActiveActionId: (id: string | null, workspaceId?: string) => {
    const wsId = workspaceId || get().currentWorkspaceId;
    if (wsId) {
      set(state => ({
        activeActionId: id,
        activeActionIdsByWorkspace: { ...state.activeActionIdsByWorkspace, [wsId]: id }
      }));
    } else {
      set({ activeActionId: id });
    }
  },

  setPlanScrollTop: (scrollTop) => set({ planScrollTop: scrollTop }),

  initSessionFromMarkdown: async (rawMarkdown, workspaceId, rootPaths, customTitle, customDescription) => {
    set({ error: null });
    try {
      // Step 1: Preliminary pass through parser to extract all exact candidate relative paths
      const preliminarySession = parseSessionMarkdown(rawMarkdown, workspaceId, rootPaths, {});
      const existingFilesMap: Record<string, string | null> = {};

      // Step 2: Query physical disk files across all root paths
      for (const action of preliminarySession.actions) {
        const relPath = action.targetRelativePath;
        for (const root of rootPaths) {
          const cleanRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
          const rootBase = cleanRoot.split('/').pop() || '';

          // 2a. Direct path check
          const directAbs = `${cleanRoot}/${relPath}`.replace(/\\/g, '/');
          try {
            const text = await window.api.readFile(directAbs);
            existingFilesMap[directAbs] = text;
          } catch {
            existingFilesMap[directAbs] = null;
          }

          // 2b. Root folder name prepended by LLM check
          if (rootBase && relPath.startsWith(`${rootBase}/`)) {
            const strippedRel = relPath.slice(rootBase.length + 1);
            const strippedAbs = `${cleanRoot}/${strippedRel}`.replace(/\\/g, '/');
            try {
              const text = await window.api.readFile(strippedAbs);
              existingFilesMap[strippedAbs] = text;
            } catch {
              existingFilesMap[strippedAbs] = null;
            }
          }
        }
      }

      // Step 3: Final deterministic parse with resolved file contents
      const session = parseSessionMarkdown(rawMarkdown, workspaceId, rootPaths, existingFilesMap);
      if (customTitle && customTitle.trim()) {
        session.name = customTitle.trim();
      }
      if (customDescription && customDescription.trim()) {
        session.description = customDescription.trim();
        session.summary.architecturalIntent = customDescription.trim();
      }

      await window.api.saveDevSession(workspaceId, session);

      const firstPending = session.actions.find(a => a.reviewStatus === 'PENDING') || session.actions[0];
      const targetActionId = firstPending?.id || null;

      set(state => ({
        currentWorkspaceId: workspaceId,
        activeSession: session,
        activeActionId: targetActionId,
        isIngestionModalOpen: false,
        isBrowserModalOpen: false,
        isStudioOpen: true,
        planScrollTop: 0,
        sessionsByWorkspace: { ...state.sessionsByWorkspace, [workspaceId]: session },
        activeActionIdsByWorkspace: { ...state.activeActionIdsByWorkspace, [workspaceId]: targetActionId },
        openStudioByWorkspace: { ...state.openStudioByWorkspace, [workspaceId]: true },
        openIngestionByWorkspace: { ...state.openIngestionByWorkspace, [workspaceId]: false }
      }));

      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  updateWorkingContent: (actionId: string, newContent: string) => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === actionId ? { ...a, workingContent: newContent } : a
    );

    const updatedSession: DevSession = {
      ...activeSession,
      actions: updatedActions
    };

    set(state => ({
      activeSession: updatedSession,
      sessionsByWorkspace: currentWorkspaceId 
        ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
        : state.sessionsByWorkspace
    }));
  },

  resetActionWorkingContent: (actionId: string) => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === actionId ? { ...a, workingContent: a.proposedContent } : a
    );

    const updatedSession: DevSession = {
      ...activeSession,
      actions: updatedActions
    };

    set(state => ({
      activeSession: updatedSession,
      sessionsByWorkspace: currentWorkspaceId 
        ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
        : state.sessionsByWorkspace
    }));
  },

  saveActionEdits: async (actionId: string) => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    const action = activeSession.actions.find(a => a.id === actionId);
    if (!action) return;

    set({ isApplying: true, error: null });
    try {
      const absPath = `${action.targetRootPath}/${action.targetRelativePath}`.replace(/\\/g, '/');
      const actionType = action.actionType === 'DELETED' ? 'DELETED' : (action.actionType === 'NEW' ? 'NEW' : 'MODIFIED');
      await window.api.applyFileAction(absPath, action.workingContent, actionType);

      const updatedActions = activeSession.actions.map(a => 
        a.id === actionId ? { 
          ...a, 
          proposedContent: a.workingContent, 
          reviewStatus: 'MERGED' as ActionReviewStatus 
        } : a
      );

      const updatedSession: DevSession = {
        ...activeSession,
        actions: updatedActions,
        updatedAt: new Date().toISOString()
      };

      await window.api.saveDevSession(activeSession.workspaceId, updatedSession);
      set(state => ({
        activeSession: updatedSession,
        isApplying: false,
        sessionsByWorkspace: currentWorkspaceId 
          ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
          : state.sessionsByWorkspace
      }));
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  applyCurrentAction: async () => {
    const { activeSession, activeActionId, currentWorkspaceId } = get();
    if (!activeSession || !activeActionId) return;

    const action = activeSession.actions.find(a => a.id === activeActionId);
    if (!action) return;

    set({ isApplying: true, error: null });
    try {
      const absPath = `${action.targetRootPath}/${action.targetRelativePath}`.replace(/\\/g, '/');
      const actionType = action.actionType === 'DELETED' ? 'DELETED' : (action.actionType === 'NEW' ? 'NEW' : 'MODIFIED');
      const contentToWrite = action.actionType === 'DELETED' ? null : action.workingContent;
      await window.api.applyFileAction(absPath, contentToWrite, actionType);

      const updatedActions = activeSession.actions.map(a => 
        a.id === activeActionId ? { 
          ...a, 
          proposedContent: a.workingContent,
          reviewStatus: 'MERGED' as ActionReviewStatus 
        } : a
      );

      const nextPending = updatedActions.find(a => a.reviewStatus === 'PENDING');
      const nextActionId = nextPending?.id || activeActionId;

      const updatedSession: DevSession = {
        ...activeSession,
        actions: updatedActions,
        updatedAt: new Date().toISOString()
      };

      await window.api.saveDevSession(activeSession.workspaceId, updatedSession);

      set(state => ({
        activeSession: updatedSession,
        activeActionId: nextActionId,
        isApplying: false,
        sessionsByWorkspace: currentWorkspaceId 
          ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
          : state.sessionsByWorkspace,
        activeActionIdsByWorkspace: currentWorkspaceId 
          ? { ...state.activeActionIdsByWorkspace, [currentWorkspaceId]: nextActionId }
          : state.activeActionIdsByWorkspace
      }));
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  revertAction: async (actionId: string) => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    const action = activeSession.actions.find(a => a.id === actionId);
    if (!action) return;

    set({ isApplying: true, error: null });
    try {
      const absPath = `${action.targetRootPath}/${action.targetRelativePath}`.replace(/\\/g, '/');
      const snapshotContent = activeSession.checkpoint.snapshotFiles[absPath];

      if (snapshotContent === null || snapshotContent === undefined) {
        await window.api.applyFileAction(absPath, null, 'DELETED');
      } else {
        await window.api.applyFileAction(absPath, snapshotContent, 'MODIFIED');
      }

      const updatedActions = activeSession.actions.map(a => 
        a.id === actionId ? { 
          ...a, 
          reviewStatus: 'PENDING' as ActionReviewStatus,
          workingContent: a.proposedContent
        } : a
      );

      const updatedSession: DevSession = {
        ...activeSession,
        actions: updatedActions,
        updatedAt: new Date().toISOString()
      };

      await window.api.saveDevSession(activeSession.workspaceId, updatedSession);
      set(state => ({
        activeSession: updatedSession,
        isApplying: false,
        sessionsByWorkspace: currentWorkspaceId 
          ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
          : state.sessionsByWorkspace
      }));
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  rejectCurrentAction: () => {
    const { activeSession, activeActionId, currentWorkspaceId } = get();
    if (!activeSession || !activeActionId) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === activeActionId ? { ...a, reviewStatus: 'REJECTED' as ActionReviewStatus } : a
    );

    const nextPending = updatedActions.find(a => a.reviewStatus === 'PENDING');
    const nextActionId = nextPending?.id || activeActionId;

    const updatedSession: DevSession = {
      ...activeSession,
      actions: updatedActions,
      updatedAt: new Date().toISOString()
    };

    window.api.saveDevSession(activeSession.workspaceId, updatedSession);

    set(state => ({
      activeSession: updatedSession,
      activeActionId: nextActionId,
      sessionsByWorkspace: currentWorkspaceId 
        ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
        : state.sessionsByWorkspace,
      activeActionIdsByWorkspace: currentWorkspaceId 
        ? { ...state.activeActionIdsByWorkspace, [currentWorkspaceId]: nextActionId }
        : state.activeActionIdsByWorkspace
    }));
  },

  restoreActionToPending: (actionId: string) => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === actionId ? { ...a, reviewStatus: 'PENDING' as ActionReviewStatus } : a
    );

    const updatedSession: DevSession = {
      ...activeSession,
      actions: updatedActions,
      updatedAt: new Date().toISOString()
    };

    window.api.saveDevSession(activeSession.workspaceId, updatedSession);
    set(state => ({
      activeSession: updatedSession,
      sessionsByWorkspace: currentWorkspaceId 
        ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
        : state.sessionsByWorkspace
    }));
  },

  applyAllPendingActions: async () => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    set({ isApplying: true, error: null });
    try {
      for (const action of activeSession.actions) {
        if (action.reviewStatus === 'PENDING') {
          const absPath = `${action.targetRootPath}/${action.targetRelativePath}`.replace(/\\/g, '/');
          const actionType = action.actionType === 'DELETED' ? 'DELETED' : (action.actionType === 'NEW' ? 'NEW' : 'MODIFIED');
          const contentToWrite = action.actionType === 'DELETED' ? null : action.workingContent;
          await window.api.applyFileAction(absPath, contentToWrite, actionType);
        }
      }

      const updatedActions = activeSession.actions.map(a => 
        a.reviewStatus === 'PENDING' ? { 
          ...a, 
          proposedContent: a.workingContent,
          reviewStatus: 'MERGED' as ActionReviewStatus 
        } : a
      );

      const updatedSession: DevSession = {
        ...activeSession,
        actions: updatedActions,
        updatedAt: new Date().toISOString()
      };

      await window.api.saveDevSession(activeSession.workspaceId, updatedSession);
      set(state => ({
        activeSession: updatedSession,
        isApplying: false,
        sessionsByWorkspace: currentWorkspaceId 
          ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
          : state.sessionsByWorkspace
      }));
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  revertCurrentSession: async () => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    set({ isApplying: true, error: null });
    try {
      await rollbackCheckpoint(activeSession.checkpoint);

      const updatedActions = activeSession.actions.map(a => ({
        ...a,
        reviewStatus: 'PENDING' as ActionReviewStatus,
        workingContent: a.proposedContent
      }));

      const updatedSession: DevSession = {
        ...activeSession,
        actions: updatedActions,
        updatedAt: new Date().toISOString()
      };

      await window.api.saveDevSession(activeSession.workspaceId, updatedSession);
      set(state => ({
        activeSession: updatedSession,
        isApplying: false,
        sessionsByWorkspace: currentWorkspaceId 
          ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: updatedSession }
          : state.sessionsByWorkspace
      }));
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  completeCurrentSession: async () => {
    const { activeSession, currentWorkspaceId } = get();
    if (!activeSession) return;

    const completedSession: DevSession = {
      ...activeSession,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await window.api.saveDevSession(activeSession.workspaceId, completedSession);

    set(state => ({
      activeSession: null,
      activeActionId: null,
      isStudioOpen: false,
      isIngestionModalOpen: false,
      isBrowserModalOpen: true,
      sessionsByWorkspace: currentWorkspaceId 
        ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: null }
        : state.sessionsByWorkspace,
      openStudioByWorkspace: currentWorkspaceId 
        ? { ...state.openStudioByWorkspace, [currentWorkspaceId]: false }
        : state.openStudioByWorkspace
    }));
  },

  exitCurrentSession: () => {
    const { currentWorkspaceId } = get();
    set(state => ({
      activeSession: null,
      activeActionId: null,
      isStudioOpen: false,
      isIngestionModalOpen: false,
      isBrowserModalOpen: true,
      openStudioByWorkspace: currentWorkspaceId 
        ? { ...state.openStudioByWorkspace, [currentWorkspaceId]: false }
        : state.openStudioByWorkspace
    }));
  },

  loadSession: async (workspaceId, sessionId) => {
    const session = await window.api.loadDevSession(workspaceId, sessionId);
    if (session) {
      const firstPending = session.actions.find(a => a.reviewStatus === 'PENDING') || session.actions[0];
      const targetActionId = firstPending?.id || null;

      set(state => ({
        currentWorkspaceId: workspaceId,
        activeSession: session,
        activeActionId: targetActionId,
        isStudioOpen: true,
        isBrowserModalOpen: false,
        isIngestionModalOpen: false,
        planScrollTop: 0,
        sessionsByWorkspace: { ...state.sessionsByWorkspace, [workspaceId]: session },
        activeActionIdsByWorkspace: { ...state.activeActionIdsByWorkspace, [workspaceId]: targetActionId },
        openStudioByWorkspace: { ...state.openStudioByWorkspace, [workspaceId]: true },
        openIngestionByWorkspace: { ...state.openIngestionByWorkspace, [workspaceId]: false }
      }));
    }
  },

  deleteSession: async (workspaceId, sessionId) => {
    await window.api.deleteDevSession(workspaceId, sessionId);
    set(state => {
      const nextSessions = { ...state.sessionsByWorkspace };
      if (nextSessions[workspaceId]?.id === sessionId) {
        nextSessions[workspaceId] = null;
      }
      return {
        sessionsByWorkspace: nextSessions,
        activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
        activeActionId: state.activeSession?.id === sessionId ? null : state.activeActionId,
        isStudioOpen: state.activeSession?.id === sessionId ? false : state.isStudioOpen
      };
    });
  },

  batchDeleteSessions: async (workspaceId, sessionIds) => {
    for (const id of sessionIds) {
      await window.api.deleteDevSession(workspaceId, id);
    }
    set(state => {
      const nextSessions = { ...state.sessionsByWorkspace };
      if (nextSessions[workspaceId] && sessionIds.includes(nextSessions[workspaceId]!.id)) {
        nextSessions[workspaceId] = null;
      }
      return {
        sessionsByWorkspace: nextSessions,
        activeSession: state.activeSession && sessionIds.includes(state.activeSession.id) ? null : state.activeSession,
        activeActionId: state.activeSession && sessionIds.includes(state.activeSession.id) ? null : state.activeActionId,
        isStudioOpen: state.activeSession && sessionIds.includes(state.activeSession.id) ? false : state.isStudioOpen
      };
    });
  },

  discardCurrentSession: () => {
    const { currentWorkspaceId } = get();
    set(state => ({
      activeSession: null,
      activeActionId: null,
      isStudioOpen: false,
      isIngestionModalOpen: false,
      planScrollTop: 0,
      sessionsByWorkspace: currentWorkspaceId 
        ? { ...state.sessionsByWorkspace, [currentWorkspaceId]: null }
        : state.sessionsByWorkspace,
      openStudioByWorkspace: currentWorkspaceId 
        ? { ...state.openStudioByWorkspace, [currentWorkspaceId]: false }
        : state.openStudioByWorkspace,
      openIngestionByWorkspace: currentWorkspaceId 
        ? { ...state.openIngestionByWorkspace, [currentWorkspaceId]: false }
        : state.openIngestionByWorkspace
    }));
  }
}));