import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Modal, Image, StatusBar, useWindowDimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import YoutubePlayer from "react-native-youtube-iframe";
import { useStore } from "../store";
import { api } from "../services/api";
import { SansText, SerifText, Divider, ThumbPlaceholder, SkipCounter } from "../components/UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import type { QueueEntry } from "../types";
import { formatDuration, timeAgo } from "../types";

const PROGRESS_REPORT_INTERVAL = 10 * 1000;

export default function PlayerScreen() {
  const navigation = useNavigation<any>();
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

  const [playing, setPlaying]               = useState(true);
  const [showSkipModal, setShowSkipModal]   = useState(false);
  const [showDoneModal, setShowDoneModal]   = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [markingDone,   setMarkingDone]     = useState(false);
  const [removing,      setRemoving]        = useState(false);
  const [actionEntry,   setActionEntry]     = useState<typeof upcomingEntries[0] | null>(null);

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

  const onStateChange = useCallback(async (state: string) => {
    if (state === "playing") setPlaying(true);
    if (state === "paused")  setPlaying(false);
    if (state === "ended" && current) {
      await updateProgress(current.id, current.video.durationSecs ?? 0);
      await fetchQueue();
      navigation.replace("Completion");
    }
  }, [current]);

  const handleMarkDone = useCallback(async () => {
    if (!current) return;
    setMarkingDone(true);
    try {
      await updateProgress(current.id, current.video.durationSecs ?? 0);
      await fetchQueue();
      navigation.replace("Completion");
    } finally {
      setMarkingDone(false);
      setShowDoneModal(false);
    }
  }, [current]);

  const handleSkipConfirm = async () => {
    setShowSkipModal(false);
    await skipCurrent();
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
          <SansText style={styles.backText}>← Queue</SansText>
        </TouchableOpacity>
        <View style={styles.noVideo}>
          <SerifText style={styles.noVideoText}>Nothing to play right now.</SerifText>
        </View>
      </SafeAreaView>
    );
  }

  // Landscape: expand video to fill the screen, hide all chrome
  if (isLandscape) {
    return (
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden />
        <YoutubePlayer
          ref={playerRef}
          height={height}
          width={width}
          videoId={current.video.ytVideoId}
          play={playing}
          onChangeState={onStateChange}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <SansText style={styles.backText}>← Queue</SansText>
        </TouchableOpacity>
        <Text style={styles.navLogo}>K<Text style={{ color: Colors.accent }}>e</Text>w</Text>
        <View style={{ width: 60 }} />
      </View>
      <Divider />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <YoutubePlayer
          ref={playerRef}
          height={210}
          videoId={current.video.ytVideoId}
          play={playing}
          onChangeState={onStateChange}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
        />

        <View style={styles.metaSection}>
          <SansText style={styles.channelName}>{current.video.channelTitle}</SansText>
          <SerifText style={styles.videoTitle}>{current.video.title}</SerifText>
          <View style={styles.metaRow}>
            <SansText style={styles.metaText}>Added {timeAgo(current.addedAt)}</SansText>
          </View>
        </View>

        <View style={styles.skipSection}>
          <View style={styles.skipTop}>
            <SansText style={styles.skipLabel}>Not feeling this one?</SansText>
            {user && <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />}
          </View>
          <SansText style={styles.skipConsequence}>You can skip it or remove it from your queue.</SansText>
          <TouchableOpacity
            onPress={() => setShowSkipModal(true)}
            disabled={!user || user.skipsRemaining <= 0}
            style={[styles.skipAction, (!user || user.skipsRemaining <= 0) && styles.skipActionDisabled]}
          >
            <SansText style={[styles.skipActionText, (!user || user.skipsRemaining <= 0) && styles.skipActionTextDisabled]}>
              Move to end of queue
            </SansText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowRemoveModal(true)}
            style={styles.skipAction}
          >
            <SansText style={styles.removeActionText}>Remove from queue</SansText>
          </TouchableOpacity>
        </View>

        {/* Mark as watched — subtle fallback link */}
        <TouchableOpacity style={styles.doneLink} onPress={() => setShowDoneModal(true)} activeOpacity={0.6}>
          <SansText style={styles.doneLinkText}>Already watched this? Mark as done</SansText>
        </TouchableOpacity>

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
            <SerifText style={styles.modalTitle}>Move to end of queue?</SerifText>
            <SansText style={styles.modalBody}>
              "{current.video.title}" will be moved to the back of your queue.{"\n\n"}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  fullscreenContainer: { flex: 1, backgroundColor: "black" },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backText: { fontSize: FontSize.sm, color: Colors.ink },
  navLogo: { fontFamily: FontFamily.serif, fontSize: FontSize.lg, color: Colors.ink },
  scrollContent: { paddingBottom: 60 },
  metaSection: { padding: Spacing.md },
  channelName: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: Spacing.xs },
  videoTitle: { fontSize: FontSize.lg, lineHeight: 26 },
  metaRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
  metaText: { fontSize: FontSize.xxs, color: Colors.warmMid },
  doneLink: { alignItems: "center", paddingVertical: Spacing.md },
  doneLinkText: { fontSize: FontSize.xs, color: Colors.warmMid, textDecorationLine: "underline" },
  skipSection: { marginHorizontal: Spacing.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  skipTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skipLabel: { fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
  skipConsequence: { fontSize: FontSize.xxs, color: Colors.warmMid, lineHeight: 16, fontStyle: "italic" },
  skipAction: { alignSelf: "flex-start", borderBottomWidth: 1, borderBottomColor: `${Colors.accent}50`, paddingBottom: 1 },
  skipActionDisabled: { opacity: 0.4 },
  skipActionText: { fontSize: FontSize.sm, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  skipActionTextDisabled: { color: Colors.queued },
  removeActionText: { fontSize: FontSize.sm, color: Colors.warmMid, fontFamily: FontFamily.sansMedium },
  upNextSection: { paddingHorizontal: Spacing.md },
  upNextLabel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium, marginBottom: Spacing.sm },
  upNextCard: { flexDirection: "row", gap: Spacing.sm, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, padding: Spacing.sm, opacity: 0.5, marginBottom: Spacing.sm },
  upNextThumb: { width: 76, height: 48, borderRadius: Radius.sm, overflow: "hidden" },
  upNextInfo: { flex: 1, minWidth: 0 },
  upNextChannel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
  upNextTitle: { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 17, marginTop: 2 },
  upNextStatus: { fontSize: FontSize.xxs, color: Colors.queued, marginTop: 3, fontStyle: "italic" },
  upNextMeta: { fontSize: FontSize.xxs, color: Colors.queued, marginTop: 3 },
  noVideo: { flex: 1, alignItems: "center", justifyContent: "center" },
  noVideoText: { fontSize: FontSize.lg, color: Colors.warmMid },
  backBtn: { padding: Spacing.md },
  modalOverlay: { flex: 1, backgroundColor: "rgba(26,23,20,0.5)", justifyContent: "flex-end", padding: Spacing.md },
  modalCard: { backgroundColor: Colors.cream, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg },
  modalBody: { fontSize: FontSize.sm, color: Colors.warmMid, lineHeight: 22 },
  modalBtns: { flexDirection: "row", gap: Spacing.sm },
  modalBtn: { flex: 1, height: 48, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  modalBtnCancel: { backgroundColor: Colors.divider },
  modalBtnCancelText: { fontSize: FontSize.sm, color: Colors.ink },
  modalBtnConfirm: { backgroundColor: Colors.accent },
  modalBtnConfirmText: { fontSize: FontSize.sm, color: Colors.cream, fontFamily: FontFamily.sansMedium },
});
