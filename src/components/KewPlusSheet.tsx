import React, { useMemo } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { SansText, SerifText } from "./UI";
import { ProIcon } from "./ProIcon";
import { BottomSheet } from "./BottomSheet";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius, KEW_PLUS_GOLD } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

const FEATURE_BULLETS = [
  "Multiple queues",
  "Unlimited queue length",
  "More skips",
  "Journal",
  "Watch insights & personal limits",
  "Full watch history",
  "Premium themes",
];

interface Props {
  visible: boolean;
  onClose: () => void;
  headline: string;
  body: string;
  onExplore: () => void;
}

export function KewPlusSheet({ visible, onClose, headline, body, onExplore }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleExplore = () => {
    onExplore();
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAvoiding={false}
      contentStyle={styles.content}
    >
      <View style={styles.iconWrap}>
        <ProIcon size={48} />
      </View>

      <SerifText style={styles.headline}>{headline}</SerifText>
      <SansText style={styles.body} numberOfLines={2}>{body}</SansText>

      <View style={styles.bullets}>
        {FEATURE_BULLETS.map((b) => (
          <View key={b} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <SansText style={styles.bulletText}>{b}</SansText>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.exploreBtn} onPress={handleExplore} activeOpacity={0.85}>
        <SansText style={styles.exploreBtnText}>Explore Kew+</SansText>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.notNowBtn}>
        <SansText style={styles.notNowText}>Not now</SansText>
      </TouchableOpacity>
    </BottomSheet>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    content:      { alignItems: "center" },
    iconWrap:     { marginBottom: Spacing.sm },
    headline:     { fontSize: FontSize.lg, color: c.ink, textAlign: "center", marginTop: Spacing.xs },
    body:         { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 19, marginTop: Spacing.xs, paddingHorizontal: Spacing.sm },
    bullets:      { width: "100%", marginTop: Spacing.md, gap: Spacing.s6 },
    bulletRow:    { flexDirection: "row", alignItems: "center", gap: Spacing.sm, alignSelf: "center" },
    bulletDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: KEW_PLUS_GOLD },
    bulletText:   { fontSize: FontSize.sm, color: c.ink },
    exploreBtn:   { width: "100%", backgroundColor: KEW_PLUS_GOLD, borderRadius: Radius.pill, paddingVertical: Spacing.s14, alignItems: "center", justifyContent: "center", marginTop: Spacing.lg },
    exploreBtnText:{ fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium, letterSpacing: 0.3 },
    notNowBtn:    { marginTop: Spacing.sm, paddingVertical: Spacing.sm, alignItems: "center" },
    notNowText:   { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
  });
}
