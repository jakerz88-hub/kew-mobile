import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, RefreshControl } from "react-native";
import { useStore } from "../store";
import { api } from "../services/api";
import type { BrowseVideo, Channel } from "../types";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration, timeAgo } from "../types";

export default function BrowseScreen() {
  const { addToQueue, error, clearError } = useStore();
  const [channels, setChannels]   = useState<Channel[]>([]);
  const [videos, setVideos]       = useState<BrowseVideo[]>([]);
  const [activeChannel, setActive] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [addingId, setAddingId]   = useState<string | null>(null);
  const [addedIds, setAddedIds]   = useState<Set<string>>(new Set());

  const loadData = useCallback(async (channelId?: string) => {
    setLoading(true);
    try {
      const [ch, vids] = await Promise.all([api.listChannels(), api.browseFeed(channelId)]);
      setChannels(ch);
      setVideos(vids);
    } catch (e: any) {
      // error handled by store
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const handleChannelFilter = (channelId: string | null) => {
    setActive(channelId);
    loadData(channelId ?? undefined);
  };

  const handleAdd = async (video: BrowseVideo) => {
    setAddingId(video.ytVideoId);
    try {
      await addToQueue(video.ytVideoId);
      setAddedIds(prev => new Set([...prev, video.ytVideoId]));
    } catch {
      // error shown via store
    } finally {
      setAddingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <KewLogo />
        <View style={{ width: 32 }} />
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <FlatList
        data={videos}
        keyExtractor={item => item.ytVideoId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadData(activeChannel ?? undefined)} tintColor={Colors.accent} />}
        ListHeaderComponent={
          <>
            <SerifText style={styles.pageTitle}>Browse</SerifText>
            <FlatList
              data={[{ id: null, title: "All Channels" }, ...channels.map(c => ({ id: c.ytChannelId, title: c.title }))]}
              keyExtractor={item => item.id ?? "all"}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.chip, (item.id === activeChannel) && styles.chipActive]}
                  onPress={() => handleChannelFilter(item.id)}
                >
                  <SansText style={[styles.chipText, (item.id === activeChannel) && styles.chipTextActive]}>
                    {item.title}
                  </SansText>
                </TouchableOpacity>
              )}
            />
          </>
        }
        renderItem={({ item }) => (
          <BrowseCard
            video={item}
            inQueue={item.inQueue || addedIds.has(item.ytVideoId)}
            adding={addingId === item.ytVideoId}
            onAdd={() => handleAdd(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={!loading ? <EmptyState icon="+" title="No videos yet" subtitle="Sync your subscriptions to see recent uploads from your YouTube channels." /> : null}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function BrowseCard({ video, inQueue, adding, onAdd }: { video: BrowseVideo; inQueue: boolean; adding: boolean; onAdd: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.thumbContainer}>
        {video.thumbnailUrl
          ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <View style={styles.durationBadge}>
          <SansText style={styles.durationText}>{formatDuration(video.durationSecs)}</SansText>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.channelDotSmall}>
          <SansText style={styles.channelDotChar}>{video.channelTitle.charAt(0).toUpperCase()}</SansText>
        </View>
        <View style={styles.cardText}>
          <SansText style={styles.cardChannel}>{video.channelTitle}</SansText>
          <SansText style={styles.cardTitle} numberOfLines={2}>{video.title}</SansText>
          <SansText style={styles.cardMeta}>{timeAgo(video.publishedAt)}</SansText>
        </View>
        <TouchableOpacity style={[styles.addBtn, inQueue && styles.addBtnAdded]} onPress={onAdd} disabled={inQueue || adding} activeOpacity={0.7}>
          <SansText style={[styles.addBtnText, inQueue && styles.addBtnTextAdded]}>
            {adding ? "..." : inQueue ? "+" : "+"}
          </SansText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pageTitle: { fontSize: FontSize.lg, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  chipsContainer: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.divider, backgroundColor: Colors.cardBg },
  chipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipText: { fontSize: FontSize.xs, color: Colors.warmMid, fontFamily: FontFamily.sansMedium },
  chipTextActive: { color: Colors.cream },
  card: { marginHorizontal: Spacing.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, overflow: "hidden" },
  thumbContainer: { width: "100%", height: 120, position: "relative" },
  durationBadge: { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(26,23,20,0.75)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  durationText: { color: "white", fontSize: FontSize.xxs },
  cardBody: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.sm, gap: Spacing.sm },
  channelDotSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  channelDotChar: { color: "white", fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium },
  cardText: { flex: 1, minWidth: 0 },
  cardChannel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FontFamily.sansMedium },
  cardTitle: { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 18, marginVertical: 2 },
  cardMeta: { fontSize: FontSize.xxs, color: Colors.queued },
  addBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: Colors.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addBtnAdded: { backgroundColor: Colors.green, borderColor: Colors.green },
  addBtnText: { fontSize: FontSize.lg, color: Colors.accent, lineHeight: 24, marginTop: -2 },
  addBtnTextAdded: { color: "white", fontSize: FontSize.sm, marginTop: 0 },
  listContent: { paddingBottom: 80 },
});