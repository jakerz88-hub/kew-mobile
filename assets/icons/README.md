# Alternate app icons

PNG assets for `expo-dynamic-app-icon`. Each file is registered as a slot in
`app.json` under the `expo-dynamic-app-icon` plugin block, and the runtime
swap is performed by `setAppIcon(slot)` in `src/screens/AppIconScreen.tsx`.

## Slot inventory

Filename matches the slot key 1:1. Slugs are camelCase, matching the existing
`ThemeId` slugs used elsewhere (see `src/screens/ProfileScreen.tsx`
`PREMIUM_THEMES`).

| Slot                | File                  | Tier         |
|---------------------|-----------------------|--------------|
| `standardLight`     | `standardLight.png`   | Free         |
| `standardDark`      | `standardDark.png`    | Free         |
| `goldenHourLight`   | `goldenHourLight.png` | Kew+         |
| `goldenHourDark`    | `goldenHourDark.png`  | Kew+         |
| `leatherWineLight`  | `leatherWineLight.png`| Kew+         |
| `leatherWineDark`   | `leatherWineDark.png` | Kew+         |
| `nectarLight`       | `nectarLight.png`     | Kew+         |
| `nectarDark`        | `nectarDark.png`      | Kew+         |
| `brightTideLight`   | `brightTideLight.png` | Kew+         |
| `brightTideDark`    | `brightTideDark.png`  | Kew+         |
| `quietForestLight`  | `quietForestLight.png`| Kew+         |
| `quietForestDark`   | `quietForestDark.png` | Kew+         |
| `openWaterLight`    | `openWaterLight.png`  | Kew+         |
| `openWaterDark`     | `openWaterDark.png`   | Kew+         |

## Format

- **Dimensions:** 1024 × 1024
- **Format:** PNG (RGB or RGBA, no transparency at the edges — iOS auto-rounds)
- **Colorspace:** sRGB
- **No alpha at the corners** — they get clipped by iOS to a rounded square.

## Replacing placeholders with real designs

Today these are generated from `kew-web/public/logo-mark.svg` via the
ad-hoc render script. To swap in design's real files:

1. Drop the new PNGs at the same paths/filenames listed above.
2. Confirm dimensions are 1024×1024 and the file is an opaque PNG.
3. Run `./build-staging.sh ios` for a fresh native staging build (icon assets
   are baked at build time and cannot be OTA'd).
4. Once staging is verified, follow the AGENTS.md "staging first" rule before
   merging to main and cutting a new TestFlight build.

The `app.json` `expo-dynamic-app-icon` block is the wiring contract — adding
or removing slots requires a native rebuild. Renaming slots is also a native
change because the slot name is referenced by the iOS `Info.plist`.
