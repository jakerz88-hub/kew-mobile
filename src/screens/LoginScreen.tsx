import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { supabase } from "../services/supabase";
import { api } from "../services/api";
import { Colors, FontFamily, FontSize, Spacing } from "../types/theme";
import { KewLogo, SansText } from "../components/UI";
import { LogoMark } from "../components/TabIcons";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      // In Expo Go (dev or published), use the EAS project URL so the redirect
      // works for all testers, not just the local machine.
      // In a standalone build, use the kew:// custom scheme.
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

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === "success" && result.url) {
          // Implicit flow — tokens are in the URL hash fragment
          const params = new URLSearchParams(result.url.split("#")[1] ?? result.url.split("?")[1] ?? "");
          const accessToken         = params.get("access_token");
          const refreshToken        = params.get("refresh_token");
          const providerToken       = params.get("provider_token");
          const providerRefreshToken = params.get("provider_refresh_token");
          const expiresAt           = params.get("expires_at");
          if (accessToken) {
            await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken ?? "",
            });
            if (providerToken) {
              await api.saveYouTubeToken({
                access_token:  providerToken,
                refresh_token: providerRefreshToken ?? undefined,
                expires_at:    expiresAt ? Number(expiresAt) : undefined,
              }).catch(console.warn);
              api.syncSubscriptions().catch(console.warn);
            }
          } else {
            setError("No token in callback URL.");
          }
        } else {
          setError("Auth result: " + result.type);
        }
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.logoSection}>
          <View style={styles.logoLockup}>
            <LogoMark size={40} />
            <KewLogo size={56} />
          </View>
          <SansText style={styles.tagline}>
            Push against the pull.{"\n"}Enjoyment {">"} Engagement.
          </SansText>
        </View>

        <View style={styles.howItWorks}>
          {[
            ["☰", "Build a queue from your existing subscriptions."],
            ["▶", "Watch intentionally, one at a time."],
            ["→", "Earn skips by completing videos."],
          ].map(([icon, text]) => (
            <View key={icon} style={styles.howItem}>
              <Text style={styles.howIcon}>{icon}</Text>
              <SansText style={styles.howText}>{text}</SansText>
            </View>
          ))}
        </View>

        <View style={styles.ctaSection}>
          {error && <SansText style={styles.errorText}>{error}</SansText>}
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={loading} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color={Colors.cream} />
              : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnLabel}>Continue with Google</Text>
                </>
              )
            }
          </TouchableOpacity>
          <SansText style={styles.disclaimer}>
            Kew uses your Google account to read your YouTube subscriptions. We never post on your behalf.
          </SansText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  inner: { flex: 1, paddingHorizontal: Spacing.lg, justifyContent: "space-between", paddingVertical: Spacing.xl },
  logoSection: { alignItems: "center", paddingTop: Spacing.xxl, gap: Spacing.md },
  logoLockup: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  tagline: { fontSize: FontSize.md, color: Colors.warmMid, textAlign: "center", lineHeight: 24, fontFamily: FontFamily.sansLight },
  howItWorks: { gap: Spacing.lg, paddingHorizontal: Spacing.sm },
  howItem: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
  howIcon: { fontSize: 18, width: 28, textAlign: "center", marginTop: 1 },
  howText: { flex: 1, fontSize: FontSize.sm, color: Colors.warmMid, lineHeight: 20 },
  ctaSection: { gap: Spacing.md },
  googleBtn: { backgroundColor: Colors.ink, borderRadius: 999, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
  googleIcon: { fontFamily: FontFamily.serif, fontSize: FontSize.md, color: Colors.cream },
  googleBtnLabel: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: Colors.cream, letterSpacing: 0.3 },
  errorText: { color: Colors.accent, fontSize: FontSize.xs, textAlign: "center" },
  disclaimer: { fontSize: FontSize.xxs, color: Colors.queued, textAlign: "center", lineHeight: 16 },
});
