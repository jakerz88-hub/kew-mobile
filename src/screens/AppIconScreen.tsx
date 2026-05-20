import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, ScrollView, SafeAreaView, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { setAppIcon, getAppIcon } from "expo-dynamic-app-icon";

import { useStore } from "../store";
import { useSubscription } from "../hooks/useSubscription";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, SerifText, Divider, Toast, ErrorBanner } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";

// ── Icon catalog ─────────────────────────────────────────────────────────────
//
// Each entry maps to two slots registered in app.json's `expo-dynamic-app-icon`
// plugin block. Image files live at `assets/icons/{slug}{Variant}.png` and are
// 1024×1024 PNGs. To swap the active icon at runtime, call setAppIcon(name)
// from `expo-dynamic-app-icon` with the slot key (e.g. "goldenHourLight").
//
// Asset placeholders today come from `scripts/gen-icons.py` which renders a
// theme-tinted version of `kew-web/public/logo-mark.svg`. Replace them with
// real design files at the same paths when ready — the runtime contract is
// just the slot name.

type IconVariant = "light" | "dark";
type IconSlot = `${string}Light` | `${string}Dark`;

type IconTheme = {
  id: string;        // matches ThemeId slug, e.g. "standard", "goldenHour"
  name: string;      // human-readable
  premium: boolean;  // free users only see premium=false
  light: { slot: IconSlot; source: number };
  dark:  { slot: IconSlot; source: number };
};

// require() must be a string literal — can't be computed.
const ICON_THEMES: IconTheme[] = [
  {
    id: "standard", name: "Standard", premium: false,
    light: { slot: "standardLight", source: require("../../assets/icons/standardLight.png") },
    dark:  { slot: "standardDark",  source: require("../../assets/icons/standardDark.png") },
  },
  {
    id: "goldenHour", name: "Golden Hour", premium: true,
    light: { slot: "goldenHourLight", source: require("../../assets/icons/goldenHourLight.png") },
    dark:  { slot: "goldenHourDark",  source: require("../../assets/icons/goldenHourDark.png") },
  },
  {
    id: "leatherWine", name: "Leather & Wine", premium: true,
    light: { slot: "leatherWineLight", source: require("../../assets/icons/leatherWineLight.png") },
    dark:  { slot: "leatherWineDark",  source: require("../../assets/icons/leatherWineDark.png") },
  },
  {
    id: "nectar", name: "Starlight Nectar", premium: true,
    light: { slot: "nectarLight", source: require("../../assets/icons/nectarLight.png") },
    dark:  { slot: "nectarDark",  source: require("../../assets/icons/nectarDark.png") },
  },
  {
    id: "brightTide", name: "Bright Tide", premium: true,
    light: { slot: "brightTideLight", source: require("../../assets/icons/brightTideLight.png") },
    dark:  { slot: "brightTideDark",  source: require("../../assets/icons/brightTideDark.png") },
  },
  {
    id: "quietForest", name: "Forest Trail", premium: true,
    light: { slot: "quietForestLight", source: require("../../assets/icons/quietForestLight.png") },
    dark:  { slot: "quietForestDark",  source: require("../../assets/icons/quietForestDark.png") },
  },
  {
    id: "openWater", name: "Open Water", premium: true,
    light: { slot: "openWaterLight", source: require("../../assets/icons/openWaterLight.png") },
    dark:  { slot: "openWaterDark",  source: require("../../assets/icons/openWaterDark.png") },
  },
];

// eslint-disable-next-line kew/no-raw-colors -- intentional non-palette green: brighter saturation reads better as a selection ring over the varied iOS app-icon backgrounds than Colors.green (#4A7C59)
const SELECTION_GREEN = "#1D9E75";

// When iOS is showing the primary icon (the one in app.json's `icon` field),
// getAppIcon() returns "DEFAULT". Treat that as standardLight for selection
// state — the primary asset is visually identical to standardLight.
function normalizeCurrentSlot(raw: string | null): IconSlot {
  if (!raw || raw === "DEFAULT") return "standardLight";
  return raw as IconSlot;
}

