// Muted-dark thumbnail placeholder gradients per palette. Each palette picks
// 5 dark hues that read as "missing thumbnail" within its own color story.
const STANDARD_THUMB_GRADIENTS = [
  "#2C3E2D", "#4A3728", "#2B3A4A", "#3A2B4A", "#2B4A3A",
] as const;

export const Colors = {
  cream:       "#F5F0E8",
  ink:         "#1A1714",
  warmMid:     "#8C7B6B",
  accent:      "#C4552A",
  accentLight: "#E8896A",
  cardBg:      "#FFFDF9",
  queued:      "#C8C2B8",
  divider:     "#E8E2D8",
  green:       "#4A7C59",
  background:  "#EDEAE3",
  thumbGradients: STANDARD_THUMB_GRADIENTS,
} as const;

// Kew+ brand color — strictly reserved for Kew+ surfaces (see DESIGN_SYSTEM §1.1).
export const KEW_PLUS_GOLD        = "#C49A28";
export const KEW_PLUS_GOLD_TINT   = "rgba(196,154,40,0.12)";
export const KEW_PLUS_GOLD_BORDER = "rgba(196,154,40,0.35)";

export const DarkColors = {
  cream:        "#171410",   // screen backgrounds in dark
  ink:          "#F0EAE0",   // primary text in dark
  warmMid:      "#9A8878",
  accent:       "#C4552A",   // unchanged
  accentLight:  "#E8896A",   // unchanged
  cardBg:       "#1E1A16",
  queued:       "#5C5048",
  divider:      "#302B24",
  green:        "#4A7C59",   // unchanged (fills)
  background:   "#131009",
  // Extra tokens that only differ in dark mode
  cardElevated: "#252019",   // elevated / selected cards
  greenText:    "#5E9B72",   // green text / outline on dark bg
  buttonText:   "#F0EAE0",   // text on accent/ink filled buttons
  thumbGradients: STANDARD_THUMB_GRADIENTS,
} as const;

/** Full resolved palette — includes the 3 extra dark-aware tokens */
export type ColorPalette = {
  cream:        string;
  ink:          string;
  warmMid:      string;
  accent:       string;
  accentLight:  string;
  cardBg:       string;
  queued:       string;
  divider:      string;
  green:        string;
  background:   string;
  cardElevated: string;
  greenText:    string;
  buttonText:   string;
  thumbGradients: readonly string[];
};

// ── Leather & Wine ────────────────────────────────────────────

// Dark burgundies, mahoganies, and ox-blood browns for Leather & Wine.
const LEATHER_WINE_THUMB_GRADIENTS = [
  "#3E1A24", "#2E1810", "#3A1F18", "#341E12", "#28161E",
] as const;

export const LeatherWineColors: ColorPalette = {
  cream:        "#F0E8DC",
  ink:          "#28140A",
  warmMid:      "#896050",
  accent:       "#7A1E40",
  accentLight:  "#A03A58",
  cardBg:       "#FAF5EE",
  queued:       "#B89880",
  divider:      "#DED0BC",
  green:        "#B87820",
  background:   "#E8DDD0",
  cardElevated: "#FFFDF8",
  greenText:    "#A06818",
  buttonText:   "#FAF5EE",
  thumbGradients: LEATHER_WINE_THUMB_GRADIENTS,
};

export const LeatherWineDarkColors: ColorPalette = {
  cream:        "#261408",
  ink:          "#F2DCC0",
  warmMid:      "#C09070",
  accent:       "#D04868",
  accentLight:  "#E06880",
  cardBg:       "#321A0A",
  queued:       "#805040",
  divider:      "#4A2810",
  green:        "#D09830",
  background:   "#1E1008",
  cardElevated: "#3C200C",
  greenText:    "#D09830",
  buttonText:   "#F2DCC0",
  thumbGradients: LEATHER_WINE_THUMB_GRADIENTS,
};

// ── Starlight Nectar ───────────────────────────────────────────

