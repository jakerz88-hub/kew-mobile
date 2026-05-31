import React, { useState } from "react";
import { TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SansText } from "./UI";
import { BottomSheet } from "./BottomSheet";
import { useStore } from "../store";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { useTabletSwitchTab } from "../contexts/TabletSidebarContext";
import { FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import type { ColorPalette } from "../types/theme";
import { handleQueueLimitReached } from "../utils/kewPlusUpsell";

interface Props {
  visible: boolean;
  ytVideoId: string;
  videoTitle: string;
  onClose: () => void;
}

export function WatchNowSheet({ visible, ytVideoId, videoTitle, onClose }: Props) {
  const { colors } = useTheme();
  const { user, watchNow, setPendingToast } = useStore();
  const navigation = useNavigation<any>();
  const isTablet = useIsTablet();
  const switchTab = useTabletSwitchTab();
  const [loading, setLoading] = useState(false);

  const skipsRemaining = user?.skipsRemaining ?? 0;
  const canWatch = skipsRemaining > 0;

  const handleWatchNow = async () => {
    if (!canWatch || loading) return;
    setLoading(true);
    try {
      const { queueSwitched } = await watchNow(ytVideoId);
      onClose();
      if (queueSwitched) setPendingToast("Switched to your main queue.");
      // iPad's now-playing surface is QueueScreen split-view (per the
      // iPad Player Surface invariant). The TabletNavigator switches tabs
      // via internal state, not React Navigation routes — so use switchTab
      // when available; on phone, navigate to the Player stack screen.
      if (isTablet && switchTab) {
        switchTab("Queue");
        // From a Stack screen layered over the tablet shell (e.g. Channel,
        // RecentUploads), goBack pops back to the TabletNavigator so the
        // freshly-active Queue tab is visible.
        if (navigation.canGoBack()) navigation.goBack();
      } else {
        navigation.navigate("Player");
      }
    } catch (e: any) {
      if (e?.code === "queue_limit_reached") {
        onClose();
        await handleQueueLimitReached();
      }
      // Other errors: store surfaces the banner.
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);
  const skipLabel = `${skipsRemaining} skip${skipsRemaining !== 1 ? "s" : ""} remaining`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAvoiding={false}
      contentStyle={styles.content}
    >
      <SansText style={styles.title} numberOfLines={2}>{videoTitle}</SansText>
      <TouchableOpacity
        style={[styles.btn, !canWatch && styles.btnDisabled]}
        onPress={handleWatchNow}
        disabled={!canWatch || loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.buttonText} />
        ) : (
          <SansText style={styles.btnText}>
            {canWatch ? `Watch now · ${skipLabel}` : "No skips remaining"}
          </SansText>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelRow} onPress={onClose} activeOpacity={0.7}>
        <SansText style={styles.cancelText}>Cancel</SansText>
      </TouchableOpacity>
    </BottomSheet>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    content:     { paddingTop: Spacing.lg, gap: Spacing.sm },
    title:       { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center", marginBottom: Spacing.xs },
    btn:         { height: 48, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.accent },
    btnDisabled: { opacity: 0.4 },
    btnText:     { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    cancelRow:   { paddingVertical: Spacing.md, alignItems: "center" },
    cancelText:  { fontSize: FontSize.sm, color: c.warmMid },
  });
}
