import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { ColorPalette, FontFamily, FontSize, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, ErrorBanner, Toast } from "./UI";
import { api } from "../services/api";
import { connectYouTube } from "../utils/youtubeConnect";
import { useStore } from "../store";

const COMMENT_MAX = 500;
const SHEET_ANIM_IN_MS = 280;
const SHEET_ANIM_OUT_MS = 220;
const BACKDROP_OPACITY = 0.35;
const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);

interface InteractModuleProps {
  visible: boolean;
  onClose: () => void;
  videoTitle: string;
  currentTimestamp: number;
  ytVideoId: string;
  durationSecs?: number | null;
}

export function formatTimestamp(secs: number, durationSecs?: number | null): string {
  const s = Math.max(0, Math.floor(secs));
  const useHours = (durationSecs ?? 0) >= 3600;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (useHours) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function HeartIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7.5-4.6-9.6-9.1C1.1 8.6 3.4 5 7 5c2 0 3.6 1.1 5 2.7C13.4 6.1 15 5 17 5c3.6 0 5.9 3.6 4.6 6.9C19.5 16.4 12 21 12 21Z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24">
      <Path
        d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M12 7v5l3 2"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={FontSize.lg} height={FontSize.lg} viewBox="0 0 24 24">
      <Path
        d="M6 6 18 18 M18 6 6 18"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const RECONNECT_HINT =
  "Your YouTube account needs to be reconnected to enable interactions. Please disconnect and reconnect from your profile.";

export function InteractModule({
  visible,
  onClose,
  videoTitle,
  currentTimestamp,
  ytVideoId,
  durationSecs,
}: InteractModuleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const translateY = useRef(new Animated.Value(1)).current; // 1 = off-screen
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [comment, setComment] = useState("");
  const [chipTapped, setChipTapped] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postedUrl, setPostedUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const fetchUser = useStore(s => s.fetchUser);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  };

  const tsLabel = formatTimestamp(currentTimestamp, durationSecs);

  // Pre-fetch like status whenever the video changes. The module is mounted while the
  // parent screen is visible, so this usually completes before the user taps Interact —
  // making the open feel instant. If they tap mid-fetch, behavior matches the old open-
  // gated path (button disabled until the response lands).
  useEffect(() => {
    if (!ytVideoId) return;
    setLiked(false);
    setLikeBusy(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const { liked: serverLiked } = await api.interactLikeStatus(ytVideoId);
        if (cancelled) return;
        setLiked(serverLiked);
      } catch (e: any) {
        if (cancelled) return;
        const msg: string = e?.message ?? "";
        if (msg.includes(RECONNECT_HINT) || msg.startsWith("403")) {
          setError(RECONNECT_HINT);
        }
      } finally {
        if (!cancelled) setLikeBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ytVideoId]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setChipTapped(false);
      setComment("");
      setPostedUrl(null);
      translateY.setValue(1);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: SHEET_ANIM_IN_MS,
          easing: SHEET_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: BACKDROP_OPACITY,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const runClose = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 1,
        duration: SHEET_ANIM_OUT_MS,
        easing: SHEET_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: SHEET_ANIM_OUT_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleLike = async () => {
    if (likeBusy) return;
    const next = !liked;
    setLiked(next);
    setLikeBusy(true);
    setError(null);
    try {
      await api.interactLike(ytVideoId, next ? "like" : "unlike");
      showToast(next ? "Liked" : "Removed like");
    } catch (e: any) {
      setLiked(!next);
      const msg: string = e?.message ?? "";
      if (msg.includes(RECONNECT_HINT) || msg.startsWith("403")) {
        setError(RECONNECT_HINT);
      } else {
        setError(`Couldn't update like. ${msg}`);
      }
    } finally {
      setLikeBusy(false);
    }
  };

  const handleReconnect = async () => {
    if (reconnecting) return;
    setReconnecting(true);
    try {
      const { success, error: connectErr } = await connectYouTube();
      if (success) {
        await fetchUser();
        setError(null);
        showToast("YouTube reconnected");
      } else if (connectErr) {
        setError(connectErr);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not reconnect YouTube.");
    } finally {
      setReconnecting(false);
    }
  };

  const handleChipTap = () => {
    if (chipTapped) return;
    setChipTapped(true);
    setComment(c => `${tsLabel} - ${c}`);
  };

  const handlePost = async () => {
    const trimmed = comment.trim();
    if (trimmed.length === 0 || trimmed.length > COMMENT_MAX || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await api.interactComment(ytVideoId, trimmed);
      const url = `https://www.youtube.com/watch?v=${ytVideoId}&lc=${res.commentId}`;
      setPostedUrl(url);
      showToast("Comment posted");
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (msg.includes(RECONNECT_HINT) || msg.startsWith("403")) {
        setError(RECONNECT_HINT);
      } else {
        setError(`Couldn't post comment. ${msg}`);
      }
    } finally {
      setPosting(false);
    }
  };

  const sheetTranslate = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 600],
  });

  if (!mounted && !visible) return null;

  const charsRemaining = COMMENT_MAX - comment.length;
  const overLimit = comment.length > COMMENT_MAX;
  const canPost = comment.trim().length > 0 && !overLimit && !posting;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={runClose}>
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={runClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={styles.kbContainer}
        >
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetTranslate }] }]}
            accessibilityViewIsModal
            accessibilityLabel={`Interact with ${videoTitle}`}
          >
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <SansText style={styles.headerTitle}>Interact</SansText>
              <TouchableOpacity
                onPress={runClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <CloseIcon color={colors.queued} />
              </TouchableOpacity>
            </View>

            <SansText style={styles.subheader}>
              Let this creator know what you thought of this video.
            </SansText>

            <View style={styles.fullDivider} />

            {error && (
              <ErrorBanner
                message={error}
                onDismiss={() => setError(null)}
                actionLabel={error === RECONNECT_HINT ? "Reconnect" : undefined}
                onAction={error === RECONNECT_HINT ? handleReconnect : undefined}
                actionBusy={reconnecting}
              />
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleLike}
                disabled={likeBusy}
                activeOpacity={0.8}
                style={[
                  styles.likeBtn,
                  liked ? styles.likeBtnOn : styles.likeBtnOff,
                  likeBusy && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: liked, busy: likeBusy }}
                accessibilityLabel={liked ? "Unlike this video" : "Like this video"}
              >
                <HeartIcon
                  color={liked ? colors.buttonText : colors.accent}
                  filled={liked}
                />
                <SansText
                  style={[
                    styles.likeBtnText,
                    { color: liked ? colors.buttonText : colors.accent },
                  ]}
                >
                  Like this video
                </SansText>
              </TouchableOpacity>

              {!postedUrl ? (
                <View>
                  <SansText style={styles.sectionLabel}>Leave a comment</SansText>
                  <TextInput
                    style={styles.textarea}
                    placeholder="Share your thoughts…"
                    placeholderTextColor={colors.queued}
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={COMMENT_MAX + 50}
                    textAlignVertical="top"
                  />
                  <View style={styles.commentFooter}>
                    <TouchableOpacity
                      onPress={handleChipTap}
                      activeOpacity={0.8}
                      style={[
                        styles.tsChip,
                        chipTapped ? styles.tsChipOn : styles.tsChipOff,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: chipTapped }}
                      accessibilityLabel={
                        chipTapped
                          ? `Timestamp ${tsLabel} added`
                          : `Add timestamp ${tsLabel}`
                      }
                    >
                      <ClockIcon
                        color={chipTapped ? colors.green : colors.warmMid}
                      />
                      <SansText
                        style={[
                          styles.tsChipText,
                          { color: chipTapped ? colors.green : colors.warmMid },
                        ]}
                      >
                        {chipTapped ? `${tsLabel} added` : `${tsLabel} +`}
                      </SansText>
                    </TouchableOpacity>

                    <View style={styles.footerRight}>
                      {(comment.length > COMMENT_MAX - 60 || overLimit) && (
                        <SansText
                          style={[
                            styles.charCount,
                            overLimit && { color: colors.accent },
                          ]}
                        >
                          {charsRemaining}
                        </SansText>
                      )}
                      <TouchableOpacity
                        onPress={handlePost}
                        disabled={!canPost}
                        activeOpacity={0.8}
                        style={[
                          styles.postBtn,
                          { backgroundColor: colors.accent },
                          !canPost && { opacity: 0.4 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Post comment to YouTube"
                      >
                        <SansText
                          style={[
                            styles.postBtnText,
                            { color: colors.buttonText },
                          ]}
                        >
                          {posting ? "Posting…" : "Post to YouTube"}
                        </SansText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.postedBlock}>
                  <SansText style={styles.postedText}>
                    Posted to YouTube. Replies live there, not here, by design.
                  </SansText>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(postedUrl).catch(() => {})}
                    activeOpacity={0.7}
                    accessibilityRole="link"
                    accessibilityLabel="View your comment on YouTube"
                  >
                    <SansText style={styles.postedLink}>
                      View your comment on YouTube
                    </SansText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <SansText style={styles.disclaimer}>
              Your interactions go to the creator, not to Kew. We never use them to personalize your experience.
            </SansText>
          </Animated.View>
        </KeyboardAvoidingView>

        <Toast message={toastMsg} visible={toastVisible} />
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    root: { flex: 1 },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#000",
    },
    kbContainer: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: c.cardBg,
      borderTopLeftRadius: Radius.lg,
      borderTopRightRadius: Radius.lg,
      paddingTop: 6,
      // Width cap so the sheet doesn't span an iPad's full landscape width.
      // Phones (< 520pt wide) get full width naturally; iPad caps at 520pt
      // and centers via alignSelf.
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
    },
    handle: {
      alignSelf: "center",
      width: 32,
      height: 3,
      borderRadius: 999,
      backgroundColor: c.divider,
      marginBottom: 4,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 8,
    },
    headerTitle: {
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
    actions: {
      paddingTop: 4,
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 8,
    },
    likeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: Radius.pill,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    likeBtnOff: {
      borderWidth: 1.5,
      borderColor: c.accent,
      backgroundColor: "transparent",
    },
    likeBtnOn: {
      backgroundColor: c.accent,
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    likeBtnText: {
      fontSize: FontSize.sm,
      fontFamily: FontFamily.sansMedium,
    },
    sectionLabel: {
      fontSize: FontSize.xs,
      fontFamily: FontFamily.sansMedium,
      color: c.ink,
      marginBottom: 6,
      marginTop: 6,
    },
    textarea: {
      backgroundColor: c.cream,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: 14,
      paddingVertical: 9,
      paddingHorizontal: 11,
      fontSize: FontSize.xs,
      color: c.ink,
      minHeight: 64,
      fontFamily: FontFamily.sans,
    },
    commentFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    tsChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1.5,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    tsChipOff: {
      borderColor: c.divider,
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
    footerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    charCount: {
      fontSize: FontSize.xxs,
      color: c.warmMid,
    },
    postBtn: {
      borderRadius: Radius.pill,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    postBtnText: {
      fontSize: FontSize.xs,
      fontFamily: FontFamily.sansMedium,
    },
    postedBlock: {
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
    },
    postedText: {
      fontSize: FontSize.xs,
      color: c.warmMid,
      textAlign: "center",
      lineHeight: FontSize.xs * 1.5,
    },
    postedLink: {
      fontSize: FontSize.xs,
      color: c.accent,
      fontWeight: "500",
    },
    disclaimer: {
      fontSize: FontSize.xxs,
      color: c.queued,
      textAlign: "center",
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 4,
      lineHeight: FontSize.xxs * 1.5,
    },
  });
}
