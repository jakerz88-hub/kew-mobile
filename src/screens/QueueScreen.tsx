import React, { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Modal, Pressable,
  StyleSheet, SafeAreaView, RefreshControl, Image, ScrollView,
  useWindowDimensions, Share, Animated, PanResponder,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { InteractModule } from "../components/InteractModule";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import YoutubePlayer from "react-native-youtube-iframe";
import { useStore } from "../store";
import { api } from "../services/api";
import {
  KewLogo, SansText, SerifText, Divider, ThumbPlaceholder,
  EmptyState, ErrorBanner, AvatarBubble, SkipCounter,
} from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import type { QueueEntry } from "../types";
import { formatDuration, formatProgress, timeAgo, formatDate } from "../types";
import { useIsTablet } from "../hooks/useIsTablet";
import { useInTabletSidebar, useTabletSwitchTab } from "../contexts/TabletSidebarContext";
import { useTooltip } from "../hooks/useTooltip";
import TooltipOverlay, { TooltipAnchor } from "../components/TooltipOverlay";
import { Feather } from "@expo/vector-icons";

// ── Recently-removed storage ──────────────────────────────────────────────────
type RemovedEntry = { video: import("../types").Video; removedAt: string };
const REMOVED_KEY = "kew_recently_removed";
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function removedAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hrs  < 24)  return `${hrs}h ago`;
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

async function loadRemoved(): Promise<RemovedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(REMOVED_KEY);
    if (!raw) return [];
    const all: RemovedEntry[] = JSON.parse(raw);
    return all.filter(e => Date.now() - new Date(e.removedAt).getTime() < THREE_DAYS);
  } catch { return []; }
}

async function saveRemoved(entry: RemovedEntry, existing: RemovedEntry[]): Promise<RemovedEntry[]> {
  const deduped = existing.filter(e => e.video.ytVideoId !== entry.video.ytVideoId);
  const updated = [entry, ...deduped].slice(0, 20);
  try { await AsyncStorage.setItem(REMOVED_KEY, JSON.stringify(updated)); } catch { /* silent */ }
  return updated;
}

// ── Component ─────────────────────────────────────────────────────────────────
const PROGRESS_REPORT_INTERVAL = 10 * 1000;
const QUEUE_COL_WIDTH = 320;

const QUEUE_TIPS = [
  "This is your queue of hand-picked videos! You'll watch in the order you added them.",
  "Skipping a video sends it to the back of your queue. You only get 3, but completing a video allows you to earn 1 back.",
  "Go to the Browse tab to begin building your queue!",
];
const QUEUE_ANCHORS: TooltipAnchor[] = [
  { arrowSide: "top", top: 172, left: 16, arrowOffset: 20 },
  { arrowSide: "top", top: 172, right: 16, arrowOffset: 170 },
  { arrowSide: "bottom", top: 622, left: 16, arrowOffset: 110 },
];