// Deep violets, plums, and dusky roses for Starlight Nectar.
const NECTAR_THUMB_GRADIENTS = [
  "#2A1E3D", "#3D1E2E", "#2E1A40", "#341E50", "#3A2840",
] as const;

export const NectarColors: ColorPalette = {
  cream:        "#EEE8F8",
  ink:          "#1A0E2E",
  warmMid:      "#706098",
  accent:       "#B88020",
  accentLight:  "#D4A040",
  cardBg:       "#F8F5FD",
  queued:       "#A898CC",
  divider:      "#DDD5EE",
  green:        "#9A3868",
  background:   "#E0D8F0",
  cardElevated: "#FDFAFE",
  greenText:    "#882E58",
  buttonText:   "#EEE8F8",
  thumbGradients: NECTAR_THUMB_GRADIENTS,
};

export const NectarDarkColors: ColorPalette = {
  cream:        "#140A26",
  ink:          "#E0D0F5",
  warmMid:      "#9888C8",
  accent:       "#D4AA40",
  accentLight:  "#E8C860",
  cardBg:       "#1E1038",
  queued:       "#5A4E88",
  divider:      "#2C1E50",
  green:        "#C05888",
  background:   "#0E0820",
  cardElevated: "#261440",
  greenText:    "#C05888",
  buttonText:   "#E0D0F5",
  thumbGradients: NECTAR_THUMB_GRADIENTS,
};

// ── Bright Tide ────────────────────────────────────────────────

// Deep teals, sea greens, and dark cyans for Bright Tide.
const BRIGHT_TIDE_THUMB_GRADIENTS = [
  "#0D2825", "#143830", "#1A3A38", "#0F302C", "#1F2E2C",
] as const;

export const BrightTideColors: ColorPalette = {
  cream:        "#EDF7F6",
  ink:          "#0D2825",
  warmMid:      "#558480",
  accent:       "#8A3480",
  accentLight:  "#B060A8",
  cardBg:       "#F7FCFB",
  queued:       "#90C0BC",
  divider:      "#C5E5E2",
  green:        "#C85828",
  background:   "#D8F0EE",
  cardElevated: "#FBFFFE",
  greenText:    "#B04820",
  buttonText:   "#EDF7F6",
  thumbGradients: BRIGHT_TIDE_THUMB_GRADIENTS,
};

export const BrightTideDarkColors: ColorPalette = {
  cream:        "#071614",
  ink:          "#C8E5E2",
  warmMid:      "#558480",
  accent:       "#B84A90",
  accentLight:  "#CC68A8",
  cardBg:       "#0D2220",
  queued:       "#2A5048",
  divider:      "#123028",
  green:        "#E07848",
  background:   "#041210",
  cardElevated: "#132C28",
  greenText:    "#E07848",
  buttonText:   "#C8E5E2",
  thumbGradients: BRIGHT_TIDE_THUMB_GRADIENTS,
};

// ── Forest Trail ───────────────────────────────────────────────

// Dark mossy greens, evergreens, and bark browns for Forest Trail.
const FOREST_TRAIL_THUMB_GRADIENTS = [
  "#1E2D1E", "#2D2818", "#1A2820", "#2A2218", "#243018",
] as const;

export const ForestTrailColors: ColorPalette = {
  cream:        "#ECF3EC",
  ink:          "#0E2010",
  warmMid:      "#507855",
  accent:       "#B05530",
  accentLight:  "#C87848",
  cardBg:       "#F5FAF5",
  queued:       "#8AB090",
  divider:      "#C8DEC8",
  green:        "#3A7A9C",
  background:   "#D8EAD8",
  cardElevated: "#FBFDFB",
  greenText:    "#3A7A9C",
  buttonText:   "#ECF3EC",
  thumbGradients: FOREST_TRAIL_THUMB_GRADIENTS,
};

