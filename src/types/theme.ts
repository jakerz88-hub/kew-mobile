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
} as const;

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
};

// ── Leather & Wine ────────────────────────────────────────────

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
};

// ── Starlight Nectar ───────────────────────────────────────────

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
};

// ── Bright Tide ────────────────────────────────────────────────

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
};

// ── Forest Trail ───────────────────────────────────────────────

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
};

// ── Open Water ─────────────────────────────────────────────────

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
};

// ── Golden Hour ───────────────────────────────────────────────

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
