import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, RefreshControl, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { api } from "../services/api";
import type { BrowseVideo } from "../types";
import { SansText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner } from "../components/UI";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { ChannelSheet } from "../components/ChannelSheet";
import { DurationBadge } from "../components/DurationBadge";
import { useAddToQueue } from "../hooks/useAddToQueue";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
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

  const { queue, user, error, clearError } = useStore();
  const queuedVideos = useStore(s => s.queuedVideos);
  const isPro = user?.plan === "pro";
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId } = useAddToQueue();

  const [videos, setVideos]             = useState<BrowseVideo[]>([]);
  const [loading, setLoading]           = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ entryId: string; title: string; queueName: string | null } | null>(null);
  const [channelSheetVisible, setChannelSheetVisible] = useState(false);

  // Active-queue map (used as free-user fallback for inQueue + entry_id, and
  // for pro users when the cross-queue map hasn't loaded yet).
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


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={{ padding: 4 }}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <View style={[styles.channelInfo, { flex: 1 }]}>
          {thumbnailUrl
            ? <Image source={{ uri: thumbnailUrl }} style={styles.avatar} />
            : <View style={styles.avatarFallback}>
                <SansText style={styles.avatarChar}>{channelTitle.charAt(0).toUpperCase()}</SansText>
              </View>
          }
          <SansText style={styles.channelName} numberOfLines={1}>{channelTitle}</SansText>
        </View>
        <TouchableOpacity onPress={() => setChannelSheetVisible(true)} activeOpacity={0.6} style={{ padding: 6, minWidth: 32, minHeight: 32, justifyContent: 'center', alignItems: 'center' }}>
          <Feather name="info" size={20} color={colors.warmMid} />
        </TouchableOpacity>
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={clearError} />}
      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <FlatList
        data={videos}
        keyExtractor={item => item.ytVideoId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadVideos(0)} tintColor={colors.ink} />}
        renderItem={({ item }) => {
          const queuedEntry = queuedVideos[item.ytVideoId];
          const inQueue = !!queuedEntry || !!queueEntryByVideoId[item.ytVideoId];
          // Prefer queuedVideos.entryId (works across all queues for pro);
          // fall back to active-queue map (free-user single-queue case).
          const removeEntryId = queuedEntry?.entryId || queueEntryByVideoId[item.ytVideoId];
          // Subtitle "In your {queueName} queue" only shown for pro users.
          const queueName = isPro ? queuedEntry?.queueName ?? null : null;
          return (
            <VideoCard
              video={item}
              inQueue={inQueue}
              adding={addingId === item.ytVideoId}
              onAdd={() => handleAdd(item.ytVideoId)}
              onRemove={removeEntryId ? () => setRemoveTarget({ entryId: removeEntryId, title: item.title, queueName }) : undefined}
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

      {channelSheetVisible && (
        <ChannelSheet
          visible={channelSheetVisible}
          onClose={() => setChannelSheetVisible(false)}
          ytChannelId={channelId}
          channelTitle={channelTitle}
          channelThumbnailUrl={thumbnailUrl || undefined}
        />
      )}
    </SafeAreaView>
  );
}

const STAGE_LABELS = ["2 weeks", "3 months", "9 months", "all time"] as const;

function LoadMoreButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.loadOlderBtn} onPress={onPress} disabled={loading} activeOpacity={0.7}>
      <SansText style={styles.loadOlderText}>{loading ? "Loading…" : label}</SansText>
    </TouchableOpacity>
  );
}

function EmptyChannelState({ stage, loadingOlder, onLoadOlder }: { stage: number; loadingOlder: boolean; onLoadOlder: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.thumbContainer}>
        {video.thumbnailUrl
          ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <DurationBadge seconds={video.durationSecs} />
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

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.cream },
    header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    backBtn:        { flex: 1 },
    channelInfo:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
    avatar:         { width: 28, height: 28, borderRadius: 14, backgroundColor: c.divider },
    avatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.green, alignItems: "center", justifyContent: "center" },
    avatarChar:     { color: c.buttonText, fontSize: FontSize.xxs, fontFamily: FontFamily.sansMedium },
    channelName:    { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium, maxWidth: 180 },
    listContent:    { paddingBottom: 80, paddingTop: Spacing.sm },
    card:           { marginHorizontal: Spacing.md, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, overflow: "hidden" },
    thumbContainer: { width: "100%", height: 120, position: "relative" },
    cardBody:       { flexDirection: "row", alignItems: "flex-start", padding: Spacing.sm, gap: Spacing.sm },
    cardText:       { flex: 1, minWidth: 0 },
    cardTitle:      { fontSize: FontSize.sm, color: c.ink, lineHeight: 18, marginBottom: 4 },
    cardMeta:       { fontSize: FontSize.xxs, color: c.queued },
    addBtn:            { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    addBtnAdded:       { backgroundColor: c.green },
    addBtnText:        { fontSize: FontSize.lg, color: c.buttonText, lineHeight: 24, marginTop: -2 },
    addBtnTextAdded:   { color: c.buttonText, fontSize: FontSize.sm, marginTop: 0 },
    emptyContainer:  { alignItems: "center", paddingHorizontal: Spacing.md },
    footerContainer: { alignItems: "center", paddingVertical: Spacing.lg },
    loadOlderBtn:    { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.accent },
    loadOlderText:   { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    exhaustedText:   { fontSize: FontSize.sm, color: c.warmMid, fontFamily: FontFamily.sansMedium },
  });
}
