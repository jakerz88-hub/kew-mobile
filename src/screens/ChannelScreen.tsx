import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, RefreshControl } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { api } from "../services/api";
import type { BrowseVideo } from "../types";
import { SansText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration, timeAgo } from "../types";

export default function ChannelScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { channelId, channelTitle, thumbnailUrl } = route.params as {
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
  };

  // Stages: 0=2wk, 1=12wk, 2=36wk, 3=all history (exhausted)
  const STAGE_WEEKS = [2, 12, 36, 0] as const; // 0 = no limit

  const { addToQueue, queue, error, clearError } = useStore();
  const [videos, setVideos]             = useState<BrowseVideo[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [addingId, setAddingId]         = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ entryId: string; title: string } | null>(null);

  // Build a map of ytVideoId → queue entry id for long-press remove
  const queueEntryByVideoId = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of queue?.entries ?? []) {
      map[entry.video.ytVideoId] = entry.id;
    }
    return map;
  }, [queue]);
  const [stage, setStage]               = useState(0); // current loaded stage

  const loadVideos = useCallback(async (targetStage = 0) => {
    if (targetStage === 0) setLoading(true);
    else setLoadingOlder(true);
    setLoadError(null);
    try {
      const weeks = STAGE_WEEKS[targetStage];
      const vids = await api.browseFeed(channelId, weeks);
      setVideos(vids);
      setStage(targetStage);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load videos");
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  }, [channelId]);

  useEffect(() => { loadVideos(0); }, []);

  const handleAdd = async (video: BrowseVideo) => {
    setAddingId(video.ytVideoId);
    try {
      await addToQueue(video.ytVideoId);
    } catch {
      // error shown via store
    } finally {
      setAddingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <SansText style={styles.backLabel}>Browse</SansText>
        </TouchableOpacity>
        <View style={styles.channelInfo}>
          {thumbnailUrl
            ? <Image source={{ uri: thumbnailUrl }} style={styles.avatar} />
            : <View style={styles.avatarFallback}>
                <SansText style={styles.avatarChar}>{channelTitle.charAt(0).toUpperCase()}</SansText>
              </View>
          }
          <SansText style={styles.channelName} numberOfLines={1}>{channelTitle}</SansText>
        </View>
        <View style={{ width: 80 }} />
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={clearError} />}
      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <FlatList
        data={videos}
        keyExtractor={item => item.ytVideoId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadVideos(0)} tintColor={Colors.accent} />}
        renderItem={({ item }) => {
          const entryId = queueEntryByVideoId[item.ytVideoId];
          const inQueue = !!entryId;
          return (
            <VideoCard
              video={item}
              inQueue={inQueue}
              adding={addingId === item.ytVideoId}
              onAdd={() => handleAdd(item)}
              onRemove={inQueue && entryId ? () => setRemoveTarget({ entryId, title: item.title }) : undefined}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={!loading ? <EmptyChannelState stage={stage} loadingOlder={loadingOlder} onLoadOlder={() => loadVideos(stage + 1)} /> : null}
        ListFooterComponent={videos.length > 0 ? <LoadMoreFooter stage={stage} loadingOlder={loadingOlder} onLoadOlder={() => loadVideos(stage + 1)} /> : null}
        contentContainerStyle={styles.listContent}
      />

      <QueueActionSheet
        visible={!!removeTarget}
        entryId={removeTarget?.entryId ?? ""}
        videoTitle={removeTarget?.title ?? ""}
        showMoveToEnd={false}
        onClose={() => setRemoveTarget(null)}
      />
    </SafeAreaView>
  );
}

const STAGE_LABELS = ["2 weeks", "3 months", "9 months", "all time"] as const;

function LoadMoreButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.loadOlderBtn} onPress={onPress} disabled={loading} activeOpacity={0.7}>
      <SansText style={styles.loadOlderText}>{loading ? "Loading…" : label}</SansText>
    </TouchableOpacity>
  );
}

