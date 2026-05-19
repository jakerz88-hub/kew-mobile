import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View, FlatList, TouchableOpacity, Animated, SafeAreaView, useWindowDimensions,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { SansText, SerifText, SkipIcon } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { FontFamily, FontSize, Spacing, Radius } from "../types/theme";

interface Props {
  onDone: () => void;
}

const SLIDES = [
  {
    id: "welcome" as const,
    label: "Welcome to",
    title: "Kew",
    body: "Your new app for intentional content consumption.",
  },
  {
    id: "queue" as const,
    label: "First",
    title: "Build your queue",
    body: "Hand-pick videos from your subscribed channels, import from existing playlists, or search for something new!",
  },
  {
    id: "curate" as const,
    label: "Next",
    title: "Curate and watch",
    body: "Set your queue order and begin watching at your own pace.",
  },
  {
    id: "skips" as const,
    label: "FYI",
    title: "Limited skips",
    body: "Use a skip to send a video to the back of your queue. Finish a video to earn one back.",
  },
  {
    id: "done" as const,
    label: "All set",
    title: "Get queuing!",
    body: "You're ready to start reclaiming your attention!",
  },
];

// ── Illustration helpers ─────────────────────────────────────────────────────

function DashedConnector({ height, color }: { height: number; color: string }) {
  const dashH = 4;
  const gapH = 3;
  const count = Math.floor(height / (dashH + gapH));
  return (
    <View style={{ width: 2, height, gap: gapH }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: 2, height: dashH, borderRadius: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

function WelcomeIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
      <View style={{
        position: "absolute", width: 150, height: 150, borderRadius: 75,
        backgroundColor: colors.cardBg, opacity: 0.85,
      }} />
      <View style={{
        position: "absolute", width: 106, height: 106, borderRadius: 53,
        backgroundColor: colors.cardBg,
      }} />
      <LogoMark size={80} />
    </View>
  );
}

function QueueIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      {/* Pill chips, each with its own connector */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["Browse", "Import", "Explore"] as const).map((label, i) => {
          const rotate = i === 0 ? "-45deg" : i === 2 ? "45deg" : "0deg";
          return (
          <View key={label} style={{ alignItems: "center", gap: 6 }}>
            <View
              style={{
                paddingHorizontal: 12, paddingVertical: 5,
                borderRadius: Radius.pill, borderWidth: 1.5, borderColor: colors.divider,
                backgroundColor: colors.cardBg,
              }}
            >
              <SansText style={{ fontSize: FontSize.xs, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
                {label}
              </SansText>
            </View>
            <View style={{ transform: [{ rotate }] }}>
              <DashedConnector height={28} color={colors.divider} />
            </View>
          </View>
          );
        })}
      </View>

      {/* Card stack */}
      <View style={{ width: 164, height: 100 }}>
        {/* Rear card */}
        <View style={{
          position: "absolute", width: 150, height: 86, borderRadius: 10,
          backgroundColor: colors.divider, top: 10, left: 7,
          transform: [{ rotate: "4deg" }],
        }} />
        {/* Middle card */}
        <View style={{
          position: "absolute", width: 150, height: 86, borderRadius: 10,
          backgroundColor: colors.queued, top: 5, left: 7,
          transform: [{ rotate: "-2.5deg" }],
        }} />
        {/* Front card */}
        <View style={{
          position: "absolute", width: 150, height: 86, borderRadius: 10,
          backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.divider,
          top: 0, left: 7, flexDirection: "row", overflow: "hidden",
        }}>
          <View style={{
            width: 56, height: 86, backgroundColor: colors.divider,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="play" size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1, padding: 8, justifyContent: "center", gap: 5 }}>
            <View style={{ height: 6, width: "80%", borderRadius: 3, backgroundColor: colors.divider }} />
            <View style={{ height: 6, width: "60%", borderRadius: 3, backgroundColor: colors.divider }} />
            <View style={{ height: 6, width: "42%", borderRadius: 3, backgroundColor: colors.queued }} />
          </View>
        </View>
        {/* + Badge */}
        <View style={{
          position: "absolute", top: -7, right: 7, width: 23, height: 23, borderRadius: 12,
          backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>
          <SansText style={{ color: colors.buttonText, fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium, lineHeight: 23 }}>
            +
          </SansText>
        </View>
      </View>
    </View>
  );
}

function CurateIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "flex-start" }}>
      {/* Item 1 — NOW PLAYING */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="play" size={14} color="white" />
        </View>
        <View style={{
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        }}>
          <SansText style={{
            fontSize: FontSize.xxs, color: colors.buttonText, fontFamily: FontFamily.sansMedium,
            letterSpacing: 0.8, textTransform: "uppercase",
          }}>
            Now Playing
          </SansText>
        </View>
      </View>

      <View style={{ marginLeft: 18, marginVertical: 4 }}>
        <DashedConnector height={26} color={colors.divider} />
      </View>

      {/* Item 2 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.divider,
          alignItems: "center", justifyContent: "center",
        }}>
          <SansText style={{ fontSize: FontSize.sm, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
            2
          </SansText>
        </View>
        <View style={{ gap: 5 }}>
          <View style={{ height: 6, width: 100, borderRadius: 3, backgroundColor: colors.divider }} />
          <View style={{ height: 6, width: 72, borderRadius: 3, backgroundColor: colors.divider }} />
        </View>
      </View>

      <View style={{ marginLeft: 18, marginVertical: 4 }}>
        <DashedConnector height={26} color={colors.divider} />
      </View>

      {/* Item 3 */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.divider,
          alignItems: "center", justifyContent: "center",
        }}>
          <SansText style={{ fontSize: FontSize.sm, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
            3
          </SansText>
        </View>
        <View style={{ gap: 5 }}>
          <View style={{ height: 6, width: 88, borderRadius: 3, backgroundColor: colors.divider }} />
          <View style={{ height: 6, width: 60, borderRadius: 3, backgroundColor: colors.divider }} />
        </View>
      </View>
    </View>
  );
}

function SkipsIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 24 }}>
      {/* Skip icon in cream ring */}
      <View style={{
        width: 110, height: 110, borderRadius: 55,
        backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.divider,
        alignItems: "center", justifyContent: "center",
      }}>
        <SkipIcon size={44} color={colors.ink} />
      </View>

      {/* Skip counter dots — generous spacing per spec */}
      <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
        {/* Used skip: hollow accent outline only */}
        <View style={{
          width: 14, height: 14, borderRadius: 7,
          borderWidth: 2, borderColor: colors.accent,
        }} />
        {/* Remaining: solid accent */}
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent }} />
        {/* Remaining: solid accent */}
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}

function DoneIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}>
      <View style={{
        position: "absolute", width: 160, height: 160, borderRadius: 80,
        backgroundColor: colors.green, opacity: 0.15,
      }} />
      <View style={{
        position: "absolute", width: 110, height: 110, borderRadius: 55,
        backgroundColor: colors.green, opacity: 0.35,
      }} />
      <View style={{
        position: "absolute", width: 68, height: 68, borderRadius: 34,
        backgroundColor: colors.green,
      }} />
      <Feather name="check" size={30} color="white" />

      {/* Decorative dots */}
      <View style={{ position: "absolute", top: 12, left: 22, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, opacity: 0.7 }} />
      <View style={{ position: "absolute", top: 28, right: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cardBg, opacity: 0.9 }} />
      <View style={{ position: "absolute", bottom: 18, left: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.cardBg, opacity: 0.9 }} />
      <View style={{ position: "absolute", bottom: 22, right: 22, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, opacity: 0.5 }} />
    </View>
  );
}

const ILLUSTRATION_MAP = {
  welcome: WelcomeIllustration,
  queue:   QueueIllustration,
  curate:  CurateIllustration,
  skips:   SkipsIllustration,
  done:    DoneIllustration,
} as const;

// ── Main screen ──────────────────────────────────────────────────────────────

