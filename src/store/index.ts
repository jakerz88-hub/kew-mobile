import { create } from "zustand";
import type { Queue, User, KewQueue } from "../types";
import { api } from "../services/api";

export interface KewPlusUpsell {
  headline: string;
  body: string;
}

interface AppState {
  user: User | null;
  queue: Queue | null;
  queues: KewQueue[];
  activeQueueId: string | null;
  isLoadingQueue: boolean;
  isLoadingUser: boolean;
  isLoadingQueues: boolean;
  error: string | null;
  kewPlusUpsell: KewPlusUpsell | null;
  showKewPlusUpsell: (upsell: KewPlusUpsell) => void;
  hideKewPlusUpsell: () => void;
  fetchUser: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchQueues: () => Promise<void>;
  setActiveQueue: (id: string) => Promise<void>;
  createQueue: (name: string, emoji: string | null) => Promise<KewQueue>;
  updateQueue: (id: string, name?: string, emoji?: string | null) => Promise<void>;
  pinQueue: (id: string, pinned: boolean) => Promise<void>;
  deleteQueue: (id: string) => Promise<void>;
  addToQueue: (ytVideoId: string, queueId?: string) => Promise<void>;
  removeFromQueue: (entryId: string) => Promise<void>;
  moveToQueue: (entryId: string, targetQueueId: string) => Promise<void>;
  moveToEnd: (entryId: string) => Promise<void>;
  shuffleQueue: () => Promise<void>;
  reorderQueue: (entryId: string, newPosition: number, useSkip: boolean) => Promise<{ skipsRemaining: number; skipsMax: number }>;
  updateProgress: (entryId: string, progressSecs: number) => Promise<void>;
  skipCurrent: () => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  queue: null,
  queues: [],
  activeQueueId: null,
  isLoadingQueue: false,
  isLoadingUser: false,
  isLoadingQueues: false,
  error: null,
  kewPlusUpsell: null,

  showKewPlusUpsell: (upsell) => set({ kewPlusUpsell: upsell }),
  hideKewPlusUpsell: () => set({ kewPlusUpsell: null }),

  clearError: () => set({ error: null }),

  fetchUser: async () => {
    set({ isLoadingUser: true });
    try {
      const user = await api.getProfile();
      // Initialize activeQueueId from user profile if not already set
      set(s => ({
        user,
        isLoadingUser: false,
        activeQueueId: s.activeQueueId ?? user.activeQueueId,
      }));
    } catch (e: any) {
      set({ error: e.message, isLoadingUser: false });
    }
  },

  fetchQueue: async () => {
    set({ isLoadingQueue: true });
    try {
      const queue = await api.getQueue(get().activeQueueId ?? undefined);
      set({ queue, isLoadingQueue: false });
    } catch (e: any) {
      set({ error: e.message, isLoadingQueue: false });
    }
  },

  fetchQueues: async () => {
    set({ isLoadingQueues: true });
    try {
      const queues = await api.listQueues();
      set({ queues, isLoadingQueues: false });
    } catch (e: any) {
      set({ isLoadingQueues: false });
    }
  },

  setActiveQueue: async (id: string) => {
    set({ activeQueueId: id });
    api.activateQueue(id).catch(() => { /* fire-and-forget */ });
    await get().fetchQueue();
  },

  createQueue: async (name: string, emoji: string | null) => {
    const queue = await api.createQueue({ name, emoji });
    await get().fetchQueues();
    return queue;
  },

  updateQueue: async (id: string, name?: string, emoji?: string | null) => {
    await api.updateQueue(id, { name, emoji });
    await get().fetchQueues();
  },

