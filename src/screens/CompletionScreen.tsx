import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Image } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../store";
import { SerifText, SansText, ThumbPlaceholder } from "../components/UI";
import { InteractModule } from "../components/InteractModule";
import { Colors, ColorPalette, FontFamily, FontSize, Spacing, Radius, withAlpha } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { formatDuration } from "../types";

interface CompletedVideoParam {
  ytVideoId: string;
  title: string;
  durationSecs: number | null;
}

export default function CompletionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { queue, user, fetchUser } = useStore();
  const [userLoaded, setUserLoaded] = useState(false);
  const [interactVisible, setInteractVisible] = useState(false);

  useEffect(() => { fetchUser().then(() => setUserLoaded(true)); }, []);

  const watchedSecs: number = route.params?.watchedSecs ?? 0;
  const skipsBefore: number = route.params?.skipsBefore ?? 0;
  const completedVideo: CompletedVideoParam | undefined = route.params?.completedVideo;
  // The backend promotes the next entry to "watching" on completion, so the
  // up-next card should show queue.current — not the first pending, which
  // would be one entry too far ahead.
  const nextEntry = queue?.current ?? queue?.entries.find(e => e.status === "watching") ?? null;
  const watchedDisplay = watchedSecs > 0 ? formatDuration(watchedSecs) : "0:00";
  const earnedSkip = userLoaded && user != null && user.skipsRemaining > skipsBefore;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.heroSection}>
          <View style={styles.checkCircle}>
            <SerifText style={styles.checkIcon}>✓</SerifText>
          </View>
          <SerifText style={styles.heroTitle}>Complete!</SerifText>
          {earnedSkip && (
            <SansText style={styles.heroSub} numberOfLines={3}>
              You earned a skip back.
            </SansText>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCard value={watchedDisplay} label="Watched" />
          <StatCard value={String(queue?.total ?? 0)} label="In Queue" />
          <StatCard value={String(user?.skipsRemaining ?? "-")} label="Skips Left" />
        </View>

        {completedVideo && (
          <View style={styles.interactRow}>
            <SansText style={styles.interactCopy} numberOfLines={2}>
              Let this creator know what you thought of this video
            </SansText>
            <TouchableOpacity
              onPress={() => setInteractVisible(true)}
              style={styles.interactBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Interact"
            >
              <SansText style={styles.interactBtnText}>Interact</SansText>
            </TouchableOpacity>
          </View>
        )}

        {nextEntry ? (
          <View style={styles.nextSection}>
            <SerifText style={styles.nextHeading}>What would you like to do now?</SerifText>
            <TouchableOpacity style={styles.nextCard} onPress={() => navigation.replace("Player")} activeOpacity={0.85}>
              <View style={styles.nextThumbArea}>
                {nextEntry.video.thumbnailUrl
                  ? <Image source={{ uri: nextEntry.video.thumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  : <ThumbPlaceholder seed={nextEntry.video.ytVideoId} style={StyleSheet.absoluteFillObject} />}
                <View style={styles.readyTag}>
                  <SansText style={styles.readyTagText}>Queued up</SansText>
                </View>
              </View>
              <View style={styles.nextInfo}>
                <SansText style={styles.nextChannel}>{nextEntry.video.channelTitle}</SansText>
                <SerifText style={styles.nextTitle} numberOfLines={2}>{nextEntry.video.title}</SerifText>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyNext}>
            <SerifText style={styles.emptyNextText}>Your queue is empty.</SerifText>
            <SansText style={styles.emptyNextSub}>Head to Browse to add more videos.</SansText>
          </View>
        )}

        <TouchableOpacity style={styles.backToQueue} onPress={() => navigation.navigate("Tabs")} activeOpacity={0.7}>
          <SansText style={styles.backToQueueText}>Back to queue</SansText>
        </TouchableOpacity>
      </View>

      {completedVideo && (
        <InteractModule
          visible={interactVisible}
          onClose={() => setInteractVisible(false)}
          videoTitle={completedVideo.title}
          currentTimestamp={watchedSecs}
          ytVideoId={completedVideo.ytVideoId}
          durationSecs={completedVideo.durationSecs}
        />
      )}
    </SafeAreaView>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <SerifText style={styles.statValue}>{value}</SerifText>
      <SansText style={styles.statLabel}>{label}</SansText>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.cream },
    inner:        { flex: 1, padding: Spacing.md, gap: Spacing.lg, justifyContent: "center" },
    heroSection:  { alignItems: "center", gap: Spacing.sm },
    checkCircle:  { width: 68, height: 68, borderRadius: 34, backgroundColor: c.green, alignItems: "center", justifyContent: "center" },
    checkIcon:    { fontSize: FontSize.xxl, color: c.buttonText },
    heroTitle:    { fontSize: FontSize.xxl },
    heroSub:      { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20, maxWidth: 260 },
    statsRow:     { flexDirection: "row", gap: Spacing.sm },
    statCard:     { flex: 1, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, alignItems: "center" },
    statValue:    { fontSize: FontSize.xl },
    statLabel:    { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
    interactRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm, paddingVertical: Spacing.xs },
    interactCopy:   { flex: 1, fontSize: FontSize.sm, color: c.warmMid, lineHeight: 18 },
    interactBtn:    { borderWidth: 1.5, borderColor: c.accent, borderRadius: Radius.pill, paddingVertical: 8, paddingHorizontal: 18, backgroundColor: c.accent },
    interactBtnText:{ fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    nextSection:  { gap: Spacing.sm },
    nextHeading:  { fontSize: FontSize.lg, color: c.ink },
    // next card — intentionally always dark (immersive cinema surface).
    // Uses static Colors.ink (light-theme value) so the dark surface persists
    // across light + dark modes rather than inverting to cream-ink.
    nextCard:     { backgroundColor: Colors.ink, borderRadius: Radius.lg, overflow: "hidden" },
    nextThumbArea:{ height: 120, justifyContent: "center", alignItems: "center", position: "relative" },
    readyTag:     { position: "absolute", top: 8, left: 8, backgroundColor: c.green, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    readyTagText: { color: c.buttonText, fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium, letterSpacing: 0.5 },
    nextInfo:     { padding: Spacing.s10 },
    nextChannel:  { color: withAlpha(Colors.cream, 0.45), fontSize: FontSize.xxs, textTransform: "uppercase", letterSpacing: 0.5 },
    nextTitle:    { color: c.buttonText, fontSize: FontSize.md, lineHeight: 22, marginTop: 3 },
    emptyNext:    { alignItems: "center", gap: Spacing.xs },
    emptyNextText:{ fontSize: FontSize.lg, color: c.ink },
    emptyNextSub: { fontSize: FontSize.sm, color: c.warmMid },
    backToQueue:     { borderWidth: 1, borderColor: c.divider, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 32, alignSelf: "center" },
    backToQueueText: { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
  });
}
