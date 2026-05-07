import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, FlatList, StyleSheet, SafeAreaView, Image, RefreshControl, TouchableOpacity, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useStore } from "../store";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner, AvatarBubble } from "../components/UI";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { useAddToQueue } from "../hooks/useAddToQueue";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { useInTabletSidebar } from "../contexts/TabletSidebarContext";
import { formatDuration, timeAgo } from "../types";
import type { QueueEntry } from "../types";

function toCamel(s: string) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function keysToCamel<T>(obj: any): T {
  if (Array.isArray(obj)) return obj.map(v => keysToCamel(v)) as any;
  if (obj !== null && typeof obj === "object")
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), keysToCamel(v)])) as any;
  return obj;
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isTablet = useIsTablet();
  const inSidebar = useInTabletSidebar();
  const { error, clearError, user } = useStore();
  const { handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId } = useAddToQueue(
    (ytVideoId) => setReaddedIds(prev => new Set([...prev, ytVideoId]))
  );
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSecs, setTotal] = useState(0);
  const [readdedIds, setReaddedIds] = useState<Set<string>>(new Set());

  const isFree = (user?.plan ?? "free") === "free";

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let query = supabase
        .from("queue")
        .select("*, video:videos(*)")
        .eq("user_id", session.user.id)
        .eq("status", "completed");

      if (isFree) {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("completed_at", cutoff);
      }

      const { data } = await query
        .order("completed_at", { ascending: false })
        .limit(100);

      if (data) {
        const camel = keysToCamel<QueueEntry[]>(data);
        setEntries(camel);
        const secs = camel.reduce((acc: number, e: QueueEntry) => acc + (e.video?.durationSecs ?? 0), 0);
        setTotal(secs);
      }
    } catch (e) {
      console.warn("History load error:", e);
    } finally {
      setLoading(false);
    }
  }, [isFree]);

  useEffect(() => { loadHistory(); }, []);

  const handleReadd = (entry: QueueEntry) => handleAdd(entry.video.ytVideoId);

  return (
    <SafeAreaView style={styles.container}>
      {!(isTablet && inSidebar) && (
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
      )}
      {!(isTablet && inSidebar) && <Divider />}

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHistory} tintColor={colors.ink} />}
        ListHeaderComponent={
          <View style={styles.pageHeader}>
            <SerifText style={styles.pageTitle}>Your Watch History</SerifText>
            {entries.length > 0 && (
              <SansText style={styles.pageSubtitle}>
                {entries.length} video{entries.length !== 1 ? "s" : ""} watched · {_formatTotalTime(totalSecs)} total
              </SansText>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <HistoryItem
            entry={item}
            readded={readdedIds.has(item.video.ytVideoId)}
            adding={addingId === item.video.ytVideoId}
            onReadd={() => handleReadd(item)}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="↻" title="Nothing watched yet" subtitle="Videos you finish will appear here. Go watch something!" />
          ) : null
        }
        ListFooterComponent={
          isFree && entries.length > 0 ? (
            <View style={styles.cutoffCard}>
              <View style={styles.cutoffRow}>
                <View style={styles.cutoffIconBox}>
                  <Feather name="info" size={14} color={KEW_PLUS_GOLD} />
                </View>
                <SansText style={styles.cutoffText}>
                  You're seeing the last 30 days. Kew+ unlocks your full watch history.
                </SansText>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("Benefits")}
                activeOpacity={0.7}
                style={styles.cutoffLink}
              >
                <SansText style={styles.cutoffLinkText}>Explore Kew+ ›</SansText>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      {Platform.OS !== "ios" && pickerVideoId && (
        <QueuePickerModal
          onSelect={(queueId) => { const vid = pickerVideoId; setPickerVideoId(null); doAddVideo(vid, queueId); }}
          onDismiss={() => setPickerVideoId(null)}
        />
      )}
    </SafeAreaView>
  );
}

function HistoryItem({ entry, readded, adding, onReadd }: {
  entry: QueueEntry;
  readded: boolean;
  adding: boolean;
  onReadd: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.item}>
      <View style={styles.thumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={[StyleSheet.absoluteFill, styles.thumbImg]} />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <View style={styles.completedBadge}>
          <SansText style={styles.completedTick}>✓</SansText>
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
      <TouchableOpacity
        style={[styles.readdBtn, readded && styles.readdBtnDone]}
        onPress={onReadd}
        disabled={readded || adding}
        activeOpacity={0.7}
      >
        <SansText style={[styles.readdBtnText, readded && styles.readdBtnTextDone]}>
          {adding ? "..." : readded ? "✓" : "↺"}
        </SansText>
      </TouchableOpacity>
    </View>
  );
}

function _formatTotalTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const KEW_PLUS_GOLD = "#C49A28";
const KEW_PLUS_GOLD_TINT = "rgba(196,154,40,0.12)";
const KEW_PLUS_GOLD_BORDER = "rgba(196,154,40,0.35)";

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    pageHeader:      { padding: Spacing.md, paddingBottom: Spacing.sm },
    pageTitle:       { fontSize: FontSize.lg },
    pageSubtitle:    { fontSize: FontSize.xs, color: c.warmMid, marginTop: 2 },
    item:            { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, gap: Spacing.sm },
    thumb:           { width: 88, height: 56, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: c.divider, flexShrink: 0, position: "relative" },
    thumbImg:        { borderRadius: Radius.sm },
    completedBadge:  { position: "absolute", bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: c.green, alignItems: "center", justifyContent: "center" },
    completedTick:   { color: "white", fontSize: 9, fontFamily: FontFamily.sansMedium },
    info:            { flex: 1, minWidth: 0 },
    channel:         { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FontFamily.sansMedium, marginBottom: 2 },
    title:           { fontSize: FontSize.sm, color: c.ink, lineHeight: 18 },
    meta:            { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    metaText:        { fontSize: FontSize.xxs, color: c.queued },
    metaDot:         { fontSize: FontSize.xxs, color: c.queued },
    readdBtn:        { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    readdBtnDone:    { backgroundColor: c.green, borderColor: c.green },
    readdBtnText:    { fontSize: FontSize.lg, color: c.accent, lineHeight: 24, marginTop: -2 },
    readdBtnTextDone:{ color: "white", fontSize: FontSize.sm, marginTop: 0 },
    listContent:     { paddingBottom: 80 },
    cutoffCard:      { backgroundColor: c.cardBg, borderWidth: 0.5, borderColor: KEW_PLUS_GOLD_BORDER, borderRadius: Radius.md, padding: Spacing.md, marginHorizontal: Spacing.md, marginTop: Spacing.md, gap: Spacing.sm },
    cutoffRow:       { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    cutoffIconBox:   { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: KEW_PLUS_GOLD_TINT, alignItems: "center", justifyContent: "center" },
    cutoffText:      { flex: 1, fontSize: FontSize.xs, color: c.ink, lineHeight: 18 },
    cutoffLink:      { alignSelf: "flex-start", paddingVertical: 2 },
    cutoffLinkText:  { fontSize: FontSize.xs, color: KEW_PLUS_GOLD, fontFamily: FontFamily.sansMedium },
  });
}
