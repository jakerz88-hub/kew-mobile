import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { SansText, SerifText, Divider, ThumbPlaceholder, SkipCounter } from "../components/UI";
import YouTubePlayer, { YouTubePlayerRef } from "../components/YouTubePlayer";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration, timeAgo } from "../types";

const PROGRESS_REPORT_INTERVAL = 10 * 1000;

export default function PlayerScreen() {
  const navigation = useNavigation<any>();
  const playerRef  = useRef<YouTubePlayerRef>(null);

  const { queue, user, updateProgress, skipCurrent, fetchQueue } = useStore();
  const current   = queue?.current;
  const nextEntry = queue?.entries.find(e => e.status === "pending");

  const [playing, setPlaying]         = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);

  useEffect(() => {
    if (!current || !playing) return;
    const interval = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime !== undefined && currentTime !== null) {
        await updateProgress(current.id, Math.floor(currentTime));
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

  const handleSkipConfirm = async () => {
    setShowSkipModal(false);
    await skipCurrent();
    navigation.goBack();
  };

  if (!current) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <SansText style={styles.backText}>← Queue</SansText>
        </TouchableOpacity>
        <View style={styles.noVideo}>
          <SerifText style={styles.noVideoText}>Nothing playing right now.</SerifText>
        </View>
      </SafeAreaView>
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
        <YouTubePlayer
          ref={playerRef}
          videoId={current.video.ytVideoId}
          height={210}
          play={playing}
          onChangeState={onStateChange}
        />

        <View style={styles.metaSection}>
          <SansText style={styles.channelName}>{current.video.channelTitle}</SansText>
          <SerifText style={styles.videoTitle}>{current.video.title}</SerifText>
          <View style={styles.metaRow}>
            <SansText style={styles.metaText}>Added {timeAgo(current.addedAt)}</SansText>
            <SansText style={styles.metaText}>#{current.position} in queue</SansText>
          </View>
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.skipSection}>
          <View style={styles.skipTop}>
            <SansText style={styles.skipLabel}>Not feeling this one?</SansText>
            {user && <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />}
          </View>
          <SansText style={styles.skipConsequence}>
            This will move the current video to the end of your queue.
          </SansText>
          <TouchableOpacity
            onPress={() => setShowSkipModal(true)}
            disabled={!user || user.skipsRemaining <= 0}
            style={[styles.skipAction, (!user || user.skipsRemaining <= 0) && styles.skipActionDisabled]}
          >
            <SansText style={[styles.skipActionText, (!user || user.skipsRemaining <= 0) && styles.skipActionTextDisabled]}>
              Move to end of queue
            </SansText>
          </TouchableOpacity>
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        {nextEntry && (
          <View style={styles.upNextSection}>
            <SansText style={styles.upNextLabel}>Up Next</SansText>
            <View style={styles.upNextCard}>
              <View style={styles.upNextThumb}>
                <ThumbPlaceholder seed={nextEntry.video.ytVideoId} style={StyleSheet.absoluteFill} />
              </View>
              <View style={styles.upNextInfo}>
                <SansText style={styles.upNextChannel}>{nextEntry.video.channelTitle}</SansText>
                <SansText style={styles.upNextTitle} numberOfLines={2}>{nextEntry.video.title}</SansText>
                <SansText style={styles.upNextStatus}>Queued up · available after this</SansText>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={showSkipModal} transparent animationType="fade" onRequestClose={() => setShowSkipModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <SerifText style={styles.modalTitle}>Move to end of queue?</SerifText>
            <SansText style={styles.modalBody}>
              "{current.video.title}" will be moved to the back of your queue.{"\n\n"}
              You have {user?.skipsRemaining ?? 0} skip{user?.skipsRemaining !== 1 ? "s" : ""} remaining.
              You will earn one back when you finish another video.
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
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backText: { fontSize: FontSize.sm, color: Colors.ink },
  navLogo: { fontFamily: FontFamily.serif, fontSize: FontSize.lg, color: Colors.ink },
  scrollContent: { paddingBottom: 60 },
  metaSection: { padding: Spacing.md },
  channelName: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: Spacing.xs },
  videoTitle: { fontSize: FontSize.lg, lineHeight: 26 },
  metaRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
  metaText: { fontSize: FontSize.xxs, color: Colors.warmMid },
  skipSection: { marginHorizontal: Spacing.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  skipTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skipLabel: { fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
  skipConsequence: { fontSize: FontSize.xxs, color: Colors.warmMid, lineHeight: 16, fontStyle: "italic" },
  skipAction: { alignSelf: "flex-start", borderBottomWidth: 1, borderBottomColor: `${Colors.accent}50`, paddingBottom: 1 },
  skipActionDisabled: { opacity: 0.4 },
  skipActionText: { fontSize: FontSize.sm, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  skipActionTextDisabled: { color: Colors.queued },
  upNextSection: { paddingHorizontal: Spacing.md },
  upNextLabel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium, marginBottom: Spacing.sm },
  upNextCard: { flexDirection: "row", gap: Spacing.sm, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, padding: Spacing.sm, opacity: 0.5 },
  upNextThumb: { width: 76, height: 48, borderRadius: Radius.sm, overflow: "hidden" },
  upNextInfo: { flex: 1, minWidth: 0 },
  upNextChannel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
  upNextTitle: { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 17, marginTop: 2 },
  upNextStatus: { fontSize: FontSize.xxs, color: Colors.queued, marginTop: 3, fontStyle: "italic" },
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
