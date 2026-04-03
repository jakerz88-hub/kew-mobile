import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Image, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";
import type { Channel } from "../types";
import { KewLogo, SansText, SerifText, Divider, EmptyState, ErrorBanner } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { useStore } from "../store";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";

export default function BrowseScreen() {
  const navigation = useNavigation<any>();
  const { user } = useStore();
  const [channels, setChannels]       = useState<Channel[]>([]);
  const [syncing, setSyncing]         = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadChannels = useCallback(async () => {
    try {
      const ch = await api.listChannels();
      setChannels(ch);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load channels");
    }
  }, []);

  // Pull-to-refresh does a full re-sync against YouTube, then updates the list
  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    setLoadError(null);
    try {
      const updated = await api.syncSubscriptions();
      setChannels(updated);
    } catch (e: any) {
      setLoadError(e?.message ?? "Sync failed. Pull down to try again.");
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, []);

  const filteredChannels = searchQuery.trim()
    ? channels.filter(ch =>
        ch.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : channels;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LogoMark size={24} />
          <KewLogo />
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.8}>
          <View style={styles.avatarBubble}>
            <SansText style={styles.avatarBubbleText}>
              {user?.displayName?.charAt(0).toUpperCase() ?? "?"}
            </SansText>
          </View>
        </TouchableOpacity>
      </View>
      <Divider />

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <FlatList
        data={filteredChannels}
        keyExtractor={item => item.ytChannelId}
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          <>
            {/* Title + stats row */}
            <View style={styles.pageTitleRow}>
              <SerifText style={styles.pageTitle}>Browse Your Channels</SerifText>
              {channels.length > 0 && (
                <View style={styles.statsRow}>
                  <SansText style={styles.channelCount}>
                    {channels.length} subscription{channels.length !== 1 ? "s" : ""} loaded
                  </SansText>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("RecentUploads")}
                    activeOpacity={0.7}
                  >
                    <SansText style={styles.recentLink}>Latest uploads →</SansText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Search bar */}
            <View style={styles.searchRow}>
              <Feather name="search" size={14} color={Colors.warmMid} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search creators..."
                placeholderTextColor={Colors.warmMid}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </>
        }
        renderItem={({ item }) => (
          <ChannelRow
            channel={item}
            onPress={() =>
              navigation.navigate("Channel", {
                channelId:    item.ytChannelId,
                channelTitle: item.title,
                thumbnailUrl: item.thumbnailUrl,
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !syncing
            ? <EmptyState
                icon="☰"
                title={searchQuery ? "No matching creators" : "No channels yet"}
                subtitle={searchQuery ? "Try a different search." : "Pull down to sync your YouTube subscriptions."}
              />
            : null
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function ChannelRow({ channel, onPress }: { channel: Channel; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {channel.thumbnailUrl
        ? <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatar} />
        : <View style={styles.avatarFallback}>
            <SansText style={styles.avatarChar}>{channel.title.charAt(0).toUpperCase()}</SansText>
          </View>
      }
      <SansText style={styles.channelName} numberOfLines={1}>{channel.title}</SansText>
      <Feather name="chevron-right" size={16} color={Colors.warmMid} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.cream },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pageTitleRow:     { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  pageTitle:        { fontSize: FontSize.lg },
  statsRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  channelCount:     { fontSize: FontSize.xs, color: Colors.warmMid },
  recentLink:       { fontSize: FontSize.xs, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  searchRow:        { flexDirection: "row", alignItems: "center", marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.divider, gap: 8 },
  searchInput:      { flex: 1, fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansRegular, padding: 0 },
  listContent:      { paddingBottom: 80 },
  separator:        { height: 1, backgroundColor: Colors.divider, marginLeft: 72 },
  row:              { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.md },
  avatar:           { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.divider },
  avatarFallback:   { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarChar:       { color: "white", fontSize: FontSize.md, fontFamily: FontFamily.sansMedium },
  channelName:      { flex: 1, fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansMedium },
  avatarBubble:     { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarBubbleText: { color: Colors.cream, fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium },
});
