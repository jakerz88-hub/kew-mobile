import React, { useState, useMemo } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { SansText, SerifText, EmptyState } from "./UI";
import { BottomSheet } from "./BottomSheet";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { useTabletSwitchTab } from "../contexts/TabletSidebarContext";

type Step = "options" | "confirm-remove" | "pick-queue";

interface Props {
  visible: boolean;
  entryId: string;
  videoTitle: string;
  // Name of the queue the entry lives in. When provided AND the user is pro,
  // shown as muted subtitle ("In your {queueName} queue") so the user knows
  // which queue they're acting on — important for non-active-queue removes
  // initiated from Browse / Channel / etc. Hidden for free users (one queue).
  queueName?: string | null;
  onClose: () => void;
  onActionComplete?: () => void;
  onRemoved?: () => void;   // fires after a successful remove, before close
  onMoved?: (targetQueueName: string) => void; // fires after a successful move
}

export function QueueActionSheet({
  visible,
  entryId,
  videoTitle,
  queueName,
  onClose,
  onActionComplete,
  onRemoved,
  onMoved,
}: Props) {
  const { colors } = useTheme();
  const { removeFromQueue, moveToQueue, queues, activeQueueId, user, watchNow, setPendingToast } = useStore();
  const navigation = useNavigation<any>();
  const isTablet = useIsTablet();
  const switchTab = useTabletSwitchTab();
  const [step, setStep]             = useState<Step>("options");
  const [loading, setLoading]       = useState(false);
  const [movingToId, setMovingToId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [watchNowLoading, setWatchNowLoading] = useState(false);

  const skipsRemaining = user?.skipsRemaining ?? 0;
  const canWatchNow = skipsRemaining > 0;

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Queues the user can move this entry to (all except the current active one)
  const moveTargets = queues.filter(q => q.id !== activeQueueId);
  const canMoveToQueue = user?.plan === "pro" && moveTargets.length > 0;

  const handleClose = () => {
    setStep("options");
    setErrorMsg(null);
    setMovingToId(null);
    setWatchNowLoading(false);
    onClose();
  };

  const handleWatchNow = async () => {
    if (!canWatchNow || watchNowLoading) return;
    setWatchNowLoading(true);
    setErrorMsg(null);
    try {
      const { queueSwitched } = await watchNow(undefined, entryId);
      handleClose();
      onActionComplete?.();
      if (queueSwitched) setPendingToast("Switched to your main queue.");
      // Phone → Player; iPad → switch internal tab to Queue (split-view
      // player picks it up). TabletNavigator owns iPad tabs via internal
      // state, so React Navigation routes don't reach them.
      if (isTablet && switchTab) {
        switchTab("Queue");
        if (navigation.canGoBack()) navigation.goBack();
      } else {
        navigation.navigate("Player");
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setWatchNowLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await removeFromQueue(entryId);
      onRemoved?.();
      handleClose();
      onActionComplete?.();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToQueue = async (targetQueueId: string) => {
    const targetQueue = moveTargets.find(q => q.id === targetQueueId);
    setLoading(true);
    setMovingToId(targetQueueId);
    setErrorMsg(null);
    try {
      await moveToQueue(entryId, targetQueueId);
      handleClose();
      onMoved?.(targetQueue?.name ?? "queue");
      onActionComplete?.();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setMovingToId(null);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      handle={false}
      keyboardAvoiding={false}
      contentStyle={styles.content}
    >
      {step === "options" && (
        <>
          <SansText style={styles.videoTitle} numberOfLines={2}>{videoTitle}</SansText>
          {user?.plan === "pro" && queueName && (
            <SansText style={styles.queueSubtitle}>In your {queueName} queue</SansText>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnWatchNow, !canWatchNow && styles.btnWatchNowDisabled]}
            onPress={handleWatchNow}
            disabled={!canWatchNow || watchNowLoading}
            activeOpacity={0.7}
          >
            {watchNowLoading ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <SansText style={styles.btnWatchNowText}>
                {canWatchNow ? "Watch now" : "No skips remaining"}
              </SansText>
            )}
          </TouchableOpacity>

          <View style={styles.btnRow}>
            {canMoveToQueue ? (
              <TouchableOpacity style={[styles.btn, styles.btnMoveEntry]} onPress={() => setStep("pick-queue")} activeOpacity={0.7}>
                <SansText style={styles.btnMoveEntryText}>Move to another queue</SansText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleClose} activeOpacity={0.7}>
                <SansText style={styles.btnCancelText}>Cancel</SansText>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnRemoveEntry]} onPress={() => setStep("confirm-remove")} activeOpacity={0.7}>
              <SansText style={styles.btnRemoveEntryText}>Remove</SansText>
            </TouchableOpacity>
          </View>

          {canMoveToQueue && (
            <TouchableOpacity style={styles.cancelOption} onPress={handleClose} activeOpacity={0.7}>
              <SansText style={styles.cancelText}>Cancel</SansText>
            </TouchableOpacity>
          )}
        </>
      )}

      {step === "confirm-remove" && (
        <>
          <SerifText style={styles.confirmTitle}>Remove from queue?</SerifText>
          <SansText style={styles.confirmBody} numberOfLines={3}>"{videoTitle}"</SansText>

          {errorMsg && (
            <SansText style={styles.errorMsg}>{errorMsg}</SansText>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setStep("options")} activeOpacity={0.7}>
              <SansText style={styles.btnCancelText}>Cancel</SansText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnDestructive]}
              onPress={handleRemove}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.cream} />
              ) : (
                <SansText style={styles.btnConfirmText}>Remove</SansText>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {step === "pick-queue" && (
        <>
          <SerifText style={styles.confirmTitle}>Move to queue</SerifText>
          <SansText style={styles.pickSubtitle} numberOfLines={2}>"{videoTitle}"</SansText>

          {errorMsg && (
            <SansText style={styles.errorMsg}>{errorMsg}</SansText>
          )}

          {moveTargets.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="☰"
                title="No other queues"
                subtitle="Create another queue to move videos between them."
              />
            </View>
          ) : (
            <ScrollView style={styles.queueList} bounces={false}>
              {moveTargets.map(q => (
                <TouchableOpacity
                  key={q.id}
                  style={styles.queueRow}
                  onPress={() => handleMoveToQueue(q.id)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={styles.queueIconSlot}>
                    {movingToId === q.id ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <SansText style={styles.queueEmoji}>{q.emoji ?? "☰"}</SansText>
                    )}
                  </View>
                  <SansText style={styles.queueName}>{q.name}</SansText>
                  <SansText style={styles.queueCount}>{q.videoCount}</SansText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.cancelOption} onPress={() => setStep("options")} activeOpacity={0.7}>
            <SansText style={styles.cancelText}>Cancel</SansText>
          </TouchableOpacity>
        </>
      )}
    </BottomSheet>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    // Override BottomSheet's default content padding. Pre-migration the sheet
    // used `padding: Spacing.lg` (24 on all sides) + `gap: Spacing.sm` and
    // had no drag handle. BottomSheet defaults give the right horizontal /
    // bottom padding already; we restore the larger top inset (since no
    // handle takes up that space) and the inter-child gap.
    content:               { paddingTop: Spacing.lg, gap: Spacing.sm },
    videoTitle:            { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center", marginBottom: Spacing.xs },
    queueSubtitle:         { fontSize: FontSize.xxs, color: c.queued, textAlign: "center", marginTop: -Spacing.xs, marginBottom: Spacing.xs },
    cancelOption:          { paddingVertical: Spacing.md, alignItems: "center" },
    btnMoveEntry:          { backgroundColor: "transparent", borderWidth: 1, borderColor: c.accent },
    btnMoveEntryText:      { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    btnRemoveEntry:        { backgroundColor: "transparent", borderWidth: 1, borderColor: c.divider },
    btnRemoveEntryText:    { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    cancelText:            { fontSize: FontSize.sm, color: c.warmMid },
    confirmTitle:          { fontSize: FontSize.lg, textAlign: "center" },
    confirmBody:           { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20 },
    pickSubtitle:          { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center", lineHeight: 18 },
    queueList:             { maxHeight: 220 },
    emptyWrap:             { minHeight: 140, justifyContent: "center" },
    queueRow:              { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: c.divider, backgroundColor: c.cardElevated, marginBottom: Spacing.xs },
    queueIconSlot:         { width: 24, alignItems: "center" },
    queueEmoji:            { fontSize: FontSize.md, color: c.ink, textAlign: "center" },
    queueName:             { flex: 1, fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    queueCount:            { fontSize: FontSize.xs, color: c.warmMid },
    btnRow:                { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    btn:                   { flex: 1, height: 48, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    btnWatchNow:           { backgroundColor: c.accent, flex: undefined, width: "100%", marginTop: Spacing.xs },
    btnWatchNowDisabled:   { opacity: 0.4 },
    btnWatchNowText:       { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    btnCancel:             { backgroundColor: c.divider },
    btnCancelText:         { fontSize: FontSize.sm, color: c.ink },
    btnConfirmText:        { fontSize: FontSize.sm, color: c.cream, fontFamily: FontFamily.sansMedium },
    btnDestructive:        { backgroundColor: c.ink },
    errorMsg:              { fontSize: FontSize.xs, color: c.accent, textAlign: "center", marginTop: Spacing.xs },
  });
}
