import { supabase } from "./supabase";
import Constants from "expo-constants";
import type { Queue, BrowseVideo, Channel, User, SkipResult, Playlist, PlaylistVideosResult, ImportResult, KewQueue, Insights, InsightsPeriod, Intentionality, WatchLimits, WatchEventType } from "../types";

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || Constants.expoConfig?.extra?.API_BASE_URL) as string;

// Convert snake_case keys to camelCase recursively
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function keysToCamel<T>(obj: any): T {
  if (Array.isArray(obj)) return obj.map(v => keysToCamel(v)) as any;
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamel(k), keysToCamel(v)])
    ) as any;
  }
  return obj;
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`${res.status}: ${errorBody.detail || "Request failed"}`);
  }

  const data = await res.json();
  return keysToCamel<T>(data);
}

export const api = {
  getProfile(): Promise<User> {
    return request("/v1/profile");
  },

  saveYouTubeToken(params: {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    google_email?: string;
  }): Promise<{ message: string }> {
    return request("/v1/profile/youtube-token", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  disconnectYouTube(): Promise<{ message: string }> {
    return request("/v1/profile/youtube-disconnect", { method: "POST" });
  },

  listChannels(): Promise<Channel[]> {
    return request("/v1/channels");
  },

  syncSubscriptions(): Promise<Channel[]> {
    return request("/v1/channels/sync", { method: "POST" });
  },

  browseFeed(channelId?: string, weeks: number = 2): Promise<BrowseVideo[]> {
    const params = new URLSearchParams();
    if (channelId) params.set("channel_id", channelId);
    if (weeks !== 2) params.set("weeks", String(weeks));
    const qs = params.toString();
    return request(`/v1/browse${qs ? `?${qs}` : ""}`);
  },

  getRecentUploads(days: number = 7, forceRefresh: boolean = false): Promise<BrowseVideo[]> {
    const params = new URLSearchParams({ days: String(days) });
    if (forceRefresh) params.set("force_refresh", "true");
    return request(`/v1/browse/recent?${params}`);
  },

  updateAvatar(avatarUrl: string | null): Promise<{ message: string }> {
    return request("/v1/profile/avatar", {
      method: "PATCH",
      body: JSON.stringify({ avatar_url: avatarUrl }),
    });
  },

  listQueues(): Promise<KewQueue[]> {
    return request("/v1/queues");
  },

  createQueue(params: { name: string; emoji?: string | null }): Promise<KewQueue> {
    return request("/v1/queues", {
      method: "POST",
      body: JSON.stringify({ name: params.name, emoji: params.emoji ?? null }),
    });
  },

  updateQueue(id: string, params: { name?: string; emoji?: string | null; pinned?: boolean }): Promise<KewQueue> {
    return request(`/v1/queues/${id}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  },

  deleteQueue(id: string): Promise<void> {
    return request(`/v1/queues/${id}`, { method: "DELETE" });
  },

  activateQueue(id: string): Promise<{ activeQueueId: string }> {
    return request(`/v1/queues/${id}/activate`, { method: "PATCH" });
  },

  getQueue(queueId?: string): Promise<Queue> {
    return request("/v1/queue" + (queueId ? "?queue_id=" + queueId : ""));
  },

  addToQueue(ytVideoId: string, queueId?: string): Promise<{ message: string }> {
    return request("/v1/queue/add", {
      method: "POST",
      body: JSON.stringify({ yt_video_id: ytVideoId, ...(queueId ? { queue_id: queueId } : {}) }),
    });
  },

  updateProgress(entryId: string, watchProgressSecs: number): Promise<{ message: string }> {
    return request(`/v1/queue/${entryId}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ watch_progress_secs: watchProgressSecs }),
    });
  },

  removeFromQueue(entryId: string): Promise<{ message: string }> {
    return request(`/v1/queue/${entryId}`, { method: "DELETE" });
  },

  moveToEnd(entryId: string): Promise<{ message: string }> {
    return request(`/v1/queue/${entryId}/move-to-end`, { method: "POST" });
  },

  moveToQueue(entryId: string, targetQueueId: string): Promise<{ message: string }> {
    return request(`/v1/queue/${entryId}/move`, {
      method: "POST",
      body: JSON.stringify({ target_queue_id: targetQueueId }),
    });
  },

  shuffleQueue(): Promise<{ message: string }> {
    return request("/v1/queue/shuffle", { method: "POST" });
  },

  reorderQueue(entryId: string, newPosition: number, useSkip: boolean): Promise<{ skipsRemaining: number; skipsMax: number }> {
    return request("/v1/queue/reorder", {
      method: "PATCH",
      body: JSON.stringify({ entry_id: entryId, new_position: newPosition, use_skip: useSkip }),
    });
  },

  skipCurrent(): Promise<SkipResult> {
    return request("/v1/queue/skip", { method: "POST" });
  },

  checkUsername(username: string): Promise<{ available: boolean }> {
    return request(`/v1/profile/check-username?username=${encodeURIComponent(username)}`);
  },

  updateUsername(username: string): Promise<{ message: string }> {
    return request("/v1/profile/username", {
      method: "PATCH",
      body: JSON.stringify({ username }),
    });
  },

  deleteAccount(): Promise<{ message: string }> {
    return request("/v1/profile", { method: "DELETE" });
  },

  getPlaylists(): Promise<Playlist[]> {
    return request("/v1/playlists");
  },

  getPlaylistVideos(playlistId: string): Promise<PlaylistVideosResult> {
    return request(`/v1/playlists/${playlistId}/videos`);
  },

  importToQueue(ytVideoIds: string[], queueId?: string): Promise<ImportResult> {
    return request("/v1/queue/import", {
      method: "POST",
      body: JSON.stringify({ yt_video_ids: ytVideoIds, ...(queueId ? { queue_id: queueId } : {}) }),
    });
  },

  shareQueue(queueId?: string): Promise<{ shareToken: string }> {
    return request("/v1/queue/share", {
      method: "POST",
      body: JSON.stringify(queueId ? { queue_id: queueId } : {}),
    });
  },

  searchYouTube(q: string): Promise<BrowseVideo[]> {
    return request(`/v1/explore/search?q=${encodeURIComponent(q)}`);
  },

  // ── Insights & Limits ──────────────────────────────────────────────────────

  getInsights(period: InsightsPeriod = "week"): Promise<Insights> {
    return request(`/v1/insights?period=${period}`);
  },

  getIntentionality(period: InsightsPeriod = "week"): Promise<Intentionality> {
    return request(`/v1/insights/intentionality?period=${period}`);
  },

  getLimits(): Promise<WatchLimits> {
    return request("/v1/limits");
  },

  updateLimits(params: {
    dailyVideos: number | null;
    dailyMinutes: number | null;
    consecutiveVideos: number | null;
  }): Promise<WatchLimits> {
    return request("/v1/limits", {
      method: "PUT",
      body: JSON.stringify({
        daily_videos:       params.dailyVideos,
        daily_minutes:      params.dailyMinutes,
        consecutive_videos: params.consecutiveVideos,
      }),
    });
  },

  recordWatchEvent(params: {
    ytVideoId: string;
    queueId?: string | null;
    eventType: WatchEventType;
    watchSeconds?: number;
  }): Promise<{ message: string }> {
    return request("/v1/watch-events", {
      method: "POST",
      body: JSON.stringify({
        yt_video_id:   params.ytVideoId,
        queue_id:      params.queueId ?? null,
        event_type:    params.eventType,
        watch_seconds: params.watchSeconds ?? 0,
      }),
    });
  },
};
