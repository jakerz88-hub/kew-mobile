import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, TouchableOpacity, Modal, Pressable, StyleSheet, SafeAreaView, Image, RefreshControl } from "react-native";
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
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  const handleResync = async () => {
    setShowSyncConfirm(false);
    setSyncing(true);
    try {
      const updated = await api.syncSubscriptions();
      setChannels(updated);
    } catch (e: any) {
      setLoadError(e?.message ?? "Re-sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

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
          <>
            <View style={styles.pageTitleRow}>
              <SerifText style={styles.pageTitle}>Browse Your Channels</SerifText>
              {channels.length > 0 && (
                <SansText style={styles.channelCount}>
                  {channels.length} subscription{channels.length !== 1 ? "s" : ""} loaded
                </SansText>
              )}
            </View>

            <TouchableOpacity
              style={[styles.resyncBtn, syncing && { opacity: 0.5 }]}
              onPress={() => setShowSyncConfirm(true)}
              disabled={syncing}
              activeOpacity={0.7}
            >
              <SansText style={styles.resyncBtnText}>
                {syncing ? "Re-syncing…" : "Re-sync subscriptions"}
              </SansText>
            </TouchableOpacity>
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
          !loading
            ? <EmptyState icon="☰" title="No channels yet" subtitle="Tap 'Re-sync subscriptions' above to load your YouTube subscriptions." />
            : null
        }
        contentContainerStyle={styles.listContent}
      />

      <ResyncConfirmSheet
        visible={showSyncConfirm}
        onConfirm={handleResync}
        onClose={() => setShowSyncConfirm(false)}
      />
    </SafeAreaView>
  );
}

function ResyncConfirmSheet({ visible, onConfirm, onClose }: {
  visible: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <SerifText style={styles.sheetTitle}>Re-sync subscriptions?</SerifText>
          <SansText style={styles.sheetSubtitle}>
            This will update your channel list to match your{"\n"}current YouTube subscriptions.
          </SansText>
          <TouchableOpacity
            style={styles.sheetActionBtn}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <SansText style={styles.sheetActionText}>Yes, re-sync</SansText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <SansText style={styles.sheetCancelText}>Cancel</SansText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
  channelCount:     { fontSize: FontSize.xs, color: Colors.warmMid, marginTop: 3 },
  resyncBtn:        { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.accent, alignItems: "center" },
  resyncBtnText:    { color: Colors.accent, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  listContent:      { paddingBottom: 80 },
  separator:        { height: 1, backgroundColor: Colors.divider, marginLeft: 72 },
  row:              { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.md },
  avatar:           { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.divider },
  avatarFallback:   { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarChar:       { color: "white", fontSize: FontSize.md, fontFamily: FontFamily.sansMedium },
  channelName:      { flex: 1, fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansMedium },
  avatarBubble:     { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarBubbleText: { color: Colors.cream, fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium },
  sheetOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheetContainer:   { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  sheetHandle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.divider, alignSelf: "center", marginBottom: Spacing.sm },
  sheetTitle:       { fontSize: FontSize.md, color: Colors.ink, textAlign: "center" },
  sheetSubtitle:    { fontSize: FontSize.xs, color: Colors.warmMid, textAlign: "center", lineHeight: 20, marginBottom: Spacing.xs },
  sheetActionBtn:   { backgroundColor: Colors.accent, borderRadius: Radius.pill, paddingVertical: Spacing.sm + 2, alignItems: "center" },
  sheetActionText:  { color: "white", fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  sheetCancelBtn:   { borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.divider, paddingVertical: Spacing.sm + 2, alignItems: "center" },
  sheetCancelText:  { color: Colors.warmMid, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
});
