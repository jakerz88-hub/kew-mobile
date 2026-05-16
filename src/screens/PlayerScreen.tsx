import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Modal, Image, StatusBar, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as ScreenOrientation from "expo-screen-orientation";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { InteractModule } from "../components/InteractModule";
import { ReflectModule } from "../components/ReflectModule";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import YoutubePlayer from "react-native-youtube-iframe";
import { useStore } from "../store";
import { api } from "../services/api";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, SkipCounter, Toast } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { handleLastSkipUsed } from "../utils/kewPlusUpsell";
import type { QueueEntry } from "../types";
import { formatDuration, timeAgo, formatDate } from "../types";

const PROGRESS_REPORT_INTERVAL = 10 * 1000;

// Split text into plain-text and URL parts so URLs can be rendered as
// tappable elements. Trailing punctuation that's likely sentence-ending
// (".", ",", ")", etc.) is stripped from the URL and kept as text.
function parseDescriptionParts(text: string): Array<{ type: "text" | "url"; value: string }> {
  const parts: Array<{ type: "text" | "url"; value: string }> = [];
  const regex = /(https?:\/\/[^\s]+)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: "text", value: text.slice(lastIdx, match.index) });
    }
    let url = match[0];
    const trail = url.match(/[.,;:!?)\]}>"']+$/)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    parts.push({ type: "url", value: url });
    if (trail) parts.push({ type: "text", value: trail });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push({ type: "text", value: text.slice(lastIdx) });
  return parts;
}

