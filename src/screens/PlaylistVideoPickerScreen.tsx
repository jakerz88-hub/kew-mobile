import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator, Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";
import { useStore } from "../store";
import { SansText, SerifText, Divider, EmptyState, ErrorBanner, Toast } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { formatDuration } from "../types";
import type { PlaylistVideo } from "../types";
import { handleQueueLimitReached } from "../utils/kewPlusUpsell";

const MAX_SELECT = 50;

export default function PlaylistVideoPickerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { playlistId, playlistTitle } = route.params as { playlistId: string; playlistTitle: string };
  const { fetchQueue } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [videos, setVideos]         = useState<PlaylistVideo[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [importing, setImporting]   = useState(false);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [skippedCount, setSkipped]  = useState(0);
  const [toastMsg, setToastMsg]     = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    api.getPlaylistVideos(playlistId)
      .then(result => {
        setVideos(result.videos);
        setSkipped(result.skippedCount);
      })
      .catch(e => setLoadError(e?.message ?? "Failed to load videos."))
      .finally(() => setLoading(false));
  }, [playlistId]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3600);
  }, []);

  const toggleVideo = (ytVideoId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ytVideoId)) {
        next.delete(ytVideoId);
      } else if (next.size < MAX_SELECT) {
        next.add(ytVideoId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const ids = videos.slice(0, MAX_SELECT).map(v => v.ytVideoId);
    setSelected(new Set(ids));
  };

  const clearAll = () => setSelected(new Set());

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const result = await api.importToQueue([...selected]);
      await fetchQueue();

      const parts: string[] = [];
      if (result.importedCount > 0) parts.push(`${result.importedCount} video${result.importedCount !== 1 ? "s" : ""} added to your queue`);
      if (result.alreadyQueuedCount > 0) parts.push(`${result.alreadyQueuedCount} already in queue`);
      const successMsg = parts.join(" · ");

      if (skippedCount > 0) {
        showToast(`${successMsg}.\n\nSome videos couldn't be loaded. This may be because they are private, region-blocked, or were deleted.`);
        setTimeout(() => navigation.goBack(), 3800);
      } else {
        showToast(successMsg);
        setTimeout(() => navigation.goBack(), 3800);
      }
    } catch (e: any) {
      if (e?.code === "queue_limit_reached") {
        await handleQueueLimitReached();
      } else {
        showToast(e?.message ?? "Import failed. Please try again.");
      }
    } finally {
      setImporting(false);
    }
  };

  const allSelected = videos.length > 0 && selected.size === Math.min(videos.length, MAX_SELECT);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle} numberOfLines={1}>{playlistTitle}</SerifText>
        <TouchableOpacity
          style={[styles.importBtn, (selected.size === 0 || importing) && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={selected.size === 0 || importing}
          activeOpacity={0.75}
        >
          {importing
            ? <ActivityIndicator color="white" size="small" />
            : <SansText style={styles.importBtnText}>
                {selected.size > 0 ? `Add ${selected.size}` : "Add"}
              </SansText>
          }
        </TouchableOpacity>
      </View>
      <Divider />

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <SansText style={styles.loadingText}>Loading videos…</SansText>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={item => item.ytVideoId}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <SansText style={styles.countText}>
                {videos.length} video{videos.length !== 1 ? "s" : ""}
                {selected.size > 0 ? ` · ${selected.size} selected` : ""}
                {selected.size === MAX_SELECT ? ` (max)` : ""}
              </SansText>
              <TouchableOpacity onPress={allSelected ? clearAll : selectAll} activeOpacity={0.7}>
                <SansText style={styles.selectAllText}>
                  {allSelected ? "Clear all" : `Select all${videos.length > MAX_SELECT ? ` (${MAX_SELECT})` : ""}`}
                </SansText>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="☰" title="No videos found" subtitle="This playlist appears to be empty." />
          }
          renderItem={({ item }) => {
            const isSelected = selected.has(item.ytVideoId);
            const atLimit = !isSelected && selected.size >= MAX_SELECT;
            return (
              <TouchableOpacity
                style={[styles.row, atLimit && styles.rowDisabled]}
                onPress={() => toggleVideo(item.ytVideoId)}
                activeOpacity={0.7}
                disabled={atLimit}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Feather name="check" size={12} color="white" />}
                </View>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={styles.info}>
                  <SansText style={styles.channel} numberOfLines={1}>{item.channelTitle}</SansText>
                  <SansText style={styles.title} numberOfLines={2}>{item.title}</SansText>
                  <SansText style={styles.duration}>{formatDuration(item.durationSecs)}</SansText>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Toast message={toastMsg} visible={toastVisible} />
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:         { flex: 1, backgroundColor: c.cream },
    header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    headerTitle:       { flex: 1, fontSize: FontSize.md, color: c.ink, marginHorizontal: Spacing.sm },
    backBtn:           { padding: 4 },
    importBtn:         { backgroundColor: c.accent, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.pill, minWidth: 64, alignItems: "center" },
    importBtnDisabled: { opacity: 0.4 },
    importBtnText:     { fontSize: FontSize.xs, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    centered:          { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
    loadingText:       { fontSize: FontSize.sm, color: c.warmMid },
    listHeader:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    countText:         { fontSize: FontSize.xs, color: c.warmMid },
    selectAllText:     { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sansMedium },
    row:               { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md },
    rowDisabled:       { opacity: 0.4 },
    checkbox:          { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: c.divider, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    checkboxSelected:  { backgroundColor: c.accent, borderColor: c.accent },
    thumb:             { width: 80, height: 50, borderRadius: Radius.sm, flexShrink: 0 },
    thumbPlaceholder:  { backgroundColor: c.divider },
    info:              { flex: 1, minWidth: 0, gap: 2 },
    channel:           { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FontFamily.sansMedium },
    title:             { fontSize: FontSize.sm, color: c.ink, lineHeight: 18 },
    duration:          { fontSize: FontSize.xxs, color: c.queued },
    listContent:       { paddingBottom: 80 },
  });
}