export default function AppIconScreen() {
  const navigation = useNavigation<any>();
  const { user } = useStore();
  const { isPro: rcIsPro } = useSubscription();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isPro = rcIsPro || user?.plan === "pro";

  const [currentSlot, setCurrentSlot] = useState<IconSlot>(() =>
    normalizeCurrentSlot(getAppIcon()),
  );
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Refresh on focus in case the user came back from elsewhere.
  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      setCurrentSlot(normalizeCurrentSlot(getAppIcon()));
    });
    return unsub;
  }, [navigation]);

  const handleSelect = useCallback(async (slot: IconSlot) => {
    if (slot === currentSlot) return;
    setError(null);
    // iOS shows its own "An app has changed your icon" alert after success,
    // so we only add a brief in-app confirmation toast on top of that.
    try {
      const result = await setAppIcon(slot);
      if (result) {
        setCurrentSlot(slot);
        showToast("Icon updated");
      } else {
        // setAppIcon returned falsy without throwing — surface as a generic
        // failure so the user isn't left wondering why the selection didn't
        // stick (most common cause: the user denied the system prompt).
        setError("Couldn't update app icon. Please try again.");
      }
    } catch {
      setError("Couldn't update app icon. Please try again.");
    }
  }, [currentSlot]);

  const visibleThemes = ICON_THEMES.filter(t => !t.premium || isPro);
  const standard = visibleThemes.find(t => t.id === "standard")!;
  const premiumThemes = visibleThemes.filter(t => t.premium);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>App icon</SerifText>
        <View style={{ flex: 1 }} />
      </View>
      <Divider />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemeRow theme={standard} currentSlot={currentSlot} onSelect={handleSelect} styles={styles} />

        {premiumThemes.length > 0 && (
          <>
            <View style={styles.sectionDivider} />
            <SansText style={styles.sectionLabel}>Premium themes</SansText>
            {premiumThemes.map(t => (
              <ThemeRow key={t.id} theme={t} currentSlot={currentSlot} onSelect={handleSelect} styles={styles} />
            ))}
          </>
        )}
      </ScrollView>

      <Toast message={toastMsg} visible={toastVisible} />
    </SafeAreaView>
  );
}

function ThemeRow({
  theme, currentSlot, onSelect, styles,
}: {
  theme: IconTheme;
  currentSlot: IconSlot;
  onSelect: (slot: IconSlot) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <SansText style={styles.rowLabel}>{theme.name}</SansText>
      <View style={styles.thumbRow}>
        <IconThumb
          source={theme.light.source}
          selected={currentSlot === theme.light.slot}
          onPress={() => onSelect(theme.light.slot)}
          styles={styles}
        />
        <IconThumb
          source={theme.dark.source}
          selected={currentSlot === theme.dark.slot}
          onPress={() => onSelect(theme.dark.slot)}
          styles={styles}
        />
      </View>
    </View>
  );
}

function IconThumb({
  source, selected, onPress, styles,
}: {
  source: number;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.thumbOuter, selected && styles.thumbOuterSelected]}
    >
      <Image source={source} style={styles.thumbImage} />
    </TouchableOpacity>
  );
}

// Exported so ProfileScreen can reuse the catalog for the entry-row preview.
export { ICON_THEMES, normalizeCurrentSlot };
export type { IconSlot, IconTheme };

function makeStyles(c: ColorPalette) {
  const THUMB = 56;
  const RING_PAD = 4;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.cream },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    backBtn:     { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: FontSize.lg, marginLeft: Spacing.xs },

    content: { padding: Spacing.md, paddingBottom: 80 },

    sectionDivider: {
      height: 1, backgroundColor: c.divider,
      marginVertical: Spacing.md,
    },
    sectionLabel: {
      fontSize: FontSize.xxs,
      color: c.warmMid,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      fontFamily: FontFamily.sansMedium,
      marginBottom: Spacing.sm,
    },

    row: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: Spacing.sm,
    },
    rowLabel:  { fontSize: FontSize.md, color: c.ink, flex: 1 },
    thumbRow:  { flexDirection: "row", gap: Spacing.sm },

    thumbOuter: {
      width: THUMB + RING_PAD * 2,
      height: THUMB + RING_PAD * 2,
      borderRadius: Radius.md + RING_PAD,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    thumbOuterSelected: {
      borderColor: SELECTION_GREEN,
    },
    thumbImage: {
      width: THUMB,
      height: THUMB,
      borderRadius: Radius.md,
    },
  });
}
