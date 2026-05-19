import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "../../services/api";
import { useStore } from "../../store";
import { SansText, SerifText, Divider, EmptyState, ErrorBanner, Toast } from "../../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../../types/theme";
import { useTheme } from "../../contexts/ThemeContext";
import { useScrollToTopOnTabPress } from "../../hooks/useScrollToTopOnTabPress";
import { formatDuration } from "../../types";
import type { Playlist, PlaylistVideo, ImportResult } from "../../types";
import { handleQueueLimitReached } from "../../utils/kewPlusUpsell";

const MAX_SELECT = 50;

type ImportView = "list" | "picker";

export default function TabletImportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, fetchQueue } = useStore();

  const [view, setView] = useState<ImportView>("list");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  return view === "list" ? (
    <ListView
      colors={colors}
      styles={styles}
      hasYoutube={!!user?.hasYoutube}
      onSelect={(pl) => { setSelectedPlaylist(pl); setView("picker"); }}
    />
  ) : selectedPlaylist ? (
    <PickerView
      colors={colors}
      styles={styles}
      playlist={selectedPlaylist}
      onBack={() => setView("list")}
      onImported={() => fetchQueue()}
    />
  ) : null;
}

// ── List view ──────────────────────────────────────────────────────────────
function ListView({
  colors, styles, hasYoutube, onSelect,
}: {
  colors: ColorPalette;
  styles: ReturnType<typeof makeStyles>;
  hasYoutube: boolean;
  onSelect: (pl: Playlist) => void;
}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList | null>(null);
  useScrollToTopOnTabPress(listRef, "Import");

  useEffect(() => {
    if (!hasYoutube) { setLoading(false); return; }
    api.getPlaylists()
      .then(setPlaylists)
      .catch(e => setError(e?.message ?? "Failed to load playlists."))
      .finally(() => setLoading(false));
  }, [hasYoutube]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pageHeader}>
        <SerifText style={styles.pageTitle}>Import from YouTube</SerifText>
        <SansText style={styles.pageSubtitle}>
          Select a playlist to choose videos to add to your queue.
        </SansText>
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {!hasYoutube ? (
        <View style={styles.centered}>
          <EmptyState
            icon="☰"
            title="YouTube not connected"
            subtitle="Connect your YouTube account from your profile to import playlists."
          />
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <SansText style={styles.loadingText}>Loading your playlists…</SansText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={playlists}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <EmptyState
              icon="☰"
              title="No playlists found"
              subtitle="We couldn't find any playlists on your YouTube account."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              {item.thumbnailUrl ? (
                <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Feather name="list" size={20} color={colors.warmMid} />
                </View>
              )}
              <View style={styles.info}>
                <SansText style={styles.title} numberOfLines={2}>{item.title}</SansText>
                <SansText style={styles.count}>{item.videoCount} video{item.videoCount !== 1 ? "s" : ""}</SansText>
              </View>
              <Feather name="chevron-right" size={16} color={colors.warmMid} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

// ── Picker view ────────────────────────────────────────────────────────────
function PickerView({
  colors, styles, playlist, onBack, onImported,
}: {
  colors: ColorPalette;
  styles: ReturnType<typeof makeStyles>;
  playlist: Playlist;
  onBack: () => void;
  onImported: () => void;
}) {
  const [videos, setVideos]         = useState<PlaylistVideo[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [importing, setImporting]   = useState(false);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [skippedCount, setSkipped]  = useState(0);
  const [toastMsg, setToastMsg]     = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const pickerListRef = useRef<FlatList | null>(null);
  useScrollToTopOnTabPress(pickerListRef, "Import");

  useEffect(() => {
    setLoading(true);
    api.getPlaylistVideos(playlist.id)
      .then(result => {
        setVideos(result.videos);
        setSkipped(result.skippedCount);
      })
      .catch(e => setLoadError(e?.message ?? "Failed to load videos."))
      .finally(() => setLoading(false));
  }, [playlist.id]);

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
      const result: ImportResult = await api.importToQueue([...selected]);
      onImported();

      const parts: string[] = [];
      if (result.importedCount > 0) parts.push(`${result.importedCount} video${result.importedCount !== 1 ? "s" : ""} added to your queue`);
      if (result.alreadyQueuedCount > 0) parts.push(`${result.alreadyQueuedCount} already in queue`);
      const successMsg = parts.join(" · ");

      if (skippedCount > 0) {
        showToast(`${successMsg}.\n\nSome videos couldn't be loaded. This may be because they are private, region-blocked, or were deleted.`);
      } else {
        showToast(successMsg);
      }
      setTimeout(() => onBack(), 3000);
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
      <View style={styles.pickerHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.pickerTitle} numberOfLines={1}>{playlist.title}</SerifText>
        <TouchableOpacity
          style={[styles.addBtn, (selected.size === 0 || importing) && styles.addBtnDisabled]}
          onPress={handleImport}
          disabled={selected.size === 0 || importing}
          activeOpacity={0.75}
        >
          {importing
            ? <ActivityIndicator color="white" size="small" />
            : <SansText style={styles.addBtnText}>
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
          ref={pickerListRef}
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
                style={[styles.pickerRow, atLimit && styles.rowDisabled]}
                onPress={() => toggleVideo(item.ytVideoId)}
                activeOpacity={0.7}
                disabled={atLimit}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Feather name="check" size={12} color="white" />}
                </View>
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.pickerThumb} />
                ) : (
                  <View style={[styles.pickerThumb, styles.thumbPlaceholder]} />
                )}
                <View style={styles.info}>
                  <SansText style={styles.channel} numberOfLines={1}>{item.channelTitle}</SansText>
                  <SansText style={styles.pickerTitleText} numberOfLines={2}>{item.title}</SansText>
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
    container:        { flex: 1, backgroundColor: c.cream },
    pageHeader:       { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 4 },
    pageTitle:        { fontSize: FontSize.lg, color: c.ink },
    pageSubtitle:     { fontSize: FontSize.xs, color: c.warmMid },
    pickerHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    pickerTitle:      { flex: 1, fontSize: FontSize.md, color: c.ink, marginHorizontal: Spacing.sm },
    backBtn:          { padding: 4 },
    addBtn:           { backgroundColor: c.accent, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.pill, minWidth: 64, alignItems: "center" },
    addBtnDisabled:   { opacity: 0.4 },
    addBtnText:       { fontSize: FontSize.xs, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    centered:         { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
    loadingText:      { fontSize: FontSize.sm, color: c.warmMid },
    row:              { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.s10, paddingHorizontal: Spacing.md },
    thumb:            { width: 72, height: 54, borderRadius: Radius.sm, flexShrink: 0 },
    thumbPlaceholder: { backgroundColor: c.divider, alignItems: "center", justifyContent: "center" },
    info:             { flex: 1, minWidth: 0, gap: 3 },
    title:            { fontSize: FontSize.sm, color: c.ink, lineHeight: 18, fontFamily: FontFamily.sansMedium },
    count:            { fontSize: FontSize.xs, color: c.warmMid },
    listContent:      { paddingBottom: 80 },
    listHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    countText:        { fontSize: FontSize.xs, color: c.warmMid },
    selectAllText:    { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sansMedium },
    pickerRow:        { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.s10, paddingHorizontal: Spacing.md },
    rowDisabled:      { opacity: 0.4 },
    checkbox:         { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: c.divider, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    checkboxSelected: { backgroundColor: c.accent, borderColor: c.accent },
    pickerThumb:      { width: 80, height: 50, borderRadius: Radius.sm, flexShrink: 0 },
    channel:          { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FontFamily.sansMedium },
    pickerTitleText:  { fontSize: FontSize.sm, color: c.ink, lineHeight: 18 },
    duration:         { fontSize: FontSize.xxs, color: c.queued },
  });
}
