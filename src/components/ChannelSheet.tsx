import React, { useEffect, useMemo, useState } from "react";
import { View, Modal, TouchableOpacity, TouchableWithoutFeedback, Alert, Image, StyleSheet, Dimensions } from "react-native";
import { SansText, Divider, ErrorBanner } from "./UI";
import { BottomSheet } from "./BottomSheet";
import { Colors, ColorPalette, FontFamily, FontSize, Spacing, Radius, withAlpha } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { api } from "../services/api";
import Feather from "@expo/vector-icons/Feather";

interface ChannelSheetProps {
  visible: boolean;
  onClose: () => void;
  ytChannelId: string;
  channelTitle: string;
  channelThumbnailUrl?: string;
}

interface ChannelData {
  ytChannelId: string;
  title: string;
  thumbnailUrl: string | null;
  description: string;
  recentVideos: {
    ytVideoId: string;
    title: string;
    thumbnailUrl: string | null;
    publishedAt: string | null;
    durationSecs: number | null;
  }[];
}

export function ChannelSheet({
  visible,
  onClose,
  ytChannelId,
  channelTitle,
  channelThumbnailUrl,
}: ChannelSheetProps) {
  const { colors } = useTheme();
  const isTablet = useIsTablet();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Array<{ subscriptionId: string; ytChannelId: string }>>([]);
  const [expandedAbout, setExpandedAbout] = useState(false);

  useEffect(() => {
    if (!visible) return;
    loadData();
  }, [visible]);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [channelRes, channelsRes] = await Promise.all([
        api.getChannel(ytChannelId),
        api.listChannels(),
      ]);
      setChannelData(channelRes);
      setSubscriptions(
        channelsRes.map((ch) => ({
          subscriptionId: ch.subscriptionId || "",
          ytChannelId: ch.ytChannelId,
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to load channel");
    } finally {
      setIsLoading(false);
    }
  }

  const subscription = subscriptions.find((s) => s.ytChannelId === ytChannelId);
  const isSubscribed = !!subscription && !!subscription.subscriptionId;
  const subscriptionId = subscription?.subscriptionId;

  async function handleSubscribe() {
    setIsSubscribing(true);
    try {
      const result = await api.subscribeChannel(ytChannelId);
      setSubscriptions((prev) => [
        ...prev,
        { subscriptionId: result.subscriptionId, ytChannelId },
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to subscribe");
    } finally {
      setIsSubscribing(false);
    }
  }

  async function handleUnsubscribe() {
    Alert.alert("Unsubscribe", `Remove ${channelTitle} from your subscriptions?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unsubscribe",
        style: "destructive",
        onPress: async () => {
          if (!subscriptionId) return;
          setIsSubscribing(true);
          try {
            await api.unsubscribeChannel(subscriptionId);
            setSubscriptions((prev) =>
              prev.filter((s) => s.ytChannelId !== ytChannelId)
            );
          } catch (e: any) {
            setError(e?.message || "Failed to unsubscribe");
          } finally {
            setIsSubscribing(false);
          }
        },
      },
    ]);
  }

  // The actual channel content — no outer sheet wrapper, no handle, no close
  // button. Each render path (iPad centered card vs phone BottomSheet) is
  // responsible for its own chrome.
  const body = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          {channelThumbnailUrl ? (
            <Image
              source={{ uri: channelThumbnailUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <SansText style={styles.avatarInitial}>
              {channelTitle.charAt(0).toUpperCase()}
            </SansText>
          )}
        </View>
        <View style={styles.headerText}>
          <SansText style={styles.channelTitle}>{channelTitle}</SansText>
          <SansText style={styles.channelMeta}>
            {isLoading ? "Loading..." : "Channel"}
          </SansText>
        </View>
      </View>

      <Divider />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {isLoading ? (
        <>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { marginTop: Spacing.sm }]} />
          <View style={[styles.skeletonLine, { marginTop: Spacing.sm, width: "60%" }]} />
        </>
      ) : channelData ? (
        <>
          <View style={styles.aboutSection}>
            <SansText
              style={styles.aboutText}
              numberOfLines={expandedAbout ? undefined : 3}
            >
              {channelData.description}
            </SansText>
            {!expandedAbout && (
              <TouchableOpacity onPress={() => setExpandedAbout(true)}>
                <SansText style={styles.moreText}>more</SansText>
              </TouchableOpacity>
            )}
          </View>
          <Divider />

          <SansText style={styles.videoLabel}>RECENT VIDEOS</SansText>

          <View style={styles.thumbnailStrip}>
            {channelData.recentVideos.slice(0, 3).map((video) => (
              <View key={video.ytVideoId} style={styles.thumbnailCell}>
                <View style={styles.thumbnailContainer}>
                  {video.thumbnailUrl ? (
                    <Image
                      source={{ uri: video.thumbnailUrl }}
                      style={styles.thumbnail}
                    />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
                  )}
                </View>
                <SansText
                  style={styles.videoTitle}
                  numberOfLines={2}
                >
                  {video.title}
                </SansText>
                {video.publishedAt && (
                  <SansText style={styles.videoDate}>
                    {new Date(video.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </SansText>
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}

      <TouchableOpacity
        style={[
          styles.subscribeButton,
          isSubscribed ? styles.subscribedButton : styles.unsubscribedButton,
          isSubscribing && styles.loadingButton,
        ]}
        onPress={isSubscribed ? handleUnsubscribe : handleSubscribe}
        disabled={isSubscribing}
        activeOpacity={0.8}
      >
        <SansText
          style={[
            styles.subscribeButtonText,
            isSubscribed
              ? styles.subscribedButtonText
              : styles.unsubscribedButtonText,
          ]}
        >
          {isSubscribing
            ? "..."
            : isSubscribed
              ? "Subscribed ✓"
              : "Subscribe"}
        </SansText>
      </TouchableOpacity>
    </>
  );

  // iPad: centered modal card. Not a bottom sheet — left as inline Modal +
  // centered View pattern, outside the BottomSheet primitive's scope.
  if (isTablet) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.tabletOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.tabletCard}>
                <View style={[styles.sheet, styles.sheetTablet]}>
                  <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Feather name="x" size={20} color={colors.queued} />
                  </TouchableOpacity>
                  {body}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // Phone: standard bottom sheet via shared primitive.
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAvoiding={false}
    >
      {body}
    </BottomSheet>
  );
}

function makeStyles(c: ColorPalette) {
  const { height } = Dimensions.get("window");
  return StyleSheet.create({
    tabletOverlay: {
      flex: 1,
      backgroundColor: withAlpha(Colors.ink, 0.5),
      justifyContent: "center",
      alignItems: "center",
    },
    // Inner sheet wrapper. Phone path now delegates this to BottomSheet's
    // defaults (paddingHorizontal/Top/Bottom and Radius.lg top corners all
    // match). iPad path still references it via sheetTablet override.
    sheet: {
      backgroundColor: c.cardBg,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.s10,
      paddingBottom: Spacing.xl,
      maxHeight: height * 0.85,
    },
    sheetTablet: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderRadius: Radius.lg,
      paddingTop: Spacing.lg,
    },
    tabletCard: {
      width: 360,
      maxHeight: height * 0.8,
      borderRadius: Radius.lg,
      backgroundColor: c.cardBg,
      overflow: "hidden",
    },
    closeButton: {
      position: "absolute",
      top: Spacing.md,
      right: Spacing.md,
      zIndex: 10,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.green,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarInitial: {
      fontSize: FontSize.lg,
      color: c.buttonText,
      fontFamily: FontFamily.sansMedium,
    },
    headerText: {
      flex: 1,
    },
    channelTitle: {
      fontSize: FontSize.md,
      color: c.ink,
      fontFamily: FontFamily.sansMedium,
    },
    channelMeta: {
      fontSize: FontSize.xs,
      color: c.warmMid,
      marginTop: Spacing.xs,
    },
    aboutSection: {
      paddingVertical: Spacing.md,
    },
    aboutText: {
      fontSize: FontSize.sm,
      color: c.warmMid,
      lineHeight: 18,
    },
    moreText: {
      fontSize: FontSize.xs,
      color: c.accent,
      marginTop: Spacing.xs,
      fontFamily: FontFamily.sansMedium,
    },
    videoLabel: {
      fontSize: FontSize.xxs,
      color: c.queued,
      fontFamily: FontFamily.sansMedium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    thumbnailStrip: {
      flexDirection: "row",
      gap: Spacing.md,
      marginVertical: Spacing.md,
    },
    thumbnailCell: {
      flex: 1,
    },
    thumbnailContainer: {
      width: "100%",
      aspectRatio: "16/9",
      borderRadius: Radius.sm,
      overflow: "hidden",
      marginBottom: Spacing.xs,
    },
    thumbnail: {
      width: "100%",
      height: "100%",
    },
    thumbnailPlaceholder: {
      backgroundColor: c.divider,
    },
    videoTitle: {
      fontSize: FontSize.xxs,
      color: c.ink,
      numberOfLines: 2,
      marginBottom: Spacing.xs,
    },
    videoDate: {
      fontSize: FontSize.xxs,
      color: c.queued,
    },
    skeletonLine: {
      height: 12,
      backgroundColor: c.divider,
      borderRadius: 4,
      marginTop: Spacing.md,
    },
    subscribeButton: {
      width: 160,
      paddingVertical: Spacing.s14,
      borderRadius: Radius.pill,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginTop: Spacing.lg,
    },
    unsubscribedButton: {
      backgroundColor: c.accent,
    },
    subscribedButton: {
      borderWidth: 1.5,
      borderColor: c.green,
      backgroundColor: "transparent",
    },
    loadingButton: {
      opacity: 0.4,
    },
    subscribeButtonText: {
      fontSize: FontSize.sm,
      fontFamily: FontFamily.sansMedium,
    },
    unsubscribedButtonText: {
      color: c.buttonText,
    },
    subscribedButtonText: {
      color: c.green,
    },
  });
}