export default function PlayerScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const playerRef  = useRef<any>(null);

  const { queue, user, updateProgress, skipCurrent, fetchQueue, markEntryCompleted } = useStore();
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

  const [playing, setPlaying]               = useState(false);
  const [showSkipModal, setShowSkipModal]   = useState(false);
  const [showDoneModal, setShowDoneModal]   = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [markingDone,   setMarkingDone]     = useState(false);
  const [removing,      setRemoving]        = useState(false);
  const [descExpanded,  setDescExpanded]    = useState(false);
  const [actionEntry,   setActionEntry]     = useState<typeof upcomingEntries[0] | null>(null);
  const [interactVisible, setInteractVisible] = useState(false);
  const [interactTs, setInteractTs] = useState(0);
  const [reflectVisible, setReflectVisible] = useState(false);
  const [reflectTs, setReflectTs] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  // Pre-fill the Mark Done circle to filled-green the moment the user taps it,
  // even though the confirmation modal still gates the actual completion.
  // Reverts on cancel / when a new video starts.
  const [markDonePressed, setMarkDonePressed] = useState(false);

  // ── Watch event + limit tracking ──
  const startedRef = useRef<string | null>(null);
  const [limitHit, setLimitHit] = useState<{ title: string; body: string } | null>(null);

  // Track latest known progress so we can save one last time when the
  // screen unmounts (back nav, tab switch, app backgrounding) without
  // having to query the player ref during cleanup. Reset whenever the
  // current entry changes so a stale value from the previous video
  // never gets written against the next one.
  const lastReportedSecsRef = useRef(0);
  const currentIdRef        = useRef<string | null>(null);
  // Set by completion paths (mark done, end, skip, remove) so the
  // unmount cleanup doesn't overwrite a final value that was just saved.
  const suppressFinalSaveRef = useRef(false);
  useEffect(() => {
    currentIdRef.current = current?.id ?? null;
    lastReportedSecsRef.current = 0;
    // Completion paths set this for the current entry; don't let it
    // leak into the next one if the screen stays mounted.
    suppressFinalSaveRef.current = false;
    setMarkDonePressed(false);
  }, [current?.id]);

  const openInteract = useCallback(async () => {
    const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
    setInteractTs(playerSecs != null ? Math.floor(playerSecs) : 0);
    setInteractVisible(true);
  }, []);

  // Reflect pauses the video on open and resumes on close (handled by the
  // parent here + the onClose prop below). This is a deliberate departure
  // from openInteract — writing a thoughtful note while playback continues
  // would compete for attention.
  const openReflect = useCallback(async () => {
    const ts = await playerRef.current?.getCurrentTime?.() ?? 0;
    setReflectTs(Math.max(0, Math.floor(ts)));
    setPlaying(false);
    setReflectVisible(true);
  }, []);

  // Keep queue in sync whenever this screen comes into focus
  useFocusEffect(useCallback(() => { fetchQueue(); }, []));

  // Report progress every 10s while playing
  useEffect(() => {
    if (!current || !playing) return;
    const interval = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime != null) {
        const secs = Math.floor(currentTime);
        lastReportedSecsRef.current = secs;
        updateProgress(current.id, secs);
      }
    }, PROGRESS_REPORT_INTERVAL);
    return () => clearInterval(interval);
  }, [current?.id, playing]);

  // Final save on unmount — covers back navigation, tab switches, and
  // anywhere the screen is torn down without going through a completion
  // path. Fire-and-forget; updateProgress in the store swallows errors.
  useEffect(() => {
    return () => {
      if (suppressFinalSaveRef.current) return;
      const id = currentIdRef.current;
      const secs = lastReportedSecsRef.current;
      if (id && secs > 0) updateProgress(id, secs);
    };
  }, []);

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
      // Pause IMMEDIATELY before any awaits — YouTube's internal
      // autoplay-next behavior fires during the async gap before
      // navigation.replace("Completion", ...) and would auto-start the
      // next related video unless `playing` is forced false synchronously.
      setPlaying(false);
      // Prefer the player's actual current position over the cached video
      // duration — some YouTube videos (livestreams, premieres) have null
      // durationSecs, which would otherwise leave watchedSecs at 0 and
      // render as "-" on the completion screen.
      const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
      const watchedSecs = playerSecs != null ? Math.floor(playerSecs) : (current.video.durationSecs ?? 0);
      suppressFinalSaveRef.current = true;
      await recordEvent("completed", watchedSecs);
      await updateProgress(current.id, watchedSecs);
      markEntryCompleted(current.id);
      await fetchQueue();
      navigation.replace("Completion", {
        watchedSecs,
        completedVideo: {
          ytVideoId: current.video.ytVideoId,
          title: current.video.title,
          durationSecs: current.video.durationSecs,
        },
      });
    }
  }, [current, recordEvent]);

  const handleMarkDone = useCallback(async () => {
    if (!current) return;
    setMarkingDone(true);
    const playerSecs = await playerRef.current?.getCurrentTime().catch(() => null);
    const watchedSecs = playerSecs != null ? Math.floor(playerSecs) : (current.video.durationSecs ?? 0);
    try {
      suppressFinalSaveRef.current = true;
      await recordEvent("completed", watchedSecs);
      await updateProgress(current.id, current.video.durationSecs ?? watchedSecs);
      markEntryCompleted(current.id);
      await fetchQueue();
      navigation.replace("Completion", {
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
  }, [current, recordEvent]);

  const handleSkipConfirm = async () => {
    setShowSkipModal(false);
    suppressFinalSaveRef.current = true;
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
    suppressFinalSaveRef.current = true;
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
          // rel: 0 disables YouTube's "related videos" overlay, which on iOS
          // can manifest as an autoplay-next when a video ends. Always
          // present; `start` only when resuming mid-video.
          initialPlayerParams={{
            ...(current.watchProgressSecs > 10
              ? { start: Math.max(0, current.watchProgressSecs - 3) }
              : {}),
            rel: 0,
          }}
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
          {current.video.publishedAt && (
            <SansText style={styles.metaText}>Uploaded on {formatDate(current.video.publishedAt)}</SansText>
          )}
          <View style={styles.metaRow}>
            <SansText style={styles.metaText}>Added to your queue {timeAgo(current.addedAt)}</SansText>
          </View>
          {current.video.description && current.video.description.trim().length > 0 && (
            <>
              <TouchableOpacity
                onPress={() => setDescExpanded(e => !e)}
                activeOpacity={0.7}
                style={styles.descToggle}
              >
                <SansText style={styles.descLabel}>Description</SansText>
                <Feather
                  name={descExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.warmMid}
                />
              </TouchableOpacity>
              {descExpanded && (
                <SansText style={styles.descBody}>
                  {parseDescriptionParts(current.video.description).map((p, i) =>
                    p.type === "url" ? (
                      <Text
                        key={i}
                        style={styles.descLink}
                        onPress={() => WebBrowser.openBrowserAsync(p.value).catch(() => {})}
                      >
                        {p.value}
                      </Text>
                    ) : (
                      p.value
                    ),
                  )}
                </SansText>
              )}
            </>
          )}
        </View>

        {/* Skip counter — kept exactly where it was */}
        {user && (
          <View style={styles.skipCountBar}>
            <SansText style={styles.actionSkipCountText}>{user.skipsRemaining}/{user.skipsMax} Skips</SansText>
            <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />
          </View>
        )}

        {/* Reflect / Interact / Skip / Mark done / Remove */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            onPress={openReflect}
            style={[styles.ctaChip, styles.ctaChipReflect]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Reflect"
          >
            <SansText style={styles.ctaChipReflectText}>Reflect</SansText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openInteract}
            style={[styles.ctaChip, styles.ctaChipInteract]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Interact"
          >
            <SansText style={styles.ctaChipInteractText}>Interact</SansText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowSkipModal(true)}
            disabled={!user || user.skipsRemaining <= 0}
            style={[
              styles.ctaSkipCircle,
              (!user || user.skipsRemaining <= 0) && styles.actionBtnDisabled,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            {/* Skip-forward: filled triangle + vertical bar (per spec). */}
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M5 4 L15 12 L5 20 Z" fill={colors.accent} />
              <Path d="M19 5 L19 19" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setMarkDonePressed(true); setShowDoneModal(true); }}
            style={[styles.ctaCircle, markDonePressed ? styles.markDoneFilled : styles.markDoneOutline]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Mark done"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path
                d="M5 12 10 17 19 8"
                fill="none"
                stroke={markDonePressed ? colors.buttonText : colors.green}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowRemoveModal(true)}
            style={[styles.ctaCircle, styles.removeCircle]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Remove from queue"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M6 6 18 18 M18 6 6 18"
                fill="none"
                stroke={colors.warmMid}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
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
      <Modal visible={showDoneModal} transparent animationType="fade" onRequestClose={() => { setShowDoneModal(false); setMarkDonePressed(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SerifText style={styles.modalTitle}>Done watching?</SerifText>
            <SansText style={styles.modalBody}>
              This will mark "{current.video.title}" as complete and move to the next video.
            </SansText>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => { setShowDoneModal(false); setMarkDonePressed(false); }}>
                <SansText style={styles.modalBtnCancelText}>Not yet</SansText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleMarkDone} disabled={markingDone}>
                <SansText style={styles.modalBtnConfirmText}>{markingDone ? "..." : "Mark done"}</SansText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <InteractModule
        visible={interactVisible}
        onClose={() => setInteractVisible(false)}
        videoTitle={current.video.title}
        currentTimestamp={interactTs}
        ytVideoId={current.video.ytVideoId}
        durationSecs={current.video.durationSecs}
      />

      <ReflectModule
        visible={reflectVisible}
        onClose={() => { setReflectVisible(false); setPlaying(true); }}
        onSaved={() => showToast("Entry saved")}
        videoTitle={current.video.title}
        ytVideoId={current.video.ytVideoId}
        currentTimestamp={reflectTs}
        durationSecs={current.video.durationSecs}
      />

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

      <Toast message={toastMsg} visible={toastVisible} />
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
    descToggle:          { marginTop: Spacing.sm, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    descLabel:           { fontSize: FontSize.xs, color: c.warmMid },
    descBody:            { fontSize: FontSize.xs, color: c.ink, lineHeight: 18, marginTop: Spacing.xs },
    descLink:            { color: c.accent, textDecorationLine: "underline" },
    skipCountBar:        { marginHorizontal: Spacing.md, marginTop: Spacing.xs, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    actionSkipCountText: { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    ctaRow:              { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
    ctaChip:             { flex: 1, borderRadius: Radius.pill, alignItems: "center", borderWidth: 1.5, paddingVertical: 8, paddingHorizontal: 10 },
    ctaChipReflect:      { borderColor: c.accent, backgroundColor: c.accent },
    ctaChipReflectText:  { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    ctaChipInteract:     { borderColor: c.accent, backgroundColor: "transparent" },
    ctaChipInteractText: { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    ctaSkipCircle:       { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: c.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    ctaCircle:           { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    markDoneOutline:     { borderWidth: 1.5, borderColor: c.green, backgroundColor: "transparent" },
    markDoneFilled:      { backgroundColor: c.green, borderWidth: 0 },
    removeCircle:        { borderWidth: 1.5, borderColor: c.divider, backgroundColor: "transparent" },
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
