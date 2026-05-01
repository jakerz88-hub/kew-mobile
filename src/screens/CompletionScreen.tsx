import React, { useEffect, useState, useMemo } from "react";
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../store";
import { SerifText, SansText, ThumbPlaceholder } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { formatDuration } from "../types";

export default function CompletionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { queue, user, fetchUser } = useStore();
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => { fetchUser().then(() => setUserLoaded(true)); }, []);

  const watchedSecs: number = route.params?.watchedSecs ?? 0;
  const nextEntry = queue?.entries.find(e => e.status === "pending");
  const earnedSkip = userLoaded && user != null && user.skipsRemaining < user.skipsMax;

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
              You earned 1 skip!
            </SansText>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCard value={formatDuration(watchedSecs)} label="Watched" />
          <StatCard value={String(queue?.total ?? 0)} label="In Queue" />
          <StatCard value={String(user?.skipsRemaining ?? "-")} label="Skips Left" />
        </View>

        {nextEntry ? (
          <View style={styles.nextSection}>
            <SansText style={styles.nextLabel}>Up Next - Ready</SansText>
            <TouchableOpacity style={styles.nextCard} onPress={() => navigation.replace("Player")} activeOpacity={0.85}>
              <View style={styles.nextThumbArea}>
                <ThumbPlaceholder seed={nextEntry.video.ytVideoId} style={StyleSheet.absoluteFillObject} />
                <View style={styles.readyTag}>
                  <SansText style={styles.readyTagText}>Ready to watch the next one?</SansText>
                </View>
                <View style={styles.nextPlayBtn}>
                  <SansText style={styles.nextPlayIcon}>&#9654;</SansText>
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

        <TouchableOpacity style={styles.backToQueue} onPress={() => navigation.navigate("Tabs")}>
          <SansText style={styles.backToQueueText}>Back to queue</SansText>
        </TouchableOpacity>
      </View>
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
    checkIcon:    { fontSize: 28, color: "white" },
    heroTitle:    { fontSize: FontSize.xxl },
    heroSub:      { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20, maxWidth: 260 },
    statsRow:     { flexDirection: "row", gap: Spacing.sm },
    statCard:     { flex: 1, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, alignItems: "center" },
    statValue:    { fontSize: FontSize.xl },
    statLabel:    { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
    nextSection:  { gap: Spacing.sm },
    nextLabel:    { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium },
    // "Up Next" card — intentionally always dark (immersive cinema surface)
    nextCard:     { backgroundColor: "#1A1714", borderRadius: Radius.lg, overflow: "hidden" },
    nextThumbArea:{ height: 120, justifyContent: "center", alignItems: "center", position: "relative" },
    readyTag:     { position: "absolute", top: 8, left: 8, backgroundColor: c.green, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    readyTagText: { color: "white", fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium, letterSpacing: 0.5 },
    nextPlayBtn:  { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", paddingLeft: 3 },
    nextPlayIcon: { color: "white", fontSize: 18 },
    nextInfo:     { padding: Spacing.sm + 2 },
    nextChannel:  { color: "rgba(255,255,255,0.45)", fontSize: FontSize.xxs, textTransform: "uppercase", letterSpacing: 0.5 },
    nextTitle:    { color: "white", fontSize: FontSize.md, lineHeight: 22, marginTop: 3 },
    emptyNext:    { alignItems: "center", gap: Spacing.xs },
    emptyNextText:{ fontSize: FontSize.lg, color: c.ink },
    emptyNextSub: { fontSize: FontSize.sm, color: c.warmMid },
    backToQueue:  { alignItems: "center", paddingVertical: Spacing.sm },
    backToQueueText: { fontSize: FontSize.sm, color: c.warmMid, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 2 },
  });
}
