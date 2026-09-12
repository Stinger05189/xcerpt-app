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
  isApplying: boolean;
  error: string | null;

  setIngestionModalOpen: (open: boolean) => void;
  setStudioOpen: (open: boolean) => void;
  setActiveActionId: (id: string | null) => void;

  initSessionFromMarkdown: (
    rawMarkdown: string,
    workspaceId: string,
    rootPaths: string[]
  ) => Promise<DevSession>;

  applyCurrentAction: () => Promise<void>;
  rejectCurrentAction: () => void;
  applyAllPendingActions: () => Promise<void>;
  revertCurrentSession: () => Promise<void>;
  loadSession: (workspaceId: string, sessionId: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  activeActionId: null,
  isStudioOpen: false,
  isIngestionModalOpen: false,
  isApplying: false,
  error: null,

  setIngestionModalOpen: (open) => set({ isIngestionModalOpen: open, error: null }),
  setStudioOpen: (open) => set({ isStudioOpen: open }),
  setActiveActionId: (id) => set({ activeActionId: id }),

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

      set({
        activeSession: session,
        activeActionId: session.actions[0]?.id || null,
        isIngestionModalOpen: false,
        isStudioOpen: true
      });

      return session;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
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
      await window.api.applyFileAction(absPath, action.proposedContent, actionType);

      const updatedActions = activeSession.actions.map(a => 
        a.id === activeActionId ? { ...a, reviewStatus: 'MERGED' as ActionReviewStatus } : a
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

  applyAllPendingActions: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    set({ isApplying: true, error: null });
    try {
      for (const action of activeSession.actions) {
        if (action.reviewStatus === 'PENDING') {
          const absPath = `${action.targetRootPath}/${action.targetRelativePath}`.replace(/\\/g, '/');
          const actionType = action.actionType === 'DELETED' ? 'DELETED' : (action.actionType === 'NEW' ? 'NEW' : 'MODIFIED');
          await window.api.applyFileAction(absPath, action.proposedContent, actionType);
        }
      }

      const updatedActions = activeSession.actions.map(a => 
        a.reviewStatus === 'PENDING' ? { ...a, reviewStatus: 'MERGED' as ActionReviewStatus } : a
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
        reviewStatus: 'PENDING' as ActionReviewStatus
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
      set({
        activeSession: session,
        activeActionId: session.actions[0]?.id || null,
        isStudioOpen: true
      });
    }
  }
}));