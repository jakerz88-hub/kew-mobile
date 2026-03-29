import { supabase } from "./supabase";
import Constants from "expo-constants";
import type { Queue, BrowseVideo, Channel, User, SkipResult } from "../types";

const BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL as string;

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Request failed");
  }

  return res.json();
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

  browseFeed(channelId?: string): Promise<BrowseVideo[]> {
    const params = channelId ? `?channel_id=${channelId}` : "";
    return request(`/v1/browse${params}`);
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

  skipCurrent(): Promise<SkipResult> {
    return request("/v1/queue/skip", { method: "POST" });
  },
};