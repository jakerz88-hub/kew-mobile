import React from "react";
import { View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";

interface LogoMarkProps {
  /** Pass a single color for unicolor (tab icon). Omit to use the graded palette. */
  color?: string;
  size?: number;
}

/**
 * Scalable Kew logo mark: right-pointing triangle + three decreasing lines.
 * When `color` is provided (tab bar), all elements share that color.
 * When omitted (screen header), each element uses the theme-aware graded palette.
 */
export function LogoMark({ color, size = 20 }: LogoMarkProps) {
  const { colors } = useTheme();

  const scale  = size / 20;
  const triH   = Math.round(10 * scale);
  const triW   = Math.round(11 * scale);
  const lineH  = Math.max(2, Math.round(2.5 * scale));
  // Ionicons "play" has ~2.5px built-in right padding at size=20 (scales proportionally).
  // A negative margin compensates so the lines sit close to the triangle tip.
  const iconRightPad = 2.5 * scale;
  const visualGap    = 2 * scale;
  const gap          = Math.round(visualGap - iconRightPad); // typically negative
  const totalH = triH * 2;

  // When `color` is provided (tab icon, unicolor), use it for all elements.
  // When omitted (header), use theme-aware graded palette.
  const triColor   = color ?? colors.accent;
  const lineColor1 = color ?? colors.ink;
  const lineColor2 = color ?? colors.warmMid;
  const lineColor3 = color ?? colors.queued;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: totalH }}>
      {/* Ionicons "play" renders a right-pointing triangle with naturally rounded corners */}
      <Ionicons name="play" size={totalH} color={triColor} />
      {/* Three lines: dark → mid → light */}
      <View style={{ marginLeft: gap, justifyContent: "space-between", height: Math.round(15 * scale) }}>
        <View style={{ width: Math.round(10 * scale), height: lineH, borderRadius: lineH / 2, backgroundColor: lineColor1 }} />
        <View style={{ width: Math.round(8  * scale), height: lineH, borderRadius: lineH / 2, backgroundColor: lineColor2 }} />
        <View style={{ width: Math.round(5  * scale), height: lineH, borderRadius: lineH / 2, backgroundColor: lineColor3 }} />
      </View>
    </View>
  );
}

/** Queue tab icon — unicolor, driven by the navigator's active/inactive tint */
export function QueueTabIcon({ color }: { color: string }) {
  return <LogoMark color={color} size={20} />;
}

/** Browse tab icon — magnifying glass */
export function BrowseTabIcon({ color }: { color: string }) {
  return <Feather name="search" size={22} color={color} />;
}

/** Explore tab icon — compass */
export function ExploreTabIcon({ color }: { color: string }) {
  return <Feather name="compass" size={22} color={color} />;
}

/** History tab icon — clock */
export function HistoryTabIcon({ color }: { color: string }) {
  return <Feather name="clock" size={22} color={color} />;
}

/** Journal tab icon — open book */
export function JournalTabIcon({ color }: { color: string }) {
  return <Feather name="book-open" size={22} color={color} />;
}
