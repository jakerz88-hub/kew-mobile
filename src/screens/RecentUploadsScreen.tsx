import React, { useEffect, useState, useMemo } from "react";
import { friendlyError } from "../utils/friendlyError";
import { View, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, ActivityIndicator, RefreshControl, Platform } from "react-native";
import { useIsTablet } from "../hooks/useIsTablet";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";
import type { BrowseVideo } from "../types";
import { SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { DurationBadge } from "../components/DurationBadge";
import { useStore } from "../store";
import { useAddToQueue } from "../hooks/useAddToQueue";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { formatDuration, timeAgo } from "../types";

export default function RecentUploadsScreen() {
  const navigation = useNavigation<any>();
  const isTablet = useIsTablet();
  const { queue, user, error, clearError } = useStore();
  const queuedVideos = useStore(s => s.queuedVideos);
  const isPro = user?.plan === "pro";
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId } = useAddToQueue();

  const [videos, setVideos]           = useState<BrowseVideo[]>([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ entryId: string; title: string; queueName: string | null } | null>(null);

  // Active-queue map (free-user fallback for inQueue + entry_id).
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
      setLoadError(friendlyError(e, "Failed to load recent uploads"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadVideos(); }, []);


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Latest Uploads</SerifText>
        <View style={{ flex: 1 }} />
      </View>
      <Divider />

      {error    && <ErrorBanner message={error}     onDismiss={clearError} />}
      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
          <SansText style={styles.loadingText}>Fetching from all your channels…</SansText>
        </View>
      ) : (
        <FlatList
          key={isTablet ? "2col" : "1col"}
          numColumns={isTablet ? 2 : 1}
          data={videos}
          keyExtractor={item => item.ytVideoId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadVideos(true)}
              tintColor={colors.ink}
            />
          }
          columnWrapperStyle={isTablet ? styles.gridRow : undefined}
          renderItem={({ item }) => {
            const queuedEntry = queuedVideos[item.ytVideoId];
            const inQueue = !!queuedEntry || !!queueEntryByVideoId[item.ytVideoId];
            const removeEntryId = queuedEntry?.entryId || queueEntryByVideoId[item.ytVideoId];
            const queueName = isPro ? queuedEntry?.queueName ?? null : null;
            return (
              <View style={isTablet ? styles.gridItem : undefined}>
                <VideoCard
                  video={item}
                  inQueue={inQueue}
                  adding={addingId === item.ytVideoId}
                  onAdd={() => handleAdd(item.ytVideoId)}
                  onRemove={removeEntryId ? () => setRemoveTarget({ entryId: removeEntryId, title: item.title, queueName }) : undefined}
                  isGrid={isTablet}
                />
              </View>
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
        queueName={removeTarget?.queueName ?? null}
        onClose={() => setRemoveTarget(null)}
      />

      {Platform.OS !== "ios" && (
        <QueuePickerModal
          visible={!!pickerVideoId}
          onSelect={(queueId) => { const vid = pickerVideoId; setPickerVideoId(null); doAddVideo(vid, queueId); }}
          onDismiss={() => setPickerVideoId(null)}
        />
      )}
    </SafeAreaView>
  );
}

function VideoCard({ video, inQueue, adding, onAdd, onRemove, isGrid }: {
  video: BrowseVideo;
  inQueue: boolean;
  adding: boolean;
  onAdd: () => void;
  onRemove?: () => void;
  isGrid?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, isGrid && styles.cardGrid]}>
      <View style={isGrid ? styles.thumbGrid : styles.thumbContainer}>
        {video.thumbnailUrl
          ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <DurationBadge seconds={video.durationSecs} />
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

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    backBtn:         { flex: 1 },
    headerTitle:     { fontSize: FontSize.md, color: c.ink, textAlign: "center" },
    loadingContainer:{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    loadingText:     { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center" },
    resultCount:     { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, fontSize: FontSize.xs, color: c.warmMid },
    listContent:     { paddingBottom: 80, paddingTop: Spacing.sm },
    card:            { marginHorizontal: Spacing.md, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, overflow: "hidden" },
    cardGrid:        { marginHorizontal: 0 },
    thumbContainer:  { width: "100%", height: 120, position: "relative" },
    thumbGrid:       { width: "100%", aspectRatio: 16 / 9, position: "relative" },
    cardBody:        { flexDirection: "row", alignItems: "flex-start", padding: Spacing.sm, gap: Spacing.sm },
    cardText:        { flex: 1, minWidth: 0 },
    cardChannel:     { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium },
    cardTitle:       { fontSize: FontSize.sm, color: c.ink, lineHeight: 18, marginBottom: 4 },
    cardMeta:        { fontSize: FontSize.xxs, color: c.queued },
    addBtn:          { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    addBtnAdded:     { backgroundColor: c.green },
    addBtnText:      { fontSize: FontSize.lg, color: c.buttonText, lineHeight: 24, marginTop: -2 },
    addBtnTextAdded: { color: c.buttonText, fontSize: FontSize.sm, marginTop: 0 },
    // Tablet grid layout
    gridRow:         { gap: 12, paddingHorizontal: Spacing.md },
    gridItem:        { flex: 1 },
  });
}
