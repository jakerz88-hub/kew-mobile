export interface User {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  skipsRemaining: number;
  skipsMax: number;
}

export interface Channel {
  id: string;
  ytChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  lastSyncedAt: string | null;
}

export interface Video {
  id: string;
  ytVideoId: string;
  ytChannelId: string;
  channelTitle: string;
  title: string;
  thumbnailUrl: string | null;
  durationSecs: number | null;
  publishedAt: string | null;
}

export type QueueStatus = "pending" | "watching" | "completed" | "skipped";

export interface QueueEntry {
  id: string;
  position: number;
  status: QueueStatus;
  watchProgressSecs: number;
  completedAt: string | null;
  addedAt: string;
  video: Video;
}

export interface Queue {
  entries: QueueEntry[];
  total: number;
  current: QueueEntry | null;
}

export interface BrowseVideo {
  ytVideoId: string;
  ytChannelId: string;
  channelTitle: string;
  title: string;
  thumbnailUrl: string | null;
  durationSecs: number | null;
  publishedAt: string | null;
  inQueue: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  videoCount: number;
}

export interface PlaylistVideo {
  ytVideoId: string;
  ytChannelId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  durationSecs: number | null;
}

export interface PlaylistVideosResult {
  videos: PlaylistVideo[];
  skippedCount: number;
}

export interface ImportResult {
  importedCount: number;
  alreadyQueuedCount: number;
}

export interface SkipResult {
  skipsRemaining: number;
  skipsMax: number;
  movedEntryId: string;
  nextEntry: QueueEntry | null;
}

export function formatDuration(secs: number | null | undefined): string {
  if (!secs) return "-";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatProgress(progressSecs: number, durationSecs: number | null): string {
  if (!durationSecs) return "";
  return `${Math.round((progressSecs / durationSecs) * 100)}% watched`;
}

export function timeAgo(isoString: string | null): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
