import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, TouchableOpacity, StyleSheet, SafeAreaView, Alert, TextInput, Image, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useStore } from "../store";
import { supabase } from "../services/supabase";
import { api } from "../services/api";
import { connectYouTube } from "../utils/youtubeConnect";

import { SansText, SerifText, Divider, SkipCounter, Toast, ErrorBanner } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme, type ThemeId } from "../contexts/ThemeContext";
import { MiniWeekChart } from "./InsightsScreen";
import { ProIcon } from "../components/ProIcon";
import type { Insights } from "../types";

type PremiumTheme = {
  id: ThemeId;
  name: string;
  available: boolean;
};

const PREMIUM_THEMES: PremiumTheme[] = [
  { id: "goldenHour",  name: "Golden Hour",      available: true },
  { id: "leatherWine", name: "Leather & Wine",   available: true },
  { id: "nectar",      name: "Starlight Nectar", available: true },
  { id: "brightTide",  name: "Bright Tide",      available: true },
  { id: "quietForest", name: "Forest Trail",     available: true },
  { id: "openWater",   name: "Open Water",       available: true },
];

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const USERNAME_MAX = 24;

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, fetchUser } = useStore();
  const { colors, mode, setMode, themeId, setThemeId } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [ytConnecting, setYtConnecting] = useState(false);
  const [ytDisconnecting, setYtDisconnecting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [insightsPreview, setInsightsPreview] = useState<Insights | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  // Load insights preview for the collapsed card (Pro only)
  useEffect(() => {
    if (user?.plan !== "pro") { setInsightsPreview(null); return; }
    api.getInsights("week").then(setInsightsPreview).catch(() => setInsightsPreview(null));
  }, [user?.plan]);

  const displayName = user?.displayName;
  const initial = displayName?.charAt(0).toUpperCase() ?? "?";
  const avatarUrl = user?.avatarUrl;

  const handleStartEdit = () => {
    setUsernameInput("");
    setUsernameError(null);
    setAvailability("idle");
    setEditingUsername(true);
  };

  const handleCancelEdit = () => {
    setEditingUsername(false);
    setUsernameError(null);
    setAvailability("idle");
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
  };

  const handleUsernameInput = (value: string) => {
    setUsernameInput(value);
    setUsernameError(null);
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    const trimmed = value.trim();
    if (!trimmed || !USERNAME_REGEX.test(trimmed) || trimmed.length > USERNAME_MAX) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    checkTimerRef.current = setTimeout(async () => {
      try {
        const result = await api.checkUsername(trimmed);
        setAvailability(result.available ? "available" : "taken");
      } catch {
        setAvailability("idle");
      }
    }, 500);
  };

  const handleSaveUsername = () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) { setUsernameError("Username cannot be empty."); return; }
    if (trimmed.length > USERNAME_MAX) { setUsernameError(`Must be ${USERNAME_MAX} characters or fewer.`); return; }
    if (!USERNAME_REGEX.test(trimmed)) { setUsernameError("Letters, numbers, and underscores only."); return; }
    if (availability !== "available") return;

    Alert.alert(
      "Set username",
      `"${trimmed}" will be your permanent username. It can't be changed later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set username",
          onPress: async () => {
            setSavingUsername(true);
            setUsernameError(null);
            try {
              await api.updateUsername(trimmed);
              await fetchUser();
              setEditingUsername(false);
              setAvailability("idle");
            } catch (e: any) {
              const msg = e?.message ?? "Failed to save username.";
              if (msg.toLowerCase().includes("taken") || msg.includes("409")) {
                setAvailability("taken");
                setUsernameError("That username is already taken.");
              } else {
                setUsernameError(msg);
              }
            } finally {
              setSavingUsername(false);
            }
          },
        },
      ]
    );
  };

  const handleAvatarPress = () => {
    const options: { text: string; onPress?: () => void; style?: "cancel" | "destructive" | "default" }[] = [
      { text: "Choose from Library", onPress: () => pickImage("library") },
      { text: "Take a Photo", onPress: () => pickImage("camera") },
    ];
    if (avatarUrl) {
      options.push({ text: "Remove Photo", style: "destructive", onPress: handleRemoveAvatar });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Profile Photo", "Update your profile picture", options);
  };

  const pickImage = async (source: "library" | "camera") => {
    try {
      let result;
      if (source === "library") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setProfileError("Please allow access to your photo library in Settings.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setProfileError("Please allow camera access in Settings.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadAvatar(result.assets[0].uri);
    } catch (e: any) {
      setProfileError(e?.message ?? "Failed to pick image.");
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const userId = session.user.id;

      // Fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage (upsert to overwrite)
      const filePath = `${userId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Bust cache by appending a timestamp
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      // Save URL to profile
      await api.updateAvatar(cacheBustedUrl);
      await fetchUser();
    } catch (e: any) {
      setProfileError(e?.message ?? "Could not upload photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const userId = session.user.id;

      await supabase.storage.from("avatars").remove([`${userId}.jpg`]);
      await api.updateAvatar(null);
      await fetchUser();
    } catch (e: any) {
      setProfileError(e?.message ?? "Could not remove photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncSubscriptions();
      showToast("Subscriptions synced");
    } catch (e: any) {
      setProfileError(e?.message ?? "Could not sync your YouTube account.");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectYouTube = async () => {
    setYtConnecting(true);
    setProfileError(null);
    try {
      const { success, error } = await connectYouTube();
      if (!success) {
        if (error) setProfileError(error);
        return;
      }
      await fetchUser();
      showToast("YouTube connected");
    } catch (e: any) {
      setProfileError(e?.message ?? "Could not connect YouTube.");
    } finally {
      setYtConnecting(false);
    }
  };

  const handleDisconnectYouTube = () => {
    Alert.alert(
      "Disconnect YouTube",
      "This will remove your YouTube connection. Your queue will remain, but you won't be able to browse subscriptions or import playlists.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setYtDisconnecting(true);
            try {
              await api.disconnectYouTube();
              await fetchUser();
              showToast("YouTube disconnected");
            } catch (e: any) {
              setProfileError(e?.message ?? "Could not disconnect YouTube.");
            } finally {
              setYtDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all your data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount();
              await supabase.auth.signOut();
            } catch (e: any) {
              setProfileError(e?.message ?? "Could not delete account. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Your Profile</SerifText>
        <View style={{ flex: 1 }} />
      </View>
      <Divider />

      {profileError && <ErrorBanner message={profileError} onDismiss={() => setProfileError(null)} />}

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={styles.avatarWrapper} disabled={uploadingAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <SansText style={styles.avatarInitial}>{initial}</SansText>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="white" size="small" />
              </View>
            ) : (
              <View style={styles.avatarEditBadge}>
                <Feather name="camera" size={10} color="white" />
              </View>
            )}
          </TouchableOpacity>

          {/* Username */}
          {editingUsername ? (
            <View style={styles.editBlock}>
              <TextInput
                style={[styles.usernameInput, usernameError ? styles.usernameInputError : null]}
                value={usernameInput}
                onChangeText={handleUsernameInput}
                placeholder="Enter username"
                placeholderTextColor={colors.warmMid}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={USERNAME_MAX}
                autoFocus
              />
              {/* Char count + availability */}
              <View style={styles.availabilityRow}>
                <SansText style={styles.charCount}>{usernameInput.trim().length}/{USERNAME_MAX}</SansText>
                {availability === "checking" && <SansText style={styles.availChecking}>Checking…</SansText>}
                {availability === "available" && <SansText style={styles.availAvailable}>Available</SansText>}
                {availability === "taken" && <SansText style={styles.availTaken}>Already taken</SansText>}
              </View>
              {usernameError && (
                <SansText style={styles.inputError}>{usernameError}</SansText>
              )}
              <View style={styles.editBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} activeOpacity={0.7}>
                  <SansText style={styles.cancelBtnText}>Cancel</SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (savingUsername || availability !== "available") && styles.saveBtnDisabled]}
                  onPress={handleSaveUsername}
                  disabled={savingUsername || availability !== "available"}
                  activeOpacity={0.7}
                >
                  <SansText style={styles.saveBtnText}>{savingUsername ? "Saving…" : "Save"}</SansText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.usernameRow}>
              <SerifText style={styles.displayName}>
                {displayName ?? "Set a username"}
              </SerifText>
              {user?.plan === "pro" && <ProIcon />}
              {!displayName && (
                <TouchableOpacity onPress={handleStartEdit} activeOpacity={0.7} style={styles.editIconBtn}>
                  <SansText style={styles.editIconText}>Set</SansText>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Email */}
          {email && (
            <SansText style={styles.emailText}>{email}</SansText>
          )}
        </View>

        {/* Skip counter */}
        {user && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <SansText style={styles.cardLabel}>Skips remaining</SansText>
              <SkipCounter remaining={user.skipsRemaining} max={user.skipsMax} />
            </View>
            <SansText style={styles.cardHint}>
              You earn a skip back each time you finish a video.
            </SansText>
          </View>
        )}

        {/* Insights & Limits — Pro only */}
        {user?.plan === "pro" && (
          <TouchableOpacity
            style={styles.insightsCard}
            onPress={() => navigation.navigate("Insights")}
            activeOpacity={0.8}
          >
            <View style={styles.cardRow}>
              <SansText style={styles.cardLabel}>Insights & Limits</SansText>
              <Feather name="chevron-right" size={15} color={colors.warmMid} />
            </View>
            {insightsPreview ? (
              <>
                <View style={{ marginTop: Spacing.xs }}>
                  <MiniWeekChart breakdown={insightsPreview.dailyBreakdown} colors={colors} />
                </View>
                <SansText style={styles.insightsSentence}>
                  {insightsPreview.insightSentence}
                </SansText>
              </>
            ) : (
              <SansText style={styles.cardHint}>Loading your week…</SansText>
            )}
          </TouchableOpacity>
        )}

        {/* Appearance card */}
        <View style={styles.themeCard}>
          {/* Mode toggle */}
          <SansText style={styles.themeCardLabel}>Appearance</SansText>
          <View style={styles.themePill}>
            {(["system", "light", "dark"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.themeOption, mode === m && styles.themeOptionActive]}
                onPress={() => setMode(m)}
                activeOpacity={0.7}
              >
                <SansText style={[styles.themeOptionText, mode === m && styles.themeOptionTextActive]}>
                  {m === "system" ? "Auto" : m.charAt(0).toUpperCase() + m.slice(1)}
                </SansText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Premium Themes — only visible to pro users */}
          {user?.plan === "pro" && (
            <>
              <View style={styles.premiumDivider} />
              <SansText style={styles.premiumLabel}>Premium Themes</SansText>
              {/* Row 1 — first 3 pills */}
              <View style={styles.themePillRow}>
                {PREMIUM_THEMES.slice(0, 3).map((theme) => {
                  const isSelected = themeId === theme.id;
                  return (
                    <TouchableOpacity
                      key={theme.id}
                      style={[
                        styles.themePillBtn,
                        isSelected ? styles.themePillBtnSelected : theme.available ? styles.themePillBtnAvailable : styles.themePillBtnMuted,
                      ]}
                      onPress={() => theme.available ? setThemeId(isSelected ? "standard" : theme.id) : undefined}
                      activeOpacity={theme.available ? 0.7 : 1}
                    >
                      <SansText style={[
                        styles.themePillBtnText,
                        isSelected ? styles.themePillBtnTextSelected : !theme.available && styles.themePillBtnTextMuted,
                      ]}>
                        {theme.name}
                      </SansText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Row 2 — last 3 pills */}
              <View style={[styles.themePillRow, { marginTop: Spacing.xs }]}>
                {PREMIUM_THEMES.slice(3).map((theme) => {
                  const isSelected = themeId === theme.id;
                  return (
                    <TouchableOpacity
                      key={theme.id}
                      style={[
                        styles.themePillBtn,
                        isSelected ? styles.themePillBtnSelected : theme.available ? styles.themePillBtnAvailable : styles.themePillBtnMuted,
                      ]}
                      onPress={() => theme.available ? setThemeId(isSelected ? "standard" : theme.id) : undefined}
                      activeOpacity={theme.available ? 0.7 : 1}
                    >
                      <SansText style={[
                        styles.themePillBtnText,
                        isSelected ? styles.themePillBtnTextSelected : !theme.available && styles.themePillBtnTextMuted,
                      ]}>
                        {theme.name}
                      </SansText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* YouTube connection */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <SansText style={styles.cardLabel}>YouTube</SansText>
            {user?.hasYoutube ? (
              <SansText style={styles.ytConnectedBadge}>Connected</SansText>
            ) : null}
          </View>
          {user?.hasYoutube ? (
            <View style={{ gap: 6 }}>
              <TouchableOpacity
                style={styles.ytConnectBtn}
                onPress={handleSync}
                disabled={syncing}
                activeOpacity={0.7}
              >
                <Feather name="refresh-cw" size={13} color="#fff" style={{ marginRight: 6 }} />
                <SansText style={styles.ytConnectBtnText}>
                  {syncing ? "Syncing…" : "Sync Accounts"}
                </SansText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDisconnectYouTube}
                disabled={ytDisconnecting}
                activeOpacity={0.7}
                style={{ alignItems: "center", paddingVertical: 6 }}
              >
                <SansText style={{ fontSize: 12, color: colors.warmMid }}>
                  {ytDisconnecting ? "Disconnecting…" : "Disconnect YouTube"}
                </SansText>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.ytConnectBtn, ytConnecting && { opacity: 0.6 }]}
              onPress={handleConnectYouTube}
              disabled={ytConnecting}
              activeOpacity={0.7}
            >
              <SansText style={styles.ytConnectBtnText}>
                {ytConnecting ? "Connecting…" : "Connect YouTube"}
              </SansText>
            </TouchableOpacity>
          )}
        </View>

        {/* Help */}
        <TouchableOpacity style={styles.helpBtn} onPress={() => navigation.navigate("Help")} activeOpacity={0.7}>
          <SansText style={styles.helpBtnText}>Help</SansText>
          <Feather name="chevron-right" size={15} color={colors.warmMid} />
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <SansText style={styles.signOutText}>Sign out</SansText>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <SansText style={styles.deleteBtnText}>Delete account</SansText>
        </TouchableOpacity>
      </View>

      <Toast message={toastMsg} visible={toastVisible} />
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    headerTitle:     { fontSize: FontSize.md, color: c.ink, textAlign: "center" },
    backBtn:         { flex: 1, padding: 4 },
    content:         { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
    avatarSection:   { alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xl },
    avatarWrapper:   { position: "relative" },
    avatar:          { width: 80, height: 80, borderRadius: 40 },
    avatarFallback:  { backgroundColor: c.green, alignItems: "center", justifyContent: "center" },
    avatarInitial:   { color: "white", fontSize: 30, fontFamily: FontFamily.sansMedium },
    avatarOverlay:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
    avatarEditBadge: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.cream },
    usernameRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
    displayName:     { fontSize: FontSize.md, color: c.ink },
    editIconBtn:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.divider },
    editIconText:    { fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.5 },
    emailText:       { fontSize: FontSize.xs, color: c.warmMid },
    editBlock:       { width: "100%", maxWidth: 400, alignSelf: "center", alignItems: "center", gap: Spacing.xs },
    usernameInput:   { width: "100%", borderWidth: 1.5, borderColor: c.divider, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: c.ink, backgroundColor: c.cardBg, textAlign: "center" },
    usernameInputError: { borderColor: c.accent },
    availabilityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" },
    charCount:       { fontSize: FontSize.xxs, color: c.warmMid },
    availChecking:   { fontSize: FontSize.xxs, color: c.warmMid },
    availAvailable:  { fontSize: FontSize.xxs, color: c.greenText },
    availTaken:      { fontSize: FontSize.xxs, color: c.accent },
    inputError:      { fontSize: FontSize.xxs, color: c.accent },
    editBtnRow:      { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    cancelBtn:       { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.divider, alignItems: "center" },
    cancelBtnText:   { fontSize: FontSize.sm, color: c.warmMid },
    saveBtn:         { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, backgroundColor: c.ink, alignItems: "center" },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText:     { fontSize: FontSize.sm, color: c.cream, fontFamily: FontFamily.sansMedium },
    card:            { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs, marginBottom: Spacing.md, maxWidth: 400, width: "100%", alignSelf: "center" },
    insightsCard:    { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs, marginBottom: Spacing.md, maxWidth: 400, width: "100%", alignSelf: "center" },
    insightsSentence:{ fontSize: FontSize.xs, color: c.warmMid, lineHeight: 17, marginTop: Spacing.xs, fontStyle: "italic" },
    cardRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardLabel:       { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    cardHint:        { fontSize: FontSize.xxs, color: c.warmMid, lineHeight: 16, fontStyle: "italic" },
    // Theme toggle
    themeCard:       { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.xs, maxWidth: 400, width: "100%", alignSelf: "center" },
    themeCardLabel:  { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium, marginBottom: Spacing.sm },
    themePill:            { flexDirection: "row", backgroundColor: c.divider, borderRadius: Radius.pill, padding: 3 },
    themeOption:          { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: Radius.pill },
    themeOptionActive:    { backgroundColor: c.cardElevated, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
    themeOptionText:      { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    themeOptionTextActive: { color: c.ink },
    // Premium themes
    premiumDivider:           { height: 1, backgroundColor: c.divider, marginVertical: Spacing.sm },
    premiumLabel:             { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium, marginBottom: Spacing.xs },
    themePillRow:             { flexDirection: "row", gap: Spacing.xs },
    themePillBtn:             { flex: 1, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, alignItems: "center" },
    themePillBtnAvailable:    { borderColor: c.divider, backgroundColor: c.cardBg },
    themePillBtnMuted:        { borderColor: c.divider, backgroundColor: c.cardBg },
    themePillBtnSelected:     { borderColor: c.accent, backgroundColor: c.accent },
    themePillBtnText:         { fontSize: FontSize.xxs + 1, fontFamily: FontFamily.sansMedium, color: c.ink },
    themePillBtnTextSelected: { color: "white" },
    themePillBtnTextMuted:    { color: c.queued },
    ytConnectedBadge:   { fontSize: FontSize.xs, color: c.greenText, fontFamily: FontFamily.sansMedium },
    ytConnectBtn:       { marginTop: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: c.accent, borderRadius: Radius.pill, alignItems: "center" },
    ytConnectBtnText:   { fontSize: FontSize.sm, color: "white", fontFamily: FontFamily.sansMedium },
    ytDisconnectBtn:    { marginTop: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.pill, alignItems: "center" },
    ytDisconnectBtnText: { fontSize: FontSize.sm, color: c.warmMid, fontFamily: FontFamily.sans },
    syncAccountsBtn:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs, maxWidth: 400, width: "100%", alignSelf: "center", backgroundColor: c.cardBg },
    syncAccountsBtnText: { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    helpBtn:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, marginBottom: Spacing.xs, maxWidth: 400, width: "100%", alignSelf: "center", backgroundColor: c.cardBg },
    helpBtnText:     { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    signOutBtn:      { marginTop: Spacing.xs, borderWidth: 1.5, borderColor: c.accent, borderRadius: Radius.pill, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.xl, alignItems: "center", alignSelf: "center" },
    signOutText:     { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },
    deleteBtn:       { marginTop: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: "center", alignSelf: "center" },
    deleteBtnText:   { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sans },
  });
}
