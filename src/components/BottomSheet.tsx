import React, { useEffect, useRef, useState } from "react";
import {
  View, Modal, Animated, TouchableWithoutFeedback, KeyboardAvoidingView,
  Easing, Platform, StyleSheet, ViewStyle, useWindowDimensions,
} from "react-native";
import { Colors, Radius, Spacing } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

const SHEET_ANIM_IN_MS  = 280;
const SHEET_ANIM_OUT_MS = 220;
const SCRIM_OPACITY     = 0.5;
const SHEET_EASING      = Easing.bezier(0.32, 0.72, 0, 1);

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
  const translateY      = useRef(new Animated.Value(visible ? 0 : 1)).current;
  const scrimOpacity    = useRef(new Animated.Value(visible ? SCRIM_OPACITY : 0)).current;

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

  if (!mounted) return null;

  const sheetTranslate = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight],
  });

  const sheet = (
    <Animated.View
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
            <View style={[staticStyles.handle, { backgroundColor: colors.divider, marginBottom: handleMarginBottom }]} />
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
