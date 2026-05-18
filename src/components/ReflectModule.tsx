/**
 * ReflectModule — bottom sheet on the Player screen for capturing a private
 * journal entry while watching a video. Persists via POST /v1/journal/entries
 * (api.createJournalEntry).
 *
 * Behavior contract owned by the parent (PlayerScreen):
 *   - Pause-on-open / resume-on-close (parent calls setPlaying(false) before
 *     toggling visible=true and setPlaying(true) inside onClose).
 *   - currentTimestamp is captured by the parent at the moment the sheet
 *     opens — Reflect doesn't poll the player.
 *
 * Sheet shell (scrim + corner radius + drag handle + slide animation +
 * KeyboardAvoidingView) is delegated to <BottomSheet>. This file owns the
 * Reflect-specific content and the entry-save state machine.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { ColorPalette, FontFamily, FontSize, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, ErrorBanner } from "./UI";
import { BottomSheet } from "./BottomSheet";
import { formatTimestamp } from "./InteractModule";
import { api } from "../services/api";


const ENTRY_MAX_CHARS = 750;


interface ReflectModuleProps {
  visible: boolean;
  onClose: () => void;
  /** Fired after the entry persists successfully, before the close animation
   *  begins. The parent (PlayerScreen) uses this to surface a confirmation
   *  toast — the modal closes too fast for an inline toast to land. */
  onSaved?: () => void;
  videoTitle: string;
  ytVideoId: string;
  /** Playback position (seconds) at the moment the sheet opened. */
  currentTimestamp: number;
  durationSecs?: number | null;
}


function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24">
      <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v5l3 2" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={FontSize.lg} height={FontSize.lg} viewBox="0 0 24 24">
      <Path d="M6 6 18 18 M18 6 6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}


export function ReflectModule({
  visible,
  onClose,
  onSaved,
  videoTitle,
  ytVideoId,
  currentTimestamp,
  durationSecs,
}: ReflectModuleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [chipTapped, setChipTapped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tsLabel = formatTimestamp(currentTimestamp, durationSecs);

  // Reset every time the sheet opens — a stale draft from the previous
  // video would be a bad surprise.
  useEffect(() => {
    if (visible) {
      setText("");
      setChipTapped(false);
      setError(null);
    }
  }, [visible]);

  const requestClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  /**
   * Insert "{M:SS} - " at the start of the entry text and lock the chip
   * green. Matches InteractModule's chip behavior — same separator
   * (hyphen + spaces), per ETHOS rule against em-dashes in user copy.
   */
  const handleChipTap = () => {
    if (chipTapped) return;
    setChipTapped(true);
    setText(t => `${tsLabel} - ${t}`);
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      // When the chip was tapped, attach the playback position. Otherwise
      // store NULL so the entry isn't pinned to a moment that wasn't the
      // user's intent. (The text already contains the textual timestamp
      // either way — the DB column is for indexing, not display.)
      const ts = chipTapped ? Math.max(0, Math.floor(currentTimestamp)) : null;
      await api.createJournalEntry(ytVideoId, trimmed, ts);
      onSaved?.();
      requestClose();
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save entry.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = text.trim().length > 0 && !saving;

  return (
    <BottomSheet
      visible={visible}
      onClose={requestClose}
      handleMarginBottom={4}
      contentStyle={styles.content}
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel={`Reflect on ${videoTitle}`}
      >
        <View style={styles.headerRow}>
          <SansText style={styles.headerTitle}>Reflect</SansText>
          <TouchableOpacity
            onPress={requestClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon color={colors.queued} />
          </TouchableOpacity>
        </View>

        <SansText style={styles.subheader}>
          Capture a thought for your Journal.
        </SansText>

        <View style={styles.fullDivider} />

        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}

        <View style={styles.body}>
          <TextInput
            ref={inputRef}
            autoFocus
            style={styles.textarea}
            placeholder="What are you thinking about…"
            placeholderTextColor={colors.queued}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={ENTRY_MAX_CHARS}
            textAlignVertical="top"
          />

          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={handleChipTap}
              disabled={chipTapped}
              activeOpacity={0.8}
              style={[
                styles.tsChip,
                chipTapped ? styles.tsChipOn : styles.tsChipOff,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: chipTapped, disabled: chipTapped }}
              accessibilityLabel={
                chipTapped
                  ? `Timestamp ${tsLabel} added`
                  : `Add timestamp ${tsLabel}`
              }
            >
              <ClockIcon color={chipTapped ? colors.green : colors.ink} />
              <SansText
                style={[
                  styles.tsChipText,
                  { color: chipTapped ? colors.green : colors.ink },
                ]}
              >
                {chipTapped ? `${tsLabel} added` : `${tsLabel} +`}
              </SansText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
              style={[
                styles.saveBtn,
                { backgroundColor: colors.accent },
                !canSave && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save entry"
            >
              <SansText style={[styles.saveBtnText, { color: colors.buttonText }]}>
                {saving ? "Saving…" : "Save entry"}
              </SansText>
            </TouchableOpacity>
          </View>
        </View>

        <SansText style={styles.disclaimer}>
          This is saved privately to your Journal.
        </SansText>
      </View>
    </BottomSheet>
  );
}


function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    // Override BottomSheet's default content padding — the headerRow,
    // subheader, body, and disclaimer each carry their own paddingHorizontal,
    // and the fullDivider needs to span edge-to-edge.
    content: {
      paddingHorizontal: 0,
      paddingTop: 6,
      paddingBottom: 0,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 6,
    },
    headerTitle: {
      // Spec called for FontFamily.sansBold at 16pt; sansBold isn't loaded
      // and 16 is off the design-system scale. Match InteractModule's
      // header treatment instead: FontSize.md + sansMedium.
      fontSize: FontSize.md,
      fontFamily: FontFamily.sansMedium,
      color: c.ink,
    },
    subheader: {
      fontSize: FontSize.xs,
      color: c.warmMid,
      paddingHorizontal: 14,
      paddingBottom: 10,
      lineHeight: FontSize.xs * 1.5,
    },
    fullDivider: {
      height: 1,
      backgroundColor: c.divider,
    },
    body: {
      paddingTop: 10,
      paddingHorizontal: 14,
      paddingBottom: 8,
      gap: 10,
    },
    textarea: {
      backgroundColor: c.cream,
      borderRadius: 10,
      padding: 8,
      fontSize: FontSize.sm,
      color: c.ink,
      minHeight: 96,
      fontFamily: "DMSans_400Regular_Italic",
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    tsChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1.5,
      borderRadius: Radius.pill,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    tsChipOff: {
      borderColor: c.ink,
      backgroundColor: "transparent",
    },
    tsChipOn: {
      borderColor: c.green,
      backgroundColor: `${c.green}10`,
    },
    tsChipText: {
      fontSize: FontSize.xxs,
      fontFamily: FontFamily.sansMedium,
    },
    saveBtn: {
      borderRadius: Radius.pill,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    saveBtnText: {
      fontSize: FontSize.xs,
      fontFamily: FontFamily.sansMedium,
    },
    disclaimer: {
      fontSize: FontSize.xxs,
      color: c.queued,
      textAlign: "center",
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 4,
      lineHeight: FontSize.xxs * 1.5,
      fontFamily: "DMSans_400Regular_Italic",
    },
  });
}
