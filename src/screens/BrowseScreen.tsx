import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { friendlyError } from "../utils/friendlyError";
import {
  View, FlatList, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, RefreshControl, ActivityIndicator, ScrollView,
  Platform, Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { api } from "../services/api";
import { connectYouTube } from "../utils/youtubeConnect";
import type { Channel, BrowseVideo } from "../types";
import { formatDuration, timeAgo } from "../types";
import {
  KewLogo, SansText, SerifText, Divider, ThumbPlaceholder,
  EmptyState, ErrorBanner, AvatarBubble,
} from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { DurationBadge } from "../components/DurationBadge";
import { useStore } from "../store";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { useScrollToTopOnTabPress } from "../hooks/useScrollToTopOnTabPress";
import { useInTabletSidebar } from "../contexts/TabletSidebarContext";
import { useAddToQueue } from "../hooks/useAddToQueue";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { WatchNowSheet } from "../components/WatchNowSheet";
import { ChannelSheet } from "../components/ChannelSheet";

const CHANNEL_COL_WIDTH = 260;

export default function BrowseScreen() {
  const navigation = useNavigation<any>();
  const isTablet = useIsTablet();
  const inSidebar = useInTabletSidebar();
  const { colors } = useTheme();
  const styles  = useMemo(() => makePhoneStyles(colors), [colors]);
  const tStyles = useMemo(() => makeTabletStyles(colors), [colors]);
  const { user } = useStore();
  const queuedVideos = useStore(s => s.queuedVideos);

  const { fetchUser } = useStore();
  const [channels, setChannels]         = useState<Channel[]>([]);
  const [syncing, setSyncing]           = useState(false);
  const [ytConnecting, setYtConnecting] = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [ytError, setYtError]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [recentUploads, setRecentUploads] = useState<BrowseVideo[]>([]);
  const [recentError, setRecentError]     = useState(false);

  // Tablet panel state
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [panelVideos, setPanelVideos]   = useState<BrowseVideo[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const STAGE_WEEKS = [2, 12, 36, 0] as const;
  const [panelStage, setPanelStage]             = useState(0);
  const [panelLoadingOlder, setPanelLoadingOlder] = useState(false);
  const [channelSheetVisible, setChannelSheetVisible] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<{ ytChannelId: string; title: string; thumbnailUrl?: string } | null>(null);

  // Tab-icon re-tap → scroll to top. Phone uses the channels FlatList;
  // tablet has both the left channel column and the right video panel —
  // wire both so whichever the user has scrolled snaps back.
  const phoneListRef = useRef<FlatList | null>(null);
  const tabletChannelsRef = useRef<FlatList | null>(null);
  const tabletPanelRef = useRef<FlatList | null>(null);
  useScrollToTopOnTabPress(phoneListRef, "Browse");
  useScrollToTopOnTabPress(tabletChannelsRef, "Browse");
  useScrollToTopOnTabPress(tabletPanelRef, "Browse");

  // Queue picker (shared hook — handles iOS ActionSheet + Android modal)
  const {
    handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId,
    handleWatchNow, closeWatchNow, watchNowVideoId, watchNowTitle,
  } = useAddToQueue(
    (ytVideoId) => setPanelVideos(v => v.map(x => x.ytVideoId === ytVideoId ? { ...x, inQueue: true } : x))
  );

  const loadChannels = useCallback(async () => {
    try {
      const ch = await api.listChannels();
      setChannels(ch);
    } catch (e: any) {
      setLoadError(friendlyError(e, "Failed to load channels"));
    }
  }, []);

  const loadRecentUploads = useCallback(async () => {
    setRecentError(false);
    try {
      const recent = await api.getRecentUploads(7);
      setRecentUploads(recent.slice(0, 6));
    } catch {
      // Surface inline in the strip's slot rather than as a full ErrorBanner —
      // this is one strip among many on the page, not the primary surface.
      setRecentError(true);
    }
  }, []);

  const loadPanelVideos = useCallback(async (channelId: string | null, targetStage = 0) => {
    if (targetStage === 0) {
      setPanelLoading(true);
      setPanelStage(0);
    } else {
      setPanelLoadingOlder(true);
    }
    try {
      const vids = channelId
        ? await api.browseFeed(channelId, STAGE_WEEKS[targetStage])
        : await api.getRecentUploads();
      setPanelVideos(vids);
      if (channelId) setPanelStage(targetStage);
    } catch (e: any) {
      setLoadError(friendlyError(e, "Failed to load videos"));
    } finally {
      setPanelLoading(false);
      setPanelLoadingOlder(false);
    }
  }, []);

  const handleConnectYouTube = async () => {
    setYtConnecting(true);
    setYtError(null);
    try {
      const { success, error } = await connectYouTube();
      if (!success) {
        if (error) setYtError(error);
        return;
      }
      await fetchUser();
      // hasYoutube is now true — the gate render will disappear automatically
    } catch (e: any) {
      setYtError(friendlyError(e, "Could not connect YouTube."));
    } finally {
      setYtConnecting(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setSyncing(true);
    setLoadError(null);
    try {
      const updated = await api.syncSubscriptions();
      setChannels(updated);
      if (isTablet) await loadPanelVideos(selectedChannelId);
    } catch (e: any) {
      setLoadError(friendlyError(e, "Sync failed. Pull down to try again."));
    } finally {
      setSyncing(false);
    }
  }, [isTablet, selectedChannelId, loadPanelVideos]);

  useEffect(() => { loadChannels(); loadRecentUploads(); }, []);

  // Load panel videos when tablet is ready or channel selection changes
  useEffect(() => {
    if (isTablet) loadPanelVideos(selectedChannelId);
  }, [isTablet, selectedChannelId]);


  const filteredChannels = searchQuery.trim()
    ? channels.filter(ch => ch.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : channels;

  const selectedChannelTitle = selectedChannelId
    ? channels.find(ch => ch.ytChannelId === selectedChannelId)?.title ?? "Channel"
    : "Latest Uploads";

  // ══════════════════════════════════════════════════════════════
  // YOUTUBE NOT CONNECTED GATE
  // ══════════════════════════════════════════════════════════════
  if (!user?.hasYoutube) {
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
        <View style={styles.emptyWithBtn}>
          <SerifText style={styles.emptyWithBtnTitle}>Connect YouTube to browse</SerifText>
          <SansText style={styles.emptyWithBtnSub}>
            Connect your YouTube account to browse your subscriptions and add videos to your queue.
          </SansText>
          {ytError && (
            <SansText style={{ fontSize: FontSize.xs, color: colors.accent, textAlign: "center" }}>
              {ytError}
            </SansText>
          )}
          <TouchableOpacity
            style={[styles.syncBtn, ytConnecting && { opacity: 0.6 }]}
            onPress={handleConnectYouTube}
            disabled={ytConnecting}
            activeOpacity={0.7}
          >
            <SansText style={styles.syncBtnText}>
              {ytConnecting ? "Connecting…" : "Connect YouTube"}
            </SansText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // TABLET LAYOUT
  // ══════════════════════════════════════════════════════════════
  if (isTablet) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Top bar — hidden when embedded in sidebar (sidebar provides nav) */}
        {!inSidebar && (
          <View style={tStyles.topBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LogoMark size={20} />
              <KewLogo size={20} />
            </View>
            <AvatarBubble
              avatarUrl={user?.avatarUrl}
              initial={user?.displayName?.charAt(0).toUpperCase() ?? "?"}
              size={28}
              onPress={() => navigation.navigate("Profile")}
            />
          </View>
        )}
        {!inSidebar && <Divider />}

        {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

        <View style={tStyles.root}>
          {/* ── Left: Channel list ── */}
          <View style={tStyles.channelCol}>
            <View style={tStyles.channelHeader}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <SerifText style={tStyles.channelTitle}>Browse Your Channels</SerifText>
                <TouchableOpacity onPress={handleRefresh} disabled={syncing} activeOpacity={0.7}>
                  <SansText style={[tStyles.syncBtn, syncing && { opacity: 0.4 }]}>
                    {syncing ? "Syncing…" : "Sync"}
                  </SansText>
                </TouchableOpacity>
              </View>
              {channels.length > 0 && (
                <SansText style={tStyles.channelCount}>
                  {channels.length} subscription{channels.length !== 1 ? "s" : ""}
                </SansText>
              )}
              <View style={tStyles.searchRow}>
                <Feather name="search" size={12} color={colors.warmMid} />
                <TextInput
                  style={tStyles.searchInput}
                  placeholder="Search creators..."
                  placeholderTextColor={colors.warmMid}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <Divider />

            <FlatList
              ref={tabletChannelsRef}
              data={filteredChannels}
              keyExtractor={item => item.ytChannelId}
              refreshControl={
                <RefreshControl refreshing={syncing} onRefresh={handleRefresh} tintColor={colors.ink} />
              }
              ListHeaderComponent={
                <TouchableOpacity
                  style={[tStyles.channelRow, !selectedChannelId && tStyles.channelRowActive]}
                  onPress={() => setSelectedChannelId(null)}
                  activeOpacity={0.7}
                >
                  <View style={[tStyles.channelAvatar, { backgroundColor: colors.divider, alignItems: "center", justifyContent: "center" }]}>
                    <Feather name="grid" size={14} color={colors.warmMid} />
                  </View>
                  <SansText style={[tStyles.channelName, !selectedChannelId && tStyles.channelNameActive]}>
                    All Channels
                  </SansText>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <View style={[tStyles.channelRow, selectedChannelId === item.ytChannelId && tStyles.channelRowActive]}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                    onPress={() => setSelectedChannelId(item.ytChannelId)}
                    activeOpacity={0.7}
                  >
                    {item.thumbnailUrl
                      ? <Image source={{ uri: item.thumbnailUrl }} style={tStyles.channelAvatar} />
                      : (
                        <View style={[tStyles.channelAvatar, { backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }]}>
                          <SansText style={{ color: colors.buttonText, fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium }}>
                            {item.title.charAt(0).toUpperCase()}
                          </SansText>
                        </View>
                      )
                    }
                    <SansText
                      style={[tStyles.channelName, selectedChannelId === item.ytChannelId && tStyles.channelNameActive]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </SansText>
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={16} color={colors.warmMid} style={{ paddingRight: Spacing.sm }} />
                </View>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 48 }} />}
              ListEmptyComponent={
                !syncing ? (
                  <EmptyState
                    icon={searchQuery ? "☰" : "↓"}
                    title={searchQuery ? "No matching creators" : "Pull down to sync subscriptions"}
                  />
                ) : null
              }
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          </View>

          {/* ── Right: Video grid ── */}
          <View style={tStyles.videoCol}>
            <View style={[tStyles.videoColHeader, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <SansText style={tStyles.videoColTitle}>{selectedChannelTitle}</SansText>
              {selectedChannelId && (() => {
                const ch = channels.find(c => c.ytChannelId === selectedChannelId);
                if (!ch) return null;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedChannel({ ytChannelId: ch.ytChannelId, title: ch.title, thumbnailUrl: ch.thumbnailUrl || undefined });
                      setChannelSheetVisible(true);
                    }}
                    activeOpacity={0.6}
                    style={{ padding: 6, minWidth: 32, minHeight: 32, justifyContent: "center", alignItems: "center" }}
                  >
                    <Feather name="info" size={16} color={colors.warmMid} />
                  </TouchableOpacity>
                );
              })()}
            </View>
            <Divider />

            {panelLoading ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
                <ActivityIndicator color={colors.accent} size="large" />
                <SansText style={{ fontSize: FontSize.sm, color: colors.warmMid }}>Loading videos…</SansText>
              </View>
            ) : (
              <FlatList
                ref={tabletPanelRef}
                key="2col"
                numColumns={2}
                data={panelVideos}
                keyExtractor={v => v.ytVideoId}
                columnWrapperStyle={tStyles.gridRow}
                contentContainerStyle={tStyles.gridContent}
                renderItem={({ item }) => {
                  const inQueue = item.inQueue || !!queuedVideos[item.ytVideoId];
                  return (
                    <BrowseVideoCard
                      video={item}
                      inQueue={inQueue}
                      adding={addingId === item.ytVideoId}
                      onAdd={handleAdd}
                      onLongPress={() => handleWatchNow(item.ytVideoId, item.title)}
                    />
                  );
                }}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                ListEmptyComponent={
                  <EmptyState
                    icon="▶"
                    title="No videos found"
                    subtitle="Try syncing your subscriptions"
                  />
                }
                ListFooterComponent={
                  selectedChannelId && !panelLoading ? (
                    <TabletLoadMoreFooter
                      stage={panelStage}
                      loadingOlder={panelLoadingOlder}
                      onLoadOlder={() => loadPanelVideos(selectedChannelId, panelStage + 1)}
                    />
                  ) : null
                }
              />
            )}
          </View>
        </View>

        {/* Watch now (long-press) — iPad path. The phone return block has its
            own copy; this one is required because the tablet layout returns
            early and never reaches that JSX. Without it, long-press sets
            watchNowVideoId but the sheet has no mount point on iPad. */}
        {watchNowVideoId && (
          <WatchNowSheet
            visible={!!watchNowVideoId}
            ytVideoId={watchNowVideoId}
            videoTitle={watchNowTitle}
            onClose={closeWatchNow}
          />
        )}

        {/* Channel sheet modal */}
        {selectedChannel && (
          <ChannelSheet
            visible={channelSheetVisible}
            onClose={() => setChannelSheetVisible(false)}
            ytChannelId={selectedChannel.ytChannelId}
            channelTitle={selectedChannel.title}
            channelThumbnailUrl={selectedChannel.thumbnailUrl}
          />
        )}
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PHONE LAYOUT
  // ══════════════════════════════════════════════════════════════
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

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <FlatList
        ref={phoneListRef}
        data={filteredChannels}
        keyExtractor={item => item.ytChannelId}
        refreshControl={
          <RefreshControl refreshing={syncing} onRefresh={handleRefresh} tintColor={colors.ink} />
        }
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

            {recentError ? (
              <View style={styles.recentStrip}>
                <SansText style={styles.recentStripErrorText}>Couldn't load recent uploads.</SansText>
              </View>
            ) : recentUploads.length > 0 && (
              <View style={styles.recentStrip}>
                <View style={styles.recentStripHeader}>
                  <SansText style={styles.recentStripLabel}>Latest uploads</SansText>
                  <TouchableOpacity onPress={() => navigation.navigate("RecentUploads")} activeOpacity={0.7}>
                    <SansText style={styles.recentStripViewAll}>View all →</SansText>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentCards}>
                  {recentUploads.map(video => (
                    <TouchableOpacity
                      key={video.ytVideoId}
                      style={styles.recentCard}
                      onPress={() => navigation.navigate("RecentUploads")}
                      activeOpacity={0.8}
                    >
                      <View style={styles.recentThumb}>
                        {video.thumbnailUrl
                          ? <Image source={{ uri: video.thumbnailUrl }} style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }]} resizeMode="cover" />
                          : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
                        }
                        <DurationBadge seconds={video.durationSecs} />
                      </View>
                      <SansText style={styles.recentCreator} numberOfLines={1}>{video.channelTitle}</SansText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.searchRow}>
              <Feather name="search" size={14} color={colors.warmMid} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search creators..."
                placeholderTextColor={colors.warmMid}
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
            onPress={() => navigation.navigate("Channel", {
              channelId:    item.ytChannelId,
              channelTitle: item.title,
              thumbnailUrl: item.thumbnailUrl,
            })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !syncing
            ? searchQuery
              ? <EmptyState icon="☰" title="No matching creators" subtitle="Try a different search." />
              : (
                  <View style={styles.emptyWithBtn}>
                    <SerifText style={styles.emptyWithBtnTitle}>No channels yet</SerifText>
                    <SansText style={styles.emptyWithBtnSub}>Sync your YouTube account to load your subscribed channels.</SansText>
                    <TouchableOpacity style={styles.syncBtn} onPress={handleRefresh} activeOpacity={0.7}>
                      <SansText style={styles.syncBtnText}>Sync</SansText>
                    </TouchableOpacity>
                  </View>
                )
            : null
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Android queue picker modal */}
      {Platform.OS !== "ios" && (
        <QueuePickerModal
          visible={!!pickerVideoId}
          onSelect={(queueId) => { const vid = pickerVideoId; setPickerVideoId(null); doAddVideo(vid, queueId); }}
          onDismiss={() => setPickerVideoId(null)}
        />
      )}

      {/* Watch now (long-press) */}
      {watchNowVideoId && (
        <WatchNowSheet
          visible={!!watchNowVideoId}
          ytVideoId={watchNowVideoId}
          videoTitle={watchNowTitle}
          onClose={closeWatchNow}
        />
      )}

      {/* Channel sheet modal */}
      {selectedChannel && (
        <ChannelSheet
          visible={channelSheetVisible}
          onClose={() => setChannelSheetVisible(false)}
          ytChannelId={selectedChannel.ytChannelId}
          channelTitle={selectedChannel.title}
          channelThumbnailUrl={selectedChannel.thumbnailUrl}
        />
      )}
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function BrowseVideoCard({ video, inQueue, adding, onAdd, onLongPress }: {
  video: BrowseVideo;
  inQueue: boolean;
  adding: boolean;
  onAdd: (id: string) => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const tStyles = useMemo(() => makeTabletStyles(colors), [colors]);
  // Long-press anywhere on the card opens Watch Now — the "+ Add" pill is
  // too small to reliably long-press on iPad, and the card has no tap
  // affordance otherwise, so wrapping the whole thing in a TouchableOpacity
  // with only onLongPress is unambiguous. Tap (onPress) is intentionally
  // omitted so the pill remains the only way to tap-to-add.
  return (
    <TouchableOpacity
      style={tStyles.videoCard}
      onLongPress={inQueue ? undefined : onLongPress}
      delayLongPress={400}
      activeOpacity={1}
    >
      <View style={{ aspectRatio: 16 / 9, position: "relative", overflow: "hidden" }}>
        {video.thumbnailUrl
          ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
        }
        <DurationBadge seconds={video.durationSecs} />
      </View>
      <View style={tStyles.videoCardBody}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SansText style={tStyles.videoCardChannel} numberOfLines={1}>{video.channelTitle}</SansText>
          <SansText style={tStyles.videoCardTitle} numberOfLines={2}>{video.title}</SansText>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <SansText style={tStyles.videoCardMeta}>{timeAgo(video.publishedAt)}</SansText>
          <TouchableOpacity
            style={[tStyles.addBtn, inQueue && tStyles.addBtnAdded]}
            onPress={inQueue ? undefined : () => onAdd(video.ytVideoId)}
            onLongPress={inQueue ? undefined : onLongPress}
            delayLongPress={400}
            disabled={inQueue || adding}
            activeOpacity={0.7}
          >
            <SansText style={[tStyles.addBtnText, inQueue && tStyles.addBtnTextAdded]}>
              {adding ? "..." : inQueue ? "✓" : "+"}
            </SansText>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ChannelRow({ channel, onPress }: { channel: Channel; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makePhoneStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {channel.thumbnailUrl
        ? <Image source={{ uri: channel.thumbnailUrl }} style={styles.avatar} />
        : <View style={styles.avatarFallback}>
            <SansText style={styles.avatarChar}>{channel.title.charAt(0).toUpperCase()}</SansText>
          </View>
      }
      <SansText style={styles.channelName} numberOfLines={1}>{channel.title}</SansText>
      <Feather name="chevron-right" size={20} color={colors.warmMid} />
    </TouchableOpacity>
  );
}

function TabletLoadMoreFooter({ stage, loadingOlder, onLoadOlder }: {
  stage: number;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}) {
  const { colors } = useTheme();
  const tStyles = useMemo(() => makeTabletStyles(colors), [colors]);
  const isExhausted = stage >= 3;
  return (
    <View style={tStyles.footerContainer}>
      {isExhausted ? (
        <SansText style={tStyles.exhaustedText}>No more videos available</SansText>
      ) : (
        <TouchableOpacity
          style={tStyles.loadOlderBtn}
          onPress={onLoadOlder}
          disabled={loadingOlder}
          activeOpacity={0.7}
        >
          <SansText style={tStyles.loadOlderText}>
            {loadingOlder ? "Loading…" : stage === 2 ? "Load all videos" : "Load older videos"}
          </SansText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Tablet styles ──────────────────────────────────────────────
function makeTabletStyles(c: ColorPalette) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    root: { flex: 1, flexDirection: "row" },

    // Channel sidebar
    channelCol: {
      width: CHANNEL_COL_WIDTH,
      borderRightWidth: 1, borderRightColor: c.divider,
      backgroundColor: c.cardBg,
    },
    channelHeader: { padding: Spacing.s12, gap: Spacing.xs },
    channelTitle:  { fontSize: FontSize.md, flex: 1 },
    syncBtn:       { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sansMedium, paddingTop: 2 },
    channelCount:  { fontSize: FontSize.xxs, color: c.warmMid },
    searchRow: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: Spacing.sm, paddingVertical: 7,
      backgroundColor: c.cream, borderRadius: Radius.md,
      borderWidth: 1, borderColor: c.divider, marginTop: 4,
    },
    searchInput:       { flex: 1, fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sans, padding: 0 },
    channelRow:        { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.s12, paddingVertical: Spacing.sm },
    channelRowActive:  { backgroundColor: c.cream },
    channelAvatar:     { width: 28, height: 28, borderRadius: 14 },
    channelName:       { flex: 1, fontSize: FontSize.sm, color: c.warmMid },
    channelNameActive: { color: c.ink, fontFamily: FontFamily.sansMedium },

    // Video grid
    videoCol:       { flex: 1, backgroundColor: c.cream },
    videoColHeader: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.s10 },
    videoColTitle:  { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, color: c.ink },
    gridRow:        { gap: 12, paddingHorizontal: Spacing.md },
    gridContent:    { paddingTop: Spacing.sm, paddingBottom: 40 },
    videoCard: {
      flex: 1,
      backgroundColor: c.cardBg,
      borderRadius: Radius.md,
      borderWidth: 1, borderColor: c.divider,
      overflow: "hidden",
    },
    videoCardBody:    { padding: Spacing.s10 },
    videoCardChannel: { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, fontFamily: FontFamily.sansMedium },
    videoCardTitle:   { fontSize: FontSize.sm, color: c.ink, lineHeight: 18 },
    videoCardMeta:    { fontSize: FontSize.xxs, color: c.queued },
    addBtn:           { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    addBtnAdded:      { backgroundColor: c.green },
    addBtnText:       { fontSize: FontSize.lg, color: c.buttonText, lineHeight: 24, marginTop: -2 },
    addBtnTextAdded:  { color: c.buttonText, fontSize: FontSize.sm, marginTop: 0 },
    footerContainer: { alignItems: "center", paddingVertical: Spacing.lg },
    loadOlderBtn:    { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.accent },
    loadOlderText:   { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    exhaustedText:   { fontSize: FontSize.sm, color: c.warmMid, fontFamily: FontFamily.sansMedium },
  });
}

// ── Phone styles ───────────────────────────────────────────────
function makePhoneStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:            { flex: 1, backgroundColor: c.cream },
    header:               { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    pageTitleRow:         { padding: Spacing.md, paddingBottom: Spacing.sm },
    pageTitle:            { fontSize: FontSize.lg },
    channelCount:         { fontSize: FontSize.xs, color: c.warmMid, paddingHorizontal: Spacing.md, marginTop: 2 },
    recentStrip:          { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
    recentStripHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xs },
    recentStripLabel:     { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium },
    recentStripViewAll:   { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sansMedium },
    recentStripErrorText: { fontSize: FontSize.xs, color: c.warmMid },
    recentCards:          { flexDirection: "row", gap: 8, paddingRight: Spacing.md },
    recentCard:           { width: 106 },
    recentThumb:          { aspectRatio: 16/10, borderRadius: Radius.sm, overflow: "hidden", backgroundColor: c.divider, marginBottom: 4, position: "relative" },
    recentCreator:        { fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    searchRow:            { flexDirection: "row", alignItems: "center", marginHorizontal: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, backgroundColor: c.cardBg, borderRadius: Radius.md, borderWidth: 1, borderColor: c.divider, gap: 8 },
    searchInput:          { flex: 1, fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sans, padding: 0 },
    listContent:          { paddingBottom: 80 },
    separator:            { height: 1, backgroundColor: c.divider, marginLeft: 72 },
    emptyWithBtn:         { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl, gap: Spacing.sm },
    emptyWithBtnTitle:    { fontSize: FontSize.lg, textAlign: "center" },
    emptyWithBtnSub:      { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20 },
    syncBtn:              { marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, backgroundColor: c.accent },
    syncBtnText:          { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    row:                  { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.md },
    avatar:               { width: 44, height: 44, borderRadius: 22, backgroundColor: c.divider },
    avatarFallback:       { width: 44, height: 44, borderRadius: 22, backgroundColor: c.green, alignItems: "center", justifyContent: "center" },
    avatarChar:           { color: c.buttonText, fontSize: FontSize.md, fontFamily: FontFamily.sansMedium },
    channelName:          { flex: 1, fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
  });
}
