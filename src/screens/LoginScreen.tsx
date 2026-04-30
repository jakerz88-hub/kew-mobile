import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import { supabase } from "../services/supabase";
import { api } from "../services/api";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { KewLogo, SansText } from "../components/UI";
import { LogoMark } from "../components/TabIcons";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading]       = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [email, setEmail]           = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sendingMagic, setSendingMagic]   = useState(false);

  const EAS_PROJECT_ID = "d7d74b72-c5d5-4f5a-95b2-1deacc44b4d4";
  const redirectTo = Constants.appOwnership === "expo"
    ? `exp://u.expo.dev/${EAS_PROJECT_ID}/--/auth/callback`
    : AuthSession.makeRedirectUri({ scheme: "kew", path: "auth/callback" });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
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
          const params = new URLSearchParams(result.url.split("#")[1] ?? result.url.split("?")[1] ?? "");
          const accessToken         = params.get("access_token");
          const refreshToken        = params.get("refresh_token");
          const providerToken       = params.get("provider_token");
          const providerRefreshToken = params.get("provider_refresh_token");
          if (accessToken) {
            await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken ?? "",
            });
            // Save Google provider token as YouTube access token
            if (providerToken) {
              api.saveYouTubeToken({
                access_token:  providerToken,
                refresh_token: providerRefreshToken ?? undefined,
              }).catch(() => {});
            }
          } else {
            setError("No token in callback URL.");
          }
        } else if (result.type !== "cancel" && result.type !== "dismiss") {
          setError("Auth result: " + result.type);
        }
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoadingApple(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });

      if (authError) throw authError;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === "success" && result.url) {
          const params = new URLSearchParams(result.url.split("#")[1] ?? result.url.split("?")[1] ?? "");
          const accessToken  = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken) {
            await supabase.auth.setSession({
              access_token:  accessToken,
              refresh_token: refreshToken ?? "",
            });
          } else {
            setError("No token in callback URL.");
          }
        } else if (result.type !== "cancel" && result.type !== "dismiss") {
          setError("Auth result: " + result.type);
        }
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoadingApple(false);
    }
  };

  const handleSendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setSendingMagic(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      setMagicLinkSent(true);
    } catch (e: any) {
      setError(e.message || "Could not send magic link. Please try again.");
    } finally {
      setSendingMagic(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={styles.logoLockup}>
              <LogoMark size={40} />
              <KewLogo size={56} />
            </View>
            <SansText style={styles.tagline}>
              Watch intentionally.{"\n"}No algorithm. No autoplay. No noise.
            </SansText>
          </View>

          <View style={styles.howItWorks}>
            {[
              ["☰", "Build a queue from your favorite creators."],
              ["▶", "Watch your curated videos, one at a time."],
              ["→", "Earn skips by watching videos to the end."],
            ].map(([icon, text]) => (
              <View key={icon} style={styles.howItem}>
                <Text style={styles.howIcon}>{icon}</Text>
                <SansText style={styles.howText}>{text}</SansText>
              </View>
            ))}
          </View>

          <View style={styles.ctaSection}>
            {error && <SansText style={styles.errorText}>{error}</SansText>}

            {/* Google */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={loading || loadingApple || sendingMagic}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={colors.buttonText} />
                : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleBtnLabel}>Continue with Google</Text>
                  </>
                )
              }
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity
              style={styles.appleBtn}
              onPress={handleAppleSignIn}
              disabled={loading || loadingApple || sendingMagic}
              activeOpacity={0.8}
            >
              {loadingApple
                ? <ActivityIndicator color={colors.cream} />
                : (
                  <>
                    <Text style={styles.appleIcon}></Text>
                    <Text style={styles.appleBtnLabel}>Continue with Apple</Text>
                  </>
                )
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <SansText style={styles.dividerText}>or</SansText>
              <View style={styles.dividerLine} />
            </View>

            {/* Email magic link */}
            {magicLinkSent ? (
              <View style={styles.magicSentBox}>
                <SansText style={styles.magicSentTitle}>Check your email</SansText>
                <SansText style={styles.magicSentSub}>
                  We sent a sign-in link to {email.trim()}
                </SansText>
              </View>
            ) : (
              <View style={styles.emailSection}>
                <TextInput
                  style={styles.emailInput}
                  placeholder="Your email address"
                  placeholderTextColor={colors.warmMid}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.magicBtn, (loading || loadingApple || sendingMagic) && styles.magicBtnDisabled]}
                  onPress={handleSendMagicLink}
                  disabled={loading || loadingApple || sendingMagic}
                  activeOpacity={0.8}
                >
                  <SansText style={styles.magicBtnLabel}>
                    {sendingMagic ? "Sending…" : "Send magic link"}
                  </SansText>
                </TouchableOpacity>
              </View>
            )}

            <SansText style={styles.disclaimer}>
              Sign in securely. We never post on your behalf.
            </SansText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    inner:           { flexGrow: 1, paddingHorizontal: Spacing.lg, justifyContent: "space-between", paddingVertical: Spacing.xl },
    logoSection:     { alignItems: "center", paddingTop: Spacing.xxl, gap: Spacing.md },
    logoLockup:      { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    tagline:         { fontSize: FontSize.md, color: c.warmMid, textAlign: "center", lineHeight: 24, fontFamily: FontFamily.sansLight },
    howItWorks:      { gap: Spacing.lg, maxWidth: 300, width: "100%", alignSelf: "center" },
    howItem:         { flexDirection: "row", alignItems: "flex-start", gap: Spacing.md },
    howIcon:         { fontSize: 18, width: 28, textAlign: "center", marginTop: 1, color: c.warmMid },
    howText:         { flex: 1, fontSize: FontSize.sm, color: c.warmMid, lineHeight: 20 },
    ctaSection:      { gap: Spacing.sm },
    googleBtn:       { backgroundColor: c.accent, borderRadius: 999, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
    googleIcon:      { fontFamily: FontFamily.serif, fontSize: FontSize.md, color: c.buttonText },
    googleBtnLabel:  { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: c.buttonText, letterSpacing: 0.3 },
    appleBtn:        { backgroundColor: c.ink, borderRadius: 999, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
    appleIcon:       { fontSize: 18, color: c.cream },
    appleBtnLabel:   { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: c.cream, letterSpacing: 0.3 },
    dividerRow:      { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginVertical: Spacing.xs },
    dividerLine:     { flex: 1, height: 1, backgroundColor: c.divider },
    dividerText:     { fontSize: FontSize.xs, color: c.warmMid },
    emailSection:    { gap: Spacing.sm },
    emailInput:      { borderWidth: 1.5, borderColor: c.divider, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: c.ink, backgroundColor: c.cardBg },
    magicBtn:        { backgroundColor: c.cardBg, borderRadius: 999, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.divider },
    magicBtnDisabled: { opacity: 0.5 },
    magicBtnLabel:   { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: c.ink },
    magicSentBox:    { backgroundColor: c.cardBg, borderRadius: Radius.md, padding: Spacing.md, alignItems: "center", gap: Spacing.xs, borderWidth: 1, borderColor: c.divider },
    magicSentTitle:  { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    magicSentSub:    { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center" },
    errorText:       { color: c.accent, fontSize: FontSize.xs, textAlign: "center" },
    disclaimer:      { fontSize: FontSize.xxs, color: c.queued, textAlign: "center", lineHeight: 16, marginTop: Spacing.xs },
  });
}
