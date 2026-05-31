import { create } from "zustand";
import type { Queue, User, KewQueue } from "../types";
import { api } from "../services/api";
import { friendlyError } from "../utils/friendlyError";

export interface KewPlusUpsell {
  headline: string;
  body: string;
}

// Per-video info kept in the queuedVideos map. ytVideoId is implicit (the map key).
export interface QueuedVideoInfo {
  entryId: string;
  queueId: string;
  queueName: string;
  queueEmoji: string | null;
}

interface AppState {
  user: User | null;
  queue: Queue | null;
  queues: KewQueue[];
  activeQueueId: string | null;
  // Cross-queue map of every pending+watching entry across the user's queues,
  // keyed by ytVideoId. Powers "✓ In queue" badges on screens that need to
  // know about non-active queues, plus the entry_id + queue name for the
  // long-press remove flow. Empty {} for free users (one-queue, no need).
  queuedVideos: Record<string, QueuedVideoInfo>;
  isLoadingQueue: boolean;
  isLoadingUser: boolean;
  isLoadingQueues: boolean;
  error: string | null;
  kewPlusUpsell: KewPlusUpsell | null;
  showKewPlusUpsell: (upsell: KewPlusUpsell) => void;
  hideKewPlusUpsell: () => void;
  // One-shot global toast queue. Set by an action; consumed by whichever
  // screen mounts the Toast UI next. Needed for cross-tab confirmations on
  // iPad where TabletNavigator switches via internal state, so React
  // Navigation params don't reach the destination tab.
  pendingToast: string | null;
  setPendingToast: (msg: string | null) => void;
  fetchUser: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  fetchQueues: () => Promise<void>;
  fetchQueuedVideos: () => Promise<void>;
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
  watchNow: (ytVideoId?: string, sourceEntryId?: string) => Promise<{ queueSwitched: boolean }>;
  updateProgress: (entryId: string, progressSecs: number) => Promise<void>;
  // Called by PlayerScreen after a video finishes naturally; drops the entry
  // from queuedVideos so re-add affordances flip back to ↺/+ across screens.
  markEntryCompleted: (entryId: string) => void;
  skipCurrent: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

// Helper: drop one ytVideoId from the map.
function dropQueued(map: Record<string, QueuedVideoInfo>, ytVideoId: string): Record<string, QueuedVideoInfo> {
  if (!(ytVideoId in map)) return map;
  const { [ytVideoId]: _, ...rest } = map;
  return rest;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  queue: null,
  queues: [],
  activeQueueId: null,
  queuedVideos: {},
  isLoadingQueue: false,
  isLoadingUser: false,
  isLoadingQueues: false,
  error: null,
  kewPlusUpsell: null,
  pendingToast: null,

  showKewPlusUpsell: (upsell) => set({ kewPlusUpsell: upsell }),
  hideKewPlusUpsell: () => set({ kewPlusUpsell: null }),

  setPendingToast: (msg) => set({ pendingToast: msg }),

  clearError: () => set({ error: null }),

  // Wipe user-scoped state. Call on sign-out so the next sign-in (same device,
  // different user) starts clean instead of inheriting the previous user's
  // queue, queues, and activeQueueId.
  reset: () => set({
    user: null,
    queue: null,
    queues: [],
    activeQueueId: null,
    queuedVideos: {},
    isLoadingQueue: false,
    isLoadingUser: false,
    isLoadingQueues: false,
    error: null,
    kewPlusUpsell: null,
  }),

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
      // Pro users get the cross-queue map; free users keep {} and screens
      // fall back to queue?.entries for inQueue checks.
      if (user.plan === "pro") {
        get().fetchQueuedVideos();
      }
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg, isLoadingUser: false });
    }
  },

  fetchQueue: async () => {
    set({ isLoadingQueue: true });
    try {
      const queue = await api.getQueue(get().activeQueueId ?? undefined);
      set({ queue, isLoadingQueue: false });
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg, isLoadingQueue: false });
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

  fetchQueuedVideos: async () => {
    // Free users only ever have their main queue active, and the inQueue
    // check on every screen falls back to queue?.entries — no need to hit
    // the endpoint for them. Pro users (and unknown-plan during bootstrap
    // race) get the cross-queue map.
    if (get().user?.plan === "free") return;
    try {
      const items = await api.getQueuedVideos();
      const map: Record<string, QueuedVideoInfo> = {};
      for (const item of items) {
        map[item.ytVideoId] = {
          entryId: item.entryId,
          queueId: item.queueId,
          queueName: item.queueName,
          queueEmoji: item.queueEmoji,
        };
      }
      set({ queuedVideos: map });
    } catch {
      // Silent — screens will still work via the queue?.entries fallback.
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
    // Update queue name/emoji in place on any queuedVideos entries that
    // belong to this queue, so the long-press subtitle stays accurate.
    set(s => {
      const updatedQueue = s.queues.find(q => q.id === id);
      if (!updatedQueue) return {};
      const next: Record<string, QueuedVideoInfo> = {};
      let changed = false;
      for (const [ytId, info] of Object.entries(s.queuedVideos)) {
        if (info.queueId === id && (info.queueName !== updatedQueue.name || info.queueEmoji !== updatedQueue.emoji)) {
          next[ytId] = { ...info, queueName: updatedQueue.name, queueEmoji: updatedQueue.emoji };
          changed = true;
        } else {
          next[ytId] = info;
        }
      }
      return changed ? { queuedVideos: next } : {};
    });
  },

  pinQueue: async (id: string, pinned: boolean) => {
    try {
      const updated = await api.updateQueue(id, { pinned });
      set(s => ({ queues: s.queues.map(q => q.id === id ? updated : q) }));
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg });
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
    // Drop all entries that lived in the deleted queue from the cross-queue map.
    set(s => {
      const next: Record<string, QueuedVideoInfo> = {};
      let changed = false;
      for (const [ytId, info] of Object.entries(s.queuedVideos)) {
        if (info.queueId === id) { changed = true; continue; }
        next[ytId] = info;
      }
      return changed ? { queuedVideos: next } : {};
    });
  },

  addToQueue: async (ytVideoId: string, queueId?: string) => {
    try {
      await api.addToQueue(ytVideoId, queueId);
      const targetId = queueId ?? get().activeQueueId;
      // Bump chip count + optimistically insert into queuedVideos so all
      // screens watching the map flip to ✓ immediately. The real entry_id
      // arrives on the next fetchQueue / fetchQueuedVideos refresh — we
      // use the ytVideoId as a placeholder so removeFromQueue still works
      // if the user long-presses before the refetch lands. (In practice
      // the fetchQueue() call below reconciles the entry_id for the
      // active queue; non-active-queue entry_ids stay placeholder until
      // the next fetchQueuedVideos runs.)
      set(s => {
        const targetQueue = targetId ? s.queues.find(q => q.id === targetId) : null;
        const nextQueuedVideos: Record<string, QueuedVideoInfo> = targetQueue
          ? { ...s.queuedVideos, [ytVideoId]: {
              entryId: s.queuedVideos[ytVideoId]?.entryId ?? "",
              queueId: targetQueue.id,
              queueName: targetQueue.name,
              queueEmoji: targetQueue.emoji,
            } }
          : s.queuedVideos;
        return {
          queuedVideos: nextQueuedVideos,
          queues: targetId
            ? s.queues.map(q => q.id === targetId ? { ...q, videoCount: q.videoCount + 1 } : q)
            : s.queues,
        };
      });
      await get().fetchQueue();
      // Refresh the cross-queue map so the optimistic placeholder entry_id
      // gets replaced with the real one (needed for long-press remove on
      // non-active queues). Fire-and-forget — UI already flipped.
      get().fetchQueuedVideos();
    } catch (e: any) {
      // Don't surface queue_limit_reached as a generic error banner —
      // useAddToQueue handles it with a dedicated Alert. Other errors
      // still get the banner.
      if (e?.code !== "queue_limit_reached") {
        const msg = friendlyError(e); set({ error: msg });
      }
      throw e;
    }
  },

  removeFromQueue: async (entryId: string) => {
    try {
      await api.removeFromQueue(entryId);
      set(s => {
        // Find the ytVideoId for this entry — check active queue first,
        // then fall back to the cross-queue map (covers non-active queue
        // removes initiated from Browse/Channel/etc long-press).
        let removedYtId: string | undefined;
        if (s.queue?.current?.id === entryId) {
          removedYtId = s.queue.current.video.ytVideoId;
        } else if (s.queue) {
          removedYtId = s.queue.entries.find(e => e.id === entryId)?.video.ytVideoId;
        }
        if (!removedYtId) {
          // Non-active queue remove: look up via queuedVideos
          const match = Object.entries(s.queuedVideos).find(([, info]) => info.entryId === entryId);
          if (match) removedYtId = match[0];
        }

        // Optimistic chip count update for the source queue.
        const sourceQueueId = removedYtId ? s.queuedVideos[removedYtId]?.queueId ?? s.activeQueueId : s.activeQueueId;
        const updatedQueues = sourceQueueId
          ? s.queues.map(q => q.id === sourceQueueId ? { ...q, videoCount: Math.max(0, q.videoCount - 1) } : q)
          : s.queues;

        const nextQueuedVideos = removedYtId ? dropQueued(s.queuedVideos, removedYtId) : s.queuedVideos;

        if (!s.queue) {
          return { queuedVideos: nextQueuedVideos, queues: updatedQueues };
        }

        const wasWatching = s.queue.current?.id === entryId;
        const newEntries = s.queue.entries.filter(e => e.id !== entryId);
        let newCurrent = wasWatching ? null : s.queue.current;
        let finalEntries = newEntries;
        if (wasWatching && newEntries.length > 0) {
          finalEntries = newEntries.map((e, i) => i === 0 ? { ...e, status: "watching" as const } : e);
          newCurrent = finalEntries[0];
        }
        return {
          queue: { ...s.queue, entries: finalEntries, total: finalEntries.length, current: newCurrent },
          queuedVideos: nextQueuedVideos,
          queues: updatedQueues,
        };
      });
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg });
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

        // Update the cross-queue map: the entry now lives in targetQueueId.
        const targetQueue = s.queues.find(q => q.id === targetQueueId);
        const movedYtId = s.queue?.current?.id === entryId
          ? s.queue.current.video.ytVideoId
          : s.queue?.entries.find(e => e.id === entryId)?.video.ytVideoId;
        const nextQueuedVideos = (movedYtId && targetQueue && s.queuedVideos[movedYtId])
          ? { ...s.queuedVideos, [movedYtId]: { ...s.queuedVideos[movedYtId], queueId: targetQueue.id, queueName: targetQueue.name, queueEmoji: targetQueue.emoji } }
          : s.queuedVideos;

        if (!s.queue) return { queues: updatedQueues, queuedVideos: nextQueuedVideos };
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
          queuedVideos: nextQueuedVideos,
        };
      });
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg });
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
      const msg = friendlyError(e); set({ error: msg });
      throw e;
    }
  },

  shuffleQueue: async () => {
    try {
      await api.shuffleQueue();
      await get().fetchQueue();
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg });
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
      const msg = friendlyError(e); set({ error: msg });
      throw e;
    }
  },

  watchNow: async (ytVideoId?: string, sourceEntryId?: string) => {
    const { activeQueueId } = get();
    try {
      const result = await api.watchNow(ytVideoId, sourceEntryId);
      const queueSwitched = activeQueueId !== result.mainQueueId;
      set(s => ({
        activeQueueId: result.mainQueueId,
        user: s.user
          ? { ...s.user, skipsRemaining: result.skipsRemaining, skipsMax: result.skipsMax }
          : s.user,
      }));
      await get().fetchQueue();
      get().fetchQueuedVideos();
      return { queueSwitched };
    } catch (e: any) {
      // Match addToQueue: don't double-surface queue_limit_reached as a banner;
      // the consumer (WatchNowSheet) will trigger the existing kew+ upsell.
      if (e?.code !== "queue_limit_reached") {
        const msg = friendlyError(e); set({ error: msg });
      }
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

  markEntryCompleted: (entryId: string) => {
    set(s => {
      // Find the ytVideoId from the active queue (since completion always
      // happens on queue.current).
      const ytId = s.queue?.current?.id === entryId
        ? s.queue.current.video.ytVideoId
        : s.queue?.entries.find(e => e.id === entryId)?.video.ytVideoId;
      if (!ytId) return {};
      return { queuedVideos: dropQueued(s.queuedVideos, ytId) };
    });
  },

  skipCurrent: async () => {
    const { user } = get();
    if (!user || user.skipsRemaining <= 0) {
      set({ error: "No skips remaining. Finish a video to earn one back." });
      return;
    }
    try {
      // Capture the ytVideoId of the soon-to-be-skipped entry BEFORE the API
      // call, so we can drop it from queuedVideos even if the queue refreshes
      // mid-flight.
      const skippedYtId = get().queue?.current?.video.ytVideoId;
      const result = await api.skipCurrent();
      set(s => {
        const nextQueuedVideos = skippedYtId ? dropQueued(s.queuedVideos, skippedYtId) : s.queuedVideos;
        if (!s.queue) return { queuedVideos: nextQueuedVideos };
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
          queuedVideos: nextQueuedVideos,
        };
      });
    } catch (e: any) {
      const msg = friendlyError(e); set({ error: msg });
    }
  },
}));
