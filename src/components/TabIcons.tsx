import React from "react";
import { View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

// Graded colors for the header logo mark — from the approved light-mode design
const MARK_COLORS = {
  triangle: "#C4552A", // orange
  line1:    "#1A1714", // ink (darkest)
  line2:    "#7A6E66", // mid warm gray
  line3:    "#B8AFA8", // light warm gray
};

interface LogoMarkProps {
  /** Pass a single color for unicolor (tab icon). Omit to use the graded palette. */
  color?: string;
  size?: number;
}

/**
 * Scalable Kew logo mark: right-pointing triangle + three decreasing lines.
 * When `color` is provided (tab bar), all elements share that color.
 * When omitted (screen header), each element uses the approved graded palette.
 */
export function LogoMark({ color, size = 20 }: LogoMarkProps) {
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

  const triColor   = color ?? MARK_COLORS.triangle;
  const lineColor1 = color ?? MARK_COLORS.line1;
  const lineColor2 = color ?? MARK_COLORS.line2;
  const lineColor3 = color ?? MARK_COLORS.line3;

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

/** History tab icon — clock */
export function HistoryTabIcon({ color }: { color: string }) {
  return <Feather name="clock" size={22} color={color} />;
}

/**
 * Profile tab icon — avatar bubble:
 * outer circle with a small person (head + shoulders) clipped inside.
 * Built from Views so no extra SVG dependency is needed.
 */
export function ProfileTabIcon({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: color,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      {/* Head */}
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 4.5,
          backgroundColor: color,
          marginTop: 3,
        }}
      />
      {/* Shoulders — wide oval clipped by overflow:hidden on the outer circle */}
      <View
        style={{
          width: 18,
          height: 14,
          borderRadius: 9,
          backgroundColor: color,
          marginTop: 1,
        }}
      />
    </View>
  );
}