export default function NUXScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const isTablet = useIsTablet();
  const contentWidth = isTablet ? Math.min(screenW, 520) : screenW;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideHeight, setSlideHeight] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const dotAnim    = useRef(new Animated.Value(0)).current;

  // Re-scroll to current slide when screen width changes (e.g. iPad rotation)
  useEffect(() => {
    if (slideHeight > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex, animated: false });
    }
  }, [screenW]);

  const goToSlide = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
      Animated.timing(dotAnim, { toValue: index, duration: 250, useNativeDriver: false }).start();
    },
    [dotAnim],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: screenW, offset: screenW * index, index }),
    [screenW],
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const renderItem = useCallback(
    ({ item }: { item: (typeof SLIDES)[number] }) => {
      const IllustrationComponent = ILLUSTRATION_MAP[item.id];
      const isHero = item.id === "welcome";

      return (
        <View style={{ width: screenW, height: slideHeight, alignItems: "center" }}>
          <View style={{
            flex: 1,
            width: contentWidth,
            paddingHorizontal: Spacing.xl,
            justifyContent: "center",
            gap: Spacing.xl,
          }}>
            <View style={{ alignItems: "center" }}>
              <IllustrationComponent />
            </View>

            <View style={{ gap: Spacing.sm, alignItems: "center" }}>
              <SansText style={{
                fontSize: FontSize.md,
                color: colors.accent,
                fontFamily: FontFamily.sansMedium,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}>
                {item.label}
              </SansText>
              <SerifText style={{
                fontSize: isHero ? 34 : FontSize.xxl,
                color: colors.ink,
                textAlign: "center",
              }}>
                {item.title}
              </SerifText>
              <SansText style={{
                fontSize: FontSize.md,
                color: colors.warmMid,
                textAlign: "center",
                lineHeight: 24,
              }}>
                {item.body}
              </SansText>
            </View>
          </View>
        </View>
      );
    },
    [slideHeight, screenW, contentWidth, colors],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      {/* Slides */}
      <View style={{ flex: 1 }} onLayout={(e) => setSlideHeight(e.nativeEvent.layout.height)}>
        {slideHeight > 0 && (
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={renderItem}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            getItemLayout={getItemLayout}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({ offset: screenW * index, animated: true });
            }}
          />
        )}
      </View>

      {/* Navigation chrome */}
      <View style={{ paddingTop: Spacing.xs, alignItems: "center" }}>
        <View style={{ width: contentWidth }}>
          {/* Progress dots */}
          <View style={{
            flexDirection: "row", justifyContent: "center", alignItems: "center",
            gap: 6, paddingVertical: Spacing.sm,
          }}>
            {SLIDES.map((_, i) => {
              const dotWidth = dotAnim.interpolate({
                inputRange: [i - 1, i, i + 1],
                outputRange: [6, 20, 6],
                extrapolate: "clamp",
              });
              const bgColor = dotAnim.interpolate({
                inputRange: [i - 1, i, i + 1],
                outputRange: [colors.divider, colors.accent, colors.divider],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={i}
                  style={{ width: dotWidth, height: 6, borderRadius: Radius.pill, backgroundColor: bgColor }}
                />
              );
            })}
          </View>

          {/* Button row */}
          <View style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.lg,
            paddingTop: Spacing.sm,
          }}>
            {/* Skip — occupies space even when hidden to keep Next right-aligned */}
            <View style={{ flex: 1 }}>
              {!isLastSlide && (
                <TouchableOpacity
                  onPress={() => goToSlide(SLIDES.length - 1)}
                  activeOpacity={0.7}
                  style={{ paddingVertical: Spacing.sm, paddingRight: Spacing.sm }}
                >
                  <SansText style={{ fontSize: FontSize.sm, color: colors.warmMid }}>Skip</SansText>
                </TouchableOpacity>
              )}
            </View>

            {/* Next / Start watching */}
            <TouchableOpacity
              onPress={isLastSlide ? onDone : () => goToSlide(currentIndex + 1)}
              activeOpacity={0.8}
              style={{
                backgroundColor: isLastSlide ? colors.green : colors.accent,
                borderRadius: Radius.pill,
                paddingVertical: 14,
                paddingHorizontal: Spacing.xl,
              }}
            >
              <SansText style={{
                color: colors.buttonText,
                fontFamily: FontFamily.sansMedium,
                fontSize: FontSize.sm,
                letterSpacing: 0.3,
              }}>
                {isLastSlide ? "Start watching" : "Next"}
              </SansText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
