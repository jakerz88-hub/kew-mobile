import React from "react";
import {
  View, TouchableOpacity, StyleSheet, Modal, Pressable,
} from "react-native";
import { SansText } from "./UI";
import { FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

export type TooltipAnchor = {
  /** Which edge of the tooltip the arrow points away from */
  arrowSide: "top" | "bottom";
  /** Arrow horizontal offset from tooltip left edge */
  arrowOffset?: number;
  /** Tooltip top position (absolute, within SafeAreaView) */
  top: number;
  /** Tooltip left position */
  left?: number;
  /** Tooltip right position (alternative to left) */
  right?: number;
  /** Optional width override; defaults to 260 */
  width?: number;
};

type Props = {
  visible: boolean;
  step: number;
  totalSteps: number;
  body: string;
  anchor: TooltipAnchor;
  onNext: () => void;
  onDismiss: () => void;
};

// Tooltip bubble is intentionally always dark (floating overlay, like Toast)
const BUBBLE_BG   = "#1A1714";
const BUBBLE_TEXT = "#F5F0E8";

export default function TooltipOverlay({
  visible, step, totalSteps, body, anchor, onNext, onDismiss,
}: Props) {
  const { colors } = useTheme();

  if (!visible) return null;

  const isLast   = step === totalSteps - 1;
  const tipWidth = anchor.width ?? 260;
  const arrowOff = anchor.arrowOffset ?? 20;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      {/* Dim backdrop — tapping it dismisses the whole journey */}
      <Pressable style={staticStyles.backdrop} onPress={onDismiss} />

      <View
        style={[
          staticStyles.bubble,
          {
            backgroundColor: BUBBLE_BG,
            top:   anchor.top,
            width: tipWidth,
            ...(anchor.left  !== undefined ? { left:  anchor.left  } : {}),
            ...(anchor.right !== undefined ? { right: anchor.right } : {}),
          },
        ]}
      >
        {/* Arrow pointing UP (bubble is below the target) */}
        {anchor.arrowSide === "top" && (
          <View style={[staticStyles.arrowUp, { left: arrowOff, borderBottomColor: BUBBLE_BG }]} />
        )}

        <SansText style={[staticStyles.body, { color: BUBBLE_TEXT }]}>{body}</SansText>

        <View style={staticStyles.footer}>
          {/* Step dots */}
          <View style={staticStyles.dots}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  staticStyles.dot,
                  i === step && { backgroundColor: colors.accent },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity onPress={onNext} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <SansText style={[staticStyles.gotIt, { color: colors.accent }]}>
              {isLast ? "Done" : "Got it"}
            </SansText>
          </TouchableOpacity>
        </View>

        {/* Arrow pointing DOWN (bubble is above the target) */}
        {anchor.arrowSide === "bottom" && (
          <View style={[staticStyles.arrowDown, { left: arrowOff, borderTopColor: BUBBLE_BG }]} />
        )}
      </View>
    </Modal>
  );
}

const ARROW = 8;

// ── Static styles (layout only — colors applied inline) ───────────────────────
const staticStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,23,20,0.45)",
  },
  bubble: {
    position: "absolute",
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  body: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(245,240,232,0.25)",
  },
  gotIt: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansMedium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // ▲ points upward — bubble sits below the target
  arrowUp: {
    position: "absolute",
    top: -ARROW,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderBottomWidth: ARROW,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    // borderBottomColor applied inline (matches bubble bg)
  },
  // ▼ points downward — bubble sits above the target
  arrowDown: {
    position: "absolute",
    bottom: -ARROW,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopWidth: ARROW,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    // borderTopColor applied inline (matches bubble bg)
  },
});
