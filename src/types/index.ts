export interface KewQueue {
  id: string;
  name: string;
  emoji: string | null;
  position: number;
  isMain: boolean;
  videoCount: number;
  pinned: boolean;
}

export interface User {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  skipsRemaining: number;
  skipsMax: number;
  plan: "free" | "pro";
  hasYoutube: boolean;
  activeQueueId: string | null;
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
  description: string | null;
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
  queueId: string | null;
  queueName: string | null;
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

// ── Insights & Limits ────────────────────────────────────────────────────────

export type InsightsPeriod = "week" | "month" | "year";

export type WatchEventType = "started" | "completed" | "skipped";

export interface InsightsStats {
  videosWatched: number;
  watchTimeMinutes: number;
  completionRate: number; // 0-100
  skipsUsed: number;
  daysOff: number;
}

export interface DailyMinutes {
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface Insights {
  period: InsightsPeriod;
  stats: InsightsStats;
  prevPeriodComparison: InsightsStats;
  dailyBreakdown: DailyMinutes[];
  insightSentence: string;
}

export interface DailyLimitStatus {
  date: string;
  kept: boolean;
}

export interface Intentionality {
  period: InsightsPeriod;
  limitsKept: number;
  limitsTotal: number;
  limitStreak: number;
  limitStreakBest: number;
  dailyLimitStatus: DailyLimitStatus[];
}

export interface WatchLimits {
  dailyVideos: number | null;
  dailyMinutes: number | null;
  consecutiveVideos: number | null;
  todayVideos: number;
  todayMinutes: number;
  consecutiveVideosNow: number;
}

// ── Journal ──────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  videoId: string;                          // ytVideoId
  content: string;
  videoTimestampSecs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalFeedItem {
  completedAt: string;
  video: {
    ytVideoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    durationSecs: number | null;
  };
  journalEntries: JournalEntry[];
  // Backend still returns this; the current Journal UI doesn't surface
  // favorites, but the field is kept on the type so it round-trips cleanly.
  isFavorited: boolean;
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

export function formatDate(isoString: string | null): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
