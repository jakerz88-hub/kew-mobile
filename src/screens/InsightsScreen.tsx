import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, ScrollView, SafeAreaView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { api } from "../services/api";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, SerifText, Divider, ErrorBanner, EmptyState } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import type { Insights, Intentionality, WatchLimits, InsightsPeriod } from "../types";

const PERIODS: { id: InsightsPeriod; label: string }[] = [
  { id: "week",  label: "This week" },
  { id: "month", label: "This month" },
  { id: "year",  label: "This year" },
];

const LIMIT_DEFAULTS = {
  dailyVideos:       5,
  dailyMinutes:      60,
  consecutiveVideos: 3,
};

const LIMIT_RANGES = {
  dailyVideos:       { min: 1,  max: 20,  step: 1 },
  dailyMinutes:      { min: 15, max: 180, step: 15 },
  consecutiveVideos: { min: 1,  max: 10,  step: 1 },
};

function formatDelta(cur: number, prev: number, suffix: string = ""): { text: string; tone: "up" | "down" | "neutral" } {
  if (prev === 0 && cur === 0) return { text: "-", tone: "neutral" };
  const diff = cur - prev;
  if (diff === 0) return { text: "no change", tone: "neutral" };
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${diff}${suffix} vs last`, tone: diff > 0 ? "up" : "down" };
}

export function formatMinutesShort(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function InsightsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isPro = user?.plan === "pro";

  const [period, setPeriod] = useState<InsightsPeriod>("week");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [intent, setIntent] = useState<Intentionality | null>(null);
  const [limits, setLimits] = useState<WatchLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (p: InsightsPeriod) => {
    if (!isPro) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [i, n, l] = await Promise.all([
        api.getInsights(p),
        api.getIntentionality(p),
        api.getLimits(),
      ]);
      setInsights(i);
      setIntent(n);
      setLimits(l);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load insights.");
    } finally {
      setLoading(false);
    }
  }, [isPro]);

  useFocusEffect(useCallback(() => { loadAll(period); }, [period, loadAll]));

  // Defensive: if a non-Pro user reaches this screen (e.g. via deep link), bounce them.
  useEffect(() => {
    if (user && !isPro) navigation.goBack();
  }, [isPro, user, navigation]);

  // ── Limit toggles ──────────────────────────────────────────────────────────

  const saveLimits = async (next: { dailyVideos: number | null; dailyMinutes: number | null; consecutiveVideos: number | null }) => {
    try {
      const updated = await api.updateLimits(next);
      setLimits(updated);
      // Re-fetch intentionality so the dot row reflects new limits
      const n = await api.getIntentionality(period);
      setIntent(n);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save limits.");
    }
  };

  const toggleLimit = (key: "dailyVideos" | "dailyMinutes" | "consecutiveVideos", on: boolean) => {
    if (!limits) return;
    const next = {
      dailyVideos:       limits.dailyVideos,
      dailyMinutes:      limits.dailyMinutes,
      consecutiveVideos: limits.consecutiveVideos,
    };
    next[key] = on ? LIMIT_DEFAULTS[key] : null;
    saveLimits(next);
  };

  const stepLimit = (key: "dailyVideos" | "dailyMinutes" | "consecutiveVideos", direction: 1 | -1) => {
    if (!limits) return;
    const cur = limits[key];
    if (cur == null) return;
    const r = LIMIT_RANGES[key];
    const nextVal = Math.max(r.min, Math.min(r.max, cur + direction * r.step));
    if (nextVal === cur) return;
    saveLimits({
      dailyVideos:       limits.dailyVideos,
      dailyMinutes:      limits.dailyMinutes,
      consecutiveVideos: limits.consecutiveVideos,
      [key]: nextVal,
    } as any);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isPro) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={() => navigation.goBack()} colors={colors} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Period tabs */}
        <View style={styles.tabRow}>
          {PERIODS.map((p) => {
            const active = period === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setPeriod(p.id)}
                activeOpacity={0.7}
              >
                <SansText style={[styles.tabText, active && styles.tabTextActive]}>{p.label}</SansText>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !insights ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : insights && insights.stats.videosWatched === 0 ? (
          // No data yet: new pro users land on Insights before any completion.
          // Show a friendly empty state instead of a grid of zeros, but keep
          // the Watch Limits card visible below so they can configure limits
          // before their first watch session.
          <>
            <View style={styles.loadingBox}>
              <EmptyState
                icon="⏱"
                title="Come back after your first video"
                subtitle="Insights show up here once you've watched at least one video from your queue."
              />
            </View>
            {limits && (
              <View style={styles.card}>
                <SansText style={styles.sectionLabel}>Watch Limits</SansText>
                <SansText style={styles.cardHint}>
                  When you hit a limit, Kew will gently suggest you take a break. You can always continue.
                </SansText>
                <LimitRow
                  label="Daily video limit"
                  unit=""
                  value={limits.dailyVideos}
                  range={LIMIT_RANGES.dailyVideos}
                  onToggle={(on) => toggleLimit("dailyVideos", on)}
                  onStep={(d) => stepLimit("dailyVideos", d)}
                  colors={colors} styles={styles}
                />
                <LimitRow
                  label="Daily watch time"
                  unit="min"
                  value={limits.dailyMinutes}
                  range={LIMIT_RANGES.dailyMinutes}
                  onToggle={(on) => toggleLimit("dailyMinutes", on)}
                  onStep={(d) => stepLimit("dailyMinutes", d)}
                  colors={colors} styles={styles}
                />
                <LimitRow
                  label="Consecutive videos"
                  unit=""
                  value={limits.consecutiveVideos}
                  range={LIMIT_RANGES.consecutiveVideos}
                  onToggle={(on) => toggleLimit("consecutiveVideos", on)}
                  onStep={(d) => stepLimit("consecutiveVideos", d)}
                  colors={colors} styles={styles}
                  isLast
                />
              </View>
            )}
          </>
        ) : insights ? (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCell
                label="Videos watched"
                value={String(insights.stats.videosWatched)}
                delta={formatDelta(insights.stats.videosWatched, insights.prevPeriodComparison.videosWatched)}
                colors={colors} styles={styles}
              />
              <StatCell
                label="Watch time"
                value={formatMinutesShort(insights.stats.watchTimeMinutes)}
                delta={formatDelta(insights.stats.watchTimeMinutes, insights.prevPeriodComparison.watchTimeMinutes, "m")}
                deltaInverted
                colors={colors} styles={styles}
              />
              <StatCell
                label="Completion rate"
                value={`${Math.round(insights.stats.completionRate)}%`}
                delta={formatDelta(Math.round(insights.stats.completionRate), Math.round(insights.prevPeriodComparison.completionRate), "pp")}
                colors={colors} styles={styles}
              />
              <StatCell
                label="Skips used"
                value={String(insights.stats.skipsUsed)}
                delta={formatDelta(insights.stats.skipsUsed, insights.prevPeriodComparison.skipsUsed)}
                deltaInverted
                colors={colors} styles={styles}
              />
            </View>

            {/* Bar chart */}
            <View style={styles.card}>
              <SansText style={styles.sectionLabel}>Daily watch time</SansText>
              <BarChart breakdown={insights.dailyBreakdown} period={period} colors={colors} styles={styles} />
            </View>

            {/* Insight strip */}
            <View style={styles.insightStrip}>
              <SerifText style={styles.insightText}>{insights.insightSentence}</SerifText>
            </View>

            {/* Intentionality */}
            {intent && (
              <View style={styles.card}>
                <SansText style={styles.sectionLabel}>Intentionality</SansText>

                {/* Personal limits kept — wide cell */}
                <View style={styles.intentBig}>
                  <SansText style={styles.intentBigLabel}>Personal limits kept</SansText>
                  <SerifText style={styles.intentBigValue}>
                    {intent.limitsTotal > 0 ? `${intent.limitsKept} of ${intent.limitsTotal} days` : "Set a limit to start"}
                  </SerifText>
                  {intent.limitsTotal > 0 && (
                    <DotRow status={intent.dailyLimitStatus} colors={colors} styles={styles} />
                  )}
                  {intent.limitsTotal > 0 && (
                    <View style={styles.legendRow}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.greenText }]} />
                        <SansText style={styles.legendText}>Within limits</SansText>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                        <SansText style={styles.legendText}>Over</SansText>
                      </View>
                    </View>
                  )}
                </View>

                {/* Two-up: streak + days off */}
                <View style={styles.intentRow}>
                  <View style={styles.intentSmall}>
                    <SansText style={styles.intentSmallLabel}>Limit streak</SansText>
                    <SerifText style={styles.intentSmallValue}>
                      {intent.limitStreak} {intent.limitStreak === 1 ? "day" : "days"}
                    </SerifText>
                    <SansText style={styles.intentSmallHint}>
                      Best ever: {intent.limitStreakBest} {intent.limitStreakBest === 1 ? "day" : "days"}
                    </SansText>
                  </View>
                  <View style={styles.intentSmall}>
                    <SansText style={styles.intentSmallLabel}>Days off</SansText>
                    <SerifText style={styles.intentSmallValue}>{insights.stats.daysOff}</SerifText>
                    <DeltaPill
                      delta={formatDelta(insights.stats.daysOff, insights.prevPeriodComparison.daysOff)}
                      inverted={false /* more days off is positive */}
                      colors={colors} styles={styles}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Watch Limits card */}
            {limits && (
              <View style={styles.card}>
                <SansText style={styles.sectionLabel}>Watch Limits</SansText>
                <SansText style={styles.cardHint}>
                  When you hit a limit, Kew will gently suggest you take a break. You can always continue.
                </SansText>

                <LimitRow
                  label="Daily video limit"
                  unit=""
                  value={limits.dailyVideos}
                  range={LIMIT_RANGES.dailyVideos}
                  onToggle={(on) => toggleLimit("dailyVideos", on)}
                  onStep={(d) => stepLimit("dailyVideos", d)}
                  colors={colors} styles={styles}
                />
                <LimitRow
                  label="Daily watch time"
                  unit="min"
                  value={limits.dailyMinutes}
                  range={LIMIT_RANGES.dailyMinutes}
                  onToggle={(on) => toggleLimit("dailyMinutes", on)}
                  onStep={(d) => stepLimit("dailyMinutes", d)}
                  colors={colors} styles={styles}
                />
                <LimitRow
                  label="Consecutive videos"
                  unit=""
                  value={limits.consecutiveVideos}
                  range={LIMIT_RANGES.consecutiveVideos}
                  onToggle={(on) => toggleLimit("consecutiveVideos", on)}
                  onStep={(d) => stepLimit("consecutiveVideos", d)}
                  colors={colors} styles={styles}
                  isLast
                />
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Header({ onBack, colors }: { onBack: () => void; colors: ColorPalette }) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ flex: 1, padding: 4 }}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={{ fontSize: FontSize.md, color: colors.ink, textAlign: "center" }}>Insights & Limits</SerifText>
        <View style={{ flex: 1 }} />
      </View>
      <Divider />
    </>
  );
}

function StatCell({
  label, value, delta, deltaInverted, colors, styles,
}: {
  label: string;
  value: string;
  delta: { text: string; tone: "up" | "down" | "neutral" };
  deltaInverted?: boolean;
  colors: ColorPalette;
  styles: any;
}) {
  // For "inverted" stats (watch time, skips used), going DOWN is the positive change.
  let tone = delta.tone;
  if (deltaInverted) {
    if (tone === "up")   tone = "down";
    else if (tone === "down") tone = "up";
  }
  const toneColor =
    tone === "up"   ? colors.greenText :
    tone === "down" ? colors.accent :
                      colors.warmMid;
  return (
    <View style={styles.statCell}>
      <SansText style={styles.statLabel}>{label}</SansText>
      <SerifText style={styles.statValue}>{value}</SerifText>
      <SansText style={[styles.statDelta, { color: toneColor }]}>{delta.text}</SansText>
    </View>
  );
}

function DeltaPill({
  delta, inverted, colors, styles,
}: {
  delta: { text: string; tone: "up" | "down" | "neutral" };
  inverted: boolean;
  colors: ColorPalette;
  styles: any;
}) {
  let tone = delta.tone;
  if (inverted) { tone = tone === "up" ? "down" : tone === "down" ? "up" : "neutral"; }
  const color = tone === "up" ? colors.greenText : tone === "down" ? colors.accent : colors.warmMid;
  return <SansText style={[styles.statDelta, { color, marginTop: 0 }]}>{delta.text}</SansText>;
}

function BarChart({
  breakdown, period, colors, styles,
}: {
  breakdown: { date: string; minutes: number }[];
  period: InsightsPeriod;
  colors: ColorPalette;
  styles: any;
}) {
  const maxMin = Math.max(1, ...breakdown.map((d) => d.minutes));
  const todayIso = new Date().toISOString().slice(0, 10);

  // For year view, group by month for readability.
  let display: { label: string; minutes: number; isCurrent: boolean }[];
  if (period === "year") {
    const months = new Map<string, number>();
    for (const d of breakdown) {
      const m = d.date.slice(0, 7); // YYYY-MM
      months.set(m, (months.get(m) ?? 0) + d.minutes);
    }
    const curMonth = todayIso.slice(0, 7);
    display = Array.from(months.entries()).map(([m, minutes]) => ({
      label: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m.slice(5, 7)) - 1],
      minutes,
      isCurrent: m === curMonth,
    }));
  } else {
    display = breakdown.map((d) => {
      const dateObj = new Date(d.date + "T00:00:00Z");
      const day = dateObj.getUTCDate();
      const dow = ["S","M","T","W","T","F","S"][dateObj.getUTCDay()];
      const label = period === "week" ? dow : (day % 5 === 1 || day === 1 ? String(day) : "");
      return { label, minutes: d.minutes, isCurrent: d.date === todayIso };
    });
  }

  const maxDisplay = Math.max(1, ...display.map((d) => d.minutes));

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartBars}>
        {display.map((d, i) => {
          const h = Math.max(2, (d.minutes / maxDisplay) * 90);
          return (
            <View key={i} style={styles.chartBarCol}>
              <View style={[styles.chartBar, { height: h, backgroundColor: d.isCurrent ? colors.accent : colors.divider }]} />
              <SansText style={[styles.chartLabel, d.isCurrent && { color: colors.accent, fontFamily: FontFamily.sansMedium }]}>{d.label}</SansText>
            </View>
          );
        })}
      </View>
      <SansText style={styles.chartHint}>
        Peak: {formatMinutesShort(maxDisplay)}{period === "week" ? "/day" : period === "month" ? "/day" : "/month"}
      </SansText>
    </View>
  );
}

function DotRow({
  status, colors, styles,
}: {
  status: { date: string; kept: boolean }[];
  colors: ColorPalette;
  styles: any;
}) {
  return (
    <View style={styles.dotRow}>
      {status.map((s) => (
        <View
          key={s.date}
          style={[styles.dot, { backgroundColor: s.kept ? colors.greenText : colors.accent }]}
        />
      ))}
    </View>
  );
}

function LimitRow({
  label, unit, value, range, onToggle, onStep, colors, styles, isLast,
}: {
  label: string;
  unit: string;
  value: number | null;
  range: { min: number; max: number; step: number };
  onToggle: (on: boolean) => void;
  onStep: (d: 1 | -1) => void;
  colors: ColorPalette;
  styles: any;
  isLast?: boolean;
}) {
  const on = value != null;
  const atMin = on && (value as number) <= range.min;
  const atMax = on && (value as number) >= range.max;
  return (
    <View style={[styles.limitRow, !isLast && styles.limitRowBorder]}>
      <View style={styles.limitRowTop}>
        <SansText style={styles.limitLabel}>{label}</SansText>
        <Toggle on={on} onChange={onToggle} colors={colors} />
      </View>
      {on && (
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperBtn, atMin && styles.stepperBtnDisabled]}
            onPress={() => onStep(-1)}
            disabled={atMin}
            activeOpacity={0.7}
          >
            <SansText style={styles.stepperBtnText}>−</SansText>
          </TouchableOpacity>
          <SansText style={styles.stepperValue}>
            {value}{unit ? ` ${unit}` : ""}
          </SansText>
          <TouchableOpacity
            style={[styles.stepperBtn, atMax && styles.stepperBtnDisabled]}
            onPress={() => onStep(1)}
            disabled={atMax}
            activeOpacity={0.7}
          >
            <SansText style={styles.stepperBtnText}>+</SansText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Toggle({ on, onChange, colors }: { on: boolean; onChange: (on: boolean) => void; colors: ColorPalette }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!on)}
      activeOpacity={0.7}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: on ? colors.greenText : colors.divider,
        padding: 2,
        alignItems: on ? "flex-end" : "flex-start",
        justifyContent: "center",
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cardBg }} />
    </TouchableOpacity>
  );
}

// ── Mini bar chart (used by ProfileScreen card) ────────────────────────────

export function MiniWeekChart({ breakdown, colors }: { breakdown: { date: string; minutes: number }[]; colors: ColorPalette }) {
  const maxMin = Math.max(1, ...breakdown.map((d) => d.minutes));
  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 36 }}>
      {breakdown.map((d, i) => {
        const h = Math.max(3, (d.minutes / maxMin) * 36);
        const isToday = d.date === todayIso;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: 2,
              backgroundColor: isToday ? colors.accent : colors.divider,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.cream },
    scroll:       { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, paddingBottom: 64, gap: Spacing.md },
    loadingBox:   { paddingVertical: Spacing.xl, alignItems: "center" },

    // Period tabs
    tabRow:       { flexDirection: "row", backgroundColor: c.divider, borderRadius: Radius.pill, padding: 3 },
    tab:          { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: Radius.pill },
    tabActive:    { backgroundColor: c.cardElevated },
    tabText:      { fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    tabTextActive:{ color: c.ink },

    // Stats grid
    statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    statCell:     { flexBasis: "48%", flexGrow: 1, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
    statLabel:    { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: FontFamily.sansMedium },
    statValue:    { fontSize: FontSize.xl, color: c.ink },
    statDelta:    { fontSize: FontSize.xxs, marginTop: 2, fontFamily: FontFamily.sansMedium },

    // Card shell
    card:         { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
    sectionLabel: { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium },
    cardHint:     { fontSize: FontSize.xxs, color: c.warmMid, lineHeight: 16, fontStyle: "italic" },

    // Bar chart
    chartWrap:    { gap: Spacing.xs },
    chartBars:    { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 4 },
    chartBarCol:  { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
    chartBar:     { width: "70%", borderRadius: 3, minHeight: 2 },
    chartLabel:   { fontSize: FontSize.xxs, color: c.warmMid },
    chartHint:    { fontSize: FontSize.xxs, color: c.warmMid, textAlign: "right", fontStyle: "italic" },

    // Insight strip
    insightStrip: { backgroundColor: c.greenText, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.s14 },
    insightText:  { fontSize: FontSize.sm, color: c.buttonText, lineHeight: 21 },

    // Intentionality
    intentBig:    { gap: Spacing.xs, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
    intentBigLabel:{ fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: FontFamily.sansMedium },
    intentBigValue:{ fontSize: FontSize.lg, color: c.ink },
    dotRow:       { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: Spacing.xs },
    dot:          { width: 10, height: 10, borderRadius: 5 },
    legendRow:    { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.xs },
    legendItem:   { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot:    { width: 7, height: 7, borderRadius: 3.5 },
    legendText:   { fontSize: FontSize.xxs, color: c.warmMid },

    intentRow:    { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    intentSmall:  { flex: 1, gap: 2 },
    intentSmallLabel:{ fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: FontFamily.sansMedium },
    intentSmallValue:{ fontSize: FontSize.lg, color: c.ink },
    intentSmallHint: { fontSize: FontSize.xxs, color: c.warmMid, fontStyle: "italic" },

    // Limits
    limitRow:     { paddingVertical: Spacing.sm, gap: Spacing.sm },
    limitRowBorder:{ borderBottomWidth: 1, borderBottomColor: c.divider },
    limitRowTop:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    limitLabel:   { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    stepperRow:   { flexDirection: "row", alignItems: "center", gap: Spacing.md, justifyContent: "flex-start" },
    stepperBtn:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.divider, alignItems: "center", justifyContent: "center", backgroundColor: c.cardElevated },
    stepperBtnDisabled: { opacity: 0.4 },
    stepperBtnText:{ fontSize: FontSize.lg, color: c.ink, lineHeight: 22 },
    stepperValue: { fontSize: FontSize.md, color: c.ink, minWidth: 70, fontFamily: FontFamily.sansMedium },
  });
}
