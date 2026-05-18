// ESLint 9 flat config for kew-mobile-v2.
//
// Tier 1 rules (error) — no existing violations after audit; block PRs immediately.
// Tier 2 rules (warn)  — existing violations surface as warnings; flip to error
//                        per-rule once the codebase is clean (see comments below).
//
// Allowlisted paths (never trigger T2 color/font rules):
//   src/types/theme.ts  — defines all raw tokens by necessity

const tsParser = require("@typescript-eslint/parser");
const globals  = require("globals");

const noEmDash          = require("./eslint-rules/no-em-dash");
const noSystemFontFamily = require("./eslint-rules/no-system-font-family");
const noRawColors       = require("./eslint-rules/no-raw-colors");
const noRawFontSize     = require("./eslint-rules/no-raw-font-size");
const noRawWhite        = require("./eslint-rules/no-raw-white");
const noBorderRadius999 = require("./eslint-rules/no-border-radius-999");

const kewPlugin = {
  rules: {
    "no-em-dash":           noEmDash,
    "no-system-font-family": noSystemFontFamily,
    "no-raw-colors":        noRawColors,
    "no-raw-font-size":     noRawFontSize,
    "no-raw-white":         noRawWhite,
    "no-border-radius-999": noBorderRadius999,
  },
};

module.exports = [
  // ── Ignore non-source paths ────────────────────────────────────────────────
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "android/**",
      "ios/**",
      "eslint-rules/**",   // rule definitions themselves may use raw values
      "app/**",            // abandoned Expo Router migration — entry point is index.js → App.tsx
    ],
  },

  // ── Source files ──────────────────────────────────────────────────────────
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { kew: kewPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // ── Tier 1: error ──────────────────────────────────────────────────────
      // No existing violations — blocks PRs from day one.
      "kew/no-em-dash":            "error", // U+2014 em dash in JSX text
      "kew/no-system-font-family": "error", // fontFamily string literal (use FontFamily.*)

      // ── Tier 2: warn → escalate to error after cleanup pass ────────────────
      // Flip each rule to "error" once `npm run lint` reports 0 warnings for it.
      "kew/no-raw-colors":        "warn",  // raw #hex / rgba() → theme token
      "kew/no-raw-font-size":     "warn",  // numeric fontSize → FontSize.*
      "kew/no-raw-white":         "error", // color:"white" → colors.cream/buttonText (ratcheted 2026-05-18)
      "kew/no-border-radius-999": "error", // borderRadius:999 → Radius.pill (ratcheted 2026-05-18)
    },
  },
];
