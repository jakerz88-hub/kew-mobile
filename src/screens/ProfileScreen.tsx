import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, SafeAreaView, Alert, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { supabase } from "../services/supabase";
import { api } from "../services/api";
import { SansText, SerifText, Divider, SkipCounter } from "../components/UI";
import { Colors, FontFamily, FontSize, Spacing, Radius } from "../types/theme";

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const USERNAME_MAX = 24;

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, fetchUser } = useStore();

  const [email, setEmail] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  const displayName = user?.displayName;
  const initial = displayName?.charAt(0).toUpperCase() ?? "?";

  const handleStartEdit = () => {
    setUsernameInput(displayName ?? "");
    setUsernameError(null);
    setEditingUsername(true);
  };

  const handleCancelEdit = () => {
    setEditingUsername(false);
    setUsernameError(null);
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setUsernameError("Username cannot be empty.");
      return;
    }
    if (trimmed.length > USERNAME_MAX) {
      setUsernameError(`Must be ${USERNAME_MAX} characters or fewer.`);
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameError("Letters, numbers, and underscores only.");
      return;
    }
    setSavingUsername(true);
    setUsernameError(null);
    try {
      await api.updateUsername(trimmed);
      await fetchUser();
      setEditingUsername(false);
    } catch (e: any) {
      setUsernameError(e?.message ?? "Failed to save username.");
    } finally {
      setSavingUsername(false);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.accent} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Your Profile</SerifText>
        <View style={{ width: 32 }} />
      </View>
      <Divider />

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <SansText style={styles.avatarInitial}>{initial}</SansText>
          </View>

          {/* Username */}
          {editingUsername ? (
            <View style={styles.editBlock}>
              <TextInput
                style={[styles.usernameInput, usernameError ? styles.usernameInputError : null]}
                value={usernameInput}
                onChangeText={t => { setUsernameInput(t); setUsernameError(null); }}
                placeholder="Enter username"
                placeholderTextColor={Colors.warmMid}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={USERNAME_MAX}
                autoFocus
              />
              <SansText style={styles.charCount}>
                {usernameInput.trim().length}/{USERNAME_MAX}
              </SansText>
              {usernameError && (
                <SansText style={styles.inputError}>{usernameError}</SansText>
              )}
              <View style={styles.editBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} activeOpacity={0.7}>
                  <SansText style={styles.cancelBtnText}>Cancel</SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, savingUsername && styles.saveBtnDisabled]}
                  onPress={handleSaveUsername}
                  disabled={savingUsername}
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
              <TouchableOpacity onPress={handleStartEdit} activeOpacity={0.7} style={styles.editIconBtn}>
                <SansText style={styles.editIconText}>{displayName ? "Edit" : "Set"}</SansText>
              </TouchableOpacity>
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

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <SansText style={styles.signOutText}>Sign out</SansText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.cream },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerTitle:     { fontSize: FontSize.md, color: Colors.ink },
  backBtn:         { padding: 4 },
  content:         { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  avatarSection:   { alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xl },
  avatar:          { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarInitial:   { color: Colors.cream, fontSize: 28, fontFamily: FontFamily.sansMedium },
  usernameRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  displayName:     { fontSize: FontSize.md, color: Colors.ink },
  editIconBtn:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.divider },
  editIconText:    { fontSize: FontSize.xxs, color: Colors.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.5 },
  emailText:       { fontSize: FontSize.xs, color: Colors.warmMid },
  editBlock:       { width: "100%", alignItems: "center", gap: Spacing.xs },
  usernameInput:   { width: "100%", borderWidth: 1.5, borderColor: Colors.divider, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.sm, fontFamily: FontFamily.sansRegular, color: Colors.ink, backgroundColor: Colors.cardBg, textAlign: "center" },
  usernameInputError: { borderColor: Colors.accent },
  charCount:       { fontSize: FontSize.xxs, color: Colors.warmMid },
  inputError:      { fontSize: FontSize.xxs, color: Colors.accent },
  editBtnRow:      { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn:       { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.divider, alignItems: "center" },
  cancelBtnText:   { fontSize: FontSize.sm, color: Colors.warmMid },
  saveBtn:         { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill, backgroundColor: Colors.ink, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { fontSize: FontSize.sm, color: Colors.cream, fontFamily: FontFamily.sansMedium },
  card:            { backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs, marginBottom: Spacing.md },
  cardRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel:       { fontSize: FontSize.sm, color: Colors.ink, fontFamily: FontFamily.sansMedium },
  cardHint:        { fontSize: FontSize.xxs, color: Colors.warmMid, lineHeight: 16, fontStyle: "italic" },
  signOutBtn:      { marginTop: Spacing.sm, borderWidth: 1.5, borderColor: Colors.divider, borderRadius: Radius.pill, paddingVertical: Spacing.sm + 2, alignItems: "center" },
  signOutText:     { fontSize: FontSize.sm, color: Colors.warmMid, fontFamily: FontFamily.sansMedium },
});
