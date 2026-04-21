import React, { useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";
import type { BrowseVideo } from "../types";
import { SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { useStore } from "../store";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration, timeAgo } from "../types";

export default function RecentUploadsScreen() {
  const navigation = useNavigation<any>();
  const { addToQueue, queue, error, clearError } = useStore();

  const [videos, setVideos]           = useState<BrowseVideo[]>([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [addingId, setAddingId]       = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ entryId: string; title: string } | null>(null);

  const queueEntryByVideoId = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of queue?.entries ?? []) {
      map[entry.video.ytVideoId] = entry.id;
    }
    return map;
  }, [queue]);

  const loadVideos = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const vids = await api.getRecentUploads(7, forceRefresh);
      setVideos(vids);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load recent uploads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadVideos(); }, []);

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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={16} color={Colors.accent} />
          <SansText style={styles.backLabel}>Browse</SansText>
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Latest Uploads</SerifText>
        <View style={{ width: 80 }} />
      </View>
      <Divider />

      {error    && <ErrorBanner message={error}     onDismiss={clearError} />}
      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <SansText style={styles.loadingText}>Fetching from all your channels…</SansText>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={item => item.ytVideoId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadVideos(true)}
              tintColor={Colors.accent}
            />
          }
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
          ListHeaderComponent={
            videos.length > 0
              ? <SansText style={styles.resultCount}>{videos.length} video{videos.length !== 1 ? "s" : ""} in the past 7 days</SansText>
              : null
          }
          ListEmptyComponent={
            <EmptyState icon="▶" title="Nothing in the past 7 days" subtitle="Your subscribed channels haven't posted recently." />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

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
          <SansText style={styles.cardChannel} numberOfLines={1}>{video.channelTitle}</SansText>
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
  container:       { flex: 1, backgroundColor: Colors.cream },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn:         { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 80 },
  backLabel:       { fontSize: FontSize.sm, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  headerTitle:     { flex: 1, fontSize: FontSize.md, color: Colors.ink, textAlign: "center" },
  loadingContainer:{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText:     { fontSize: FontSize.sm, color: Colors.warmMid, textAlign: "center" },
  resultCount:     { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, fontSize: FontSize.xs, color: Colors.warmMid },
  listContent:     { paddingBottom: 80, paddingTop: Spacing.sm },
  card:            { marginHorizontal: Spacing.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, overflow: "hidden" },
  thumbContainer:  { width: "100%", height: 120, position: "relative" },
  durationBadge:   { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(26,23,20,0.75)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  durationText:    { color: "white", fontSize: FontSize.xxs },
  cardBody:        { flexDirection: "row", alignItems: "flex-start", padding: Spacing.sm, gap: Spacing.sm },
  cardText:        { flex: 1, minWidth: 0 },
  cardChannel:     { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium },
  cardTitle:       { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 18, marginBottom: 4 },
  cardMeta:        { fontSize: FontSize.xxs, color: Colors.queued },
  addBtn:          { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: Colors.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addBtnAdded:     { backgroundColor: Colors.green, borderColor: Colors.green },
  addBtnText:      { fontSize: FontSize.lg, color: Colors.accent, lineHeight: 24, marginTop: -2 },
  addBtnTextAdded: { color: "white", fontSize: FontSize.sm, marginTop: 0 },
});