  pinQueue: async (id: string, pinned: boolean) => {
    try {
      const updated = await api.updateQueue(id, { pinned });
      set(s => ({ queues: s.queues.map(q => q.id === id ? updated : q) }));
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  deleteQueue: async (id: string) => {
    await api.deleteQueue(id);
    // If we deleted the active queue, reset to null so fetchQueues/fetchQueue pick up main
    if (get().activeQueueId === id) {
      set({ activeQueueId: null });
    }
    await get().fetchQueues();
    await get().fetchQueue();
  },

  addToQueue: async (ytVideoId: string, queueId?: string) => {
    try {
      await api.addToQueue(ytVideoId, queueId);
      // Immediately update the chip count for the target queue.
      const targetId = queueId ?? get().activeQueueId;
      if (targetId) {
        set(s => ({
          queues: s.queues.map(q => q.id === targetId ? { ...q, videoCount: q.videoCount + 1 } : q),
        }));
      }
      await get().fetchQueue();
    } catch (e: any) {
      // Don't surface queue_limit_reached as a generic error banner —
      // useAddToQueue handles it with a dedicated Alert. Other errors
      // still get the banner.
      if (e?.code !== "queue_limit_reached") {
        set({ error: e.message });
      }
      throw e;
    }
  },

  removeFromQueue: async (entryId: string) => {
    try {
      await api.removeFromQueue(entryId);
      set(s => {
        if (!s.queue) return {};
        const wasWatching = s.queue.current?.id === entryId;
        const newEntries = s.queue.entries.filter(e => e.id !== entryId);
        let newCurrent = wasWatching ? null : s.queue.current;
        let finalEntries = newEntries;
        if (wasWatching && newEntries.length > 0) {
          finalEntries = newEntries.map((e, i) => i === 0 ? { ...e, status: "watching" as const } : e);
          newCurrent = finalEntries[0];
        }
        return { queue: { ...s.queue, entries: finalEntries, total: finalEntries.length, current: newCurrent } };
      });
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  moveToQueue: async (entryId: string, targetQueueId: string) => {
    try {
      await api.moveToQueue(entryId, targetQueueId);
      set(s => {
        // Optimistically update chip counts: source -1, target +1.
        const sourceId = s.activeQueueId;
        const updatedQueues = s.queues.map(q => {
          if (q.id === sourceId)     return { ...q, videoCount: Math.max(0, q.videoCount - 1) };
          if (q.id === targetQueueId) return { ...q, videoCount: q.videoCount + 1 };
          return q;
        });
        if (!s.queue) return { queues: updatedQueues };
        const wasWatching = s.queue.current?.id === entryId;
        const newEntries = s.queue.entries.filter(e => e.id !== entryId);
        let newCurrent = wasWatching ? null : s.queue.current;
        let finalEntries = newEntries;
        if (wasWatching && newEntries.length > 0) {
          finalEntries = newEntries.map((e, i) => i === 0 ? { ...e, status: "watching" as const } : e);
          newCurrent = finalEntries[0];
        }
        return {
          queues: updatedQueues,
          queue: { ...s.queue, entries: finalEntries, total: finalEntries.length, current: newCurrent },
        };
      });
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  moveToEnd: async (entryId: string) => {
    try {
      await api.moveToEnd(entryId);
      set(s => {
        if (!s.queue) return {};
        const wasWatching = s.queue.current?.id === entryId;
        const entry = s.queue.entries.find(e => e.id === entryId);
        if (!entry) return {};
        const withoutEntry = s.queue.entries.filter(e => e.id !== entryId);
        const movedEntry = { ...entry, status: "pending" as const };
        let finalEntries: typeof withoutEntry;
        let newCurrent = wasWatching ? null : s.queue.current;
        if (wasWatching && withoutEntry.length > 0) {
          finalEntries = [
            { ...withoutEntry[0], status: "watching" as const },
            ...withoutEntry.slice(1),
            movedEntry,
          ];
          newCurrent = finalEntries[0];
        } else {
          finalEntries = [...withoutEntry, movedEntry];
        }
        return { queue: { ...s.queue, entries: finalEntries, current: newCurrent } };
      });
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  shuffleQueue: async () => {
    try {
      await api.shuffleQueue();
      await get().fetchQueue();
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  reorderQueue: async (entryId: string, newPosition: number, useSkip: boolean) => {
    try {
      const result = await api.reorderQueue(entryId, newPosition, useSkip);
      set(s => {
        if (!s.queue) return {};
        const watching = s.queue.entries.filter(e => e.status === "watching");
        const pending = s.queue.entries.filter(e => e.status === "pending");
        const entry = pending.find(e => e.id === entryId);
        if (!entry) return {};
        const pendingWithout = pending.filter(e => e.id !== entryId);
        const insertAt = Math.max(0, Math.min(pendingWithout.length, newPosition - 1));
        const newPending = [...pendingWithout.slice(0, insertAt), entry, ...pendingWithout.slice(insertAt)];
        const newEntries = [...watching, ...newPending];
        const newUser = useSkip && s.user
          ? { ...s.user, skipsRemaining: result.skipsRemaining, skipsMax: result.skipsMax }
          : s.user;
        return { queue: { ...s.queue, entries: newEntries }, user: newUser };
      });
      return result;
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  updateProgress: async (entryId: string, progressSecs: number) => {
    try {
      await api.updateProgress(entryId, progressSecs);
    } catch {
      // Silently fail
    }
  },

  skipCurrent: async () => {
    const { user } = get();
    if (!user || user.skipsRemaining <= 0) {
      set({ error: "No skips remaining. Finish a video to earn one back." });
      return;
    }
    try {
      const result = await api.skipCurrent();
      set(s => {
        if (!s.queue) return {};
        const entries = s.queue.entries;
        const movedEntry = entries.find(e => e.id === result.movedEntryId);
        const rest = entries.filter(e => e.id !== result.movedEntryId);
        const updatedRest = result.nextEntry
          ? rest.map(e => e.id === result.nextEntry!.id ? { ...e, status: "watching" as const } : e)
          : rest;
        const newEntries = movedEntry
          ? [...updatedRest, { ...movedEntry, status: "pending" as const, watchProgressSecs: 0 }]
          : updatedRest;
        return {
          queue: { ...s.queue, entries: newEntries, current: result.nextEntry ?? null },
          user: s.user ? { ...s.user, skipsRemaining: result.skipsRemaining, skipsMax: result.skipsMax } : null,
        };
      });
    } catch (e: any) {
      set({ error: e.message });
    }
  },
}));
