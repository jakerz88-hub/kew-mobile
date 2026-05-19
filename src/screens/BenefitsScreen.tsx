import React, { useMemo, useState } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Path, Polyline, Circle, Line } from "react-native-svg";
import { SansText, SerifText, ErrorBanner } from "../components/UI";
import { ProIcon } from "../components/ProIcon";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius, KEW_PLUS_GOLD, KEW_PLUS_GOLD_TINT } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useSubscription } from "../hooks/useSubscription";
import { useStore } from "../store";

type FeatureRow = {
  key: string;
  title: string;
  subtitle: string;
  icon: (color: string, size: number) => React.ReactNode;
};

const ICON_SIZE = 16;

const FEATURES: FeatureRow[] = [
  {
    key: "multi",
    title: "Multiple queues",
    subtitle: "Organize videos into separate, named queues",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={3} y={3} width={8} height={8} rx={1.5} fill={color} />
        <Rect x={13} y={3} width={8} height={8} rx={1.5} fill={color} />
        <Rect x={3} y={13} width={8} height={8} rx={1.5} fill={color} />
        <Rect x={13} y={13} width={8} height={8} rx={1.5} fill={color} />
      </Svg>
    ),
  },
  {
    key: "queue",
    title: "Unlimited queue length",
    subtitle: "Save as many videos as you want",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={3} y={5} width={18} height={2.4} rx={1.2} fill={color} />
        <Rect x={3} y={11} width={13} height={2.4} rx={1.2} fill={color} />
        <Rect x={3} y={17} width={8} height={2.4} rx={1.2} fill={color} />
      </Svg>
    ),
  },
  {
    key: "skips",
    title: "More skips",
    subtitle: "Higher skip limit, earned by finishing videos",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Polyline points="4,5 11,12 4,19" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="11,5 18,12 11,19" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x={19} y={5} width={2.4} height={14} rx={1.2} fill={color} />
      </Svg>
    ),
  },
  {
    key: "journal",
    title: "Journal",
    subtitle: "Save private notes and reflections on your videos",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={5} y={3} width={14} height={18} rx={1.5} stroke={color} strokeWidth={2} fill="none" />
        <Rect x={5} y={3} width={3} height={18} rx={1.5} fill={color} opacity={0.35} />
        <Line x1={10} y1={8} x2={16} y2={8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Line x1={10} y1={12} x2={16} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Line x1={10} y1={16} x2={14} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: "insights",
    title: "Watch insights",
    subtitle: "Weekly stats to track your intentionality",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={4} y={14} width={4} height={6} rx={1} fill={color} />
        <Rect x={10} y={9} width={4} height={11} rx={1} fill={color} />
        <Rect x={16} y={4} width={4} height={16} rx={1} fill={color} />
      </Svg>
    ),
  },
  {
    key: "limits",
    title: "Personal watch limits",
    subtitle: "Set daily video and time limits for yourself",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={9} y={2} width={6} height={2} rx={0.8} fill={color} />
        <Line x1={12} y1={4} x2={12} y2={6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={12} cy={14} r={7.5} stroke={color} strokeWidth={2} fill="none" />
        <Line x1={12} y1={14} x2={12} y2={9.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Line x1={12} y1={14} x2={15.5} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Line x1={18.5} y1={6.5} x2={20} y2={8} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: "history",
    title: "Full watch history",
    subtitle: "Access everything you've ever watched in Kew",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
        <Polyline points="12,7 12,12 15.5,14" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  {
    key: "themes",
    title: "Premium themes",
    subtitle: "Refresh your layout with curated color palettes",
    icon: (color, s) => (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x={3} y={5}  width={18} height={3} rx={1.2} fill={color} opacity={1} />
        <Rect x={3} y={10.5} width={18} height={3} rx={1.2} fill={color} opacity={0.6} />
        <Rect x={3} y={16} width={18} height={3} rx={1.2} fill={color} opacity={0.3} />
      </Svg>
    ),
  },
];

type Plan = "annual" | "monthly";

export default function BenefitsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [plan, setPlan] = useState<Plan>("annual");
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchUser = useStore(s => s.fetchUser);
  const {
    isPro, isLoading, monthlyPackage, annualPackage,
    purchaseMonthly, purchaseAnnual, restorePurchases, openManagement,
  } = useSubscription();

  const handleSubscribe = async () => {
    if (purchasing) return;
    setError(null);
    setPurchasing(true);
    try {
      const success = plan === "annual" ? await purchaseAnnual() : await purchaseMonthly();
      if (success) {
        // Backend webhook updates profiles.plan asynchronously — refetch so the
        // gold badge and pro-only UI appear without waiting for the next mount.
        fetchUser().catch(() => {});
        navigation.goBack();
      }
      // success === false means the user cancelled. Stay on the screen
      // silently — surfacing an error would be annoying.
    } catch (e: any) {
      setError(e?.message ?? "Couldn't complete purchase. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setError(null);
    setRestoring(true);
    try {
      const restored = await restorePurchases();
      if (!restored) {
        setError("No active subscription found on this Apple ID.");
      }
      // If restored is true, the customerInfo listener inside useSubscription
      // updates isPro and the screen re-renders into the pro state. No further
      // UI feedback needed.
    } catch (e: any) {
      setError(e?.message ?? "Couldn't restore purchases. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const monthlyPriceLabel = monthlyPackage?.product.priceString;
  const annualPriceLabel = annualPackage?.product.priceString;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.headerSide}>
          <Feather name="x" size={22} color={colors.warmMid} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <SerifText style={styles.headerTitle}>
            Kew<SerifText style={styles.headerPlus}>+</SerifText>
          </SerifText>
        </View>
        <View style={styles.headerSide} />
      </View>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ProIcon size={56} />
          <SerifText style={styles.heroHeadline}>Watch more intentionally</SerifText>
          <SansText style={styles.heroSubhead}>
            Everything you need to build healthier watch habits.
          </SansText>
        </View>

        <View style={styles.featuresCard}>
          {FEATURES.map((f, idx) => (
            <View key={f.key}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconBox}>
                  {f.icon(KEW_PLUS_GOLD, ICON_SIZE)}
                </View>
                <View style={styles.featureText}>
                  <SansText style={styles.featureTitle}>{f.title}</SansText>
                  <SansText style={styles.featureSubtitle}>{f.subtitle}</SansText>
                </View>
              </View>
              {idx < FEATURES.length - 1 && <View style={styles.featureDivider} />}
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={styles.activeWrap}>
            <SerifText style={styles.activeHeadline}>You're on Kew+</SerifText>
            <SansText style={styles.activeSubhead}>
              Thanks for supporting Kew.
            </SansText>
            <TouchableOpacity style={styles.ctaBtn} onPress={openManagement} activeOpacity={0.85}>
              <SansText style={styles.ctaBtnText}>Manage subscription</SansText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.toggleWrap}>
              <View style={styles.togglePill}>
                <TouchableOpacity
                  style={[styles.toggleOption, plan === "annual" && styles.toggleOptionActive]}
                  onPress={() => setPlan("annual")}
                  activeOpacity={0.8}
                >
                  <SansText style={[styles.toggleOptionText, plan === "annual" && styles.toggleOptionTextActive]}>
                    Annual
                  </SansText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, plan === "monthly" && styles.toggleOptionActive]}
                  onPress={() => setPlan("monthly")}
                  activeOpacity={0.8}
                >
                  <SansText style={[styles.toggleOptionText, plan === "monthly" && styles.toggleOptionTextActive]}>
                    Monthly
                  </SansText>
                </TouchableOpacity>
              </View>

              <View style={styles.priceBlock}>
                {plan === "annual" ? (
                  <>
                    <SerifText style={styles.priceMain}>{annualPriceLabel ?? "$24.99"}/year</SerifText>
                    <SansText style={styles.priceSub}>$2.08/month, billed annually</SansText>
                  </>
                ) : (
                  <>
                    <SerifText style={styles.priceMain}>{monthlyPriceLabel ?? "$2.99"}/month</SerifText>
                    <SansText style={styles.priceSub}>Billed monthly, cancel any time</SansText>
                  </>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.ctaBtn, (purchasing || isLoading) && styles.ctaBtnDisabled]}
              onPress={handleSubscribe}
              activeOpacity={0.85}
              disabled={purchasing || isLoading}
            >
              {purchasing ? (
                <ActivityIndicator color={colors.buttonText} size="small" />
              ) : (
                <SansText style={styles.ctaBtnText}>Subscribe to Kew+</SansText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRestore}
              activeOpacity={0.7}
              style={styles.restoreBtn}
              disabled={restoring}
            >
              <SansText style={styles.restoreText}>
                {restoring ? "Restoring…" : "Restore purchases"}
              </SansText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: c.cream },
    header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    headerSide:       { width: 36, height: 36, alignItems: "flex-start", justifyContent: "center" },
    headerCenter:     { flex: 1, alignItems: "center" },
    headerTitle:      { fontSize: FontSize.md, color: c.ink, fontFamily: FontFamily.serif },
    headerPlus:       { color: KEW_PLUS_GOLD, fontFamily: FontFamily.serif },
    content:          { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
    hero:             { alignItems: "center", paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.sm },
    heroHeadline:     { fontSize: FontSize.xl, color: c.ink, textAlign: "center", marginTop: Spacing.xs },
    heroSubhead:      { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 19, paddingHorizontal: Spacing.md },
    featuresCard:     { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, paddingVertical: Spacing.xs },
    featureRow:       { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.s10, paddingHorizontal: Spacing.md },
    featureIconBox:   { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: KEW_PLUS_GOLD_TINT, alignItems: "center", justifyContent: "center" },
    featureText:      { flex: 1, minWidth: 0 },
    featureTitle:     { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium, marginBottom: 2 },
    featureSubtitle:  { fontSize: FontSize.xs, color: c.warmMid, lineHeight: 17 },
    // Composite layout calc: align divider under the feature text column,
    // skipping the leading Spacing.md inset + 28px icon box + Spacing.sm
    // gap. The 28 isn't a spacing value — it's the icon width.
    // eslint-disable-next-line kew/no-spacing-arithmetic
    featureDivider:   { height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginLeft: Spacing.md + 28 + Spacing.sm, marginRight: Spacing.md },
    toggleWrap:       { marginTop: Spacing.lg, alignItems: "center" },
    togglePill:       { flexDirection: "row", backgroundColor: c.divider, borderRadius: Radius.pill, padding: 3, alignSelf: "center" },
    toggleOption:     { paddingVertical: 8, paddingHorizontal: Spacing.lg, borderRadius: Radius.pill, alignItems: "center", justifyContent: "center" },
    toggleOptionActive:{ backgroundColor: KEW_PLUS_GOLD },
    toggleOptionText: { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    toggleOptionTextActive: { color: c.buttonText },
    priceBlock:       { alignItems: "center", marginTop: Spacing.md, gap: 4 },
    priceMain:        { fontSize: FontSize.xl, color: c.ink },
    priceSub:         { fontSize: FontSize.xs, color: c.warmMid },
    ctaBtn:           { marginTop: Spacing.lg, backgroundColor: KEW_PLUS_GOLD, borderRadius: Radius.pill, paddingVertical: Spacing.s14, alignItems: "center", justifyContent: "center" },
    ctaBtnDisabled:   { opacity: 0.6 },
    ctaBtnText:       { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium, letterSpacing: 0.3 },
    restoreBtn:       { marginTop: Spacing.md, alignItems: "center", paddingVertical: Spacing.sm },
    restoreText:      { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium, textDecorationLine: "underline" },
    activeWrap:       { marginTop: Spacing.lg, alignItems: "center", gap: Spacing.xs },
    activeHeadline:   { fontSize: FontSize.lg, color: c.ink },
    activeSubhead:    { fontSize: FontSize.sm, color: c.warmMid, marginBottom: Spacing.sm },
  });
}
