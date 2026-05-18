import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View, FlatList, TouchableOpacity, Animated, SafeAreaView, useWindowDimensions,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { SansText, SerifText } from "../components/UI";
import { ProIcon } from "../components/ProIcon";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { FontFamily, FontSize, Spacing, Radius, KEW_PLUS_GOLD } from "../types/theme";

interface Props {
  onDone: () => void;
}

const SLIDES = [
  {
    id: "welcome" as const,
    label: "You're in",
    title: "Welcome to Kew+",
    body: "You now have access to everything Kew has to offer. Here's what's new.",
  },
  {
    id: "queues" as const,
    label: "Queues",
    title: "More queues, more intention",
    body: "Create a queue for every mood. Add as many videos as you like.",
  },
  {
    id: "skips" as const,
    label: "Skips",
    title: "Breathing room",
    body: "More flexibility with 5 skips. Finish a video to earn one back, just like always.",
  },
  {
    id: "journal" as const,
    label: "Journal",
    title: "Space to reflect",
    body: "Capture private notes and reflections on your videos. Entries sit side-by-side with your watch history.",
  },
  {
    id: "insights" as const,
    label: "Insights",
    title: "Your watching, at a glance",
    body: "View your watch stats and see patterns over time. Set personal limits to improve your consumption habits.",
  },
];

// ── Illustration components ──────────────────────────────────────────────────

function WelcomeIllustration() {
  return (
    <View style={{ width: 180, height: 180, alignItems: "center", justifyContent: "center" }}>
      <View style={{
        position: "absolute", width: 172, height: 172, borderRadius: 86,
        backgroundColor: KEW_PLUS_GOLD, opacity: 0.08,
      }} />
      <View style={{
        position: "absolute", width: 122, height: 122, borderRadius: 61,
        backgroundColor: KEW_PLUS_GOLD, opacity: 0.12,
      }} />
      <ProIcon size={100} />
      <View style={{ position: "absolute", top: 16, left: 20, width: 8, height: 8, borderRadius: 4, backgroundColor: KEW_PLUS_GOLD, opacity: 0.35 }} />
      <View style={{ position: "absolute", top: 22, right: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: KEW_PLUS_GOLD, opacity: 0.25 }} />
      <View style={{ position: "absolute", bottom: 18, left: 18, width: 6, height: 6, borderRadius: 3, backgroundColor: KEW_PLUS_GOLD, opacity: 0.25 }} />
      <View style={{ position: "absolute", bottom: 16, right: 20, width: 8, height: 8, borderRadius: 4, backgroundColor: KEW_PLUS_GOLD, opacity: 0.35 }} />
    </View>
  );
}

function QueuesIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      {/* Chip row */}
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: Radius.pill, backgroundColor: colors.accent,
        }}>
          <SansText style={{ fontSize: 11, color: "white", fontFamily: FontFamily.sansMedium }}>
            Chill Vibes
          </SansText>
        </View>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: Radius.pill, backgroundColor: colors.cardBg,
          borderWidth: 1, borderColor: colors.divider,
        }}>
          <SansText style={{ fontSize: 11, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
            Workout
          </SansText>
        </View>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: Radius.pill, backgroundColor: colors.cardBg,
          borderWidth: 1, borderColor: colors.divider,
        }}>
          <SansText style={{ fontSize: 10, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
            Science & Tech
          </SansText>
        </View>
      </View>

      {/* Queue card */}
      <View style={{
        width: 220,
        backgroundColor: colors.cardBg,
        borderWidth: 1, borderColor: colors.divider,
        borderRadius: Radius.md,
        overflow: "hidden",
      }}>
        {/* Item 1 — Now playing */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, gap: 10 }}>
          <View style={{
            width: 46, height: 34, borderRadius: 6,
            backgroundColor: colors.divider, alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="play" size={12} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 5, width: "80%", borderRadius: 3, backgroundColor: colors.divider }} />
            <View style={{ height: 5, width: "55%", borderRadius: 3, backgroundColor: colors.divider }} />
          </View>
          <View style={{
            paddingHorizontal: 7, paddingVertical: 2,
            borderRadius: Radius.pill, backgroundColor: colors.accent,
          }}>
            <SansText style={{
              fontSize: 8, color: "white",
              fontFamily: FontFamily.sansMedium, letterSpacing: 0.5,
            }}>
              Now
            </SansText>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.divider }} />

        {/* Item 2 */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, gap: 10 }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.divider,
            alignItems: "center", justifyContent: "center",
          }}>
            <SansText style={{ fontSize: 10, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
              2
            </SansText>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 5, width: "75%", borderRadius: 3, backgroundColor: colors.divider }} />
            <View style={{ height: 5, width: "50%", borderRadius: 3, backgroundColor: colors.divider }} />
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.divider }} />

        {/* Item 3 */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 10, gap: 10 }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.divider,
            alignItems: "center", justifyContent: "center",
          }}>
            <SansText style={{ fontSize: 10, color: colors.warmMid, fontFamily: FontFamily.sansMedium }}>
              3
            </SansText>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 5, width: "68%", borderRadius: 3, backgroundColor: colors.divider }} />
            <View style={{ height: 5, width: "45%", borderRadius: 3, backgroundColor: colors.divider }} />
          </View>
        </View>
      </View>
    </View>
  );
}

function SkipsIllustration() {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 24 }}>
      {/* Skip icon in ring — matches NUXScreen exactly */}
      <View style={{
        width: 110, height: 110, borderRadius: 55,
        backgroundColor: colors.cardBg, borderWidth: 1.5, borderColor: colors.divider,
        alignItems: "center", justifyContent: "center",
      }}>
        <Feather name="skip-forward" size={44} color={colors.ink} />
      </View>

      {/* 5 custom dots — generous spacing matching NUXScreen */}
      <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
        {/* Dot 1: used skip — hollow gold outline */}
        <View style={{
          width: 14, height: 14, borderRadius: 7,
          borderWidth: 2, borderColor: KEW_PLUS_GOLD,
        }} />
        {/* Dots 2–5: solid gold */}
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: KEW_PLUS_GOLD }} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: KEW_PLUS_GOLD }} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: KEW_PLUS_GOLD }} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: KEW_PLUS_GOLD }} />
      </View>
    </View>
  );
}

function JournalIllustration() {
  const { colors } = useTheme();
  const pageLines = [
    { width: "80%", color: colors.divider },
    { width: "65%", color: colors.cardBg },
    { width: "75%", color: colors.divider },
    { width: "55%", color: colors.cardBg },
    { width: "70%", color: colors.divider },
    { width: "60%", color: colors.cardBg },
    { width: "45%", color: colors.divider },
  ];

  return (
    <View style={{ flexDirection: "row", alignItems: "stretch" }}>
      {/* Left page */}
      <View style={{
        width: 92, padding: 10, gap: 7,
        backgroundColor: colors.cardBg,
        borderWidth: 1, borderColor: colors.divider,
        borderRadius: Radius.sm,
        borderTopRightRadius: 0, borderBottomRightRadius: 0,
      }}>
        {pageLines.map((line, i) => (
          <View
            key={i}
            style={{
              height: 4, width: line.width as any,
              borderRadius: Radius.pill, backgroundColor: line.color,
            }}
          />
        ))}
      </View>

      {/* Spine */}
      <View style={{ width: 3, backgroundColor: colors.divider }} />

      {/* Right page */}
      <View style={{
        width: 92, padding: 10, gap: 7,
        backgroundColor: colors.cardBg,
        borderWidth: 1, borderColor: colors.divider,
        borderRadius: Radius.sm,
        borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
      }}>
        {pageLines.map((line, i) => (
          <View
            key={i}
            style={{
              height: 4,
              width: (i % 2 === 0 ? "72%" : "58%") as any,
              borderRadius: Radius.pill,
              backgroundColor: i % 2 === 0 ? colors.divider : colors.cardBg,
            }}
          />
        ))}
        {/* Decorative pen shape */}
        <View style={{
          position: "absolute", bottom: 10, right: 12,
          width: 4, height: 22, borderRadius: 2,
          backgroundColor: KEW_PLUS_GOLD, opacity: 0.35,
        }} />
      </View>
    </View>
  );
}

