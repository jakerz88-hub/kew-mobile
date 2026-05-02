import React, { useMemo } from "react";
import { View, Modal, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from "react-native";
import { SansText, SerifText } from "./UI";
import { ProIcon } from "./ProIcon";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

const GOLD = "#C49A28";

const FEATURE_BULLETS = [
  "Unlimited queue length",
  "Multiple queues",
  "More skips",
  "Watch insights & personal limits",
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />

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
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet:        { backgroundColor: c.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm + 2, paddingBottom: Spacing.xl, alignItems: "center" },
    handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: c.divider, marginBottom: Spacing.md },
    iconWrap:     { marginBottom: Spacing.sm },
    headline:     { fontSize: FontSize.lg, color: c.ink, textAlign: "center", marginTop: Spacing.xs },
    body:         { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 19, marginTop: Spacing.xs, paddingHorizontal: Spacing.sm },
    bullets:      { width: "100%", marginTop: Spacing.md, gap: Spacing.xs + 2 },
    bulletRow:    { flexDirection: "row", alignItems: "center", gap: Spacing.sm, alignSelf: "center" },
    bulletDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
    bulletText:   { fontSize: FontSize.sm, color: c.ink },
    exploreBtn:   { width: "100%", backgroundColor: GOLD, borderRadius: Radius.pill, paddingVertical: Spacing.md - 2, alignItems: "center", justifyContent: "center", marginTop: Spacing.lg },
    exploreBtnText:{ fontSize: FontSize.sm, color: "#FFFFFF", fontFamily: FontFamily.sansMedium, letterSpacing: 0.3 },
    notNowBtn:    { marginTop: Spacing.sm, paddingVertical: Spacing.sm, alignItems: "center" },
    notNowText:   { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
  });
}
