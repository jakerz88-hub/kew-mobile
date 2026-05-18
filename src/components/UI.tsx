import React, { useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Image, Animated,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Colors, ColorPalette, FontFamily, FontSize, Spacing, Radius, KEW_PLUS_GOLD } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../store";

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

type ButtonVariant =
  | "primary"      // T1 — accent filled
  | "secondary"    // T2 — accent outline
  | "additive"     // T3 — green filled
  | "completion"   // T4 — green outline
  | "ghost"        // T5 — divider outline, warmMid text
  | "text"         // T6 — text only, accent
  | "destructive"; // ink filled

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const { colors } = useTheme();

  // greenText is a dark-aware token; in light mode it equals green.
  const greenText = colors.greenText ?? colors.green;

  let bgColor: string;
  let textColor: string;
  let borderStyle: ViewStyle | undefined;

  switch (variant) {
    case "primary":
      bgColor = colors.accent;
      textColor = colors.buttonText;
      break;
    case "secondary":
      bgColor = "transparent";
      textColor = colors.accent;
      borderStyle = { borderWidth: 1.5, borderColor: colors.accent };
      break;
    case "additive":
      bgColor = colors.green;
      textColor = colors.buttonText;
      break;
    case "completion":
      bgColor = "transparent";
      textColor = greenText;
      borderStyle = { borderWidth: 1.5, borderColor: colors.green };
      break;
    case "ghost":
      bgColor = "transparent";
      textColor = colors.warmMid;
      borderStyle = { borderWidth: 1.5, borderColor: colors.divider };
      break;
    case "text":
      bgColor = "transparent";
      textColor = colors.accent;
      break;
    case "destructive":
      bgColor = colors.ink;
      textColor = colors.cream;
      break;
  }

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
      {/* eslint-disable-next-line kew/no-raw-font-size -- proportional to ChannelDot's size prop; no fixed token applies */}
      <Text style={[staticStyles.channelDotText, { fontSize: size * 0.38, color: colors.buttonText }]}>
        {title.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function hashSeed(seed: string): number {
  if (!seed) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function ThumbPlaceholder({ seed, style }: { seed: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  const idx = hashSeed(seed) % colors.thumbGradients.length;
  return <View style={[{ backgroundColor: colors.thumbGradients[idx] }, style]} />;
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

export function EmptyState({ icon, title, subtitle, action }: {
  icon: string | React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void; loading?: boolean };
}) {
  const { colors } = useTheme();
  return (
    <View style={staticStyles.emptyState}>
      {typeof icon === "string"
        ? <Text style={[staticStyles.emptyIcon, { color: colors.ink }]}>{icon}</Text>
        : <View style={staticStyles.emptyIconNode}>{icon}</View>
      }
      <SerifText style={staticStyles.emptyTitle}>{title}</SerifText>
      {subtitle && <SansText style={[staticStyles.emptySubtitle, { color: colors.warmMid }]}>{subtitle}</SansText>}
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          disabled={action.loading}
          activeOpacity={0.8}
          style={[staticStyles.emptyAction, { backgroundColor: colors.accent }]}
        >
          <SansText style={[staticStyles.emptyActionText, { color: colors.buttonText }]}>
            {action.loading ? "Loading…" : action.label}
          </SansText>
        </TouchableOpacity>
      )}
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
      {/* eslint-disable-next-line kew/no-raw-font-size -- proportional to AvatarBubble's size prop; no fixed token applies */}
      <Text style={[staticStyles.avatarBubbleInitial, { fontSize: size * 0.4, color: colors.buttonText }]}>{initial}</Text>
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{inner}</TouchableOpacity>;
  }
  return inner;
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  const { colors } = useTheme();
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
  return (
    <Animated.View style={[staticStyles.toast, { opacity, backgroundColor: colors.ink }]}>
      <SansText style={[staticStyles.toastText, { color: colors.cream }]}>{message}</SansText>
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
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, letterSpacing: 0.3 },
  divider: { height: 1, marginHorizontal: Spacing.md },
  channelDot: { borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  channelDotText: { fontFamily: FontFamily.sansMedium, fontWeight: "700" },
  skipCounter: { flexDirection: "row", gap: 4, alignItems: "center" },
  skipDot:     { width: 10, height: 10, borderRadius: 5 },
  emptyState:    { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  // eslint-disable-next-line kew/no-raw-font-size -- 40px is the documented empty-state icon size per DESIGN_SYSTEM §9, not a font-scale value
  emptyIcon:     { fontSize: 40, marginBottom: Spacing.md },
  emptyIconNode: { marginBottom: Spacing.md, alignItems: "center", justifyContent: "center" },
  emptyTitle:    { fontSize: FontSize.lg, textAlign: "center", marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: "center", lineHeight: 20 },
  emptyAction:   { marginTop: Spacing.lg, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xl, borderRadius: Radius.pill },
  emptyActionText: { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  errorBanner:   { padding: Spacing.sm, margin: Spacing.md, borderRadius: Radius.sm, flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  errorText:     { fontSize: FontSize.xs, textAlign: "center" },
  errorActionBtn:  { borderWidth: 1.5, borderRadius: Radius.pill, paddingVertical: 4, paddingHorizontal: 12, flexShrink: 0 },
  errorActionText: { fontSize: FontSize.xs, fontFamily: FontFamily.sansMedium },
  avatarBubbleBg:      { alignItems: "center", justifyContent: "center" },
  avatarBubbleInitial: { fontFamily: FontFamily.sansMedium },
  toast: {
    position: "absolute", bottom: 32, left: Spacing.lg, right: Spacing.lg,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    zIndex: 99,
  },
  toastText: { fontSize: FontSize.xs, textAlign: "center", lineHeight: 18 },
});
