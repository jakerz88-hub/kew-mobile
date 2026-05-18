import React, { useRef, useState, useEffect } from "react";
import { Animated, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { FontFamily, FontSize } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

interface HintBannerProps {
  text: string;
  step: number;
  total: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function HintBanner({ text, step, total, visible, onDismiss }: HintBannerProps) {
  const { colors } = useTheme();

  const opacity = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!visible && naturalHeight !== null) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start(() => onDismiss());
    }
  }, [visible, naturalHeight]);

  const animatedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, naturalHeight ?? 0],
  });

  return (
    <Animated.View
      style={{
        opacity,
        height: naturalHeight !== null ? animatedHeight : undefined,
        overflow: "hidden",
      }}
    >
      <View
        onLayout={e => {
          if (naturalHeight === null) setNaturalHeight(e.nativeEvent.layout.height);
        }}
        style={[
          styles.container,
          {
            backgroundColor: colors.cardBg,
            borderLeftColor: colors.accent,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <View style={styles.bodyRow}>
          <View style={[styles.iconOuter, { backgroundColor: colors.accent }]}>
            <View style={[styles.iconInner, { backgroundColor: colors.cardBg }]} />
          </View>
          <Text style={[styles.body, { color: colors.warmMid }]}>{text}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.counter, { color: colors.queued }]}>
            {step} of {total}
          </Text>
          <TouchableOpacity
            activeOpacity={0.6}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.dismiss,
                { color: pressed ? colors.warmMid : colors.queued },
              ]}
            >
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 2.5,
    borderBottomWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  bodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  iconOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  iconInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  body: {
    flex: 1,
    fontSize: FontSize.xxs,
    lineHeight: 15,
    fontFamily: FontFamily.sans,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counter: {
    fontSize: FontSize.xxs,
    fontFamily: FontFamily.sans,
  },
  dismiss: {
    fontSize: FontSize.xxs,
    fontFamily: FontFamily.sans,
  },
});