function EmptyChannelState({ stage, loadingOlder, onLoadOlder }: { stage: number; loadingOlder: boolean; onLoadOlder: () => void }) {
  const checked = STAGE_LABELS[stage];
  const isExhausted = stage >= 3;
  return (
    <View style={styles.emptyContainer}>
      <EmptyState
        icon="▶"
        title={isExhausted ? "No more videos available" : `No uploads in the last ${checked}`}
        subtitle={isExhausted ? "You've reached the end of this channel's history." : "Tap below to search further back."}
      />
      {!isExhausted && (
        <LoadMoreButton
          label={stage === 2 ? "Load all videos" : "Load older videos"}
          loading={loadingOlder}
          onPress={onLoadOlder}
        />
      )}
    </View>
  );
}

function LoadMoreFooter({ stage, loadingOlder, onLoadOlder }: { stage: number; loadingOlder: boolean; onLoadOlder: () => void }) {
  const isExhausted = stage >= 3;
  return (
    <View style={styles.footerContainer}>
      {isExhausted
        ? <SansText style={styles.exhaustedText}>No more videos available</SansText>
        : <LoadMoreButton
            label={stage === 2 ? "Load all videos" : "Load older videos"}
            loading={loadingOlder}
            onPress={onLoadOlder}
          />
      }
    </View>
  );
}

function VideoCard({ video, inQueue, adding, onAdd, onRemove }: {
  video: BrowseVideo;
  inQueue: boolean;
  adding: boolean;
  onAdd: () => void;
  onRemove?: () => void;
}) {
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
        <View style={styles.cardText}>
          <SansText style={styles.cardTitle} numberOfLines={2}>{video.title}</SansText>
          <SansText style={styles.cardMeta}>{timeAgo(video.publishedAt)}</SansText>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, inQueue && styles.addBtnAdded]}
          onPress={inQueue ? undefined : onAdd}
          onLongPress={inQueue ? onRemove : undefined}
          delayLongPress={400}
          disabled={adding}
          activeOpacity={0.7}
        >
          <SansText style={[styles.addBtnText, inQueue && styles.addBtnTextAdded]}>
            {adding ? "..." : inQueue ? "✓" : "+"}
          </SansText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.cream },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn:        { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 80 },
  backLabel:      { fontSize: FontSize.sm, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  channelInfo:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  avatar:         { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.divider },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarChar:     { color: "white", fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium },
  channelName:    { fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansMedium, maxWidth: 180 },
  listContent:    { paddingBottom: 80, paddingTop: Spacing.sm },
  card:           { marginHorizontal: Spacing.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, overflow: "hidden" },
  thumbContainer: { width: "100%", height: 120, position: "relative" },
  durationBadge:  { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(26,23,20,0.75)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  durationText:   { color: "white", fontSize: FontSize.xxs },
  cardBody:       { flexDirection: "row", alignItems: "flex-start", padding: Spacing.sm, gap: Spacing.sm },
  cardText:       { flex: 1, minWidth: 0 },
  cardTitle:      { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 18, marginBottom: 4 },
  cardMeta:       { fontSize: FontSize.xxs, color: Colors.queued },
  addBtn:            { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: Colors.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addBtnAdded:       { backgroundColor: Colors.green, borderColor: Colors.green },
  addBtnText:        { fontSize: FontSize.lg, color: Colors.accent, lineHeight: 24, marginTop: -2 },
  addBtnTextAdded:   { color: "white", fontSize: FontSize.sm, marginTop: 0 },
  emptyContainer:  { alignItems: "center", paddingHorizontal: Spacing.md },
  footerContainer: { alignItems: "center", paddingVertical: Spacing.lg },
  loadOlderBtn:    { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.accent },
  loadOlderText:   { fontSize: FontSize.sm, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  exhaustedText:   { fontSize: FontSize.sm, color: Colors.warmMid, fontFamily: FontFamily.sansMedium },
});
