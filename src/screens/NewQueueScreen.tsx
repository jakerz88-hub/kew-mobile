import React, { useEffect, useState, useMemo } from "react";
import {
  View, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ScrollView, Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, SerifText, Divider } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";

const VIBE_PILLS = [
  "Workout Watch",
  "Chill Vibes",
  "Sweet Jams",
  "Deep Dives",
  "Film Night",
  "Weekend Watch",
  "Learn Something",
  "Gaming",
];

const EMOJI_OPTIONS = [
  "🎬", "🎵", "📚", "🏋️",
  "🌿", "🌙", "✈️", "🎮",
  "🍎", "💡", "🎨", "⚡",
  "🌈", "🧪", "😎", "🤖",
];

export default function NewQueueScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { user, createQueue } = useStore();

  const [name, setName]               = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);

  // Pro guard — navigate back immediately if free user
  useEffect(() => {
    if (user && user.plan !== "pro") {
      navigation.goBack();
    }
  }, [user]);

  const handleVibePill = (vibe: string) => {
    setName(vibe);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(prev => (prev === emoji ? null : emoji));
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createQueue(trimmed, selectedEmoji);
      navigation.navigate("AllQueues");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create queue.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
        >
          <Feather name="chevron-left" size={24} color={colors.ink} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>New queue</SerifText>
        <View style={{ width: 32 }} />
      </View>
      <Divider />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Queue name */}
        <View style={styles.section}>
          <SansText style={styles.sectionLabel}>Queue name</SansText>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Film Night"
            placeholderTextColor={colors.warmMid}
            autoFocus
            returnKeyType="done"
            maxLength={60}
          />
        </View>

        {/* Vibe pills */}
        <View style={styles.section}>
          <SansText style={styles.sectionLabel}>Or pick a vibe</SansText>
          <View style={styles.vibePills}>
            {VIBE_PILLS.map(vibe => (
              <TouchableOpacity
                key={vibe}
                style={[styles.vibePill, name === vibe && styles.vibePillActive]}
                onPress={() => handleVibePill(vibe)}
                activeOpacity={0.7}
              >
                <SansText style={[styles.vibePillText, name === vibe && styles.vibePillTextActive]}>
                  {vibe}
                </SansText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Emoji picker */}
        <View style={styles.section}>
          <SansText style={styles.sectionLabel}>Choose an icon (optional)</SansText>
          <View style={styles.emojiGrid}>
            {EMOJI_OPTIONS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiCell, selectedEmoji === emoji && styles.emojiCellActive]}
                onPress={() => handleEmojiSelect(emoji)}
                activeOpacity={0.7}
              >
                <SansText style={styles.emojiChar}>{emoji}</SansText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, (!name.trim() || creating) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || creating}
          activeOpacity={0.8}
        >
          <SansText style={styles.createBtnText}>
            {creating ? "Creating…" : "Create queue"}
          </SansText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    headerTitle:     { fontSize: FontSize.lg },
    scrollContent:   { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 60 },

    section:         { gap: Spacing.xs },
    sectionLabel: {
      fontSize: FontSize.xxs, color: c.warmMid,
      textTransform: "uppercase", letterSpacing: 0.8,
      fontFamily: FontFamily.sansMedium, marginBottom: 2,
    },
    nameInput: {
      backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider,
      borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
      fontSize: FontSize.md, color: c.ink, fontFamily: FontFamily.sans,
    },

    vibePills:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    vibePill: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: Radius.pill, borderWidth: 1, borderColor: c.divider,
      backgroundColor: c.cardBg,
    },
    vibePillActive:  { backgroundColor: c.accent, borderColor: c.accent },
    vibePillText: {
      fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium,
    },
    vibePillTextActive: { color: "#fff" },

    emojiGrid: {
      flexDirection: "row", flexWrap: "wrap",
      gap: 10,
    },
    emojiCell: {
      width: "22%",
      aspectRatio: 1,
      alignItems: "center", justifyContent: "center",
      borderRadius: Radius.md, borderWidth: 1.5, borderColor: c.divider,
      backgroundColor: c.cardBg,
    },
    emojiCellActive: {
      borderColor: c.accent,
      backgroundColor: `${c.accent}15`,
    },
    emojiChar:       { fontSize: 26 },

    createBtn: {
      marginTop: Spacing.sm,
      backgroundColor: c.accent, borderRadius: Radius.pill,
      paddingVertical: Spacing.sm + 4, alignItems: "center",
    },
    createBtnDisabled: { opacity: 0.45 },
    createBtnText: {
      fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium,
    },
  });
}
