import React from "react";
import { View, StyleSheet } from "react-native";
import { SansText } from "./UI";
import { formatDuration } from "../types";
import { FontSize } from "../types/theme";

interface Props {
  seconds: number | null | undefined;
}

export function DurationBadge({ seconds }: Props) {
  if (!seconds) return null;
  return (
    <View style={styles.badge}>
      <SansText style={styles.text}>{formatDuration(seconds)}</SansText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(26,23,20,0.75)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  text: {
    color: "white",
    fontSize: FontSize.xxs,
  },
});
