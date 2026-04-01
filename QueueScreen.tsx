import React, { useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, RefreshControl, Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import type { QueueEntry } from "../types";
import { formatDuration, formatProgress } from "../types";

export default function QueueScreen() {
  const navigation = useNavigation<any>();
  const { queue, user, isLoadingQueue, error, fetchQueue, clearError } = useStore();

  useEffect(() => { fetchQueue(); }, []);
  const onRefresh = useCallback(() => { fetchQueue(); }, []);

  const pendingEntries = queue?.entries.filter(e => e.status !== "watching") ?? [];
  const current = queue?.current ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <KewLogo />
        <View style={styles.avatarPlaceholder}>
          <SansText style={styles.avatarInitial}>{user?.displayName?.charAt(0) ?? "?"}</SansText>
        </View>
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <FlatList
        data={pendingEntries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoadingQueue} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListHeaderComponent={
          <>
            <View style={styles.queueHeader}>
              <SerifText style={styles.queueTitle}>Your Queue</SerifText>
              <SansText style={styles.queueSubtitle}>
                {queue ? `${queue.total} video${queue.total !== 1 ? "s" : ""} · ${_totalTimeRemaining(queue.entries)}` : "Loading..."}
              </SansText>
            </View>

            {current ? (
              <NowPlayingCard entry={current} onPress={() => navigation.navigate("Player")} />
            ) : (
              queue?.total === 0 && (
                <EmptyState icon="☰" title="Your queue is empty" subtitle="Head to Browse to find videos from your subscriptions and add them here." />
              )
            )}

            {pendingEntries.length > 0 && (
              <SansText style={styles.upNextLabel}>Queued Up</SansText>
            )}
          </>
        }
        renderItem={({ item }) => <QueueItem entry={item} />}
        ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function NowPlayingCard({ entry, onPress }: { entry: QueueEntry; onPress: () => void }) {
  const progress = entry.video.durationSecs ? entry.watchProgressSecs / entry.video.durationSecs : 0;
  return (
    <TouchableOpacity style={styles.nowPlayingCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.nowPlayingThumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <View style={styles.nowPlayingOverlay} />
        <View style={styles.nowTag}><SansText style={styles.nowTagText}>Now Playing</SansText></View>
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

function QueueItem({ entry }: { entry: QueueEntry }) {
  return (
    <View style={styles.queueItem}>
      <SansText style={styles.queueNum}>{entry.position}</SansText>
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
    </View>
  );
}

function _totalTimeRemaining(entries: QueueEntry[]): string {
  const totalSecs = entries.reduce((acc, e) => acc + Math.max(0, (e.video.durationSecs ?? 0) - e.watchProgressSecs), 0);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `~${h}h ${m}m remaining`;
  return `~${m}m remaining`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.ink, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: Colors.cream, fontSize: FontSize.xs },
  queueHeader: { padding: Spacing.md, paddingBottom: Spacing.sm },
  queueTitle: { fontSize: FontSize.lg },
  queueSubtitle: { fontSize: FontSize.xs, color: Colors.warmMid, marginTop: 2 },
  nowPlayingCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.ink, borderRadius: Radius.lg, overflow: "hidden" },
  nowPlayingThumb: { width: "100%", height: 160, position: "relative", justifyContent: "center", alignItems: "center" },
  nowPlayingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  nowTag: { position: "absolute", top: 10, left: 10, backgroundColor: Colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  nowTagText: { color: "white", fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium, letterSpacing: 0.5, textTransform: "uppercase" },
  playBtn: { width: 48, height: 48, backgroundColor: Colors.accent, borderRadius: 24, alignItems: "center", justifyContent: "center", paddingLeft: 3 },
  playBtnIcon: { color: "white", fontSize: 18 },
  progressBar: { height: 3, backgroundColor: "rgba(255,255,255,0.15)" },
  progressFill: { height: 3, backgroundColor: Colors.accent },
  nowPlayingInfo: { padding: Spacing.sm + 2 },
  nowChannel: { color: "rgba(255,255,255,0.5)", fontSize: FontSize.xxs, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  nowTitle: { color: "white", fontSize: FontSize.md, lineHeight: 22 },
  nowMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  nowMetaText: { color: "rgba(255,255,255,0.45)", fontSize: FontSize.xxs },
  upNextLabel: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 1, fontFamily: FontFamily.sansMedium },
  queueItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, gap: Spacing.sm, opacity: 0.5 },
  queueNum: { fontSize: FontSize.sm, color: Colors.warmMid, width: 20, textAlign: "center", fontFamily: FontFamily.serifLight },
  queueThumb: { width: 80, height: 50, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: Colors.divider },
  queueThumbImg: { borderRadius: Radius.sm },
  queueInfo: { flex: 1, minWidth: 0 },
  queueChannel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium },
  queueTitleText: { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 18 },
  queueStatus: { fontSize: FontSize.xxs, color: Colors.queued, marginTop: 3, fontStyle: "italic" },
  listContent: { paddingBottom: 80 },
});
