import React, { useState } from "react";
import { Modal, View, TouchableOpacity, StyleSheet } from "react-native";
import { useStore } from "../store";
import { SansText, SerifText } from "./UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";

type Step = "options" | "confirm-remove" | "confirm-move";

interface Props {
  visible: boolean;
  entryId: string;
  videoTitle: string;
  showMoveToEnd?: boolean;  // false in Browse context (no skip-style move)
  onClose: () => void;
  onActionComplete?: () => void;
}

export function QueueActionSheet({
  visible,
  entryId,
  videoTitle,
  showMoveToEnd = true,
  onClose,
  onActionComplete,
}: Props) {
  const { removeFromQueue, moveToEnd } = useStore();
  const [step, setStep]       = useState<Step>("options");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    setStep("options");
    setErrorMsg(null);
    onClose();
  };

  const handleAction = async (action: "remove" | "move") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (action === "remove") await removeFromQueue(entryId);
      else await moveToEnd(entryId);
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

          {step === "options" ? (
            <>
              <SansText style={styles.videoTitle} numberOfLines={2}>{videoTitle}</SansText>

              {showMoveToEnd && (
                <TouchableOpacity style={styles.option} onPress={() => setStep("confirm-move")} activeOpacity={0.7}>
                  <SansText style={styles.optionText}>Move to end of queue</SansText>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.option, styles.optionDestructive]} onPress={() => setStep("confirm-remove")} activeOpacity={0.7}>
                <SansText style={styles.optionDestructiveText}>Remove from queue</SansText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelOption} onPress={handleClose} activeOpacity={0.7}>
                <SansText style={styles.cancelText}>Cancel</SansText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <SerifText style={styles.confirmTitle}>
                {step === "confirm-remove" ? "Remove from queue?" : "Move to end of queue?"}
              </SerifText>
              <SansText style={styles.confirmBody} numberOfLines={3}>"{videoTitle}"</SansText>

              {errorMsg && (
                <SansText style={styles.errorMsg}>{errorMsg}</SansText>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setStep("options")} activeOpacity={0.7}>
                  <SansText style={styles.btnCancelText}>Go back</SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, step === "confirm-remove" ? styles.btnDestructive : styles.btnConfirm]}
                  onPress={() => handleAction(step === "confirm-remove" ? "remove" : "move")}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <SansText style={styles.btnConfirmText}>
                    {loading ? "…" : step === "confirm-remove" ? "Remove" : "Move to end"}
                  </SansText>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:             { flex: 1, backgroundColor: "rgba(26,23,20,0.5)", justifyContent: "flex-end" },
  sheet:               { backgroundColor: Colors.cream, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.xl },
  videoTitle:          { fontSize: FontSize.xs, color: Colors.warmMid, textAlign: "center", marginBottom: Spacing.xs },
  option:              { paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.cardBg, alignItems: "center", borderWidth: 1, borderColor: Colors.divider },
  optionText:          { fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansMedium },
  optionDestructive:   { borderColor: `${Colors.accent}40` },
  optionDestructiveText: { fontSize: FontSize.sm, color: Colors.accent, fontFamily: FontFamily.sansMedium },
  cancelOption:        { paddingVertical: Spacing.md, alignItems: "center" },
  cancelText:          { fontSize: FontSize.sm, color: Colors.warmMid },
  confirmTitle:        { fontSize: FontSize.lg, textAlign: "center" },
  confirmBody:         { fontSize: FontSize.sm, color: Colors.warmMid, textAlign: "center", lineHeight: 20 },
  btnRow:              { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  btn:                 { flex: 1, height: 48, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  btnCancel:           { backgroundColor: Colors.divider },
  btnCancelText:       { fontSize: FontSize.sm, color: Colors.ink },
  btnConfirm:          { backgroundColor: Colors.ink },
  btnConfirmText:      { fontSize: FontSize.sm, color: Colors.cream, fontFamily: FontFamily.sansMedium },
  btnDestructive:      { backgroundColor: Colors.accent },
  errorMsg:            { fontSize: FontSize.xs, color: Colors.accent, textAlign: "center", marginTop: Spacing.xs },
});
