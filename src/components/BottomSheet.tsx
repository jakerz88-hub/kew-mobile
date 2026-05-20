import React, { useEffect, useRef, useState } from "react";
import {
  View, Modal, Animated, TouchableWithoutFeedback, KeyboardAvoidingView,
  Easing, Platform, StyleSheet, ViewStyle, useWindowDimensions, PanResponder,
} from "react-native";
import { Colors, Radius, Spacing } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

const SHEET_ANIM_IN_MS    = 280;
const SHEET_ANIM_OUT_MS   = 220;
const SHEET_SNAP_BACK_MS  = 200;
const SCRIM_OPACITY       = 0.5;
const SHEET_EASING        = Easing.bezier(0.32, 0.72, 0, 1);

// Drag-to-dismiss thresholds. If a release passes EITHER condition, the sheet
// completes the slide-out and fires onClose. Otherwise it snaps back to fully
// open. Mirrors iOS native sheet behavior.
const DISMISS_DISTANCE_PCT = 0.3; // ≥30% of sheet height dragged down
const DISMISS_VELOCITY     = 0.5; // dp/ms flick downward

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  handle?: boolean;
  /** Spacing below the drag handle. Tight (4) for input-bearing sheets
   *  whose first child has its own paddingTop; default (Spacing.md) for
   *  simple sheets that need breathing room before the content. */
  handleMarginBottom?: number;
  keyboardAvoiding?: boolean;
  maxHeightPct?: number;
  contentStyle?: ViewStyle;
  /** Extra nodes rendered as siblings of the sheet, inside the Modal.
   *  Use for absolutely-positioned overlays (e.g. Toast) that need the
   *  Modal's screen-relative coordinate space. */
  overlayChildren?: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  handle = true,
  handleMarginBottom = Spacing.md,
  keyboardAvoiding = true,
  maxHeightPct = 0.85,
  contentStyle,
  overlayChildren,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(0);
  const translateY      = useRef(new Animated.Value(visible ? 0 : 1)).current;
  const scrimOpacity    = useRef(new Animated.Value(visible ? SCRIM_OPACITY : 0)).current;
  // Latest sheet height captured via onLayout, mirrored into a ref so the
  // PanResponder closure (created once with useRef) always sees the current
  // value without needing to re-create the responder on every render.
  const sheetHeightRef  = useRef(0);
  sheetHeightRef.current = sheetHeight;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(1);
      scrimOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: SHEET_ANIM_IN_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: SCRIM_OPACITY,
          duration: SHEET_ANIM_IN_MS,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 1,
          duration: SHEET_ANIM_OUT_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: SHEET_ANIM_OUT_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  // PanResponder wiring drag-to-dismiss on the handle View. We attach to the
  // handle only — never the whole sheet body — so inner scroll views (e.g.
  // ChannelSheet's video list) keep their gestures uncontested. The responder
  // is created once and reads the current sheet height + onClose via refs.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once the user has moved a few pixels downward —
      // lets short taps (if any ever happen on the handle) pass through.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy <= 0) return; // ignore upward drag — sheet never floats above rest position
        const measured = sheetHeightRef.current > 0 ? sheetHeightRef.current : screenHeight;
        // translateY is in normalized 0..1 space (interpolated to screenHeight pixels).
        translateY.setValue(g.dy / screenHeight);
        const progress = Math.min(1, g.dy / measured);
        scrimOpacity.setValue(SCRIM_OPACITY * (1 - progress));
      },
      onPanResponderRelease: (_, g) => {
        const measured = sheetHeightRef.current > 0 ? sheetHeightRef.current : screenHeight;
        const distancePct = g.dy / measured;
        const shouldDismiss = distancePct > DISMISS_DISTANCE_PCT || g.vy > DISMISS_VELOCITY;
        if (shouldDismiss) {
          // Run the slide-out from wherever we currently are, then fire onClose.
          // The parent will then flip `visible` to false; our effect short-circuits
          // because we're already animating in the right direction.
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 1,
              duration: SHEET_ANIM_OUT_MS,
              easing: SHEET_EASING,
              useNativeDriver: true,
            }),
            Animated.timing(scrimOpacity, {
              toValue: 0,
              duration: SHEET_ANIM_OUT_MS,
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            if (finished) onCloseRef.current();
          });
        } else {
          // Snap back to fully open.
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: SHEET_SNAP_BACK_MS,
              easing: SHEET_EASING,
              useNativeDriver: true,
            }),
            Animated.timing(scrimOpacity, {
              toValue: SCRIM_OPACITY,
              duration: SHEET_SNAP_BACK_MS,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        // Another responder took over mid-drag (rare on the handle). Restore
        // resting position rather than leaving the sheet half-open.
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: SHEET_SNAP_BACK_MS,
            easing: SHEET_EASING,
            useNativeDriver: true,
          }),
          Animated.timing(scrimOpacity, {
            toValue: SCRIM_OPACITY,
            duration: SHEET_SNAP_BACK_MS,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  if (!mounted) return null;

  const sheetTranslate = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight],
  });

  const sheet = (
    <Animated.View
      onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      style={{
        backgroundColor: colors.cardBg,
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        maxHeight: screenHeight * maxHeightPct,
        // iPad cap: matches InteractModule/ReflectModule. Phones (< 520pt
        // wide) are unaffected; iPads center the sheet at 520pt.
        width: "100%",
        maxWidth: 520,
        alignSelf: "center",
        transform: [{ translateY: sheetTranslate }],
      }}
    >
      <TouchableWithoutFeedback>
        <View style={[staticStyles.content, contentStyle]}>
          {handle && (
            <View
              {...panResponder.panHandlers}
              // hitSlop expands the touch-responsive area beyond the visible
              // 36x4 bar without changing layout. Vertical slop is bounded by
              // handleMarginBottom so the responder never bleeds into the
              // content below (matters for tight=4 sheets like ReflectModule
              // where the textarea sits right under the handle).
              hitSlop={{ top: 8, bottom: Math.min(8, handleMarginBottom), left: 60, right: 60 }}
              style={[staticStyles.handle, { backgroundColor: colors.divider, marginBottom: handleMarginBottom }]}
            />
          )}
          {children}
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={staticStyles.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[staticStyles.scrim, { backgroundColor: Colors.ink, opacity: scrimOpacity }]}
          />
        </TouchableWithoutFeedback>

        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            pointerEvents="box-none"
            style={staticStyles.kbContainer}
          >
            {sheet}
          </KeyboardAvoidingView>
        ) : (
          sheet
        )}

        {overlayChildren}
      </View>
    </Modal>
  );
}

const staticStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: StyleSheet.absoluteFillObject,
  kbContainer: { flex: 1, justifyContent: "flex-end" },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.s10,
    paddingBottom: Spacing.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
});
