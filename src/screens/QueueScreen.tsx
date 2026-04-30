import React, { useEffect, useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Modal, Pressable,
  StyleSheet, SafeAreaView, RefreshControl, Image,
} from "react-native";
import { QueueActionSheet } from "../components/QueueActionSheet";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, EmptyState, ErrorBanner, AvatarBubble } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import type { QueueEntry } from "../types";
import { formatDuration, formatProgress } from "../types";

export default function QueueScreen() {
  const navigation = useNavigation<any>();
  const { queue, user, isLoadingQueue, error, fetchQueue, clearError, shuffleQueue } = useStore();
  const [actionEntry, setActionEntry] = useState<QueueEntry | null>(null);
  const [showShuffleConfirm, setShowShuffleConfirm] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  useEffect(() => { fetchQueue(); }, []);
  const onRefresh = useCallback(() => { fetchQueue(); }, []);

  const allEntries = queue?.entries ?? [];
  const current = queue?.current ?? null;
  const pendingEntries = allEntries.filter(e => e.status === "pending");
  const canShuffle = pendingEntries.length >= 2;

  const handleShuffleConfirm = async () => {
    setShuffling(true);
    try { await shuffleQueue(); } finally {
      setShuffling(false);
      setShowShuffleConfirm(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

            {current && (
              <NowPlayingCard entry={current} onPress={() => navigation.navigate("Player")} />
            )}
            {!current && pendingEntries.length === 0 && (
              <EmptyState icon="☰" title="Your queue is empty" subtitle="Head to Browse to find videos from your subscriptions and add them here." />
            )}

            {canShuffle && (
              <TouchableOpacity
                style={styles.shuffleBtn}
                onPress={() => setShowShuffleConfirm(true)}
                activeOpacity={0.7}
              >
                <SansText style={styles.shuffleBtnText}>Shuffle your queue?</SansText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => navigation.navigate("PlaylistList")}
              activeOpacity={0.7}
            >
              <SansText style={styles.importBtnText}>+ Import from YouTube playlist</SansText>
            </TouchableOpacity>

            {pendingEntries.length > 0 && (
              <SansText style={styles.upNextLabel}>{current ? "Queued Up" : "Up Next"}</SansText>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <QueueItem
            entry={item}
            onPress={index === 0 && !current ? () => navigation.navigate("Player") : undefined}
            onLongPress={() => setActionEntry(item)}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
        contentContainerStyle={styles.listContent}
      />

      <QueueActionSheet
        visible={!!actionEntry}
        entryId={actionEntry?.id ?? ""}
        videoTitle={actionEntry?.video.title ?? ""}
        onClose={() => setActionEntry(null)}
      />

      <ShuffleConfirmSheet
        visible={showShuffleConfirm}
        shuffling={shuffling}
        onConfirm={handleShuffleConfirm}
        onClose={() => setShowShuffleConfirm(false)}
      />
    </SafeAreaView>
  );
}

function NowPlayingCard({ entry, onPress }: { entry: QueueEntry; onPress: () => void }) {
  const label = entry.status === "watching" ? "Now Playing" : "Watch Next";
  const progress = entry.video.durationSecs ? entry.watchProgressSecs / entry.video.durationSecs : 0;
  return (
    <TouchableOpacity style={styles.nowPlayingCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.nowPlayingThumb}>
        {entry.video.thumbnailUrl
          ? <Image source={{ uri: entry.video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={entry.video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <View style={styles.nowPlayingOverlay} />
        <View style={styles.nowTag}><SansText style={styles.nowTagText}>{label}</SansText></View>
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

function QueueItem({ entry, onPress, onLongPress }: { entry: QueueEntry; onPress?: () => void; onLongPress?: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.queueItem, onPress && styles.queueItemTappable]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );
}

function ShuffleConfirmSheet({ visible, shuffling, onConfirm, onClose }: {
  visible: boolean;
  shuffling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <SerifText style={styles.sheetTitle}>Shuffle your queue?</SerifText>
          <SansText style={styles.sheetSubtitle}>
            The order of your queued videos will be randomized.{"\n"}Your current video won't be affected.
          </SansText>
          <TouchableOpacity
            style={[styles.sheetActionBtn, shuffling && { opacity: 0.5 }]}
            onPress={onConfirm}
            disabled={shuffling}
            activeOpacity={0.7}
          >
            <SansText style={styles.sheetActionText}>
              {shuffling ? "Shuffling…" : "Yes, shuffle it"}
            </SansText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <SansText style={styles.sheetCancelText}>Cancel</SansText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
  queueItemTappable: { opacity: 1 },
  queueThumb: { width: 80, height: 50, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: Colors.divider },
  queueThumbImg: { borderRadius: Radius.sm },
  queueInfo: { flex: 1, minWidth: 0 },
  queueChannel: { fontSize: FontSize.xxs, color: Colors.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium },
  queueTitleText: { fontSize: FontSize.sm, color: Colors.ink, lineHeight: 18 },
  queueStatus: { fontSize: FontSize.xxs, color: Colors.queued, marginTop: 3, fontStyle: "italic" },
  listContent: { paddingBottom: 80 },
  avatarBubble: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarBubbleText: { color: Colors.cream, fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium },
  shuffleBtn: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.accent, alignItems: "center" },
  shuffleBtnText: { color: Colors.accent, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheetContainer: { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.divider, alignSelf: "center", marginBottom: Spacing.sm },
  sheetTitle: { fontSize: FontSize.md, color: Colors.ink, textAlign: "center" },
  sheetSubtitle: { fontSize: FontSize.xs, color: Colors.warmMid, textAlign: "center", lineHeight: 20, marginBottom: Spacing.xs },
  sheetActionBtn: { backgroundColor: Colors.accent, borderRadius: Radius.pill, paddingVertical: Spacing.sm + 2, alignItems: "center" },
  sheetActionText: { color: "white", fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  sheetCancelBtn: { borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.divider, paddingVertical: Spacing.sm + 2, alignItems: "center" },
  sheetCancelText: { color: Colors.warmMid, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  importBtn: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.divider, alignItems: "center" },
  importBtnText: { color: Colors.warmMid, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
});
