import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, StyleSheet, SafeAreaView, Image, RefreshControl } from "react-native";
import { supabase } from "../services/supabase";
import { useStore } from "../store";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration, timeAgo } from "../types";
import type { QueueEntry } from "../types";

export default function HistoryScreen() {
  const { error, clearError } = useStore();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSecs, setTotal] = useState(0);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("queue")
        .select("*, video:videos(*)")
        .eq("user_id", session.user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(100);

      if (data) {
        setEntries(data as QueueEntry[]);
        const secs = data.reduce((acc: number, e: any) => acc + (e.video?.duration_secs ?? 0), 0);
        setTotal(secs);
      }
    } catch (e) {
      console.warn("History load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <KewLogo />
        <View style={{ width: 32 }} />
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHistory} tintColor={Colors.accent} />}
        ListHeaderComponent={
          <View style={styles.pageHeader}>
            <SerifText style={styles.pageTitle}>History</SerifText>
            {entries.length > 0 && (
              <SansText style={styles.pageSubtitle}>
                {entries.length} video{entries.length !== 1 ? "s" : ""} watched · {_formatTotalTime(totalSecs)} total
              </SansText>
            )}
          </View>
        }
        renderItem={({ item }) => <HistoryItem entry={item} />}
        ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="↻" title="Nothing watched yet" subtitle="Videos you finish will appear here. Go watch something!" />
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function HistoryItem({ entry }: { entry: QueueEntry }) {
  return (
    <View style={styles.item}>
      <View style={styles.thumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={[StyleSheet.absoluteFill, styles.thumbImg]} />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <View style={styles.completedBadge}>
          <SansText style={styles.completedTick}>+</SansText>
        </View>
      </View>
      <View style={styles.info}>
        <SansText style={styles.channel} numberOfLines={1}>{entry.video.channelTitle}</SansText>
        <SansText style={styles.title} numberOfLines={2}>{entry.video.title}</SansText>
        <View style={styles.meta}>
          <SansText style={styles.metaText}>{formatDuration(entry.video.durationSecs)}</SansText>
          <SansText style={styles.metaDot}>·</SansText>
          <SansText style={styles.metaText}>Watched {timeAgo(entry.completedAt)}</SansText>
        </View>
      </View>
    </View>
  );
}

function _formatTotalTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pageHeader: { padding: Spacing.md, paddingBottom: Spacing.sm },
  pageTitle: { fontSize: FontSize.lg },
  pageSubtitle: { fontSize: FontSize.xs, color: Colors.warmMid, marginTop: 2 },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, gap: Spacing.sm },
  thumb: { width: 88, height: 56, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: Colors.divider, flexShrink: 0, position: "relative" },
  thumbImg: { borderRadius: Radius.sm },
  completedBadge: { position: "absolute", bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  completedTick: { color: Colors.cream, fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium },
  info: { flex: 1, minWidth: 0 },
  channel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FontFamily.sansMedium, marginBottom: 2 },
  title: { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 18 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  metaText: { fontSize: FontSize.xxs, color: Colors.queued },
  metaDot: { fontSize: FontSize.xxs, color: Colors.queued },
  listContent: { paddingBottom: 80 },
});
