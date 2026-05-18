import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { supabase } from "../services/supabase";
import { Colors, FontFamily, FontSize, Spacing } from "../types/theme";
import { KewLogo, SansText } from "../components/UI";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      // In Expo Go, use exp:// scheme. In production builds, use kew://
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: Constants.appOwnership === "expo" ? undefined : "kew",
        path: "auth/callback",
      });

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
          // Extract tokens from the URL and set the session
          const url = new URL(result.url);
          const accessToken  = url.searchParams.get("access_token");
          const refreshToken = url.searchParams.get("refresh_token");
          if (accessToken) {
            await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken ?? "",
            });
          }
        } else if (result.type !== "success") {
          setError("Sign-in was cancelled.");
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
          <KewLogo size={56} />
          <SansText style={styles.tagline}>
            Watch intentionally.{"\n"}One video at a time.
          </SansText>
        </View>

        <View style={styles.howItWorks}>
          {[
            ["☰", "Browse your subscriptions and add videos to your queue."],
            ["▶", "Watch the video at the front - your queue, in order."],
            ["→", "Finish it to unlock the next one."],
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
