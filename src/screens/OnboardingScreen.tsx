import React, { useMemo } from "react";
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { SansText, SerifText } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logoSection}>
          <LogoMark size={48} />
        </View>

        <View style={styles.centerSection}>
          <SerifText style={styles.title}>Watch intentionally.</SerifText>
          <SansText style={styles.subtitle}>
            Kew is a calm place to watch videos from the creators you actually like.
            No algorithm. No autoplay. Just your queue.
          </SansText>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.8}>
            <SansText style={styles.primaryBtnText}>Get started</SansText>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.cream },
    inner:          { flex: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl, justifyContent: "space-between" },
    logoSection:    { alignItems: "center", paddingTop: Spacing.xxl },
    centerSection:  { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, paddingHorizontal: Spacing.sm },
    title:          { fontSize: FontSize.xl ?? FontSize.lg, color: c.ink, textAlign: "center" },
    subtitle:       { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 22, fontFamily: FontFamily.sansLight },
    errorText:      { fontSize: FontSize.xs, color: c.accent, textAlign: "center" },
    bottomSection:  { gap: Spacing.sm },
    primaryBtn:     { backgroundColor: c.accent, borderRadius: 999, height: 52, alignItems: "center", justifyContent: "center" },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: "white", letterSpacing: 0.3 },
    skipBtn:        { paddingVertical: Spacing.sm, alignItems: "center" },
    skipBtnText:    { fontSize: FontSize.sm, color: c.warmMid, fontFamily: FontFamily.sans },
  });
}
