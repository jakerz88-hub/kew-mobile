import React, { useEffect } from "react";
import { View, Image, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { SerifText, SansText } from "../components/UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration } from "../types";

export default function CompletionScreen() {
  const navigation = useNavigation<any>();
  const { queue, user, fetchUser } = useStore();

  useEffect(() => { fetchUser(); }, []);

  const completed = queue?.entries.find(e => e.status === "completed");
  const nextEntry = queue?.entries.find(e => e.status === "pending");
  const watchedSecs = completed?.video.durationSecs ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.heroSection}>
          <View style={styles.checkCircle}>
            <SerifText style={styles.checkIcon}>✓</SerifText>
          </View>
          <SerifText style={styles.heroTitle}>Well watched.</SerifText>
          <SansText style={styles.heroSub} numberOfLines={3}>
            You finished{completed ? ` "${completed.video.title}"` : " that video"} in full.
          </SansText>
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
                {nextEntry.video.thumbnailUrl
                  ? <Image source={{ uri: nextEntry.video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <View style={styles.nextThumbPlaceholder} />
                }
                <View style={styles.readyTag}>
                  <SansText style={styles.readyTagText}>Ready to watch</SansText>
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
  return (
    <View style={styles.statCard}>
      <SerifText style={styles.statValue}>{value}</SerifText>
      <SansText style={styles.statLabel}>{label}</SansText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  inner: { flex: 1, padding: Spacing.md, gap: Spacing.lg, justifyContent: "center" },
  heroSection: { alignItems: "center", gap: Spacing.sm },
  checkCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  checkIcon: { fontSize: 28, color: "white" },
  heroTitle: { fontSize: FontSize.xxl },
  heroSub: { fontSize: FontSize.sm, color: Colors.warmMid, textAlign: "center", lineHeight: 20, maxWidth: 260 },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, padding: Spacing.md, alignItems: "center" },
  statValue: { fontSize: FontSize.xl },
  statLabel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  nextSection: { gap: Spacing.sm },
  nextLabel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium },
  nextCard: { backgroundColor: Colors.ink, borderRadius: Radius.lg, overflow: "hidden" },
  nextThumbArea: { height: 120, justifyContent: "center", alignItems: "center", position: "relative" },
  nextThumbPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: "#4A3728" },
  readyTag: { position: "absolute", top: 8, left: 8, backgroundColor: Colors.green, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  readyTagText: { color: "white", fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium, letterSpacing: 0.5 },
  nextPlayBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", paddingLeft: 3 },
  nextPlayIcon: { color: "white", fontSize: 18 },
  nextInfo: { padding: Spacing.sm + 2 },
  nextChannel: { color: "rgba(255,255,255,0.45)", fontSize: FontSize.xxs, textTransform: "uppercase", letterSpacing: 0.5 },
  nextTitle: { color: "white", fontSize: FontSize.md, lineHeight: 22, marginTop: 3 },
  emptyNext: { alignItems: "center", gap: Spacing.xs },
  emptyNextText: { fontSize: FontSize.lg, color: Colors.ink },
  emptyNextSub: { fontSize: FontSize.sm, color: Colors.warmMid },
  backToQueue: { alignItems: "center", paddingVertical: Spacing.sm },
  backToQueueText: { fontSize: FontSize.sm, color: Colors.warmMid, borderBottomWidth: 1, borderBottomColor: Colors.divider, paddingBottom: 2 },
});
