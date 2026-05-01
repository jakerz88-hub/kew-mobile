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
  onClose: () => void;
  onActionComplete?: () => void;
  onRemoved?: () => void;   // fires after a successful remove, before close
}

export function QueueActionSheet({
  visible,
  entryId,
  videoTitle,
  onClose,
  onActionComplete,
  onRemoved,
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
    setLoading(true);
    setErrorMsg(null);
    try {
      await moveToQueue(entryId, targetQueueId);
      handleClose();
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

              {canMoveToQueue && (
                <TouchableOpacity style={styles.option} onPress={() => setStep("pick-queue")} activeOpacity={0.7}>
                  <SansText style={styles.optionText}>Move to another queue</SansText>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.option, styles.optionDestructive]} onPress={() => setStep("confirm-remove")} activeOpacity={0.7}>
                <SansText style={styles.optionDestructiveText}>Remove from queue</SansText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelOption} onPress={handleClose} activeOpacity={0.7}>
                <SansText style={styles.cancelText}>Cancel</SansText>
              </TouchableOpacity>
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
    option:                { paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: c.cardElevated, alignItems: "center", borderWidth: 1, borderColor: c.divider },
    optionText:            { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    optionDestructive:     { borderColor: `${c.accent}40` },
    optionDestructiveText: { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    cancelOption:          { paddingVertical: Spacing.md, alignItems: "center" },
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
    btnDestructive:        { backgroundColor: c.accent },
    errorMsg:              { fontSize: FontSize.xs, color: c.accent, textAlign: "center", marginTop: Spacing.xs },
  });
}