function InsightsIllustration() {
  const { colors } = useTheme();
  const bars = [
    { height: 40, opacity: 0.35 },
    { height: 65, opacity: 0.55 },
    { height: 50, opacity: 0.70 },
    { height: 80, opacity: 0.85 },
    { height: 55, opacity: 0.65 },
    { height: 90, opacity: 1.0 },
  ];
  const days = ["M", "T", "W", "T", "F", "S"];
  const maxBarHeight = 90;
  const limitFromBottom = 68;

  return (
    <View style={{
      width: 210,
      backgroundColor: colors.cardBg,
      borderWidth: 1, borderColor: colors.divider,
      borderRadius: Radius.md,
      padding: 16,
    }}>
      {/* Chart area */}
      <View style={{ height: maxBarHeight, position: "relative" }}>
        {/* Bars */}
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          flexDirection: "row", alignItems: "flex-end", gap: 8,
        }}>
          {bars.map((bar, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: bar.height, borderRadius: 4,
                backgroundColor: colors.accent, opacity: bar.opacity,
              }}
            />
          ))}
        </View>

        {/* Dashed limit line in green */}
        <View style={{
          position: "absolute",
          bottom: limitFromBottom,
          left: 0, right: 0,
          height: 2,
          flexDirection: "row",
          overflow: "hidden",
        }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <View key={i} style={{ width: 5, height: 2, backgroundColor: colors.green, marginRight: 3 }} />
          ))}
        </View>
      </View>

      {/* Day labels */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        {days.map((d, i) => (
          <SansText
            key={i}
            style={{
              flex: 1, textAlign: "center",
              fontSize: 9, color: colors.queued,
              fontFamily: FontFamily.sansMedium,
            }}
          >
            {d}
          </SansText>
        ))}
      </View>
    </View>
  );
}

const ILLUSTRATION_MAP = {
  welcome:  WelcomeIllustration,
  queues:   QueuesIllustration,
  skips:    SkipsIllustration,
  journal:  JournalIllustration,
  insights: InsightsIllustration,
} as const;

// ── Main screen ──────────────────────────────────────────────────────────────

export default function KewPlusWelcomeScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const isTablet = useIsTablet();
  const contentWidth = isTablet ? Math.min(screenW, 520) : screenW;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideHeight, setSlideHeight] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const dotAnim    = useRef(new Animated.Value(0)).current;

  // Re-scroll to current slide on width change (e.g. iPad rotation)
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
                color: KEW_PLUS_GOLD,
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
                outputRange: [colors.divider, KEW_PLUS_GOLD, colors.divider],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={i}
                  style={{ width: dotWidth, height: 6, borderRadius: 999, backgroundColor: bgColor }}
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

            {/* Next / Keep queuing */}
            <TouchableOpacity
              onPress={isLastSlide ? onDone : () => goToSlide(currentIndex + 1)}
              activeOpacity={0.8}
              style={{
                backgroundColor: isLastSlide ? colors.green : KEW_PLUS_GOLD,
                borderRadius: 999,
                paddingVertical: 14,
                paddingHorizontal: Spacing.xl,
              }}
            >
              <SansText style={{
                color: "white",
                fontFamily: FontFamily.sansMedium,
                fontSize: FontSize.sm,
                letterSpacing: 0.3,
              }}>
                {isLastSlide ? "Keep queuing" : "Next"}
              </SansText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
