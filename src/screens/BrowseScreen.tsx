import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Image, RefreshControl } from "react-native";
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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const ch = await api.listChannels();
      setChannels(ch);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, []);

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
        data={channels}
        keyExtractor={item => item.ytChannelId}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadChannels} tintColor={Colors.accent} />}
        ListHeaderComponent={
          <SerifText style={styles.pageTitle}>Browse Your Channels</SerifText>
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
          !loading
            ? <EmptyState icon="☰" title="No channels yet" subtitle="Sync your YouTube subscriptions from the Profile tab to get started." />
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
  container:     { flex: 1, backgroundColor: Colors.cream },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  pageTitle:     { fontSize: FontSize.lg, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  listContent:   { paddingBottom: 80 },
  separator:     { height: 1, backgroundColor: Colors.divider, marginLeft: 72 },
  row:           { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.md },
  avatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.divider },
  avatarFallback:{ width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarChar:    { color: "white", fontSize: FontSize.md, fontFamily: FontFamily.sansMedium },
  channelName:   { flex: 1, fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansMedium },
  avatarBubble:  { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarBubbleText: { color: Colors.cream, fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium },
});
