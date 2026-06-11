import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { friendlyError } from "../utils/friendlyError";
import { api } from "../services/api";
import { useStore } from "../store";
import { useAddToQueue } from "../hooks/useAddToQueue";
import {
  SansText,
  SerifText,
  Divider,
  ThumbPlaceholder,
  EmptyState,
  ErrorBanner,
  KewLogo,
} from "../components/UI";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { DurationBadge } from "../components/DurationBadge";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { timeAgo } from "../types";
import type { SharedQueue, SharedQueueEntry } from "../types";

const TABLET_MAX_WIDTH = 640;

export default function SharedQueueScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token: string | undefined = route.params?.token;

  const { colors } = useTheme();
  const isTablet = useIsTablet();
  const styles = useMemo(() => makeStyles(colors, isTablet), [colors, isTablet]);

  const user = useStore(s => s.user);
  const queuedVideos = useStore(s => s.queuedVideos);
  const queue = useStore(s => s.queue);
  const signedIn = !!user;

  const {
    handleAdd,
    doAddVideo,
    addingId,
    pickerVideoId,
    setPickerVideoId,
  } = useAddToQueue();

  const [data, setData] = useState<SharedQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const queueEntryByVideoId = useMemo(() => {
    const map: Record<string, true> = {};
    for (const e of queue?.entries ?? []) map[e.video.ytVideoId] = true;
    return map;
  }, [queue]);

  const loadShared = async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const result = await api.getSharedQueue(token);
      setData(result);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.startsWith("404")) setNotFound(true);
      else setLoadError(friendlyError(e, "Couldn't load shared queue."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadShared(); }, [token]);

  const goBackOrHome = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else if (signedIn) navigation.navigate("Tabs");
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={goBackOrHome}
        activeOpacity={0.7}
        style={{ flex: 1 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {navigation.canGoBack() ? (
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <LogoMark size={18} />
            <KewLogo size={FontSize.md} />
          </View>
        )}
      </TouchableOpacity>
      <SerifText style={styles.headerTitle}>Shared queue</SerifText>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        {!signedIn && (
          <TouchableOpacity
            onPress={() => navigation.navigate("Login")}
            activeOpacity={0.7}
          >
            <SansText style={styles.signInLink}>Sign in</SansText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <Divider />
        <View style={styles.centeredFill}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !data) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <Divider />
        <View style={styles.centeredFill}>
          <EmptyState
            icon="▶"
            title="Queue not found"
            subtitle="This queue is no longer available."
          />
        </View>
      </SafeAreaView>
    );
  }

  const sharerName = data.sharerDisplayName ?? "Someone";
  const sharedRelative = timeAgo(data.createdAt);

  const isInQueue = (ytVideoId: string) =>
    !!queuedVideos[ytVideoId] || !!queueEntryByVideoId[ytVideoId];

  const onAddAllPress = async () => {
    for (const entry of data.entries) {
      if (isInQueue(entry.ytVideoId)) continue;
      try {
        await doAddVideo(entry.ytVideoId);
      } catch {
        break;
      }
    }
  };

  const unaddedCount = data.entries.filter(e => !isInQueue(e.ytVideoId)).length;

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <Divider />

      {loadError && (
        <ErrorBanner
          message={loadError}
          onDismiss={() => setLoadError(null)}
          actionLabel="Try again"
          onAction={loadShared}
          actionBusy={loading}
        />
      )}

      <FlatList
        data={data.entries}
        keyExtractor={item => item.ytVideoId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.heroWrap}>
            <View style={styles.heroInner}>
              <SansText style={styles.heroEyebrow}>SHARED QUEUE</SansText>
              <SerifText style={styles.heroTitle}>{sharerName}&rsquo;s queue</SerifText>
              <SansText style={styles.heroMeta}>
                {data.videoCount} video{data.videoCount !== 1 ? "s" : ""}
                {sharedRelative ? ` · shared ${sharedRelative.toLowerCase()}` : ""}
              </SansText>
              {signedIn && unaddedCount > 1 && (
                <TouchableOpacity
                  onPress={onAddAllPress}
                  activeOpacity={0.8}
                  style={styles.addAllBtn}
                  disabled={!!addingId}
                >
                  <SansText style={styles.addAllBtnText}>
                    {addingId ? "Adding…" : `Add all to queue (${unaddedCount})`}
                  </SansText>
                </TouchableOpacity>
              )}
              {!signedIn && (
                <View style={styles.signedOutCta}>
                  <SansText style={styles.signedOutText}>
                    Sign in to add videos to your own queue.
                  </SansText>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Login")}
                    activeOpacity={0.8}
                    style={styles.signedOutBtn}
                  >
                    <SansText style={styles.signedOutBtnText}>Sign in</SansText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <SharedRow
            entry={item}
            index={index}
            inQueue={isInQueue(item.ytVideoId)}
            adding={addingId === item.ytVideoId}
            signedIn={signedIn}
            onAdd={() => handleAdd(item.ytVideoId)}
            onSignIn={() => navigation.navigate("Login")}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
      />

      {Platform.OS !== "ios" && (
        <QueuePickerModal
          visible={!!pickerVideoId}
          onSelect={(queueId) => {
            const vid = pickerVideoId;
            setPickerVideoId(null);
            doAddVideo(vid, queueId);
          }}
          onDismiss={() => setPickerVideoId(null)}
        />
      )}
    </SafeAreaView>
  );
}

function SharedRow({
  entry,
  index,
  inQueue,
  adding,
  signedIn,
  onAdd,
  onSignIn,
}: {
  entry: SharedQueueEntry;
  index: number;
  inQueue: boolean;
  adding: boolean;
  signedIn: boolean;
  onAdd: () => void;
  onSignIn: () => void;
}) {
  const { colors } = useTheme();
  const isTablet = useIsTablet();
  const styles = useMemo(() => makeStyles(colors, isTablet), [colors, isTablet]);
  return (
    <View style={styles.row}>
      <SansText style={styles.rowIndex}>{index + 1}</SansText>
      <View style={styles.rowThumb}>
        {entry.thumbnailUrl ? (
          <Image
            source={{ uri: entry.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <ThumbPlaceholder seed={entry.ytVideoId} style={StyleSheet.absoluteFill} />
        )}
        <DurationBadge seconds={entry.durationSecs} />
      </View>
      <View style={styles.rowInfo}>
        <SansText style={styles.rowChannel} numberOfLines={1}>
          {entry.channelTitle}
        </SansText>
        <SansText style={styles.rowTitle} numberOfLines={2}>
          {entry.title}
        </SansText>
      </View>
      {signedIn ? (
        <TouchableOpacity
          style={[styles.addBtn, inQueue && styles.addBtnAdded]}
          onPress={inQueue ? undefined : onAdd}
          disabled={inQueue || adding}
          activeOpacity={0.7}
        >
          <SansText style={[styles.addBtnText, inQueue && styles.addBtnTextAdded]}>
            {adding ? "..." : inQueue ? "✓" : "+"}
          </SansText>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onSignIn}
          activeOpacity={0.7}
          style={styles.rowSignInBtn}
        >
          <SansText style={styles.rowSignInBtnText}>Sign in</SansText>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(c: ColorPalette, isTablet: boolean) {
  const sidePadding = Spacing.md;
  // Constrain content width on iPad so the row layout stays readable
  // instead of stretching to the full sidebar-less detail width.
  const maxWidth = isTablet ? TABLET_MAX_WIDTH : undefined;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.cream },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: sidePadding,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      fontSize: FontSize.md,
      color: c.ink,
      textAlign: "center",
    },
    signInLink: {
      fontSize: FontSize.sm,
      color: c.accent,
      fontFamily: FontFamily.sansMedium,
    },
    centeredFill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.xl,
    },
    listContent: {
      paddingBottom: Spacing.xl,
      alignItems: isTablet ? "center" : "stretch",
    },
    heroWrap: {
      width: "100%",
      alignItems: "center",
    },
    heroInner: {
      width: "100%",
      maxWidth,
      paddingHorizontal: sidePadding,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    heroEyebrow: {
      fontSize: FontSize.xxs,
      color: c.warmMid,
      letterSpacing: 1,
      fontFamily: FontFamily.sansMedium,
      marginBottom: Spacing.xs,
    },
    heroTitle: {
      fontSize: FontSize.lg,
      color: c.ink,
    },
    heroMeta: {
      fontSize: FontSize.xs,
      color: c.warmMid,
      marginTop: Spacing.xs,
    },
    addAllBtn: {
      alignSelf: "flex-start",
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: c.accent,
    },
    addAllBtnText: {
      color: c.buttonText,
      fontSize: FontSize.sm,
      fontFamily: FontFamily.sansMedium,
    },
    signedOutCta: {
      marginTop: Spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      flexWrap: "wrap",
    },
    signedOutText: {
      fontSize: FontSize.xs,
      color: c.warmMid,
      flexShrink: 1,
    },
    signedOutBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: c.accent,
    },
    signedOutBtnText: {
      color: c.buttonText,
      fontSize: FontSize.sm,
      fontFamily: FontFamily.sansMedium,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: sidePadding,
      paddingVertical: Spacing.s10,
      gap: Spacing.sm,
      width: "100%",
      maxWidth,
    },
    rowIndex: {
      width: 18,
      textAlign: "right",
      fontSize: FontSize.xs,
      color: c.queued,
    },
    rowThumb: {
      width: 88,
      height: 56,
      borderRadius: Radius.sm,
      overflow: "hidden",
      backgroundColor: c.divider,
      flexShrink: 0,
      position: "relative",
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowChannel: {
      fontSize: FontSize.xxs,
      color: c.warmMid,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontFamily: FontFamily.sansMedium,
      marginBottom: 2,
    },
    rowTitle: {
      fontSize: FontSize.sm,
      color: c.ink,
      lineHeight: 18,
    },
    addBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    addBtnAdded: { backgroundColor: c.green },
    addBtnText: {
      fontSize: FontSize.lg,
      color: c.buttonText,
      lineHeight: 24,
      marginTop: -2,
    },
    addBtnTextAdded: { color: c.buttonText, fontSize: FontSize.sm, marginTop: 0 },
    rowSignInBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    rowSignInBtnText: {
      fontSize: FontSize.xs,
      color: c.accent,
      fontFamily: FontFamily.sansMedium,
    },
  });
}
