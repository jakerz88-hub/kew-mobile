import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Colors, DarkColors, ColorPalette,
  GoldenHourColors, GoldenHourDarkColors,
  LeatherWineColors, LeatherWineDarkColors,
  NectarColors, NectarDarkColors,
  BrightTideColors, BrightTideDarkColors,
  ForestTrailColors, ForestTrailDarkColors,
  OpenWaterColors, OpenWaterDarkColors,
} from "../types/theme";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeId   = "standard" | "goldenHour" | "leatherWine" | "brightTide" | "nectar" | "quietForest" | "openWater";

interface ThemeContextValue {
  colors:     ColorPalette;
  isDark:     boolean;
  mode:       ThemeMode;
  setMode:    (m: ThemeMode) => void;
  themeId:    ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const LIGHT_PALETTE: ColorPalette = {
  ...Colors,
  cardElevated: Colors.cardBg,
  greenText:    Colors.green,
  buttonText:   Colors.cream,
};

const DARK_PALETTE: ColorPalette = { ...DarkColors };

function resolvePalette(themeId: ThemeId, isDark: boolean): ColorPalette {
  switch (themeId) {
    case "goldenHour":   return isDark ? GoldenHourDarkColors  : GoldenHourColors;
    case "leatherWine":  return isDark ? LeatherWineDarkColors : LeatherWineColors;
    case "nectar":       return isDark ? NectarDarkColors      : NectarColors;
    case "brightTide":   return isDark ? BrightTideDarkColors  : BrightTideColors;
    case "quietForest":  return isDark ? ForestTrailDarkColors : ForestTrailColors;
    case "openWater":    return isDark ? OpenWaterDarkColors   : OpenWaterColors;
    default:             return isDark ? DARK_PALETTE          : LIGHT_PALETTE;
  }
}

const ThemeContext = createContext<ThemeContextValue>({
  colors:     LIGHT_PALETTE,
  isDark:     false,
  mode:       "system",
  setMode:    () => {},
  themeId:    "standard",
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme            = useColorScheme();
  const [mode,      setModeState]    = useState<ThemeMode>("system");
  const [themeId,   setThemeIdState] = useState<ThemeId>("standard");
  const [hydrated,  setHydrated]     = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("kew_theme_mode"),
      AsyncStorage.getItem("kew_theme_id"),
    ]).then(([savedMode, savedThemeId]) => {
      if (savedMode === "light" || savedMode === "dark" || savedMode === "system") {
        setModeState(savedMode);
      }
      if (savedThemeId) setThemeIdState(savedThemeId as ThemeId);
      setHydrated(true);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem("kew_theme_mode", m);
  };

  const setThemeId = (id: ThemeId) => {
    setThemeIdState(id);
    AsyncStorage.setItem("kew_theme_id", id);
  };

  const isDark = hydrated
    ? mode === "dark" || (mode === "system" && systemScheme === "dark")
    : false;

  const colors = useMemo<ColorPalette>(
    () => resolvePalette(themeId, isDark),
    [themeId, isDark],
  );

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode, themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
