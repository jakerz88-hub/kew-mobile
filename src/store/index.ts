import { create } from "zustand";
import type { Queue, User } from "../types";
import { api } from "../services/api";

interface AppState {
  user: User | null;
  queue: Queue | null;
  isLoadingQueue: boolean;
  isLoadingUser: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  fetchQueue: () => Promise<void>;
  addToQueue: (ytVideoId: string) => Promise<void>;
  removeFromQueue: (entryId: string) => Promise<void>;
  moveToEnd: (entryId: string) => Promise<void>;
  shuffleQueue: () => Promise<void>;
  updateProgress: (entryId: string, progressSecs: number) => Promise<void>;
  skipCurrent: () => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  queue: null,
  isLoadingQueue: false,
  isLoadingUser: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchUser: async () => {
    set({ isLoadingUser: true });
    try {
      const user = await api.getProfile();
      set({ user, isLoadingUser: false });
    } catch (e: any) {
      set({ error: e.message, isLoadingUser: false });
    }
  },

  fetchQueue: async () => {
    set({ isLoadingQueue: true });
    try {
      const queue = await api.getQueue();
      set({ queue, isLoadingQueue: false });
    } catch (e: any) {
      set({ error: e.message, isLoadingQueue: false });
    }
  },

  addToQueue: async (ytVideoId: string) => {
    try {
      await api.addToQueue(ytVideoId);
      await get().fetchQueue();
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  removeFromQueue: async (entryId: string) => {
    try {
      await api.removeFromQueue(entryId);
      await get().fetchQueue();
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  moveToEnd: async (entryId: string) => {
    try {
      await api.moveToEnd(entryId);
      await get().fetchQueue();
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
      set((state) => ({
        user: state.user
          ? { ...state.user, skipsRemaining: result.skipsRemaining }
          : null,
      }));
      await get().fetchQueue();
    } catch (e: any) {
      set({ error: e.message });
    }
  },
}));
