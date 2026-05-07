import React, { useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Image, Animated,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Colors, ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../store";

const KEW_PLUS_GOLD = "#C49A28";

export function SerifText({ style, children, ...props }: { style?: TextStyle; children: React.ReactNode; [k: string]: any }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontFamily: FontFamily.serif, color: colors.ink }, style]} {...props}>
      {children}
    </Text>
  );
}

export function SansText({ style, children, ...props }: { style?: TextStyle; children: React.ReactNode; [k: string]: any }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontFamily: FontFamily.sans, color: colors.ink }, style]} {...props}>
      {children}
    </Text>
  );
}

export function KewLogo({ size = 28, plus }: { size?: number; plus?: boolean }) {
  const { colors } = useTheme();
  const user = useStore(s => s.user);
  const showPlus = plus ?? user?.plan === "pro";
  return (
    <Text style={{ fontFamily: FontFamily.serif, fontSize: size, paddingRight: 2 }}>
      <Text style={{ color: colors.accent }}>K</Text>
      <Text style={{ color: colors.warmMid }}>e</Text>
      <Text style={{ color: colors.ink }}>w</Text>
      {showPlus && <Text style={{ color: KEW_PLUS_GOLD }}>+</Text>}
    </Text>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const { colors } = useTheme();

  const bgColor =
    variant === "primary"     ? colors.accent :
    variant === "destructive" ? colors.ink    :
    "transparent";

  const textColor =
    variant === "primary"     ? colors.buttonText :
    variant === "destructive" ? colors.cream      :
    colors.accent;

  const borderStyle =
    variant === "ghost"
      ? { borderWidth: 1.5, borderColor: colors.accent }
      : undefined;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        staticStyles.button,
        { backgroundColor: bgColor },
        borderStyle,
        (disabled || loading) && staticStyles.buttonDisabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[staticStyles.buttonLabel, { color: textColor }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[staticStyles.divider, { backgroundColor: colors.divider }, style]} />;
}

export function ChannelDot({ title, size = 26, color }: { title: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  const bg = color ?? colors.green;
  return (
    <View style={[staticStyles.channelDot, { width: size, height: size, backgroundColor: bg }]}>
      <Text style={[staticStyles.channelDotText, { fontSize: size * 0.38 }]}>
        {title.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const THUMB_GRADIENTS = [
  "#2C3E2D", "#4A3728", "#2B3A4A", "#3A2B4A", "#2B4A3A",
];

export function ThumbPlaceholder({ seed, style }: { seed: string; style?: ViewStyle }) {
  const idx = seed.charCodeAt(0) % THUMB_GRADIENTS.length;
  return <View style={[{ backgroundColor: THUMB_GRADIENTS[idx] }, style]} />;
}

export function SkipCounter({ remaining, max }: { remaining: number; max: number }) {
  const { colors } = useTheme();
  return (
    <View style={staticStyles.skipCounter}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            staticStyles.skipDot,
            { backgroundColor: i >= max - remaining ? colors.accent : colors.divider },
          ]}
        />
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={staticStyles.emptyState}>
      <Text style={staticStyles.emptyIcon}>{icon}</Text>
      <SerifText style={staticStyles.emptyTitle}>{title}</SerifText>
      {subtitle && <SansText style={[staticStyles.emptySubtitle, { color: colors.warmMid }]}>{subtitle}</SansText>}
    </View>
  );
}

export function AvatarBubble({
  avatarUrl,
  initial,
  size = 30,
  onPress,
}: {
  avatarUrl?: string | null;
  initial: string;
  size?: number;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const inner = avatarUrl ? (
    <Image
      source={{ uri: avatarUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View style={[staticStyles.avatarBubbleBg, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.green }]}>
      <Text style={[staticStyles.avatarBubbleInitial, { fontSize: size * 0.4, color: colors.buttonText }]}>{initial}</Text>
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{inner}</TouchableOpacity>;
  }
  return inner;
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  // Toast is intentionally always dark — it's a floating overlay, not a surface
  return (
    <Animated.View style={[staticStyles.toast, { opacity }]}>
      <SansText style={staticStyles.toastText}>{message}</SansText>
    </Animated.View>
  );
}

export function ErrorBanner({
  message,
  onDismiss,
  actionLabel,
  onAction,
  actionBusy,
}: {
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionBusy?: boolean;
}) {
  const { colors } = useTheme();
  const hasAction = !!actionLabel && !!onAction;
  return (
    <TouchableOpacity
      style={[staticStyles.errorBanner, { backgroundColor: colors.accent }]}
      onPress={onDismiss}
      activeOpacity={0.85}
    >
      <SansText style={[staticStyles.errorText, { color: colors.buttonText, flex: hasAction ? 1 : undefined }]}>
        {message}
      </SansText>
      {hasAction && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onAction!(); }}
          disabled={actionBusy}
          activeOpacity={0.7}
          style={[staticStyles.errorActionBtn, { borderColor: colors.buttonText, opacity: actionBusy ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <SansText style={[staticStyles.errorActionText, { color: colors.buttonText }]}>
            {actionBusy ? "…" : actionLabel}
          </SansText>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Static styles (layout only — no color values) ─────────────────────────
const staticStyles = StyleSheet.create({
  button: {
    height: 48, borderRadius: Radius.pill,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, letterSpacing: 0.3 },
  divider: { height: 1, marginHorizontal: Spacing.md },
  channelDot: { borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  channelDotText: { fontFamily: FontFamily.sansMedium, color: "white", fontWeight: "700" },
  skipCounter: { flexDirection: "row", gap: 4, alignItems: "center" },
  skipDot:     { width: 10, height: 10, borderRadius: 5 },
  emptyState:    { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  emptyIcon:     { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle:    { fontSize: FontSize.lg, textAlign: "center", marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: "center", lineHeight: 20 },
  errorBanner:   { padding: Spacing.sm, margin: Spacing.md, borderRadius: Radius.sm, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  errorText:     { fontSize: FontSize.xs, textAlign: "center" },
  errorActionBtn:  { borderWidth: 1.5, borderRadius: Radius.pill, paddingVertical: 4, paddingHorizontal: 12, flexShrink: 0 },
  errorActionText: { fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium },
  avatarBubbleBg:      { alignItems: "center", justifyContent: "center" },
  avatarBubbleInitial: { fontFamily: FontFamily.sansMedium },
  // Toast stays intentionally dark in both modes
  toast: {
    position: "absolute", bottom: 32, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: "#1A1714", borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    zIndex: 99,
  },
  toastText: { color: "#F5F0E8", fontSize: FontSize.xs, textAlign: "center", lineHeight: 18 },
});