export default function QueueScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isTablet = useIsTablet();
  const inSidebar = useInTabletSidebar();
  const switchTab = useTabletSwitchTab();
  const { colors } = useTheme();
  const styles  = useMemo(() => makePhoneStyles(colors), [colors]);
  const tStyles = useMemo(() => makeTabletStyles(colors), [colors]);

  const {
    queue, user, error,
    fetchQueue, clearError, shuffleQueue, updateProgress, skipCurrent, addToQueue, reorderQueue,
    queues, activeQueueId, setActiveQueue,
  } = useStore();

  // ── Queue management state ──
  const [actionEntry, setActionEntry] = useState<QueueEntry | null>(null);
  const [showShuffleConfirm, setShowShuffleConfirm] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // ── Recently removed ──
  const [removedList, setRemovedList] = useState<RemovedEntry[]>([]);

  // ── Tablet inline player state (must be declared unconditionally) ──
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [interactVisible, setInteractVisible] = useState(false);
  const [interactTs, setInteractTs] = useState(0);

  const openInteract = useCallback(async () => {
    const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
    setInteractTs(playerSecs != null ? Math.floor(playerSecs) : 0);
    setInteractVisible(true);
  }, []);

  // ── Tooltip journey ──
  const queueTip = useTooltip("queue", 3);

  // ── Derived queue values ──
  const allEntries = queue?.entries ?? [];
  const pendingEntries = allEntries.filter(e => e.status === "pending");
  const current = queue?.current ?? pendingEntries[0] ?? null;
  // Avoid showing `current` twice: if it came from pendingEntries[0], slice it off the list
  const listPendingEntries = queue?.current ? pendingEntries : pendingEntries.slice(1);
  const canShuffle = pendingEntries.length >= 2;

  // Measure the actual width the player container takes — accounts for
  // the sidebar (172/48 expanded/collapsed) which the static window
  // width doesn't know about. The fallback keeps the first paint sane
  // before onLayout fires.
  const [measuredPlayerWidth, setMeasuredPlayerWidth] = useState(width - QUEUE_COL_WIDTH);
  const playerHeight = Math.round(measuredPlayerWidth * 9 / 16);

  useEffect(() => { fetchQueue(); }, []);
  useEffect(() => { loadRemoved().then(setRemovedList); }, []);
  useFocusEffect(useCallback(() => { fetchQueue(); }, []));
  const onRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try { await fetchQueue(); }
    finally { setIsManualRefreshing(false); }
  }, []);

  // Collapse description whenever the active video changes.
  useEffect(() => {
    if (current?.id) setDescExpanded(false);
  }, [current?.id]);

  // Tablet: report progress every 10s while playing
  useEffect(() => {
    if (!isTablet || !current || !playing) return;
    const interval = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (t != null) updateProgress(current.id, Math.floor(t));
    }, PROGRESS_REPORT_INTERVAL);
    return () => clearInterval(interval);
  }, [isTablet, current?.id, playing]);

  const onPlayerStateChange = useCallback(async (state: string) => {
    if (!current) return;
    if (state === "playing") setPlaying(true);
    if (state === "paused")  setPlaying(false);
    if (state === "ended") {
      // Pause IMMEDIATELY before any awaits — YouTube's internal
      // autoplay-next would otherwise fire during the async gap before
      // navigation.navigate("Completion", ...). See PlayerScreen for the
      // matching fix.
      setPlaying(false);
      // Use the player's actual current position (matches PlayerScreen).
      // Some YouTube videos (livestreams, premieres) have null durationSecs,
      // so the cached value alone leaves watchedSecs at 0 in those cases.
      const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
      const watchedSecs = playerSecs != null ? Math.floor(playerSecs) : (current.video.durationSecs ?? 0);
      await updateProgress(current.id, watchedSecs);
      await fetchQueue();
      navigation.navigate("Completion", {
        watchedSecs,
        completedVideo: {
          ytVideoId: current.video.ytVideoId,
          title: current.video.title,
          durationSecs: current.video.durationSecs,
        },
      });
    }
  }, [current?.id]);

  const handleMarkDone = async () => {
    if (!current) return;
    setMarkingDone(true);
    const watchedSecs = current.video.durationSecs ?? 0;
    try {
      await updateProgress(current.id, watchedSecs);
      await fetchQueue();
      navigation.navigate("Completion", {
        watchedSecs,
        completedVideo: {
          ytVideoId: current.video.ytVideoId,
          title: current.video.title,
          durationSecs: current.video.durationSecs,
        },
      });
    } finally {
      setMarkingDone(false);
      setShowDoneModal(false);
    }
  };

  const handleSkipConfirm = async () => {
    setShowSkipModal(false);
    await skipCurrent();
  };

  const handleShuffleConfirm = async () => {
    setShuffling(true);
    try { await shuffleQueue(); } finally {
      setShuffling(false);
      setShowShuffleConfirm(false);
    }
  };

  const handleRemovedEntry = useCallback(async () => {
    if (!actionEntry) return;
    const entry: RemovedEntry = { video: actionEntry.video, removedAt: new Date().toISOString() };
    const updated = await saveRemoved(entry, removedList);
    setRemovedList(updated.filter(e => Date.now() - new Date(e.removedAt).getTime() < THREE_DAYS));
  }, [actionEntry, removedList]);

  const handleReadd = useCallback(async (ytVideoId: string) => {
    try {
      await addToQueue(ytVideoId);
      const updated = removedList.filter(e => e.video.ytVideoId !== ytVideoId);
      try { await AsyncStorage.setItem(REMOVED_KEY, JSON.stringify(updated)); } catch { /* silent */ }
      setRemovedList(updated);
    } catch { /* store surfaces error */ }
  }, [addToQueue, removedList]);

  const handleQueueSwitch = useCallback((id: string) => {
    if (id === activeQueueId) return;
    setActiveQueue(id);
    if (isTablet) {
      // Stop the player on tablet when switching queues
      setPlaying(false);
    }
  }, [activeQueueId, setActiveQueue, isTablet]);

  // ── Reorder / move toasts ──
  const [isDragging, setIsDragging]             = useState(false);
  const [reorderToast, setReorderToast]         = useState("");
  const reorderToastTimer                        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moveToast, setMoveToast]               = useState("");
  const moveToastTimer                           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMovedToQueue = useCallback((targetQueueName: string) => {
    if (moveToastTimer.current) clearTimeout(moveToastTimer.current);
    setMoveToast(`Moved to ${targetQueueName}`);
    moveToastTimer.current = setTimeout(() => setMoveToast(""), 3000);
  }, []);
  const [protectedModalEntry, setProtectedModalEntry] = useState<{ entry: QueueEntry; toIdx: number } | null>(null);

  const handleReorder = useCallback(async (entry: QueueEntry, toIdx: number, useSkip: boolean) => {
    setProtectedModalEntry(null);
    try {
      const result = await reorderQueue(entry.id, toIdx + 1, useSkip);
      if (useSkip) {
        if (reorderToastTimer.current) clearTimeout(reorderToastTimer.current);
        setReorderToast(`Skip used · ${result.skipsRemaining} remaining`);
        reorderToastTimer.current = setTimeout(() => setReorderToast(""), 3000);
      }
    } catch { /* store surfaces error */ }
  }, [reorderQueue]);

  const handleShare = async () => {
    if (sharing || allEntries.length === 0) return;
    setSharing(true);
    try {
      const { shareToken } = await api.shareQueue();
      const url = `https://yourkew.app/s/${shareToken}`;
      setSharing(false);
      Share.share({ message: `Check out my Kew queue: ${url}`, url });
    } catch {
      setSharing(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // TABLET LAYOUT
  // ══════════════════════════════════════════════════════════════
  if (isTablet) {
    const chipsContent = user?.plan === "pro" ? (() => {
      const mainQ = queues.find(q => q.isMain);
      const nonMain = queues.filter(q => !q.isMain);
      const pinnedNonMain = nonMain.filter(q => q.pinned);
      const chipQueues = [
        ...(mainQ ? [mainQ] : []),
        ...(pinnedNonMain.length > 0 ? pinnedNonMain.slice(0, 3) : nonMain.slice(0, 3)),
      ];
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // flexGrow: 0 stops the ScrollView from filling the column's full
          // height in landscape sidebar mode (where the strip sits above a
          // flex:1 split-pane). alignItems: "center" on the content container
          // prevents the default `stretch` cross-axis alignment from making
          // each pill expand vertically. Both together pin the strip to its
          // intrinsic height instead of growing to half the screen.
          style={{ paddingVertical: 8, paddingHorizontal: 12, flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, flexDirection: "row", alignItems: "center" }}
        >
          {chipQueues.map(q => (
            <TouchableOpacity
              key={q.id}
              onPress={() => handleQueueSwitch(q.id)}
              style={[
                { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
                activeQueueId === q.id
                  ? { backgroundColor: colors.accent }
                  : { backgroundColor: colors.cardBg, borderColor: colors.divider, borderWidth: 1 },
              ]}
            >
              {q.emoji ? (
                <SansText style={{ fontSize: 12 }}>{q.emoji}</SansText>
              ) : (
                <LogoMark color={activeQueueId === q.id ? "#fff" : colors.warmMid} size={12} />
              )}
              <SansText style={[
                { fontSize: 12, fontFamily: "DMSans_500Medium" },
                activeQueueId === q.id ? { color: "#fff" } : { color: colors.warmMid },
              ]}>
                {q.name} · {q.videoCount}
              </SansText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => navigation.navigate("AllQueues")}
            style={{ backgroundColor: colors.cardBg, borderColor: colors.divider, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <SansText style={{ color: colors.warmMid, fontSize: 12, fontFamily: "DMSans_500Medium" }}>All queues</SansText>
          </TouchableOpacity>
        </ScrollView>
      );
    })() : null;

    return (
      <SafeAreaView style={styles.container}>
        {/* Top bar — hidden when embedded in sidebar (sidebar provides nav) */}
        {!inSidebar && (
          <View style={tStyles.topBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LogoMark size={20} />
              <KewLogo size={20} />
            </View>
            <AvatarBubble
              avatarUrl={user?.avatarUrl}
              initial={user?.displayName?.charAt(0).toUpperCase() ?? "?"}
              size={28}
              onPress={() => navigation.navigate("Profile")}
            />
          </View>
        )}
        {!inSidebar && <Divider />}

        {/* Full-width queue chips — only when in sidebar so they span both panels */}
        {inSidebar && chipsContent && (
          <>
            {chipsContent}
            <Divider />
          </>
        )}

        <View style={tStyles.root}>
          {/* ── Left: Queue list ── */}
          <View style={tStyles.queueCol}>
            {/* Queue pill strip — shown for pro users so they can discover / navigate queues */}
            {!inSidebar && chipsContent}
            <View style={tStyles.queueHeader}>
              <SerifText style={tStyles.queueTitle}>Your Queue</SerifText>
              {queue && (
                <SansText style={tStyles.queueSub}>
                  {queue.total} video{queue.total !== 1 ? "s" : ""} · {_totalTimeRemaining(queue.entries)}
                </SansText>
              )}
              <View style={tStyles.actionRow}>
                <TouchableOpacity
                  onPress={handleShare}
                  disabled={sharing || !queue || queue.total === 0}
                  style={[tStyles.btnAction, tStyles.btnShareFill, (sharing || !queue || queue.total === 0) && { opacity: 0.35 }]}
                  activeOpacity={0.8}
                >
                  <SansText style={tStyles.btnShareFillText}>
                    {sharing ? "Sharing…" : "Share"}
                  </SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowShuffleConfirm(true)}
                  disabled={!canShuffle}
                  style={[tStyles.btnAction, tStyles.btnShuffleOutline, !canShuffle && { opacity: 0.35 }]}
                  activeOpacity={0.7}
                >
                  <SansText style={tStyles.btnShuffleOutlineText}>Shuffle</SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => switchTab ? switchTab("Import") : navigation.navigate("PlaylistList")}
                  style={[tStyles.btnAction, tStyles.btnImportFill]}
                  activeOpacity={0.8}
                >
                  <SansText style={tStyles.btnImportFillText}>Import</SansText>
                </TouchableOpacity>
              </View>
            </View>
            <Divider />

            {error && <ErrorBanner message={error} onDismiss={clearError} />}

            <FlatList
              data={listPendingEntries}
              keyExtractor={item => item.id}
              refreshControl={
                <RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} tintColor={colors.ink} />
              }
              ListHeaderComponent={
                current ? (
                  <>
                    <TabletNowPlayingRow entry={current} />
                    {listPendingEntries.length > 0 && <Divider style={{ marginHorizontal: 0 }} />}
                  </>
                ) : null
              }
              ListEmptyComponent={
                !current ? (
                  <View style={tStyles.emptyQueue}>
                    <SansText style={tStyles.emptyQueueTitle}>Your queue is empty</SansText>
                    <SansText style={tStyles.emptyQueueSub}>
                      Browse your subscriptions or import a playlist
                    </SansText>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <QueueItem entry={item} onLongPress={() => setActionEntry(item)} />
              )}
              ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
              contentContainerStyle={{ paddingBottom: removedList.length > 0 ? 60 : 40 }}
            />
            {/* Recently removed tray — sits at the bottom of the queue column */}
            {removedList.length > 0 && (
              <RecentlyRemovedTray
                entries={removedList}
                colors={colors}
                onReadd={handleReadd}
              />
            )}
          </View>

          {/* ── Right: Player ── */}
          <View style={tStyles.playerCol}>
            {current ? (
              <ScrollView
                contentContainerStyle={{ paddingBottom: 48 }}
                showsVerticalScrollIndicator={false}
              >
                {/* YouTube embed — letterbox bg always dark */}
                <View
                  style={{ backgroundColor: "#1A1714" }}
                  onLayout={(e) => {
                    const w = Math.round(e.nativeEvent.layout.width);
                    if (w > 0 && w !== measuredPlayerWidth) setMeasuredPlayerWidth(w);
                  }}
                >
                  <YoutubePlayer
                    ref={playerRef}
                    height={playerHeight}
                    width={measuredPlayerWidth}
                    videoId={current.video.ytVideoId}
                    play={playing}
                    onChangeState={onPlayerStateChange}
                    // rel: 0 disables YouTube's "related videos" overlay,
                    // which on iOS can manifest as autoplay-next at end.
                    initialPlayerParams={{ rel: 0 }}
                    webViewProps={{
                      allowsInlineMediaPlayback: true,
                      mediaPlaybackRequiresUserAction: false,
                    }}
                  />
                </View>

                {/* Video info */}
                <View style={tStyles.videoInfo}>
                  <SansText style={tStyles.videoChannel}>{current.video.channelTitle}</SansText>
                  <SerifText style={tStyles.videoTitle}>{current.video.title}</SerifText>
                  {current.video.publishedAt && (
                    <SansText style={tStyles.videoMeta}>Uploaded on {formatDate(current.video.publishedAt)}</SansText>
                  )}
                  <SansText style={tStyles.videoMeta}>Added to your queue {timeAgo(current.addedAt)}</SansText>

                  {current.video.description && (
                    <>
                      <TouchableOpacity
                        onPress={() => setDescExpanded(v => !v)}
                        activeOpacity={0.7}
                        style={tStyles.descToggle}
                      >
                        <SansText style={tStyles.descToggleLabel}>Description</SansText>
                        <Feather
                          name={descExpanded ? "chevron-down" : "chevron-right"}
                          size={16}
                          color={colors.warmMid}
                        />
                      </TouchableOpacity>
                      {descExpanded && (
                        <SansText style={tStyles.descBody}>{current.video.description}</SansText>
                      )}
                    </>
                  )}
                </View>

                <Divider />

                {/* Controls */}
                <View style={tStyles.controls}>
                  <TouchableOpacity
                    style={tStyles.btnInteract}
                    onPress={openInteract}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Interact"
                  >
                    <SansText style={tStyles.btnInteractText}>Interact</SansText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[tStyles.btnSkip, (!user || user.skipsRemaining <= 0) && { opacity: 0.4 }]}
                    onPress={() => setShowSkipModal(true)}
                    disabled={!user || user.skipsRemaining <= 0}
                    activeOpacity={0.8}
                  >
                    <SansText style={tStyles.btnSkipText}>Skip</SansText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tStyles.btnDone}
                    onPress={() => setShowDoneModal(true)}
                    activeOpacity={0.8}
                  >
                    <SansText style={tStyles.btnDoneText}>Mark done</SansText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tStyles.btnRemove}
                    onPress={() => setActionEntry(current)}
                    activeOpacity={0.8}
                  >
                    <SansText style={tStyles.btnRemoveText}>Remove</SansText>
                  </TouchableOpacity>
                  {user && (
                    <View style={{ marginLeft: "auto" }}>
                      <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />
                    </View>
                  )}
                </View>

                {/* Up next — single preview of the immediate next video */}
                {listPendingEntries.length > 0 && (() => {
                  const nextEntry = listPendingEntries[0];
                  return (
                    <>
                      <Divider />
                      <View style={tStyles.upNext}>
                        <SansText style={tStyles.upNextLabel}>Up Next</SansText>
                        <TouchableOpacity
                          key={nextEntry.id}
                          style={tStyles.upNextRow}
                          onLongPress={() => setActionEntry(nextEntry)}
                          delayLongPress={400}
                          activeOpacity={0.8}
                        >
                          <View style={tStyles.upNextThumb}>
                            {nextEntry.video.thumbnailUrl
                              ? <Image source={{ uri: nextEntry.video.thumbnailUrl }} style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }]} resizeMode="cover" />
                              : <ThumbPlaceholder seed={nextEntry.video.ytVideoId} style={StyleSheet.absoluteFill} />
                            }
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <SansText style={tStyles.upNextChannel}>{nextEntry.video.channelTitle}</SansText>
                            <SansText style={tStyles.upNextTitle} numberOfLines={2}>{nextEntry.video.title}</SansText>
                            <SansText style={tStyles.upNextMeta}>{formatDuration(nextEntry.video.durationSecs)}</SansText>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            ) : (
              <View style={tStyles.emptyPlayer}>
                <LogoMark size={36} />
                <SerifText style={tStyles.emptyPlayerTitle}>Nothing playing</SerifText>
                <SansText style={tStyles.emptyPlayerSub}>Add videos to your queue to get started</SansText>
              </View>
            )}
          </View>
        </View>

        {/* ── Shared overlays ── */}
        <QueueActionSheet
          visible={!!actionEntry}
          entryId={actionEntry?.id ?? ""}
          videoTitle={actionEntry?.video.title ?? ""}
          onClose={() => setActionEntry(null)}
          onRemoved={handleRemovedEntry}
        />
        <ShuffleConfirmSheet
          visible={showShuffleConfirm}
          shuffling={shuffling}
          onConfirm={handleShuffleConfirm}
          onClose={() => setShowShuffleConfirm(false)}
        />

        <Modal visible={showDoneModal} transparent animationType="fade" onRequestClose={() => setShowDoneModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <SerifText style={styles.modalTitle}>Done watching?</SerifText>
              <SansText style={styles.modalBody}>
                This will mark "{current?.video.title}" as complete and move to the next video.
              </SansText>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowDoneModal(false)}>
                  <SansText style={styles.modalBtnCancelText}>Not yet</SansText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleMarkDone} disabled={markingDone}>
                  <SansText style={styles.modalBtnConfirmText}>{markingDone ? "..." : "Mark done"}</SansText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showSkipModal} transparent animationType="fade" onRequestClose={() => setShowSkipModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <SerifText style={styles.modalTitle}>Move to end of queue?</SerifText>
              <SansText style={styles.modalBody}>
                "{current?.video.title}" will be moved to the back of your queue.{"\n\n"}
                You have {user?.skipsRemaining ?? 0} skip{user?.skipsRemaining !== 1 ? "s" : ""} remaining.
              </SansText>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowSkipModal(false)}>
                  <SansText style={styles.modalBtnCancelText}>Stay here</SansText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleSkipConfirm}>
                  <SansText style={styles.modalBtnConfirmText}>Move to end</SansText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {current && (
          <InteractModule
            visible={interactVisible}
            onClose={() => setInteractVisible(false)}
            videoTitle={current.video.title}
            currentTimestamp={interactTs}
            ytVideoId={current.video.ytVideoId}
            durationSecs={current.video.durationSecs}
          />
        )}
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PHONE LAYOUT
  // ══════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LogoMark size={24} />
          <KewLogo />
        </View>
        <AvatarBubble
          avatarUrl={user?.avatarUrl}
          initial={user?.displayName?.charAt(0).toUpperCase() ?? "?"}
          size={30}
          onPress={() => navigation.navigate("Profile")}
        />
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <ScrollView
        refreshControl={<RefreshControl refreshing={isManualRefreshing} onRefresh={onRefresh} tintColor={colors.ink} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isDragging && !protectedModalEntry}
      >
        {/* Queue header */}
        <View style={styles.queueHeader}>
          <View>
            <SerifText style={styles.queueTitle}>Your Queue</SerifText>
            <SansText style={styles.queueSubtitle}>
              {queue ? `${queue.total} video${queue.total !== 1 ? "s" : ""} · ${_totalTimeRemaining(queue.entries)}` : "Loading..."}
            </SansText>
          </View>
          {user && (
            <View style={styles.skipMini}>
              <SansText style={styles.skipMiniLabel}>Skips</SansText>
              <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />
            </View>
          )}
        </View>

        {/* Queue pill strip — shown for pro users so they can discover / navigate queues */}
        {user?.plan === "pro" && (() => {
          const mainQ = queues.find(q => q.isMain);
          const nonMain = queues.filter(q => !q.isMain);
          const pinnedNonMain = nonMain.filter(q => q.pinned);
          const chipQueues = [
            ...(mainQ ? [mainQ] : []),
            ...(pinnedNonMain.length > 0 ? pinnedNonMain.slice(0, 3) : nonMain.slice(0, 3)),
          ];
          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
              contentContainerStyle={{ gap: 8, flexDirection: "row" }}
            >
              {chipQueues.map(q => (
                <TouchableOpacity
                  key={q.id}
                  onPress={() => handleQueueSwitch(q.id)}
                  style={[
                    { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
                    activeQueueId === q.id
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.cardBg, borderColor: colors.divider, borderWidth: 1 },
                  ]}
                >
                  {q.emoji ? (
                    <SansText style={{ fontSize: 12 }}>{q.emoji}</SansText>
                  ) : (
                    <LogoMark color={activeQueueId === q.id ? "#fff" : colors.warmMid} size={12} />
                  )}
                  <SansText style={[
                    { fontSize: 12, fontFamily: "DMSans_500Medium" },
                    activeQueueId === q.id ? { color: "#fff" } : { color: colors.warmMid },
                  ]}>
                    {q.name} · {q.videoCount}
                  </SansText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => navigation.navigate("AllQueues")}
                style={{ backgroundColor: colors.cardBg, borderColor: colors.divider, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <SansText style={{ color: colors.warmMid, fontSize: 12, fontFamily: "DMSans_500Medium" }}>All queues</SansText>
              </TouchableOpacity>
            </ScrollView>
          );
        })()}

        {current && (
          <NowPlayingCard entry={current} onPress={() => navigation.navigate("Player")} />
        )}
        {!current && pendingEntries.length === 0 && (
          <View style={styles.emptyQueueState}>
            <SansText style={styles.emptyQueueTitle}>Your queue is empty</SansText>
            <SansText style={styles.emptyQueueSub}>Sync your YouTube account to begin building your video queue.</SansText>
            <TouchableOpacity
              style={styles.emptySyncBtn}
              onPress={async () => {
                try { await api.syncSubscriptions(); fetchQueue(); } catch { /* silent */ }
              }}
              activeOpacity={0.7}
            >
              <SansText style={styles.emptySyncBtnText}>Sync</SansText>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn, allEntries.length === 0 && { opacity: 0.4 }]}
            onPress={handleShare}
            disabled={sharing || allEntries.length === 0}
            activeOpacity={0.7}
          >
            <SansText style={styles.shareBtnText}>{sharing ? "Sharing…" : "Share queue"}</SansText>
          </TouchableOpacity>
          {canShuffle && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.shuffleBtn]}
              onPress={() => setShowShuffleConfirm(true)}
              activeOpacity={0.7}
            >
              <SansText style={styles.shuffleBtnText}>Shuffle</SansText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.importBtn]}
            onPress={() => navigation.navigate("PlaylistList")}
            activeOpacity={0.7}
          >
            <SansText style={styles.importBtnText}>+ Import</SansText>
          </TouchableOpacity>
        </View>

        {pendingEntries.length > 0 && (
          <SansText style={styles.upNextLabel}>{current ? "Queued Up" : "Up Next"}</SansText>
        )}

        {/* Draggable pending list */}
        {pendingEntries.length > 0 && (
          <DraggableQueueList
            entries={pendingEntries}
            isWatching={!!queue?.current}
            skipsRemaining={user?.skipsRemaining ?? 0}
            colors={colors}
            styles={styles}
            onLongPress={setActionEntry}
            onDragActiveChange={setIsDragging}
            onReorder={(entry, toIdx, useSkip) => {
              if (useSkip) {
                setProtectedModalEntry({ entry, toIdx });
              } else {
                handleReorder(entry, toIdx, false);
              }
            }}
          />
        )}
      </ScrollView>

      {/* Protected zone modal */}
      {protectedModalEntry && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setProtectedModalEntry(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <SerifText style={styles.modalTitle}>Move to Up Next?</SerifText>
              <SansText style={styles.modalBody}>
                Moving &ldquo;{protectedModalEntry.entry.video.title.length > 60
                  ? protectedModalEntry.entry.video.title.slice(0, 60) + "…"
                  : protectedModalEntry.entry.video.title}&rdquo; to your top 3 will use 1 skip.{"\n\n"}You have {user?.skipsRemaining ?? 0} remaining.
              </SansText>
              {(user?.skipsRemaining ?? 0) === 0 && (
                <SansText style={{ fontSize: FontSize.xxs, color: colors.queued, textAlign: "center", marginTop: -Spacing.xs }}>
                  Complete a video to earn a skip back.
                </SansText>
              )}
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setProtectedModalEntry(null)}
                >
                  <SansText style={styles.modalBtnCancelText}>Cancel</SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnConfirm, (user?.skipsRemaining ?? 0) === 0 && { opacity: 0.4 }]}
                  disabled={(user?.skipsRemaining ?? 0) === 0}
                  onPress={() => handleReorder(protectedModalEntry.entry, protectedModalEntry.toIdx, true)}
                >
                  <SansText style={styles.modalBtnConfirmText}>Use skip</SansText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reorder toast */}
      {!!reorderToast && (
        <View style={{ position: "absolute", bottom: 90, left: 0, right: 0, alignItems: "center", pointerEvents: "none" } as any}>
          <View style={{ backgroundColor: "#1A1714", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
            <SansText style={{ fontSize: FontSize.xs, color: "white" }}>{reorderToast}</SansText>
          </View>
        </View>
      )}

      {/* Move to queue toast */}
      {!!moveToast && (
        <View style={{ position: "absolute", bottom: 90, left: 0, right: 0, alignItems: "center", pointerEvents: "none" } as any}>
          <View style={{ backgroundColor: "#1A1714", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
            <SansText style={{ fontSize: FontSize.xs, color: "white" }}>{moveToast}</SansText>
          </View>
        </View>
      )}

      <QueueActionSheet
        visible={!!actionEntry}
        entryId={actionEntry?.id ?? ""}
        videoTitle={actionEntry?.video.title ?? ""}
        onClose={() => setActionEntry(null)}
        onRemoved={handleRemovedEntry}
        onMoved={handleMovedToQueue}
      />
      <ShuffleConfirmSheet
        visible={showShuffleConfirm}
        shuffling={shuffling}
        onConfirm={handleShuffleConfirm}
        onClose={() => setShowShuffleConfirm(false)}
      />

      <TooltipOverlay
        visible={queueTip.visible}
        step={queueTip.step}
        totalSteps={3}
        body={QUEUE_TIPS[Math.max(0, queueTip.step)] ?? ""}
        anchor={QUEUE_ANCHORS[Math.max(0, queueTip.step)] ?? QUEUE_ANCHORS[0]}
        onNext={queueTip.advance}
        onDismiss={queueTip.dismiss}
      />

      {/* Recently removed tray — anchored to the bottom of the content area */}
      {removedList.length > 0 && (
        <RecentlyRemovedTray
          entries={removedList}
          colors={colors}
          onReadd={handleReadd}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function TabletNowPlayingRow({ entry }: { entry: QueueEntry }) {
  const { colors } = useTheme();
  const tStyles = useMemo(() => makeTabletStyles(colors), [colors]);
  const progress = entry.video.durationSecs
    ? entry.watchProgressSecs / entry.video.durationSecs
    : 0;
  const label = entry.status === "watching" ? "Now Playing" : "Watch Next";
  return (
    <View style={tStyles.nowPlayingRow}>
      <View style={tStyles.nowPlayingAccent} />
      <View style={tStyles.nowThumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }]} resizeMode="cover" />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        {progress > 0 && (
          <View style={tStyles.nowProgressBar}>
            <View style={[tStyles.nowProgressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <SansText style={tStyles.nowTag}>{label}</SansText>
        <SansText style={tStyles.nowTitle} numberOfLines={2}>{entry.video.title}</SansText>
        <SansText style={tStyles.nowChannel}>{entry.video.channelTitle}</SansText>
      </View>
    </View>
  );
}

function NowPlayingCard({ entry, onPress }: { entry: QueueEntry; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makePhoneStyles(colors), [colors]);
  const label = entry.status === "watching" ? "Now Playing" : "Watch Next";
  const progress = entry.video.durationSecs ? entry.watchProgressSecs / entry.video.durationSecs : 0;
  return (
    <TouchableOpacity style={styles.nowPlayingCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.nowPlayingThumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <View style={styles.nowPlayingOverlay} />
        <View style={styles.nowTag}><SansText style={styles.nowTagText}>{label}</SansText></View>
        <View style={styles.playBtn}><Text style={styles.playBtnIcon}>&#9654;</Text></View>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>
      <View style={styles.nowPlayingInfo}>
        <SansText style={styles.nowChannel}>{entry.video.channelTitle}</SansText>
        <SerifText style={styles.nowTitle} numberOfLines={2}>{entry.video.title}</SerifText>
        <View style={styles.nowMeta}>
          <SansText style={styles.nowMetaText}>{formatDuration(entry.watchProgressSecs)} / {formatDuration(entry.video.durationSecs)}</SansText>
          <SansText style={styles.nowMetaText}>{formatProgress(entry.watchProgressSecs, entry.video.durationSecs)}</SansText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function QueueItem({ entry, onPress, onLongPress }: { entry: QueueEntry; onPress?: () => void; onLongPress?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makePhoneStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.queueItem, onPress && styles.queueItemTappable]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.7}
    >
      <View style={styles.queueThumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={[StyleSheet.absoluteFill, styles.queueThumbImg]} />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
      </View>
      <View style={styles.queueInfo}>
        <SansText style={styles.queueChannel} numberOfLines={1}>{entry.video.channelTitle}</SansText>
        <SansText style={styles.queueTitleText} numberOfLines={2}>{entry.video.title}</SansText>
        <SansText style={styles.queueStatus}>Queued up · {formatDuration(entry.video.durationSecs)}</SansText>
      </View>
    </TouchableOpacity>
  );
}

// ── Draggable queue list (phone) ───────────────────────────────
const ITEM_H = 72;

interface DraggableQueueListProps {
  entries: QueueEntry[];
  isWatching: boolean;
  skipsRemaining: number;
  colors: ColorPalette;
  styles: ReturnType<typeof makePhoneStyles>;
  onLongPress: (entry: QueueEntry) => void;
  onReorder: (entry: QueueEntry, toIdx: number, useSkip: boolean) => void;
  onDragActiveChange?: (active: boolean) => void;
}

function DraggableQueueList({
  entries, isWatching, colors, onLongPress, onReorder, onDragActiveChange,
}: DraggableQueueListProps) {
  const [fromIdx, setFromIdx] = useState<number | null>(null);
  const [toIdx, setToIdx] = useState<number | null>(null);
  const fromIdxRef = useRef<number | null>(null);
  const toIdxRef = useRef<number | null>(null);
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const isWatchingRef = useRef(isWatching);
  useEffect(() => { isWatchingRef.current = isWatching; }, [isWatching]);
  const onReorderRef = useRef(onReorder);
  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);
  const onDragActiveChangeRef = useRef(onDragActiveChange);
  useEffect(() => { onDragActiveChangeRef.current = onDragActiveChange; }, [onDragActiveChange]);

  const dragAnimY = useRef(new Animated.Value(0)).current;

  const onDragStart = useCallback((idx: number) => {
    fromIdxRef.current = idx;
    toIdxRef.current = idx;
    dragAnimY.setValue(idx * ITEM_H);
    setFromIdx(idx);
    setToIdx(idx);
    onDragActiveChangeRef.current?.(true);
  }, []);

  const onDragMove = useCallback((startIdx: number, dy: number) => {
    const raw = startIdx * ITEM_H + dy;
    const maxY = (entriesRef.current.length - 1) * ITEM_H;
    const clamped = Math.max(0, Math.min(raw, maxY));
    dragAnimY.setValue(clamped);
    const newTo = Math.min(Math.max(0, Math.round(clamped / ITEM_H)), entriesRef.current.length - 1);
    if (newTo !== toIdxRef.current) {
      toIdxRef.current = newTo;
      setToIdx(newTo);
    }
  }, []);

  const onDragEnd = useCallback(() => {
    const f = fromIdxRef.current;
    const t = toIdxRef.current;
    fromIdxRef.current = null;
    toIdxRef.current = null;
    setFromIdx(null);
    setToIdx(null);
    onDragActiveChangeRef.current?.(false);
    if (f !== null && t !== null && f !== t) {
      const entry = entriesRef.current[f];
      const useSkip = isWatchingRef.current && t < 3;
      onReorderRef.current(entry, t, useSkip);
    }
  }, []);

  function getVisualTop(idx: number): number {
    if (fromIdx === null || toIdx === null || idx === fromIdx) return idx * ITEM_H;
    if (fromIdx < toIdx) {
      if (idx > fromIdx && idx <= toIdx) return (idx - 1) * ITEM_H;
    } else if (fromIdx > toIdx) {
      if (idx >= toIdx && idx < fromIdx) return (idx + 1) * ITEM_H;
    }
    return idx * ITEM_H;
  }

  return (
    <View style={{ height: entries.length * ITEM_H, position: "relative" }}>
      {entries.map((entry, idx) => {
        const isBeingDragged = idx === fromIdx;
        const isProtectedZone = isWatching && idx < 3;
        const rowBg = isProtectedZone ? `${colors.accent}07` : "transparent";

        if (isBeingDragged) {
          return (
            <Animated.View
              key={entry.id}
              style={{
                position: "absolute", left: 0, right: 0, height: ITEM_H,
                top: dragAnimY, zIndex: 10,
                backgroundColor: colors.cardBg,
                shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 5,
              }}
            >
              <DraggableRow
                entry={entry} idx={idx} colors={colors}
                isBeingDragged={true}
                onLongPress={onLongPress}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            </Animated.View>
          );
        }

        return (
          <View
            key={entry.id}
            style={{ position: "absolute", left: 0, right: 0, height: ITEM_H, top: getVisualTop(idx), backgroundColor: rowBg }}
          >
            <DraggableRow
              entry={entry} idx={idx} colors={colors}
              isBeingDragged={false}
              onLongPress={onLongPress}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          </View>
        );
      })}

      {/* Gap indicator — accent line showing where the dragged item will land */}
      {fromIdx !== null && toIdx !== null && fromIdx !== toIdx && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", left: Spacing.md, right: Spacing.md,
            top: toIdx * ITEM_H,
            height: 2,
            backgroundColor: colors.accent,
            borderRadius: 1,
            zIndex: 8,
            opacity: 0.75,
          }}
        />
      )}

      {/* Protected zone divider — warm accent line between position 3 and 4 */}
      {isWatching && entries.length > 3 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", left: 0, right: 0,
            top: 3 * ITEM_H - 1,
            height: 2,
            backgroundColor: `${colors.accent}28`,
            zIndex: 5,
          }}
        />
      )}
    </View>
  );
}

interface DraggableRowProps {
  entry: QueueEntry;
  idx: number;
  colors: ColorPalette;
  isBeingDragged: boolean;
  onLongPress: (entry: QueueEntry) => void;
  onDragStart: (idx: number) => void;
  onDragMove: (startIdx: number, dy: number) => void;
  onDragEnd: () => void;
}

function DraggableRow({
  entry, idx, colors, isBeingDragged,
  onLongPress, onDragStart, onDragMove, onDragEnd,
}: DraggableRowProps) {
  const idxRef = useRef(idx);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef  = useRef(onDragMove);
  const onDragEndRef   = useRef(onDragEnd);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragMoveRef.current  = onDragMove;  }, [onDragMove]);
  useEffect(() => { onDragEndRef.current   = onDragEnd;   }, [onDragEnd]);

  const panResponder = useRef(
    PanResponder.create({
      // Capture the initial touch so ScrollView doesn't claim it first
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      // Do NOT capture move — would intercept scroll gestures mid-swipe
      onMoveShouldSetPanResponder:         () => true,
      onPanResponderGrant:    ()     => { onDragStartRef.current(idxRef.current); },
      onPanResponderMove:     (_, g) => { onDragMoveRef.current(idxRef.current, g.dy); },
      onPanResponderRelease:  ()     => { onDragEndRef.current(); },
      onPanResponderTerminate:()     => { onDragEndRef.current(); },
    })
  ).current;

  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, gap: Spacing.sm, opacity: isBeingDragged ? 0.92 : 1 }}>
      {/* Six-dot drag handle */}
      <View
        {...panResponder.panHandlers}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        style={{ paddingRight: 4, opacity: 0.3 }}
      >
        <View style={{ width: 12, gap: 3.5 }}>
          {[0, 1, 2].map(r => (
            <View key={r} style={{ flexDirection: "row", gap: 3.5 }}>
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.warmMid }} />
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.warmMid }} />
            </View>
          ))}
        </View>
      </View>

      {/* Thumbnail */}
      <View style={{ width: 72, height: 44, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: colors.divider }}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
      </View>

      {/* Info — long-press opens action sheet */}
      <TouchableOpacity
        style={{ flex: 1, minWidth: 0 }}
        onLongPress={() => onLongPress(entry)}
        delayLongPress={400}
        activeOpacity={0.75}
      >
        <SansText
          numberOfLines={1}
          style={{ fontSize: FontSize.xxs, color: colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium }}
        >
          {entry.video.channelTitle}
        </SansText>
        <SansText
          numberOfLines={2}
          style={{ fontSize: FontSize.sm, color: colors.ink, lineHeight: 18 }}
        >
          {entry.video.title}
        </SansText>
        <SansText style={{ fontSize: FontSize.xxs, color: colors.queued, marginTop: 2 }}>
          {formatDuration(entry.video.durationSecs)}
        </SansText>
      </TouchableOpacity>
    </View>
  );
}

