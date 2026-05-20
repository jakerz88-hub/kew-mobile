import React, { useState, useRef, useMemo } from "react";
import { friendlyError } from "../utils/friendlyError";
import {
  View, Text, TextInput, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { supabase } from "../services/supabase";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { KewLogo, SansText, ErrorBanner } from "../components/UI";
import { LogoMark } from "../components/TabIcons";

WebBrowser.maybeCompleteAuthSession();

// Email OTP flow state
type EmailStep = "idle" | "enter_email" | "enter_code";

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Google / Apple loading
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Email OTP flow
  const [emailStep, setEmailStep]     = useState<EmailStep>("idle");
  const [emailInput, setEmailInput]   = useState("");
  const [codeInput, setCodeInput]     = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  const anyLoading = loading || emailLoading;

  // ── Google ────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const EAS_PROJECT_ID = "d7d74b72-c5d5-4f5a-95b2-1deacc44b4d4";
      const redirectTo = Constants.appOwnership === "expo"
        ? `exp://u.expo.dev/${EAS_PROJECT_ID}/--/auth/callback`
        : AuthSession.makeRedirectUri({ scheme: "kew", path: "auth/callback" });

      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "https://www.googleapis.com/auth/youtube.force-ssl",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });

      if (authError) throw authError;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === "success" && result.url) {
          // exchangeCodeForSession wants just the `code` value, not the full callback URL.
          // Passing the URL produces "invalid flow state" because the server tries to
          // match the flow by the literal auth_code string.
          const code = new URL(result.url).searchParams.get("code");
          if (!code) throw new Error("No code in callback URL.");
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          const session = exchangeData.session;
          const accessToken = session.access_token;
          const providerToken = session.provider_token;
          const providerRefreshToken = session.provider_refresh_token;
          const expiresAt = session.expires_at;

          if (providerToken) {
            const PROD_API_BASE_URL = "https://kew-backend-production.up.railway.app";
            const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || Constants.expoConfig?.extra?.API_BASE_URL || PROD_API_BASE_URL) as string;

            const ytResp = await fetch(`${BASE_URL}/v1/profile/youtube-token`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                access_token:  providerToken,
                refresh_token: providerRefreshToken ?? undefined,
                expires_at:    expiresAt ? Number(expiresAt) : undefined,
              }),
            });
            if (!ytResp.ok) {
              const errText = await ytResp.text().catch(() => "");
              throw new Error(`Could not connect YouTube (${ytResp.status}): ${errText}`);
            }

            // Sync subscriptions in the background
            fetch(`${BASE_URL}/v1/channels/sync`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${accessToken}` },
            }).catch(() => {});
          }
        } else {
          setError("Auth result: " + result.type);
        }
      }
    } catch (e: any) {
      setError(friendlyError(e, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Apple ─────────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error("No identity token from Apple.");

      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (authError) throw authError;

      // fullName is only provided on the very first sign-in. Save it while we have it.
      const given  = credential.fullName?.givenName;
      const family = credential.fullName?.familyName;
      if (given || family) {
        const displayName = [given, family].filter(Boolean).join(" ");
        await supabase.auth.updateUser({ data: { full_name: displayName } });
      }
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") return;
      setError(friendlyError(e, "Apple sign-in failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Email OTP ─────────────────────────────────────────────────
  // Magic links sent to the user's email break in Expo Go because the
  // exp://u.expo.dev/... URL is intercepted as an EAS update check rather
  // than routed back to the app. OTP codes work identically in Expo Go
  // and standalone: no deep-link routing needed.
  const handleSendCode = async () => {
    const email = emailInput.trim();
    if (!email) return;
    setEmailLoading(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      setEmailStep("enter_code");
      // Auto-focus the code input after the step transition
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch (e: any) {
      setError(friendlyError(e, "Could not send code. Please try again."));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const email = emailInput.trim();
    const token = codeInput.trim();
    if (!email || token.length < 6) return;
    setEmailLoading(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (verifyError) throw verifyError;
      // Navigation happens automatically via onAuthStateChange in App.tsx
    } catch (e: any) {
      setError(friendlyError(e, "Invalid code. Please try again."));
    } finally {
      setEmailLoading(false);
    }
  };

  const resetEmailFlow = () => {
    setEmailStep("idle");
    setEmailInput("");
    setCodeInput("");
    setError(null);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={styles.logoLockup}>
              <LogoMark size={56} />
              <KewLogo size={72} />
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
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {/* Google — primary */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignIn}
              disabled={anyLoading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={colors.cream} />
                : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleBtnLabel}>Continue with Google</Text>
                  </>
                )
              }
            </TouchableOpacity>

            {/* Apple — secondary, iOS only */}
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={999}
                style={styles.appleBtn}
                onPress={handleAppleSignIn}
              />
            )}

            {/* Email — tertiary */}
            {emailStep === "idle" && (
              <TouchableOpacity
                onPress={() => { setError(null); setEmailStep("enter_email"); }}
                disabled={anyLoading}
                activeOpacity={0.6}
                style={styles.emailToggle}
              >
                <SansText style={styles.emailToggleText}>or continue with email</SansText>
              </TouchableOpacity>
            )}

            {emailStep === "enter_email" && (
              <View style={styles.emailForm}>
                <TextInput
                  style={styles.emailInput}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.warmMid}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onSubmitEditing={handleSendCode}
                  returnKeyType="send"
                  editable={!emailLoading}
                />
                <TouchableOpacity
                  style={[styles.emailSubmitBtn, (emailLoading || !emailInput.trim()) && styles.emailSubmitBtnDisabled]}
                  onPress={handleSendCode}
                  disabled={emailLoading || !emailInput.trim()}
                  activeOpacity={0.8}
                >
                  {emailLoading
                    ? <ActivityIndicator color={colors.cream} size="small" />
                    : <SansText style={styles.emailSubmitBtnText}>Send code</SansText>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={resetEmailFlow} activeOpacity={0.6} style={styles.emailCancelBtn}>
                  <SansText style={styles.emailCancelText}>Cancel</SansText>
                </TouchableOpacity>
              </View>
            )}

            {emailStep === "enter_code" && (
              <View style={styles.emailForm}>
                <SansText style={styles.emailSentHint}>
                  Code sent to {emailInput}
                </SansText>
                <TextInput
                  ref={codeInputRef}
                  style={[styles.emailInput, styles.codeInput]}
                  value={codeInput}
                  onChangeText={setCodeInput}
                  placeholder="000000"
                  placeholderTextColor={colors.warmMid}
                  keyboardType="number-pad"
                  maxLength={6}
                  onSubmitEditing={handleVerifyCode}
                  returnKeyType="done"
                  editable={!emailLoading}
                />
                <TouchableOpacity
                  style={[styles.emailSubmitBtn, (emailLoading || codeInput.trim().length < 6) && styles.emailSubmitBtnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={emailLoading || codeInput.trim().length < 6}
                  activeOpacity={0.8}
                >
                  {emailLoading
                    ? <ActivityIndicator color={colors.cream} size="small" />
                    : <SansText style={styles.emailSubmitBtnText}>Sign in</SansText>
                  }
                </TouchableOpacity>
                <View style={styles.emailFooterRow}>
                  <TouchableOpacity onPress={handleSendCode} disabled={emailLoading} activeOpacity={0.6}>
                    <SansText style={styles.emailCancelText}>Resend code</SansText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={resetEmailFlow} disabled={emailLoading} activeOpacity={0.6}>
                    <SansText style={styles.emailCancelText}>Cancel</SansText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {emailStep === "idle" && (
              <SansText style={styles.disclaimer}>
                Kew uses your Google account to read your YouTube subscriptions. We never post on your behalf.
              </SansText>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.cream },
    inner:        { flexGrow: 1, paddingHorizontal: Spacing.lg, justifyContent: "space-between", paddingVertical: Spacing.xl },
    logoSection:  { alignItems: "center", paddingTop: Spacing.xxl, gap: Spacing.md },
    logoLockup:   { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    tagline:      { fontSize: FontSize.lg, color: c.warmMid, textAlign: "center", lineHeight: 28, fontFamily: FontFamily.sansLight },
    howItWorks:   { gap: Spacing.lg, paddingHorizontal: Spacing.sm },
    howItem:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md },
    howIcon:      { fontSize: FontSize.xl, color: c.ink, textAlign: "center", marginTop: 1 },
    howText:      { fontSize: FontSize.md, color: c.warmMid, lineHeight: 22, textAlign: "center" },
    ctaSection:   { gap: Spacing.md, alignSelf: "center", width: "100%", maxWidth: 340 },

    // Google
    googleBtn:      { backgroundColor: c.accent, borderRadius: Radius.pill, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm },
    googleIcon:     { fontFamily: FontFamily.serif, fontSize: FontSize.md, color: c.cream },
    googleBtnLabel: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: c.cream, letterSpacing: 0.3 },

    // Apple
    appleBtn: { height: 46, width: "100%" },

    // Email toggle link
    emailToggle:     { alignItems: "center", paddingVertical: 2 },
    emailToggleText: { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sans },

    // Email form (shared by enter_email and enter_code steps)
    emailForm:     { gap: Spacing.sm },
    emailSentHint: { fontSize: FontSize.xs, color: c.warmMid, textAlign: "center" },
    emailInput:    {
      height: 46, borderWidth: 1.5, borderColor: c.warmMid, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md, fontSize: FontSize.sm, fontFamily: FontFamily.sans,
      color: c.ink, backgroundColor: c.cream, textAlign: "left",
    },
    codeInput:     { textAlign: "center", letterSpacing: 6, fontSize: FontSize.md },
    emailSubmitBtn:         { backgroundColor: c.ink, borderRadius: Radius.pill, height: 46, alignItems: "center", justifyContent: "center" },
    emailSubmitBtnDisabled: { opacity: 0.45 },
    emailSubmitBtnText:     { fontFamily: FontFamily.sansMedium, fontSize: FontSize.sm, color: c.cream, letterSpacing: 0.3 },
    emailFooterRow:  { flexDirection: "row", justifyContent: "space-between" },
    emailCancelBtn:  { alignItems: "center" },
    emailCancelText: { fontSize: FontSize.xs, color: c.warmMid },

    // Shared
    disclaimer:  { fontSize: FontSize.xxs, color: c.queued, textAlign: "center", lineHeight: 16 },
  });
}
