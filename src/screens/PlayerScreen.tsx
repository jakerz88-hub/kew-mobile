import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Modal, Image, StatusBar, useWindowDimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { Feather } from "@expo/vector-icons";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import YoutubePlayer from "react-native-youtube-iframe";
import { useStore } from "../store";
import { api } from "../services/api";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, SkipCounter } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useTooltip } from "../hooks/useTooltip";
import TooltipOverlay, { TooltipAnchor } from "../components/TooltipOverlay";
import { handleLastSkipUsed } from "../utils/kewPlusUpsell";
import type { QueueEntry } from "../types";
import { formatDuration, timeAgo } from "../types";

const PROGRESS_REPORT_INTERVAL = 10 * 1000;

const PLAYER_TIPS = [
  "Looking for a refresh? Shuffle the whole queue to reorder all your upcoming videos.",
  "You can also add to your queue directly from your YouTube playlists!",
];
const PLAYER_ANCHORS: TooltipAnchor[] = [
  { arrowSide: "top", top: 376, left: 16, arrowOffset: 20 },
  { arrowSide: "top", top: 376, left: 16, arrowOffset: 20 },
];

export default function PlayerScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const playerRef  = useRef<any>(null);

  const { queue, user, updateProgress, skipCurrent, fetchQueue } = useStore();
  const current         = queue?.current ?? queue?.entries.find(e => e.status === "pending") ?? null;
  const upcomingEntries = queue?.entries.filter(e => e.status === "pending" && e.id !== current?.id) ?? [];

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Unlock rotation when entering player; restore portrait lock on exit
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // ── Tooltip journey ──
  const playerTip = useTooltip("player", 2);

  const [playing, setPlaying]               = useState(true);
  const [showSkipModal, setShowSkipModal]   = useState(false);
  const [showDoneModal, setShowDoneModal]   = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [markingDone,   setMarkingDone]     = useState(false);
  const [removing,      setRemoving]        = useState(false);
  const [actionEntry,   setActionEntry]     = useState<typeof upcomingEntries[0] | null>(null);

  // ── Watch event + limit tracking ──
  const startedRef = useRef<string | null>(null);
  const [limitHit, setLimitHit] = useState<{ title: string; body: string } | null>(null);

  // Keep queue in sync whenever this screen comes into focus
  useFocusEffect(useCallback(() => { fetchQueue(); }, []));

  // Report progress every 10s while playing
  useEffect(() => {
    if (!current || !playing) return;
    const interval = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime != null) {
        updateProgress(current.id, Math.floor(currentTime));
      }
    }, PROGRESS_REPORT_INTERVAL);
    return () => clearInterval(interval);
  }, [current?.id, playing]);

  // Limit check: before starting a new video, see if any soft limit would be exceeded.
  // Pro-only — non-Pro users can't set limits, so this is a no-op for them.
  useEffect(() => {
    if (!current || user?.plan !== "pro") return;
    let cancelled = false;
    (async () => {
      try {
        const l = await api.getLimits();
        if (cancelled || !l) return;
        let hit: { title: string; body: string } | null = null;
        if (l.dailyVideos != null && l.todayVideos >= l.dailyVideos) {
          hit = { title: "Daily video limit reached",
                  body: `You've watched ${l.todayVideos} videos today, your personal limit. Reward yourself by taking a break!` };
        } else if (l.dailyMinutes != null && l.todayMinutes >= l.dailyMinutes) {
          hit = { title: "Daily watch time reached",
                  body: `You've hit your personal limit of ${l.dailyMinutes} minutes today. Reward yourself by taking a break!` };
        } else if (l.consecutiveVideos != null && l.consecutiveVideosNow >= l.consecutiveVideos) {
          hit = { title: "Time for a break",
                  body: `You've watched ${l.consecutiveVideosNow} videos in a row, your personal limit. Reward yourself by taking a break!` };
        }
        if (hit) {
          setLimitHit(hit);
          setPlaying(false);
        }
      } catch { /* swallow — limits are best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [current?.id, user?.plan]);

  const recordEvent = useCallback(async (eventType: "started" | "completed" | "skipped", watchSeconds: number) => {
    if (!current) return;
    try {
      await api.recordWatchEvent({
        ytVideoId: current.video.ytVideoId,
        queueId:   user?.activeQueueId ?? null,
        eventType,
        watchSeconds: Math.max(0, Math.floor(watchSeconds)),
      });
    } catch { /* best-effort — never block playback */ }
  }, [current, user?.activeQueueId]);

  const onStateChange = useCallback(async (state: string) => {
    if (state === "playing") {
      setPlaying(true);
      // Fire 'started' once per video — first time it plays.
      if (current && startedRef.current !== current.id) {
        startedRef.current = current.id;
        recordEvent("started", 0);
      }
    }
    if (state === "paused")  setPlaying(false);
    if (state === "ended" && current) {
      const watchedSecs = current.video.durationSecs ?? 0;
      await recordEvent("completed", watchedSecs);
      await updateProgress(current.id, watchedSecs);
      await fetchQueue();
      navigation.replace("Completion", { watchedSecs });
    }
  }, [current, recordEvent]);

  const handleMarkDone = useCallback(async () => {
    if (!current) return;
    setMarkingDone(true);
    const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
    const watchedSecs = playerSecs != null ? Math.floor(playerSecs) : (current.video.durationSecs ?? 0);
    try {
      await recordEvent("completed", watchedSecs);
      await updateProgress(current.id, current.video.durationSecs ?? watchedSecs);
      await fetchQueue();
      navigation.replace("Completion", { watchedSecs });
    } finally {
      setMarkingDone(false);
      setShowDoneModal(false);
    }
  }, [current, recordEvent]);

  const handleSkipConfirm = async () => {
    setShowSkipModal(false);
    const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
    const watchedSecs = playerSecs != null ? Math.floor(playerSecs) : 0;
    await recordEvent("skipped", watchedSecs);
    await skipCurrent();
    // After the store has updated skipsRemaining, check if the user just used
    // their last skip — if so, count it (and surface the upsell every 5th).
    const after = useStore.getState().user;
    if (after?.plan !== "pro" && after?.skipsRemaining === 0) {
      await handleLastSkipUsed();
    }
    navigation.goBack();
  };

  const handleRemoveConfirm = async () => {
    if (!current) return;
    setRemoving(true);
    try {
      await api.removeFromQueue(current.id);
      await fetchQueue();
      navigation.goBack();
    } finally {
      setRemoving(false);
      setShowRemoveModal(false);
    }
  };

  if (!current) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <View style={styles.noVideo}>
          <SerifText style={styles.noVideoText}>Nothing to play right now.</SerifText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={isLandscape} />

      {/* Portrait-only header */}
      {!isLandscape && (
        <>
          <View style={styles.nav}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={20} color={colors.warmMid} />
            </TouchableOpacity>
            <View style={styles.navLockup}>
              <LogoMark size={18} />
              <KewLogo size={FontSize.lg} />
            </View>
            <View style={{ flex: 1 }} />
          </View>
          <Divider />
        </>
      )}

      {/*
        Video is ALWAYS rendered here so React never unmounts/remounts it.
        In landscape it expands to cover the full screen via absolute positioning.
      */}
      <View style={isLandscape ? styles.videoLandscape : undefined}>
        <YoutubePlayer
          ref={playerRef}
          height={isLandscape ? height : 210}
          width={isLandscape ? width : undefined}
          videoId={current.video.ytVideoId}
          play={playing}
          onChangeState={onStateChange}
          initialPlayerParams={
            current.watchProgressSecs > 10
              ? { start: Math.max(0, current.watchProgressSecs - 3) }
              : undefined
          }
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
        />
      </View>

      {/* Portrait-only scroll content */}
      {!isLandscape && (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.metaSection}>
          <SansText style={styles.channelName}>{current.video.channelTitle}</SansText>
          <SerifText style={styles.videoTitle}>{current.video.title}</SerifText>
          <View style={styles.metaRow}>
            <SansText style={styles.metaText}>Added {timeAgo(current.addedAt)}</SansText>
          </View>
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          {user && (
            <View style={styles.actionSkipCount}>
              <SansText style={styles.actionSkipCountText}>{user.skipsRemaining}/{user.skipsMax} Skips</SansText>
              <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />
            </View>
          )}
          <View style={styles.actionBtns}>
            <TouchableOpacity
              onPress={() => setShowSkipModal(true)}
              disabled={!user || user.skipsRemaining <= 0}
              style={[styles.actionBtn, styles.actionBtnSkip, (!user || user.skipsRemaining <= 0) && styles.actionBtnDisabled]}
              activeOpacity={0.7}
            >
              <SansText style={styles.actionBtnSkipText}>Skip</SansText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowRemoveModal(true)}
              style={[styles.actionBtn, styles.actionBtnRemove]}
              activeOpacity={0.7}
            >
              <SansText style={styles.actionBtnRemoveText}>Remove</SansText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDoneModal(true)}
              style={[styles.actionBtn, styles.actionBtnDone]}
              activeOpacity={0.7}
            >
              <SansText style={styles.actionBtnDoneText}>Mark done</SansText>
            </TouchableOpacity>
          </View>
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        {upcomingEntries.length > 0 && (
          <View style={styles.upNextSection}>
            <SansText style={styles.upNextLabel}>
              Up Next · {upcomingEntries.length} video{upcomingEntries.length !== 1 ? "s" : ""}
            </SansText>
            {upcomingEntries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.upNextCard}
                onLongPress={() => setActionEntry(entry)}
                delayLongPress={400}
                activeOpacity={0.8}
              >
                <View style={styles.upNextThumb}>
                  {entry.video.thumbnailUrl
                    ? <Image source={{ uri: entry.video.thumbnailUrl }} style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }]} resizeMode="cover" />
                    : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
                  }
                </View>
                <View style={styles.upNextInfo}>
                  <SansText style={styles.upNextChannel}>{entry.video.channelTitle}</SansText>
                  <SansText style={styles.upNextTitle} numberOfLines={2}>{entry.video.title}</SansText>
                  <SansText style={styles.upNextMeta}>{formatDuration(entry.video.durationSecs)}</SansText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      )} {/* end portrait-only scroll content */}

      {/* Mark as watched modal */}
      <Modal visible={showDoneModal} transparent animationType="fade" onRequestClose={() => setShowDoneModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SerifText style={styles.modalTitle}>Done watching?</SerifText>
            <SansText style={styles.modalBody}>
              This will mark "{current.video.title}" as complete and move to the next video.
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

      <QueueActionSheet
        visible={!!actionEntry}
        entryId={actionEntry?.id ?? ""}
        videoTitle={actionEntry?.video.title ?? ""}
        onClose={() => setActionEntry(null)}
      />

      {/* Remove modal */}
      <Modal visible={showRemoveModal} transparent animationType="fade" onRequestClose={() => setShowRemoveModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SerifText style={styles.modalTitle}>Remove from queue?</SerifText>
            <SansText style={styles.modalBody}>
              "{current.video.title}" will be removed. This can't be undone.
            </SansText>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowRemoveModal(false)}>
                <SansText style={styles.modalBtnCancelText}>Keep it</SansText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleRemoveConfirm} disabled={removing}>
                <SansText style={styles.modalBtnConfirmText}>{removing ? "..." : "Remove"}</SansText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Skip modal */}
      <Modal visible={showSkipModal} transparent animationType="fade" onRequestClose={() => setShowSkipModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SerifText style={styles.modalTitle}>Not feeling this one?</SerifText>
            <SansText style={styles.modalBody}>
              "{current.video.title}" will be moved to the back of your queue.{"\n\n"}
              You have {user?.skipsRemaining ?? 0} skip{user?.skipsRemaining !== 1 ? "s" : ""} remaining.
            </SansText>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowSkipModal(false)}>
                <SansText style={styles.modalBtnCancelText}>Never mind.</SansText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleSkipConfirm}>
                <SansText style={styles.modalBtnConfirmText}>Skip this video</SansText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Personal limit reached modal (Pro) */}
      <Modal visible={!!limitHit} transparent animationType="fade" onRequestClose={() => { setLimitHit(null); setPlaying(true); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SerifText style={styles.modalTitle}>{limitHit?.title ?? ""}</SerifText>
            <SansText style={styles.modalBody}>{limitHit?.body ?? ""}</SansText>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setLimitHit(null); navigation.goBack(); }}
              >
                <SansText style={styles.modalBtnCancelText}>Take a break</SansText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={() => { setLimitHit(null); setPlaying(true); }}
              >
                <SansText style={styles.modalBtnConfirmText}>Keep watching</SansText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!isLandscape && (
        <TooltipOverlay
          visible={playerTip.visible}
          step={playerTip.step}
          totalSteps={2}
          body={PLAYER_TIPS[Math.max(0, playerTip.step)] ?? ""}
          anchor={PLAYER_ANCHORS[Math.max(0, playerTip.step)] ?? PLAYER_ANCHORS[0]}
          onNext={playerTip.advance}
          onDismiss={playerTip.dismiss}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:           { flex: 1, backgroundColor: c.cream },
    videoLandscape:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: "black" },
    nav:                 { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    navLockup:           { flexDirection: "row", alignItems: "center", gap: 6 },
    scrollContent:       { paddingBottom: 60 },
    metaSection:         { padding: Spacing.md },
    channelName:         { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: Spacing.xs },
    videoTitle:          { fontSize: FontSize.lg, lineHeight: 26 },
    metaRow:             { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
    metaText:            { fontSize: FontSize.xxs, color: c.warmMid },
    actionBar:           { marginHorizontal: Spacing.md, marginTop: Spacing.xs, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
    actionSkipCount:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    actionSkipCountText: { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    actionBtns:          { flexDirection: "row", gap: Spacing.sm },
    actionBtn:           { flex: 1, paddingVertical: Spacing.sm - 1, borderRadius: Radius.pill, alignItems: "center", borderWidth: 1.5 },
    actionBtnSkip:       { borderColor: c.accent },
    actionBtnSkipText:   { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sansMedium },
    actionBtnRemove:     { borderColor: c.ink, backgroundColor: c.ink },
    actionBtnRemoveText: { fontSize: FontSize.xs, color: c.cream, fontFamily: FontFamily.sansMedium },
    actionBtnDone:       { borderColor: c.greenText },
    actionBtnDoneText:   { fontSize: FontSize.xs, color: c.greenText, fontFamily: FontFamily.sansMedium },
    actionBtnDisabled:   { opacity: 0.4 },
    upNextSection:       { paddingHorizontal: Spacing.md },
    upNextLabel:         { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium, marginBottom: Spacing.sm },
    upNextCard:          { flexDirection: "row", gap: Spacing.sm, backgroundColor: c.cardElevated, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.sm, opacity: 0.5, marginBottom: Spacing.sm },
    upNextThumb:         { width: 76, height: 48, borderRadius: Radius.sm, overflow: "hidden" },
    upNextInfo:          { flex: 1, minWidth: 0 },
    upNextChannel:       { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
    upNextTitle:         { fontSize: FontSize.sm, color: c.ink, lineHeight: 17, marginTop: 2 },
    upNextStatus:        { fontSize: FontSize.xxs, color: c.queued, marginTop: 3, fontStyle: "italic" },
    upNextMeta:          { fontSize: FontSize.xxs, color: c.queued, marginTop: 3 },
    noVideo:             { flex: 1, alignItems: "center", justifyContent: "center" },
    noVideoText:         { fontSize: FontSize.lg, color: c.warmMid },
    backBtn:             { flex: 1, padding: Spacing.md },
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
