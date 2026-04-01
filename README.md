# Kew Mobile — v2

This is the updated version of the Kew mobile app, rewritten to work
correctly with Expo Go for development testing.

## What changed from v1

| Area | v1 | v2 |
|------|----|----|
| Navigation | Expo Router (file-based) | React Navigation |
| Entry point | `app/_layout.tsx` | `App.tsx` |
| YouTube player | `react-native-youtube-iframe` | Custom WebView player |
| Config | `app.config.ts` (TypeScript) | `app.json` (plain JSON) |
| OAuth redirect | Fixed scheme only | Handles Expo Go + production |

## Project structure

```
kew-mobile-v2/
├── App.tsx                          # Entry point + navigation setup
├── app.json                         # Expo config (fill in your keys)
├── babel.config.js
├── package.json
├── assets/                          # icon.png, splash.png etc.
└── src/
    ├── components/
    │   ├── UI.tsx                   # Shared components
    │   └── YouTubePlayer.tsx        # WebView-based YouTube player
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── QueueScreen.tsx
    │   ├── BrowseScreen.tsx
    │   ├── PlayerScreen.tsx
    │   ├── CompletionScreen.tsx
    │   └── HistoryScreen.tsx
    ├── services/
    │   ├── supabase.ts
    │   └── api.ts
    ├── store/
    │   └── index.ts
    └── types/
        ├── index.ts
        └── theme.ts
```

## Setup

1. Fill in `app.json` with your real values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `API_BASE_URL` (your Railway URL)

2. Install dependencies:
   ```
   npm install
   ```

3. Start Expo:
   ```
   npx expo start
   ```

4. Scan the QR code with Expo Go — it should connect immediately
   since React Navigation is fully compatible with Expo Go.

## Notes

- The YouTube player uses a WebView internally. It behaves the same
  as the native player but renders inside a web view.
- OAuth in Expo Go uses the `exp://` redirect scheme automatically.
  In a production build it switches to `kew://`.
- The `app.json` `extra` field is where env vars live. Do not commit
  real keys — use environment variables in CI/EAS builds.
