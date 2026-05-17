import React, { useState, useMemo } from "react";
import { Modal, View, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useStore } from "../store";
import { SansText, SerifText } from "./UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

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
  const { removeFromQueue, moveToQueue, queues, activeQueueId, user } = useStore();
  const [step, setStep]         = useState<Step>("options");
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Queues the user can move this entry to (all except the current active one)
  const moveTargets = queues.filter(q => q.id !== activeQueueId);
  const canMoveToQueue = user?.plan === "pro" && moveTargets.length > 0;

  const handleClose = () => {
    setStep("options");
    setErrorMsg(null);
    onClose();
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
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>

          {step === "options" && (
            <>
              <SansText style={styles.videoTitle} numberOfLines={2}>{videoTitle}</SansText>
              {user?.plan === "pro" && queueName && (
                <SansText style={styles.queueSubtitle}>In your {queueName} queue</SansText>
              )}

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
                  <SansText style={styles.btnCancelText}>Go back</SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnDestructive]}
                  onPress={handleRemove}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <SansText style={styles.btnConfirmText}>
                    {loading ? "…" : "Remove"}
                  </SansText>
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

              <ScrollView style={styles.queueList} bounces={false}>
                {moveTargets.map(q => (
                  <TouchableOpacity
                    key={q.id}
                    style={styles.queueRow}
                    onPress={() => handleMoveToQueue(q.id)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {q.emoji ? (
                      <SansText style={styles.queueEmoji}>{q.emoji}</SansText>
                    ) : (
                      <SansText style={styles.queueEmoji}>☰</SansText>
                    )}
                    <SansText style={styles.queueName}>{q.name}</SansText>
                    <SansText style={styles.queueCount}>{q.videoCount}</SansText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.cancelOption} onPress={() => setStep("options")} activeOpacity={0.7}>
                <SansText style={styles.cancelText}>Go back</SansText>
              </TouchableOpacity>
            </>
          )}

        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    overlay:               { flex: 1, backgroundColor: "rgba(26,23,20,0.5)", justifyContent: "flex-end" },
    sheet:                 { backgroundColor: c.cardBg, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xl },
    videoTitle:            { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center", marginBottom: Spacing.xs },
    queueSubtitle:         { fontSize: FontSize.xxs, color: c.queued, textAlign: "center", marginTop: -Spacing.xs, marginBottom: Spacing.xs },
    cancelOption:          { paddingVertical: Spacing.md, alignItems: "center" },
    btnMoveEntry:          { backgroundColor: "transparent", borderWidth: 1, borderColor: c.accent },
    btnMoveEntryText:      { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    btnRemoveEntry:        { backgroundColor: "transparent", borderWidth: 1, borderColor: `${c.accent}60` },
    btnRemoveEntryText:    { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    cancelText:            { fontSize: FontSize.sm, color: c.warmMid },
    confirmTitle:          { fontSize: FontSize.lg, textAlign: "center" },
    confirmBody:           { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20 },
    pickSubtitle:          { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center", lineHeight: 18 },
    queueList:             { maxHeight: 220 },
    queueRow:              { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: c.divider, backgroundColor: c.cardElevated, marginBottom: Spacing.xs },
    queueEmoji:            { fontSize: FontSize.md, width: 24, textAlign: "center" },
    queueName:             { flex: 1, fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    queueCount:            { fontSize: FontSize.xs, color: c.warmMid },
    btnRow:                { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    btn:                   { flex: 1, height: 48, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    btnCancel:             { backgroundColor: c.divider },
    btnCancelText:         { fontSize: FontSize.sm, color: c.ink },
    btnConfirmText:        { fontSize: FontSize.sm, color: c.cream, fontFamily: FontFamily.sansMedium },
    btnDestructive:        { backgroundColor: c.ink },
    errorMsg:              { fontSize: FontSize.xs, color: c.accent, textAlign: "center", marginTop: Spacing.xs },
  });
}
