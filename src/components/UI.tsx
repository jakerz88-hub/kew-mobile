import React, { useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Image, Animated,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";

export function SerifText({ style, children, ...props }: { style?: TextStyle; children: React.ReactNode; [k: string]: any }) {
  return (
    <Text style={[{ fontFamily: FontFamily.serif, color: Colors.ink }, style]} {...props}>
      {children}
    </Text>
  );
}

export function SansText({ style, children, ...props }: { style?: TextStyle; children: React.ReactNode; [k: string]: any }) {
  return (
    <Text style={[{ fontFamily: FontFamily.sans, color: Colors.ink }, style]} {...props}>
      {children}
    </Text>
  );
}

export function KewLogo({ size = 28 }: { size?: number }) {
  return (
    <Text style={{ fontFamily: FontFamily.serif, fontSize: size }}>
      <Text style={{ color: Colors.accent }}>K</Text>
      <Text style={{ color: Colors.warmMid }}>e</Text>
      <Text style={{ color: Colors.ink }}>w</Text>
    </Text>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={isPrimary ? Colors.cream : Colors.accent} size="small" />
        : <Text style={[styles.buttonLabel, !isPrimary && styles.buttonLabelGhost]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

export function ChannelDot({ title, size = 26, color = Colors.green }: { title: string; size?: number; color?: string }) {
  return (
    <View style={[styles.channelDot, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.channelDotText, { fontSize: size * 0.38 }]}>
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
  return (
    <View style={styles.skipCounter}>
      <Text style={styles.skipCounterText}>{remaining} of {max} skips remaining</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <SerifText style={styles.emptyTitle}>{title}</SerifText>
      {subtitle && <SansText style={styles.emptySubtitle}>{subtitle}</SansText>}
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
  const inner = avatarUrl ? (
    <Image
      source={{ uri: avatarUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View style={[styles.avatarBubbleBg, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarBubbleInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
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
  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <SansText style={styles.toastText}>{message}</SansText>
    </Animated.View>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <TouchableOpacity style={styles.errorBanner} onPress={onDismiss}>
      <SansText style={styles.errorText}>{message}</SansText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48, borderRadius: Radius.pill,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  buttonPrimary: { backgroundColor: Colors.accent },
  buttonGhost: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: Colors.accent },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: Colors.cream, letterSpacing: 0.3 },
  buttonLabelGhost: { color: Colors.accent },
  divider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: Spacing.md },
  channelDot: { borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
  channelDotText: { fontFamily: FontFamily.sansMedium, color: "white", fontWeight: "700" },
  skipCounter: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radius.pill, backgroundColor: Colors.divider, alignSelf: "flex-start",
  },
  skipCounterText: { fontFamily: FontFamily.sans, fontSize: FontSize.xxs, color: Colors.warmMid },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, textAlign: "center", marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.warmMid, textAlign: "center", lineHeight: 20 },
  errorBanner: { backgroundColor: Colors.accent, padding: Spacing.sm, margin: Spacing.md, borderRadius: Radius.sm },
  errorText: { color: Colors.cream, fontSize: FontSize.xs, textAlign: "center" },
  avatarBubbleBg: { backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarBubbleInitial: { fontFamily: FontFamily.sansMedium, color: Colors.cream },
  toast: {
    position: "absolute", bottom: 32, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.ink, borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    zIndex: 99,
  },
  toastText: { color: Colors.cream, fontSize: FontSize.xs, textAlign: "center", lineHeight: 18 },
});
