import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, SafeAreaView, Alert, TextInput, Image, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  const displayName = user?.displayName;
  const initial = displayName?.charAt(0).toUpperCase() ?? "?";
  const avatarUrl = user?.avatarUrl;

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
          Alert.alert("Permission needed", "Please allow access to your photo library in Settings.");
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
          Alert.alert("Permission needed", "Please allow camera access in Settings.");
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
      Alert.alert("Error", e?.message ?? "Failed to pick image.");
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
      Alert.alert("Upload failed", e?.message ?? "Could not upload photo.");
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
      Alert.alert("Error", e?.message ?? "Could not remove photo.");
    } finally {
      setUploadingAvatar(false);
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
  avatarWrapper:   { position: "relative", marginBottom: 4 },
  avatar:          { width: 80, height: 80, borderRadius: 40 },
  avatarFallback:  { backgroundColor: Colors.green, alignItems: "center", justifyContent: "center" },
  avatarInitial:   { color: Colors.cream, fontSize: 30, fontFamily: FontFamily.sansMedium },
  avatarOverlay:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  avatarEditBadge: { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.cream },
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