function ShuffleConfirmSheet({ visible, shuffling, onConfirm, onClose }: {
  visible: boolean; shuffling: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makePhoneStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <SerifText style={styles.sheetTitle}>Shuffle your queue?</SerifText>
          <SansText style={styles.sheetSubtitle}>
            The order of your queued videos will be randomized.{"\n"}Your current video won't be affected.
          </SansText>
          <TouchableOpacity
            style={[styles.sheetActionBtn, shuffling && { opacity: 0.5 }]}
            onPress={onConfirm}
            disabled={shuffling}
            activeOpacity={0.7}
          >
            <SansText style={styles.sheetActionText}>{shuffling ? "Shuffling…" : "Yes, shuffle it"}</SansText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <SansText style={styles.sheetCancelText}>Cancel</SansText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function _totalTimeRemaining(entries: QueueEntry[]): string {
  const totalSecs = entries.reduce((acc, e) => acc + Math.max(0, (e.video.durationSecs ?? 0) - e.watchProgressSecs), 0);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m remaining`;
  return `~${m}m remaining`;
}

// ── Recently removed tray ─────────────────────────────────────
function RecentlyRemovedTray({
  entries,
  colors,
  onReadd,
}: {
  entries: RemovedEntry[];
  colors: ColorPalette;
  onReadd: (ytVideoId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const HEADER_H  = 40;
  const CONTENT_H = Math.min(entries.length * 58, 210);

  const toggle = () => {
    Animated.spring(anim, {
      toValue: open ? 0 : 1,
      useNativeDriver: false,
      tension: 85,
      friction: 14,
    }).start();
    setOpen(o => !o);
  };

  const height = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [HEADER_H, HEADER_H + CONTENT_H],
  });
  const chevronRotate = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const s = StyleSheet.create({
    tray:        { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.divider, overflow: "hidden" },
    header:      { height: HEADER_H, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md },
    headerLeft:  { flexDirection: "row", alignItems: "center", gap: 6 },
    label:       { fontSize: FontSize.xxs, color: colors.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.6 },
    badge:       { backgroundColor: colors.divider, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: Radius.pill },
    badgeText:   { fontSize: 9, color: colors.warmMid, fontFamily: FontFamily.sansMedium },
    row:         { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 7, borderTopWidth: 0.5, borderTopColor: colors.divider },
    thumb:       { width: 52, height: 33, borderRadius: 4, backgroundColor: colors.divider, flexShrink: 0 },
    info:        { flex: 1, minWidth: 0, gap: 1 },
    title:       { fontSize: FontSize.xs, color: colors.ink, lineHeight: 16 },
    meta:        { fontSize: 9, color: colors.queued },
    readdBtn:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1, borderColor: colors.accent, flexShrink: 0 },
    readdText:   { fontSize: FontSize.xxs, color: colors.accent, fontFamily: FontFamily.sansMedium },
  });

  return (
    <Animated.View style={[s.tray, { height }]}>
      <TouchableOpacity style={s.header} onPress={toggle} activeOpacity={0.75}>
        <View style={s.headerLeft}>
          <Feather name="clock" size={12} color={colors.warmMid} />
          <SansText style={s.label}>Recently removed</SansText>
          <View style={s.badge}>
            <SansText style={s.badgeText}>{entries.length}</SansText>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Feather name="chevron-up" size={14} color={colors.warmMid} />
        </Animated.View>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {entries.map(item => (
          <View key={`${item.video.ytVideoId}-${item.removedAt}`} style={s.row}>
            {item.video.thumbnailUrl ? (
              <Image source={{ uri: item.video.thumbnailUrl }} style={s.thumb} resizeMode="cover" />
            ) : (
              <View style={s.thumb} />
            )}
            <View style={s.info}>
              <SansText style={s.title} numberOfLines={1}>{item.video.title}</SansText>
              <SansText style={s.meta}>{removedAgo(item.removedAt)}</SansText>
            </View>
            <TouchableOpacity style={s.readdBtn} onPress={() => onReadd(item.video.ytVideoId)} activeOpacity={0.7}>
              <SansText style={s.readdText}>+ Add</SansText>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ── Tablet styles ──────────────────────────────────────────────
function makeTabletStyles(c: ColorPalette) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    root: { flex: 1, flexDirection: "row" },
    queueCol: {
      width: QUEUE_COL_WIDTH,
      borderRightWidth: 1, borderRightColor: c.divider,
      backgroundColor: c.cardBg,
      flexDirection: "column",
    },
    queueHeader:     { padding: Spacing.md, paddingBottom: Spacing.sm },
    queueTitle:      { fontSize: FontSize.lg },
    skipMini:        { alignItems: "flex-end", gap: 4 },
    skipMiniLabel:   { fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.5 },
    queueSub:        { fontSize: FontSize.xxs, color: c.warmMid, marginTop: 2 },
    actionRow:       { flexDirection: "row", gap: Spacing.xs + 2, marginTop: Spacing.sm },
    btnAction:       { flex: 1, paddingVertical: 7, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    btnShareFill:           { backgroundColor: c.accent },
    btnShareFillText:       { fontSize: FontSize.xs, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    btnShuffleOutline:      { borderWidth: 1.5, borderColor: c.accent, paddingVertical: 7 - 1.5 },
    btnShuffleOutlineText:  { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sansMedium },
    btnImportFill:          { backgroundColor: c.green },
    btnImportFillText:      { fontSize: FontSize.xs, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    emptyQueue:      { padding: Spacing.lg, alignItems: "center" },
    emptyQueueTitle: { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center" },
    emptyQueueSub:   { fontSize: FontSize.xs, color: c.queued, textAlign: "center", marginTop: 4 },

    // Tablet "now playing" compact row in the left panel
    nowPlayingRow: {
      flexDirection: "row", alignItems: "center", gap: Spacing.sm,
      paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
      paddingLeft: Spacing.sm,
      backgroundColor: `${c.accent}08`,
    },
    nowPlayingAccent: { width: 3, alignSelf: "stretch", backgroundColor: c.accent, borderRadius: 2, marginRight: 4 },
    nowThumb:         { width: 72, height: 44, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: c.divider },
    nowProgressBar:   { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(0,0,0,0.2)" },
    nowProgressFill:  { height: 3, backgroundColor: c.accent },
    nowTag:           { fontSize: FontSize.xxs, color: c.accent, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
    nowTitle:         { fontSize: FontSize.sm, color: c.ink, lineHeight: 17 },
    nowChannel:       { fontSize: FontSize.xxs, color: c.warmMid, marginTop: 2 },

    // Player panel
    playerCol:    { flex: 1, backgroundColor: c.cream },
    videoInfo:    { padding: Spacing.md },
    videoChannel: { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: Spacing.xs },
    videoTitle:   { fontSize: FontSize.lg, lineHeight: 26 },
    videoMeta:    { fontSize: FontSize.xxs, color: c.warmMid, marginTop: Spacing.xs },
    descToggle:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: Spacing.sm + 2, paddingVertical: 4 },
    descToggleLabel: { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.5 },
    descBody:     { fontSize: FontSize.sm, color: c.ink, lineHeight: 20, marginTop: Spacing.xs, fontFamily: FontFamily.sans },
    controls: {
      flexDirection: "row", alignItems: "center", gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    },
    btnInteract:    { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.accent },
    btnInteractText:{ color: c.buttonText, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    btnDone:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.greenText },
    btnDoneText:   { color: c.greenText, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    btnSkip:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.accent },
    btnSkipText:   { color: c.accent, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    btnRemove:     { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 1.5, borderRadius: Radius.pill, backgroundColor: c.ink },
    btnRemoveText: { color: c.cream, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    upNext:      { padding: Spacing.md, paddingTop: Spacing.sm },
    upNextLabel: {
      fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase",
      letterSpacing: 1, fontFamily: FontFamily.sansMedium, marginBottom: Spacing.sm,
    },
    upNextRow: {
      flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm,
      backgroundColor: c.cardElevated, borderWidth: 1, borderColor: c.divider,
      borderRadius: Radius.md, padding: Spacing.sm, opacity: 0.5,
    },
    upNextThumb:   { width: 76, height: 48, borderRadius: Radius.sm, overflow: "hidden" },
    upNextChannel: { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
    upNextTitle:   { fontSize: FontSize.sm, color: c.ink, lineHeight: 17, marginTop: 2 },
    upNextMeta:    { fontSize: FontSize.xxs, color: c.queued, marginTop: 3 },
    emptyPlayer:      { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.sm },
    emptyPlayerTitle: { fontSize: FontSize.lg, color: c.ink, marginTop: Spacing.xs },
    emptyPlayerSub:   { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", paddingHorizontal: Spacing.xl },
  });
}

// ── Phone styles ───────────────────────────────────────────────
function makePhoneStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: c.cream },
    header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    queueHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, paddingBottom: Spacing.sm },
    queueTitle:    { fontSize: FontSize.lg },
    queueSubtitle: { fontSize: FontSize.xs, color: c.warmMid, marginTop: 2 },
    skipMini:      { alignItems: "flex-end", gap: 4 },
    skipMiniLabel: { fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.5 },

    // Now Playing card — intentionally always dark (immersive cinema surface)
    nowPlayingCard:    { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: "#1A1714", borderRadius: Radius.lg, overflow: "hidden" },
    nowPlayingThumb:   { width: "100%", height: 160, position: "relative", justifyContent: "center", alignItems: "center" },
    nowPlayingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
    nowTag:            { position: "absolute", top: 10, left: 10, backgroundColor: c.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    nowTagText:        { color: c.buttonText, fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium, letterSpacing: 0.5, textTransform: "uppercase" },
    playBtn:           { width: 48, height: 48, backgroundColor: c.accent, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingLeft: 3 },
    playBtnIcon:       { color: c.buttonText, fontSize: 18 },
    progressBar:       { height: 3, backgroundColor: "rgba(255,255,255,0.15)" },
    progressFill:      { height: 3, backgroundColor: c.accent },
    nowPlayingInfo:    { padding: Spacing.sm + 2 },
    nowChannel:        { color: c.buttonText, opacity: 0.5, fontSize: FontSize.xxs, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
    nowTitle:          { color: c.buttonText, fontSize: FontSize.md, lineHeight: 22 },
    nowMeta:           { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    nowMetaText:       { color: c.buttonText, opacity: 0.45, fontSize: FontSize.xxs },

    upNextLabel:     { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium },
    queueItem:       { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, gap: Spacing.sm, opacity: 0.5 },
    queueItemTappable: { opacity: 1 },
    queueThumb:      { width: 80, height: 50, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: c.divider },
    queueThumbImg:   { borderRadius: Radius.sm },
    queueInfo:       { flex: 1, minWidth: 0 },
    queueChannel:    { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium },
    queueTitleText:  { fontSize: FontSize.sm, color: c.ink, lineHeight: 18 },
    queueStatus:     { fontSize: FontSize.xxs, color: c.queued, marginTop: 3, fontStyle: "italic" },
    listContent:     { paddingBottom: 80 },

    emptyQueueState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl, gap: Spacing.sm },
    emptyQueueTitle: { fontSize: FontSize.lg, color: c.ink, fontFamily: FontFamily.sansMedium, textAlign: "center" },
    emptyQueueSub:   { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20 },
    emptySyncBtn:    { marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, backgroundColor: c.accent },
    emptySyncBtnText: { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },

    actionRow:      { flexDirection: "row", marginHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
    actionBtn:      { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: "center" },
    shareBtn:       { borderColor: c.accent, backgroundColor: c.accent },
    shareBtnText:   { color: c.buttonText, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    shuffleBtn:     { borderColor: c.accent },
    shuffleBtnText: { color: c.accent, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    importBtn:      { borderColor: c.green, backgroundColor: c.green },
    importBtnText:  { color: c.buttonText, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },

    sheetOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheetContainer:  { backgroundColor: c.cardBg, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
    sheetHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: c.divider, alignSelf: "center", marginBottom: Spacing.sm },
    sheetTitle:      { fontSize: FontSize.md, color: c.ink, textAlign: "center" },
    sheetSubtitle:   { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center", lineHeight: 20, marginBottom: Spacing.xs },
    sheetActionBtn:  { backgroundColor: c.accent, borderRadius: Radius.pill, paddingVertical: Spacing.sm + 2, alignItems: "center" },
    sheetActionText: { color: c.buttonText, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
    sheetCancelBtn:  { borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.divider, paddingVertical: Spacing.sm + 2, alignItems: "center" },
    sheetCancelText: { color: c.warmMid, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },

    modalOverlay:        { flex: 1, backgroundColor: "rgba(26,23,20,0.5)", justifyContent: "flex-end", padding: Spacing.md },
    modalCard:           { backgroundColor: c.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
    modalTitle:          { fontSize: FontSize.lg },
    modalBody:           { fontSize: FontSize.sm, color: c.warmMid, lineHeight: 22 },
    modalBtns:           { flexDirection: "row", gap: Spacing.sm },
    modalBtn:            { flex: 1, height: 48, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    modalBtnCancel:      { backgroundColor: c.divider },
    modalBtnCancelText:  { fontSize: FontSize.sm, color: c.ink },
    modalBtnConfirm:     { backgroundColor: c.accent },
    modalBtnConfirmText: { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
  });
}
