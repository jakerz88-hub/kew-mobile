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
// from `expo-dynamic-app-icon` with the slot key (e.g. "golden_hour_light").
//
// Asset placeholders today come from `scripts/gen-icons.py` which renders a
// theme-tinted version of `kew-web/public/logo-mark.svg`. Replace them with
// real design files at the same paths when ready — the runtime contract is
// just the slot name.

type IconVariant = "light" | "dark";
type IconSlot = string;

type IconTheme = {
  id: string;        // matches ThemeId slug, e.g. "standard", "golden_hour"
  name: string;      // human-readable
  premium: boolean;  // free users only see premium=false
  light: { slot: IconSlot; source: number };
  dark:  { slot: IconSlot; source: number };
};

// require() must be a string literal — can't be computed.
const ICON_THEMES: IconTheme[] = [
  {
    id: "standard", name: "Standard", premium: false,
    light: { slot: "standard_light", source: require("../../assets/icons/standard_light.png") },
    dark:  { slot: "standard_dark",  source: require("../../assets/icons/standard_dark.png") },
  },
  {
    id: "golden_hour", name: "Golden Hour", premium: true,
    light: { slot: "golden_hour_light", source: require("../../assets/icons/golden_hour_light.png") },
    dark:  { slot: "golden_hour_dark",  source: require("../../assets/icons/golden_hour_dark.png") },
  },
  {
    id: "leather_wine", name: "Leather & Wine", premium: true,
    light: { slot: "leather_wine_light", source: require("../../assets/icons/leather_wine_light.png") },
    dark:  { slot: "leather_wine_dark",  source: require("../../assets/icons/leather_wine_dark.png") },
  },
  {
    id: "nectar", name: "Starlight Nectar", premium: true,
    light: { slot: "nectar_light", source: require("../../assets/icons/nectar_light.png") },
    dark:  { slot: "nectar_dark",  source: require("../../assets/icons/nectar_dark.png") },
  },
  {
    id: "bright_tide", name: "Bright Tide", premium: true,
    light: { slot: "bright_tide_light", source: require("../../assets/icons/bright_tide_light.png") },
    dark:  { slot: "bright_tide_dark",  source: require("../../assets/icons/bright_tide_dark.png") },
  },
  {
    id: "quiet_forest", name: "Forest Trail", premium: true,
    light: { slot: "quiet_forest_light", source: require("../../assets/icons/quiet_forest_light.png") },
    dark:  { slot: "quiet_forest_dark",  source: require("../../assets/icons/quiet_forest_dark.png") },
  },
  {
    id: "open_water", name: "Open Water", premium: true,
    light: { slot: "open_water_light", source: require("../../assets/icons/open_water_light.png") },
    dark:  { slot: "open_water_dark",  source: require("../../assets/icons/open_water_dark.png") },
  },
];

// eslint-disable-next-line kew/no-raw-colors -- intentional non-palette green: brighter saturation reads better as a selection ring over the varied iOS app-icon backgrounds than Colors.green (#4A7C59)
const SELECTION_GREEN = "#1D9E75";

// ── Icon-key scheme resilience ───────────────────────────────────────────────
//
// The catalog above uses snake_case slot keys, matching app.json's current
// expo-dynamic-app-icon config. But a given installed BINARY may have been
// built from an older config that registered camelCase keys (e.g. the 1.0.0
// build, or a 1.0.1 build whose embedded bundle/registration drifted from
// source). Since we can't know at runtime which scheme the binary actually
// registered, both the setter and the read-back tolerate either scheme.

// snake_case -> camelCase, e.g. "golden_hour_light" -> "goldenHourLight"
function toCamel(slot: string): string {
  return slot.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// camelCase -> snake_case, e.g. "goldenHourLight" -> "golden_hour_light".
// Snake input is unaffected (no uppercase to match), so this is idempotent
// for the canonical catalog keys.
function toSnake(slot: string): string {
  return slot.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`);
}

// Try the snake_case key first (matches current source); fall back to the
// camelCase equivalent if the binary registered the legacy scheme. Returns the
// truthy result from setAppIcon on success, or false if both attempts fail.
async function setAppIconResilient(slot: string): Promise<boolean | string> {
  try {
    const r = await setAppIcon(slot);
    if (r) return r;
  } catch { /* fall through to camelCase attempt */ }
  // Binary may register the legacy camelCase keys (pre-snake_case builds)
  try {
    const r2 = await setAppIcon(toCamel(slot));
    if (r2) return r2;
  } catch { /* both failed */ }
  return false;
}

// When iOS is showing the primary icon (the one in app.json's `icon` field),
// getAppIcon() returns "DEFAULT". Treat that as standard_light for selection
// state — the primary asset is visually identical to standard_light. Whatever
// scheme the binary reports (snake or camel), normalize to the catalog's
// canonical snake_case so the selected-state highlight matches.
function normalizeCurrentSlot(raw: string | null): IconSlot {
  if (!raw || raw === "DEFAULT") return "standard_light";
  return toSnake(raw) as IconSlot;
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
      // Resilient setter tries snake_case then camelCase so it works regardless
      // of which key scheme the installed binary registered.
      const result = await setAppIconResilient(slot);
      if (result) {
        setCurrentSlot(slot);
        showToast("Icon updated");
      } else {
        // Both schemes returned falsy without throwing — surface as a generic
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
