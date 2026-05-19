import React, { useEffect, useState, useMemo } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";
import { useStore } from "../store";
import { SansText, SerifText, Divider, EmptyState, ErrorBanner } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import type { Playlist } from "../types";

export default function PlaylistListScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.hasYoutube) { setLoading(false); return; }
    api.getPlaylists()
      .then(setPlaylists)
      .catch(e => setError(e?.message ?? "Failed to load playlists."))
      .finally(() => setLoading(false));
  }, [user?.hasYoutube]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Import from YouTube</SerifText>
        <View style={{ flex: 1 }} />
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {!user?.hasYoutube ? (
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
          data={playlists}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <SansText style={styles.hint}>
              Select a playlist to choose videos to add to your queue.
            </SansText>
          }
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
              onPress={() => navigation.navigate("PlaylistVideoPicker", {
                playlistId: item.id,
                playlistTitle: item.title,
              })}
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

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: c.cream },
    header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    headerTitle:      { fontSize: FontSize.md, color: c.ink, textAlign: "center" },
    backBtn:          { flex: 1, padding: 4 },
    centered:         { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
    loadingText:      { fontSize: FontSize.sm, color: c.warmMid },
    hint:             { fontSize: FontSize.xs, color: c.warmMid, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    row:              { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.s10, paddingHorizontal: Spacing.md },
    thumb:            { width: 72, height: 54, borderRadius: Radius.sm, flexShrink: 0 },
    thumbPlaceholder: { backgroundColor: c.divider, alignItems: "center", justifyContent: "center" },
    info:             { flex: 1, minWidth: 0, gap: 3 },
    title:            { fontSize: FontSize.sm, color: c.ink, lineHeight: 18, fontFamily: FontFamily.sansMedium },
    count:            { fontSize: FontSize.xs, color: c.warmMid },
    listContent:      { paddingBottom: 40 },
  });
}