export const ForestTrailDarkColors: ColorPalette = {
  cream:        "#091410",
  ink:          "#C5E5C8",
  warmMid:      "#407848",
  accent:       "#C87848",
  accentLight:  "#DC9A60",
  cardBg:       "#101E12",
  queued:       "#284030",
  divider:      "#142218",
  green:        "#5AA0C8",
  background:   "#050E06",
  cardElevated: "#162418",
  greenText:    "#5AA0C8",
  buttonText:   "#C5E5C8",
  thumbGradients: FOREST_TRAIL_THUMB_GRADIENTS,
};

// ── Open Water ─────────────────────────────────────────────────

// Deep navies, midnight blues, and steel slate-blues for Open Water.
const OPEN_WATER_THUMB_GRADIENTS = [
  "#0E1F2D", "#152838", "#1A2F40", "#0E2438", "#1F2E3D",
] as const;

export const OpenWaterColors: ColorPalette = {
  cream:        "#B4CDE0",
  ink:          "#081B2A",
  warmMid:      "#356080",
  accent:       "#8E5012",
  accentLight:  "#A56828",
  cardBg:       "#D3E8F4",
  queued:       "#82A8C8",
  divider:      "#87B4CC",
  green:        "#CF5E3C",
  background:   "#9ABDD8",
  cardElevated: "#E5F2FA",
  greenText:    "#B85030",
  buttonText:   "#E5F2FA",
  thumbGradients: OPEN_WATER_THUMB_GRADIENTS,
};

export const OpenWaterDarkColors: ColorPalette = {
  cream:        "#0A1826",
  ink:          "#BACFE6",
  warmMid:      "#486E8A",
  accent:       "#CB7A28",
  accentLight:  "#DC9238",
  cardBg:       "#0F1E30",
  queued:       "#213A54",
  divider:      "#172B40",
  green:        "#DC7254",
  background:   "#061220",
  cardElevated: "#152640",
  greenText:    "#DC7254",
  buttonText:   "#BACFE6",
  thumbGradients: OPEN_WATER_THUMB_GRADIENTS,
};

// ── Golden Hour ───────────────────────────────────────────────

// Dark coffee browns, ochres, and walnut tones for Golden Hour.
const GOLDEN_HOUR_THUMB_GRADIENTS = [
  "#4A3D1F", "#3A2D14", "#3D3018", "#2E2A1A", "#403525",
] as const;

export const GoldenHourColors: ColorPalette = {
  cream:        "#F4EAC0",
  ink:          "#221400",
  warmMid:      "#8A6E22",
  accent:       "#4A8AAE",
  accentLight:  "#6AAACE",
  cardBg:       "#FAF4DA",
  queued:       "#C4A84C",
  divider:      "#DECE80",
  green:        "#B05530",
  background:   "#EDE0A8",
  cardElevated: "#FFFEF2",
  greenText:    "#B05530",
  buttonText:   "#FAF4DA",
  thumbGradients: GOLDEN_HOUR_THUMB_GRADIENTS,
};

export const GoldenHourDarkColors: ColorPalette = {
  cream:        "#140E05",
  ink:          "#EDD890",
  warmMid:      "#9E8530",
  accent:       "#78AECE",
  accentLight:  "#90BCDA",
  cardBg:       "#1C1608",
  queued:       "#463A10",
  divider:      "#261C08",
  green:        "#CC7850",
  background:   "#100C04",
  cardElevated: "#231A08",
  greenText:    "#CC7850",
  buttonText:   "#EDD890",
  thumbGradients: GOLDEN_HOUR_THUMB_GRADIENTS,
};

export const FontFamily = {
  serif:      "DMSans_500Medium",
  serifLight: "DMSans_400Regular",
  sans:       "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansLight:  "DMSans_300Light",
} as const;

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const Radius = {
  sm:    8,
  md:    14,
  lg:    18,
  pill:  999,
} as const;

export const FontSize = {
  xxs:  10,
  xs:   12,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,
} as const;
