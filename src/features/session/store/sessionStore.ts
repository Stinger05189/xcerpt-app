// src/features/session/store/sessionStore.ts
import { create } from 'zustand';
import type { DevSession, ActionReviewStatus } from '../types/session';
import { parseSessionMarkdown } from '../engine/sessionParser';
import { rollbackCheckpoint } from '../engine/checkpointEngine';

interface SessionState {
  activeSession: DevSession | null;
  activeActionId: string | null;
  isStudioOpen: boolean;
  isIngestionModalOpen: boolean;
  isBrowserModalOpen: boolean;
  isApplying: boolean;
  error: string | null;
  planScrollTop: number;

  setIngestionModalOpen: (open: boolean) => void;
  setStudioOpen: (open: boolean) => void;
  setBrowserModalOpen: (open: boolean) => void;
  setActiveActionId: (id: string | null) => void;
  setPlanScrollTop: (scrollTop: number) => void;

  initSessionFromMarkdown: (
    rawMarkdown: string,
    workspaceId: string,
    rootPaths: string[]
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
  loadSession: (workspaceId: string, sessionId: string) => Promise<void>;
  deleteSession: (workspaceId: string, sessionId: string) => Promise<void>;
  discardCurrentSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  activeActionId: null,
  isStudioOpen: false,
  isIngestionModalOpen: false,
  isBrowserModalOpen: false,
  isApplying: false,
  error: null,
  planScrollTop: 0,

  setIngestionModalOpen: (open) => set({ isIngestionModalOpen: open, error: null }),
  setStudioOpen: (open) => set({ isStudioOpen: open }),
  setBrowserModalOpen: (open) => set({ isBrowserModalOpen: open }),
  setActiveActionId: (id) => set({ activeActionId: id }),
  setPlanScrollTop: (scrollTop) => set({ planScrollTop: scrollTop }),

  initSessionFromMarkdown: async (rawMarkdown, workspaceId, rootPaths) => {
    set({ error: null });
    try {
      const existingFilesMap: Record<string, string | null> = {};
      const preliminaryActions = rawMarkdown.match(/(\/\/|#|<!--|--)\s*\[(NEW|MODIFIED|DELETED)\]\s+([^\r\n]+)/gi) || [];

      for (const line of preliminaryActions) {
        const pathPart = line.replace(/(\/\/|#|<!--|--)\s*\[(NEW|MODIFIED|DELETED)\]\s+/, '').replace(/[->]+$/, '').trim();
        for (const root of rootPaths) {
          const abs = `${root}/${pathPart}`.replace(/\\/g, '/');
          try {
            const text = await window.api.readFile(abs);
            existingFilesMap[abs] = text;
          } catch {
            existingFilesMap[abs] = null;
          }
        }
      }

      const session = parseSessionMarkdown(rawMarkdown, workspaceId, rootPaths, existingFilesMap);
      await window.api.saveDevSession(workspaceId, session);

      const firstPending = session.actions.find(a => a.reviewStatus === 'PENDING') || session.actions[0];

      set({
        activeSession: session,
        activeActionId: firstPending?.id || null,
        isIngestionModalOpen: false,
        isStudioOpen: true,
        planScrollTop: 0
      });

      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  updateWorkingContent: (actionId: string, newContent: string) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === actionId ? { ...a, workingContent: newContent } : a
    );

    set({
      activeSession: {
        ...activeSession,
        actions: updatedActions
      }
    });
  },

  resetActionWorkingContent: (actionId: string) => {
    const { activeSession } = get();
    if (!activeSession) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === actionId ? { ...a, workingContent: a.proposedContent } : a
    );

    set({
      activeSession: {
        ...activeSession,
        actions: updatedActions
      }
    });
  },

  saveActionEdits: async (actionId: string) => {
    const { activeSession } = get();
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
      set({ activeSession: updatedSession, isApplying: false });
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  applyCurrentAction: async () => {
    const { activeSession, activeActionId } = get();
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
      const updatedSession: DevSession = {
        ...activeSession,
        actions: updatedActions,
        updatedAt: new Date().toISOString()
      };

      await window.api.saveDevSession(activeSession.workspaceId, updatedSession);

      set({
        activeSession: updatedSession,
        activeActionId: nextPending?.id || activeActionId,
        isApplying: false
      });
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  revertAction: async (actionId: string) => {
    const { activeSession } = get();
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
      set({ activeSession: updatedSession, isApplying: false });
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  rejectCurrentAction: () => {
    const { activeSession, activeActionId } = get();
    if (!activeSession || !activeActionId) return;

    const updatedActions = activeSession.actions.map(a => 
      a.id === activeActionId ? { ...a, reviewStatus: 'REJECTED' as ActionReviewStatus } : a
    );

    const nextPending = updatedActions.find(a => a.reviewStatus === 'PENDING');
    const updatedSession: DevSession = {
      ...activeSession,
      actions: updatedActions,
      updatedAt: new Date().toISOString()
    };

    window.api.saveDevSession(activeSession.workspaceId, updatedSession);

    set({
      activeSession: updatedSession,
      activeActionId: nextPending?.id || activeActionId
    });
  },

  restoreActionToPending: (actionId: string) => {
    const { activeSession } = get();
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
    set({ activeSession: updatedSession });
  },

  applyAllPendingActions: async () => {
    const { activeSession } = get();
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
      set({ activeSession: updatedSession, isApplying: false });
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  revertCurrentSession: async () => {
    const { activeSession } = get();
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
      set({ activeSession: updatedSession, isApplying: false });
    } catch (err: unknown) {
      set({ isApplying: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  loadSession: async (workspaceId, sessionId) => {
    const session = await window.api.loadDevSession(workspaceId, sessionId);
    if (session) {
      const firstPending = session.actions.find(a => a.reviewStatus === 'PENDING') || session.actions[0];
      set({
        activeSession: session,
        activeActionId: firstPending?.id || null,
        isStudioOpen: true,
        isBrowserModalOpen: false,
        planScrollTop: 0
      });
    }
  },

  deleteSession: async (workspaceId, sessionId) => {
    await window.api.deleteDevSession(workspaceId, sessionId);
    const { activeSession } = get();
    if (activeSession && activeSession.id === sessionId) {
      set({ activeSession: null, activeActionId: null, isStudioOpen: false });
    }
  },

  discardCurrentSession: () => {
    set({
      activeSession: null,
      activeActionId: null,
      isStudioOpen: false,
      isIngestionModalOpen: false,
      planScrollTop: 0
    });
  }
}));