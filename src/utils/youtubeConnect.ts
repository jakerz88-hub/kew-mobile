/**
 * connectYouTube — in-app YouTube OAuth for already-authenticated users.
 *
 * Lessons applied (see memory/auth_gotchas.md):
 *
 * 1. Grab the current session token BEFORE opening the browser. Use that
 *    specific token to authenticate the backend call — not the access_token
 *    that comes back in the redirect URL. The user is already signed in; we
 *    only need the provider_token (Google OAuth token) to save YouTube access.
 *    This avoids any identity confusion for Apple users going through a Google
 *    OAuth flow to connect YouTube.
 *
 * 2. Do NOT call setSession(). The user is already logged in. Calling it would
 *    fire onAuthStateChange → SIGNED_IN, which triggers fetchUser() in App.tsx
 *    concurrently with the caller's own fetchUser() call.
 *
 * 3. Use a raw fetch() for the backend call rather than api.saveYouTubeToken().
 *    The api helper calls getAuthToken() → getSession() internally, which
 *    is fine here (we're outside onAuthStateChange so no deadlock), but using
 *    the pre-fetched token is explicit and immune to any timing edge cases.
 *
 * 4. The caller is responsible for calling fetchUser() after success to refresh
 *    hasYoutube in the store. This utility is intentionally side-effect-free.
 */

import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { supabase } from "../services/supabase";

export interface YouTubeConnectResult {
  success: boolean;
  error?: string;
}

export async function connectYouTube(): Promise<YouTubeConnectResult> {
  const EAS_PROJECT_ID = "d7d74b72-c5d5-4f5a-95b2-1deacc44b4d4";
  const redirectTo = Constants.appOwnership === "expo"
    ? `exp://u.expo.dev/${EAS_PROJECT_ID}/--/auth/callback`
    : AuthSession.makeRedirectUri({ scheme: "kew", path: "auth/callback" });

  // Capture the current token now. After the browser opens, the redirect
  // URL will contain a new access_token — we intentionally ignore it and
  // use this pre-existing one to authenticate the backend call.
  const { data: sessionData } = await supabase.auth.getSession();
  const currentToken = sessionData.session?.access_token;
  if (!currentToken) return { success: false, error: "Not authenticated." };

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "https://www.googleapis.com/auth/youtube.force-ssl",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (oauthError) return { success: false, error: oauthError.message };
  if (!data?.url) return { success: false, error: "Could not start YouTube authorization." };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  // User cancelled/dismissed — return silently so the caller can ignore it
  if (result.type === "cancel" || result.type === "dismiss") return { success: false };
  if (result.type !== "success" || !result.url) {
    return { success: false, error: "Authorization was not completed." };
  }

  const params = new URLSearchParams(
    result.url.split("#")[1] ?? result.url.split("?")[1] ?? ""
  );
  const providerToken        = params.get("provider_token");
  const providerRefreshToken = params.get("provider_refresh_token");
  const expiresAt            = params.get("expires_at");

  if (!providerToken) {
    return { success: false, error: "YouTube permission was not granted. Please try again." };
  }

  const PROD_API_BASE_URL = "https://kew-backend-production.up.railway.app";
  const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || Constants.expoConfig?.extra?.API_BASE_URL || PROD_API_BASE_URL) as string;
  try {
    const ytResp = await fetch(`${BASE_URL}/v1/profile/youtube-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`,
      },
      body: JSON.stringify({
        access_token:  providerToken,
        refresh_token: providerRefreshToken ?? undefined,
        expires_at:    expiresAt ? Number(expiresAt) : undefined,
      }),
    });

    if (!ytResp.ok) {
      const errText = await ytResp.text().catch(() => "");
      return { success: false, error: `Could not save YouTube token (${ytResp.status}): ${errText}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Could not connect YouTube." };
  }
}
