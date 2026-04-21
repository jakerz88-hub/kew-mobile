import { supabase } from "./supabase";
import Constants from "expo-constants";
import type { Queue, BrowseVideo, Channel, User, SkipResult } from "../types";

const BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL as string;

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
  }): Promise<{ message: string }> {
    return request("/v1/profile/youtube-token", {
      method: "POST",
      body: JSON.stringify(params),
    });
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

  getQueue(): Promise<Queue> {
    return request("/v1/queue");
  },

  addToQueue(ytVideoId: string): Promise<{ message: string }> {
    return request("/v1/queue/add", {
      method: "POST",
      body: JSON.stringify({ yt_video_id: ytVideoId }),
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

  shuffleQueue(): Promise<{ message: string }> {
    return request("/v1/queue/shuffle", { method: "POST" });
  },

  skipCurrent(): Promise<SkipResult> {
    return request("/v1/queue/skip", { method: "POST" });
  },

  updateUsername(username: string): Promise<{ message: string }> {
    return request("/v1/profile/username", {
      method: "PATCH",
      body: JSON.stringify({ username }),
    });
  },
};
