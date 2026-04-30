import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { supabase } from "../services/supabase";
import { api } from "../services/api";

export interface YouTubeConnectResult {
  success: boolean;
  error?: string;
}

export async function connectYouTube(): Promise<YouTubeConnectResult> {
  try {
    const EAS_PROJECT_ID = "d7d74b72-c5d5-4f5a-95b2-1deacc44b4d4";
    const redirectTo = Constants.appOwnership === "expo"
      ? `exp://u.expo.dev/${EAS_PROJECT_ID}/--/auth/callback`
      : AuthSession.makeRedirectUri({ scheme: "kew", path: "auth/callback" });

    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "https://www.googleapis.com/auth/youtube.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (authError) throw authError;
    if (!data?.url) throw new Error("No OAuth URL returned.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== "success" || !result.url) {
      if (result.type === "cancel" || result.type === "dismiss") {
        return { success: false, error: "Cancelled." };
      }
      return { success: false, error: "Auth result: " + result.type };
    }

    const params = new URLSearchParams(
      result.url.split("#")[1] ?? result.url.split("?")[1] ?? ""
    );

    const providerToken        = params.get("provider_token");
    const providerRefreshToken = params.get("provider_refresh_token");
    const expiresAt            = params.get("expires_at");

    if (!providerToken) {
      return { success: false, error: "No YouTube permission returned. Please try again." };
    }

    // NOTE: we intentionally do NOT call supabase.auth.setSession() here.
    // The existing session is valid for the backend API call — we only need
    // the provider_token (Google access token) from the redirect hash.
    // Calling setSession() would fire onAuthStateChange → SIGNED_IN which
    // triggers concurrent fetchUser() calls in App.tsx and can interfere
    // with the handleConnectYouTube flow in ProfileScreen.

    // Fetch the Google email for duplicate detection
    let googleEmail: string | undefined;
    try {
      const userinfoRes = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${providerToken}`
      );
      if (userinfoRes.ok) {
        const info = await userinfoRes.json();
        googleEmail = info.email ?? undefined;
      }
    } catch {
      // Non-fatal — proceed without email
    }

    await api.saveYouTubeToken({
      access_token:  providerToken,
      refresh_token: providerRefreshToken ?? undefined,
      expires_at:    expiresAt ? Number(expiresAt) : undefined,
      google_email:  googleEmail,
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Something went wrong. Please try again." };
  }
}
