import React, { useEffect, useState } from "react";
import {
  View, TouchableOpacity, StyleSheet, Modal, Pressable,
  useWindowDimensions,
} from "react-native";
import { SansText } from "./UI";
import { FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Anchor descriptor for ref-based tooltip positioning.
 *
 * anchorRef  — a ref attached to the target View element
 * placement  — where the bubble appears relative to the target:
 *   "below"  → bubble below, arrow points UP toward element
 *   "above"  → bubble above, arrow points DOWN toward element
 *   "right"  → bubble to the right, arrow points LEFT toward element
 * width      — optional bubble width override (default 260)
 */
export type TooltipAnchor = {
  anchorRef: React.RefObject<View | null>;
  placement: "above" | "below" | "right";
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
const GAP = 10;
const ARROW = 8;
const H_MARGIN = 8; // minimum horizontal margin from screen edge

type ComputedPos = {
  top?: number;
  bottom?: number;
  left: number;
  arrowSide: "top" | "bottom" | "left";
  arrowOffset: number; // distance from bubble left (or top for "left" arrow) to arrow center
};

export default function TooltipOverlay({
  visible, step, totalSteps, body, anchor, onNext, onDismiss,
}: Props) {
  const { colors } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [pos, setPos] = useState<ComputedPos | null>(null);

  const tipWidth = anchor.width ?? 260;

  // Re-measure whenever the tooltip becomes visible or advances to a new step.
  // measureInWindow gives coordinates in the device window frame, independent
  // of any scroll offset or parent transforms.
  useEffect(() => {
    if (!visible) {
      setPos(null);
      return;
    }

    const ref = anchor.anchorRef.current;
    if (!ref) return;

    // Small delay so the anchor element is fully laid out before we measure.
    const timer = setTimeout(() => {
      ref.measureInWindow((x, y, w, h) => {
        const anchorCenterX = x + w / 2;

        // Clamp bubble horizontally so it stays within screen margins.
        const rawLeft = anchorCenterX - tipWidth / 2;
        const left = Math.max(H_MARGIN, Math.min(screenWidth - tipWidth - H_MARGIN, rawLeft));

        // Arrow offset = distance from bubble's left edge to the anchor's
        // horizontal center — keeps the arrow pointing at the element even
        // when the bubble is clamped toward a screen edge.
        const arrowOffset = Math.max(
          ARROW + 4,
          Math.min(tipWidth - ARROW * 3 - 4, anchorCenterX - left - ARROW),
        );

        let computed: ComputedPos;

        if (anchor.placement === "below") {
          // Bubble below the element; arrow at top of bubble pointing UP.
          computed = {
            top: y + h + GAP,
            left,
            arrowSide: "top",
            arrowOffset,
          };
        } else if (anchor.placement === "above") {
          // Bubble above the element; arrow at bottom of bubble pointing DOWN.
          // Use `bottom` so we don't need to know the bubble's own height.
          computed = {
            bottom: screenHeight - y + GAP,
            left,
            arrowSide: "bottom",
            arrowOffset,
          };
        } else {
          // "right" — bubble to the right of the element; arrow on left pointing LEFT.
          // Vertically center the bubble on the anchor element's midpoint;
          // 40px is a reasonable half-height estimate for a short bubble.
          const estHalfHeight = 40;
          const rawTop = y + h / 2 - estHalfHeight;
          const bubbleTop = Math.max(H_MARGIN, Math.min(screenHeight - estHalfHeight * 2 - H_MARGIN, rawTop));
          const verticalCenter = y + h / 2 - bubbleTop;

          computed = {
            top: bubbleTop,
            left: x + w + GAP,
            arrowSide: "left",
            arrowOffset: Math.max(ARROW + 4, verticalCenter - ARROW),
          };
        }

        setPos(computed);
      });
    }, 50);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step]);

  if (!visible) return null;

  const isLast = step === totalSteps - 1;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      {/* Dim backdrop — tapping dismisses the whole journey */}
      <Pressable style={staticStyles.backdrop} onPress={onDismiss} />

      {/* Bubble — only rendered once position is computed to avoid position flash */}
      {pos && (
        <View
          style={[
            staticStyles.bubble,
            {
              backgroundColor: BUBBLE_BG,
              width: tipWidth,
              left: pos.left,
              ...(pos.top    !== undefined ? { top:    pos.top    } : {}),
              ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
            },
          ]}
        >
          {/* ▲ arrow pointing UP — bubble is below the target */}
          {pos.arrowSide === "top" && (
            <View style={[staticStyles.arrowUp, { left: pos.arrowOffset, borderBottomColor: BUBBLE_BG }]} />
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

            <TouchableOpacity
              onPress={onNext}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <SansText style={[staticStyles.gotIt, { color: colors.accent }]}>
                {isLast ? "Done" : "Got it"}
              </SansText>
            </TouchableOpacity>
          </View>

          {/* ▼ arrow pointing DOWN — bubble is above the target */}
          {pos.arrowSide === "bottom" && (
            <View style={[staticStyles.arrowDown, { left: pos.arrowOffset, borderTopColor: BUBBLE_BG }]} />
          )}

          {/* ◀ arrow pointing LEFT — bubble is to the right of the target */}
          {pos.arrowSide === "left" && (
            <View style={[staticStyles.arrowLeft, { top: pos.arrowOffset, borderRightColor: BUBBLE_BG }]} />
          )}
        </View>
      )}
    </Modal>
  );
}

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
  // ◀ points leftward — bubble sits to the right of the target
  arrowLeft: {
    position: "absolute",
    left: -ARROW,
    width: 0,
    height: 0,
    borderTopWidth: ARROW,
    borderBottomWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    // borderRightColor applied inline (matches bubble bg)
  },
});
