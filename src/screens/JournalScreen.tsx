/**
 * JournalScreen — replaces HistoryScreen for paid users. Free users get the
 * existing HistoryScreen verbatim (rendered inline below).
 *
 * Layout: header / segmented control ("Entries" / "History") / body.
 *
 *   "Entries" view  — feed grouped by Month → Day → entry blocks. Each entry
 *                     block shows the journal note (5-line truncate, tap
 *                     "Read more" to expand inline) plus a small video
 *                     reference. Long-press an entry → ActionSheet with
 *                     Edit / Delete. Days that have watches but no entries
 *                     show the watched videos with a dashed "+ Add entry"
 *                     affordance that opens the composer.
 *
 *   "History" view  — flat chronological list of completed videos. Each row
 *                     has the explicit ↺ readd circle button (HistoryScreen
 *                     pattern). If entries exist for the video, the first
 *                     entry's content shows below the row (1-line truncate,
 *                     "Read more" to expand). Otherwise, an inline
 *                     "+ Add entry" affordance opens the composer.
 *
 * Both views' rows surface the explicit ↺ readd button — long-press is only
 * used for Edit/Delete on existing journal entries.
 *
 * Fonts: Lora_400Regular_Italic (month headings) and Lora_400Regular (day
 * headings) are loaded inside this screen via useFonts. All other text
 * remains DM Sans. This is a deliberate design-system deviation for the
 * Journal screen — see the Layer 2 spec.
 *
 * Free-user gating: if user.plan === "free", we render the existing
 * HistoryScreen.tsx (which already has its own header, list, and gold-bordered
 * upsell footer card). The Lora screen is paid-only.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import {
  useFonts,
  Lora_400Regular,
  Lora_400Regular_Italic,
} from "@expo-google-fonts/lora";

import { api } from "../services/api";
import { useStore } from "../store";
import { useAddToQueue } from "../hooks/useAddToQueue";
import { useTheme } from "../contexts/ThemeContext";
import { useIsTablet } from "../hooks/useIsTablet";
import { useInTabletSidebar } from "../contexts/TabletSidebarContext";
import {
  KewLogo, SansText, SerifText, Divider, ThumbPlaceholder,
  EmptyState, ErrorBanner, AvatarBubble, Toast,
} from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { formatDuration } from "../types";
import type { JournalEntry, JournalFeedItem } from "../types";

// Free users keep the legacy History tab UX exactly as it was.
import HistoryScreen from "./HistoryScreen";


// ── Date helpers (hand-rolled to avoid adding a date-fns dep) ─────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** "May 2026" — used as the month-group key + heading. */
function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Thursday, May 8, 2026" — used as the day-group key + heading. */
function formatDayLong(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "M:SS" or "MM:SS" — used by the entry timestamp chip. */
function formatTimestampShort(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** "May 8" — used in History rows under the title. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}


// ── Grouping ──────────────────────────────────────────────────────────────────

interface DayGroup {
  dayKey: string;          // "Thursday, May 8, 2026"
  items: JournalFeedItem[];
}

interface MonthGroup {
  monthKey: string;        // "May 2026"
  days: DayGroup[];
  entryCount: number;
  watchedCount: number;
}

/**
 * Group the (already date-desc) feed by month then day. Within a month, days
 * stay date-desc; within a day, items keep their order from the API.
 */
function groupByMonthDay(items: JournalFeedItem[]): MonthGroup[] {
  const months: MonthGroup[] = [];
  let currentMonth: MonthGroup | null = null;
  let currentDay: DayGroup | null = null;

  for (const item of items) {
    const monthKey = formatMonthYear(item.completedAt);
    const dayKey = formatDayLong(item.completedAt);

    if (!currentMonth || currentMonth.monthKey !== monthKey) {
      currentMonth = { monthKey, days: [], entryCount: 0, watchedCount: 0 };
      months.push(currentMonth);
      currentDay = null;
    }
    if (!currentDay || currentDay.dayKey !== dayKey) {
      currentDay = { dayKey, items: [] };
      currentMonth.days.push(currentDay);
    }
    currentDay.items.push(item);
    currentMonth.watchedCount += 1;
    currentMonth.entryCount += item.journalEntries.length;
  }
  return months;
}


// ── Main screen ───────────────────────────────────────────────────────────────

type ViewMode = "Entries" | "History";

interface ComposerState {
  videoId: string;
  /** When set, the composer is in edit mode (PATCH). Otherwise create (POST). */
  entry?: JournalEntry;
}

/**
 * Top-level gate. Free users get the legacy HistoryScreen verbatim — no Lora,
 * no entries UI. Paid users get JournalScreenPaid below. The gate is split
 * out from the paid screen body so that Rules of Hooks isn't violated when
 * a user upgrades or downgrades mid-session: the paid component mounts/
 * unmounts as a unit, while this gate has a stable hook list.
 */
export default function JournalScreen() {
  const user = useStore(s => s.user);
  const isFree = (user?.plan ?? "free") === "free";
  if (isFree) return <HistoryScreen />;
  return <JournalScreenPaid />;
}

function JournalScreenPaid() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isTablet = useIsTablet();
  const inSidebar = useInTabletSidebar();
  const { user, error, clearError } = useStore();

  // Lora is loaded lazily on first mount of the paid screen; while it's
  // resolving we render an ActivityIndicator so the screen never flashes
  // the system fallback font for the month/day headings.
  const [fontsLoaded] = useFonts({ Lora_400Regular, Lora_400Regular_Italic });

  const [feedItems, setFeedItems] = useState<JournalFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewMode>("Entries");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [readdedIds, setReaddedIds] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const { handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId } =
    useAddToQueue((ytVideoId) => setReaddedIds(prev => new Set([...prev, ytVideoId])));

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
      const data = await api.getJournalFeed();
      setFeedItems(data);
    } catch (e: any) {
      setLocalError(e?.message ?? "Couldn't load your journal.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadFeed(); }, [loadFeed]);

  const monthGroups = useMemo(() => groupByMonthDay(feedItems), [feedItems]);

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleDay = (key: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  };

  const openCreateComposer = (videoId: string) => setComposerState({ videoId });
  const openEditComposer = (videoId: string, entry: JournalEntry) => setComposerState({ videoId, entry });
  const closeComposer = () => setComposerState(null);

  const handleSaveEntry = async (content: string) => {
    if (!composerState) return;
    try {
      if (composerState.entry) {
        await api.updateJournalEntry(composerState.entry.id, content);
        showToast("Entry updated");
      } else {
        await api.createJournalEntry(composerState.videoId, content);
        showToast("Entry saved");
      }
      closeComposer();
      await loadFeed();
    } catch (e: any) {
      setLocalError(e?.message ?? "Couldn't save entry.");
    }
  };

  /**
   * Long-press handler attached to entry blocks. Action sheet on iOS,
   * Alert on Android. The destructive button is the confirmation step —
   * we don't add a second confirm dialog before deleting.
   */
  const handleEntryLongPress = (videoId: string, entry: JournalEntry) => {
    const onEdit = () => openEditComposer(videoId, entry);
    const onDelete = async () => {
      try {
        await api.deleteJournalEntry(entry.id);
        showToast("Entry deleted");
        await loadFeed();
      } catch (e: any) {
        setLocalError(e?.message ?? "Couldn't delete entry.");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Edit", "Delete", "Cancel"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) onEdit();
          else if (idx === 1) onDelete();
        },
      );
    } else {
      Alert.alert("Entry options", undefined, [
        { text: "Edit", onPress: onEdit },
        { text: "Delete", style: "destructive", onPress: onDelete },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const handleReadd = (ytVideoId: string) => handleAdd(ytVideoId);

  const isLoadingFonts = !fontsLoaded;
  const showInitialSpinner = isLoadingFonts || (loading && feedItems.length === 0);

  return (
    <SafeAreaView style={styles.container}>
      {!(isTablet && inSidebar) && (
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LogoMark size={24} />
            <KewLogo />
          </View>
          <AvatarBubble
            avatarUrl={user?.avatarUrl}
            initial={user?.displayName?.charAt(0).toUpperCase() ?? "?"}
            size={30}
            onPress={() => navigation.navigate("Profile")}
          />
        </View>
      )}
      {!(isTablet && inSidebar) && <Divider />}

      {error && <ErrorBanner message={error} onDismiss={clearError} />}
      {localError && <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} />}

      <View style={styles.pageHeader}>
        <SerifText style={styles.pageTitle}>Your Journal</SerifText>
        <SansText style={styles.pageSubtitle}>
          Take a moment to reflect on what you&apos;ve watched.
        </SansText>
      </View>

      <View style={styles.segmentedWrap}>
        <SegmentedControl
          options={["Entries", "History"]}
          selected={view}
          onChange={setView}
        />
      </View>

      {showInitialSpinner ? (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : view === "Entries" ? (
        <EntriesView
          monthGroups={monthGroups}
          loading={loading}
          onRefresh={loadFeed}
          collapsedMonths={collapsedMonths}
          collapsedDays={collapsedDays}
          expandedEntries={expandedEntries}
          onToggleMonth={toggleMonth}
          onToggleDay={toggleDay}
          onToggleExpanded={toggleExpanded}
          onAddEntry={openCreateComposer}
          onEntryLongPress={handleEntryLongPress}
          onReadd={handleReadd}
          addingId={addingId}
          readdedIds={readdedIds}
        />
      ) : (
        <HistoryView
          items={feedItems}
          loading={loading}
          onRefresh={loadFeed}
          expandedEntries={expandedEntries}
          onToggleExpanded={toggleExpanded}
          onAddEntry={openCreateComposer}
          onReadd={handleReadd}
          addingId={addingId}
          readdedIds={readdedIds}
        />
      )}

      {composerState && (
        <EntryComposer
          existingContent={composerState.entry?.content}
          onClose={closeComposer}
          onSave={handleSaveEntry}
        />
      )}

      {Platform.OS !== "ios" && pickerVideoId && (
        <QueuePickerModal
          onSelect={(queueId) => {
            const vid = pickerVideoId;
            setPickerVideoId(null);
            doAddVideo(vid, queueId);
          }}
          onDismiss={() => setPickerVideoId(null)}
        />
      )}

      <Toast message={toastMsg} visible={toastVisible} />
    </SafeAreaView>
  );
}


// ── SegmentedControl ──────────────────────────────────────────────────────────

function SegmentedControl({
  options,
  selected,
  onChange,
}: {
  options: ViewMode[];
  selected: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[segmentedStyles.wrap, { borderColor: colors.divider, backgroundColor: colors.cardBg }]}>
      {options.map(opt => {
        const isActive = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
            style={[
              segmentedStyles.seg,
              isActive && { backgroundColor: colors.accent },
            ]}
          >
            <SansText
              style={[
                segmentedStyles.label,
                { color: isActive ? colors.buttonText : colors.warmMid },
                isActive && { fontFamily: FontFamily.sansMedium },
              ]}
            >
              {opt}
            </SansText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segmentedStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: 3,
    alignSelf: "center",
  },
  seg: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    minWidth: 96,
    alignItems: "center",
  },
  label: {
    fontSize: FontSize.xs,
  },
});


// ── EntriesView ───────────────────────────────────────────────────────────────

interface EntriesViewProps {
  monthGroups: MonthGroup[];
  loading: boolean;
  onRefresh: () => void;
  collapsedMonths: Set<string>;
  collapsedDays: Set<string>;
  expandedEntries: Set<string>;
  onToggleMonth: (key: string) => void;
  onToggleDay: (key: string) => void;
  onToggleExpanded: (entryId: string) => void;
  onAddEntry: (videoId: string) => void;
  onEntryLongPress: (videoId: string, entry: JournalEntry) => void;
  onReadd: (ytVideoId: string) => void;
  addingId: string | null;
  readdedIds: Set<string>;
}

function EntriesView(props: EntriesViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    monthGroups, loading, onRefresh,
    collapsedMonths, collapsedDays, expandedEntries,
    onToggleMonth, onToggleDay, onToggleExpanded,
    onAddEntry, onEntryLongPress, onReadd, addingId, readdedIds,
  } = props;

  if (!loading && monthGroups.length === 0) {
    return (
      <EmptyState
        icon="✎"
        title="No entries yet"
        subtitle="Watched videos will show up here. Add a journal entry to capture what stood out."
      />
    );
  }

  return (
    <FlatList
      data={monthGroups}
      keyExtractor={m => m.monthKey}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.ink} />}
      contentContainerStyle={styles.listContent}
      renderItem={({ item: month }) => {
        const monthCollapsed = collapsedMonths.has(month.monthKey);
        return (
          <View>
            <TouchableOpacity
              onPress={() => onToggleMonth(month.monthKey)}
              activeOpacity={0.7}
              style={styles.monthRow}
            >
              <Feather
                name={monthCollapsed ? "chevron-right" : "chevron-down"}
                size={14}
                color={colors.warmMid}
              />
              <SansText style={styles.monthHeading}>{month.monthKey}</SansText>
              {monthCollapsed && (
                <SansText style={styles.monthSummary}>
                  {month.entryCount} entr{month.entryCount === 1 ? "y" : "ies"} · {month.watchedCount} watched
                </SansText>
              )}
            </TouchableOpacity>

            {!monthCollapsed && month.days.map(day => {
              const dayCollapsed = collapsedDays.has(day.dayKey);
              return (
                <View key={day.dayKey} style={styles.dayBlock}>
                  <TouchableOpacity
                    onPress={() => onToggleDay(day.dayKey)}
                    activeOpacity={0.7}
                    style={styles.dayRow}
                  >
                    <SansText style={styles.dayBullet}>●</SansText>
                    <SansText style={styles.dayHeading}>{day.dayKey}</SansText>
                    <Feather
                      name={dayCollapsed ? "chevron-right" : "chevron-down"}
                      size={12}
                      color={colors.warmMid}
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>

                  {!dayCollapsed && day.items.map((item, idx) => {
                    const hasEntries = item.journalEntries.length > 0;
                    return (
                      <View key={`${item.video.ytVideoId}-${idx}`} style={styles.itemBlock}>
                        {hasEntries ? (
                          item.journalEntries.map(entry => (
                            <EntryBlock
                              key={entry.id}
                              entry={entry}
                              video={item.video}
                              expanded={expandedEntries.has(entry.id)}
                              onToggleExpanded={() => onToggleExpanded(entry.id)}
                              onLongPress={() => onEntryLongPress(item.video.ytVideoId, entry)}
                              onReadd={() => onReadd(item.video.ytVideoId)}
                              adding={addingId === item.video.ytVideoId}
                              readded={readdedIds.has(item.video.ytVideoId)}
                            />
                          ))
                        ) : (
                          <UnenteredItem
                            video={item.video}
                            onAddEntry={() => onAddEntry(item.video.ytVideoId)}
                            onReadd={() => onReadd(item.video.ytVideoId)}
                            adding={addingId === item.video.ytVideoId}
                            readded={readdedIds.has(item.video.ytVideoId)}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        );
      }}
    />
  );
}


// ── EntryBlock ────────────────────────────────────────────────────────────────

function EntryBlock({
  entry,
  video,
  expanded,
  onToggleExpanded,
  onLongPress,
  onReadd,
  adding,
  readded,
}: {
  entry: JournalEntry;
  video: JournalFeedItem["video"];
  expanded: boolean;
  onToggleExpanded: () => void;
  onLongPress: () => void;
  onReadd: () => void;
  adding: boolean;
  readded: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.95}
      style={styles.entryBlock}
    >
      <View style={styles.entryRow}>
        <View style={styles.entryNoteWrap}>
          <SansText
            style={styles.entryNote}
            numberOfLines={expanded ? undefined : 5}
          >
            {entry.content}
          </SansText>
          {/* "Read more" — render only when content actually overflows the
              5-line cap or already expanded. We approximate overflow with a
              char-count heuristic since RN doesn't expose line metrics. */}
          {(expanded || entry.content.length > 220) && (
            <TouchableOpacity onPress={onToggleExpanded} activeOpacity={0.7}>
              <SansText style={styles.readMore}>
                {expanded ? "Show less" : "Read more"}
              </SansText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.entryVideoRef}>
        <View style={styles.entryThumb}>
          {video.thumbnailUrl
            ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
          }
        </View>
        <View style={styles.entryVideoMeta}>
          <SansText style={styles.entryChannel} numberOfLines={1}>{video.channelTitle}</SansText>
          <SansText style={styles.entryTitle} numberOfLines={1}>{video.title}</SansText>
        </View>
        {entry.videoTimestampSecs != null && (
          <View style={styles.tsChip}>
            <SansText style={styles.tsChipText}>at {formatTimestampShort(entry.videoTimestampSecs)}</SansText>
          </View>
        )}
        <ReaddCircle onPress={onReadd} adding={adding} readded={readded} />
      </View>
    </TouchableOpacity>
  );
}


// ── UnenteredItem (watched, no entry) ─────────────────────────────────────────

function UnenteredItem({
  video,
  onAddEntry,
  onReadd,
  adding,
  readded,
}: {
  video: JournalFeedItem["video"];
  onAddEntry: () => void;
  onReadd: () => void;
  adding: boolean;
  readded: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.unenteredRow}>
      <View style={styles.unenteredLeft}>
        <View style={styles.unenteredThumb}>
          {video.thumbnailUrl
            ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <ThumbPlaceholder seed={video.ytVideoId} style={StyleSheet.absoluteFill} />
          }
        </View>
        <View style={styles.unenteredMeta}>
          <SansText style={styles.unenteredChannel} numberOfLines={1}>{video.channelTitle}</SansText>
          <SansText style={styles.unenteredTitle} numberOfLines={1}>{video.title}</SansText>
          <TouchableOpacity onPress={onAddEntry} activeOpacity={0.7} style={styles.addEntryDashed}>
            <SansText style={styles.addEntryDashedText}>+ Add entry</SansText>
          </TouchableOpacity>
        </View>
      </View>
      <ReaddCircle onPress={onReadd} adding={adding} readded={readded} />
    </View>
  );
}


// ── HistoryView ───────────────────────────────────────────────────────────────

interface HistoryViewProps {
  items: JournalFeedItem[];
  loading: boolean;
  onRefresh: () => void;
  expandedEntries: Set<string>;
  onToggleExpanded: (entryId: string) => void;
  onAddEntry: (videoId: string) => void;
  onReadd: (ytVideoId: string) => void;
  addingId: string | null;
  readdedIds: Set<string>;
}

function HistoryView(props: HistoryViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    items, loading, onRefresh, expandedEntries,
    onToggleExpanded, onAddEntry, onReadd, addingId, readdedIds,
  } = props;

  if (!loading && items.length === 0) {
    return (
      <EmptyState
        icon="↻"
        title="Nothing watched yet"
        subtitle="Videos you finish will appear here."
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item, idx) => `${item.video.ytVideoId}-${idx}`}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.ink} />}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 0 }} />}
      renderItem={({ item }) => {
        const firstEntry = item.journalEntries[0];
        return (
          <View style={styles.historyItemWrap}>
            <View style={styles.historyRow}>
              <View style={styles.historyThumb}>
                {item.video.thumbnailUrl
                  ? <Image source={{ uri: item.video.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <ThumbPlaceholder seed={item.video.ytVideoId} style={StyleSheet.absoluteFill} />
                }
              </View>
              <View style={styles.historyMeta}>
                <SansText style={styles.historyChannel} numberOfLines={1}>{item.video.channelTitle}</SansText>
                <SansText style={styles.historyTitle} numberOfLines={2}>{item.video.title}</SansText>
                <SansText style={styles.historyMetaLine}>
                  {formatShortDate(item.completedAt)} · {formatDuration(item.video.durationSecs)}
                </SansText>
              </View>
              <ReaddCircle
                onPress={() => onReadd(item.video.ytVideoId)}
                adding={addingId === item.video.ytVideoId}
                readded={readdedIds.has(item.video.ytVideoId)}
              />
            </View>

            {firstEntry ? (
              <View style={styles.historyEntryWrap}>
                <SansText
                  style={styles.historyEntryText}
                  numberOfLines={expandedEntries.has(firstEntry.id) ? undefined : 1}
                >
                  {firstEntry.content}
                </SansText>
                {(expandedEntries.has(firstEntry.id) || firstEntry.content.length > 60) && (
                  <TouchableOpacity onPress={() => onToggleExpanded(firstEntry.id)} activeOpacity={0.7}>
                    <SansText style={styles.readMore}>
                      {expandedEntries.has(firstEntry.id) ? "Show less" : "Read more"}
                    </SansText>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => onAddEntry(item.video.ytVideoId)}
                activeOpacity={0.7}
                style={styles.historyAddEntry}
              >
                <SansText style={styles.historyAddEntryText}>+ Add entry</SansText>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );
}


// ── ReaddCircle ───────────────────────────────────────────────────────────────
// Lifted directly from HistoryScreen.tsx's readdBtn pattern (same dimensions,
// same accent ring, same green-filled "done" state). Identical visual contract
// across both views.

function ReaddCircle({
  onPress,
  adding,
  readded,
}: {
  onPress: () => void;
  adding: boolean;
  readded: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={readded || adding}
      activeOpacity={0.7}
      style={[styles.readdBtn, readded && { backgroundColor: colors.green, borderColor: colors.green }]}
    >
      <SansText
        style={[
          styles.readdBtnText,
          readded && { color: "white", fontSize: FontSize.sm, marginTop: 0 },
        ]}
      >
        {adding ? "..." : readded ? "✓" : "↺"}
      </SansText>
    </TouchableOpacity>
  );
}


// ── EntryComposer (bottom sheet) ──────────────────────────────────────────────
// Mirrors InteractModule's animation contract (translateY + backdrop opacity,
// same easing/durations) so the screen's bottom sheets behave consistently.

const SHEET_ANIM_IN_MS = 280;
const SHEET_ANIM_OUT_MS = 220;
const BACKDROP_OPACITY = 0.35;
const SHEET_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const ENTRY_MAX_CHARS = 750;

function EntryComposer({
  existingContent,
  onClose,
  onSave,
}: {
  existingContent?: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => composerStyles(colors), [colors]);

  const translateY = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const [mounted, setMounted] = useState(true);
  const [text, setText] = useState(existingContent ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0, duration: SHEET_ANIM_IN_MS, easing: SHEET_EASING, useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: BACKDROP_OPACITY, duration: 200, useNativeDriver: true,
      }),
    ]).start(() => {
      // Focus only after the slide-in completes — autoFocus races the keyboard
      // against the slide and makes the sheet feel laggy on open.
      inputRef.current?.focus();
    });
  }, []);

  const runClose = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 1, duration: SHEET_ANIM_OUT_MS, easing: SHEET_EASING, useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0, duration: SHEET_ANIM_OUT_MS, useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  const sheetTranslate = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 600],
  });

  if (!mounted) return null;

  const canSave = text.trim().length > 0 && !saving;

  return (
    <Modal visible transparent animationType="none" onRequestClose={runClose}>
      <View style={{ flex: 1 }}>
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
            accessibilityLabel="Journal entry composer"
          >
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <SansText style={styles.headerTitle}>
                {existingContent ? "Edit entry" : "New entry"}
              </SansText>
              <TouchableOpacity
                onPress={runClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={FontSize.lg} color={colors.queued} />
              </TouchableOpacity>
            </View>

            <View style={styles.fullDivider} />

            <View style={styles.bodyWrap}>
              <TextInput
                ref={inputRef}
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
                <SansText style={styles.charCount}>
                  {ENTRY_MAX_CHARS - text.length}
                </SansText>
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
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}


// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    spinnerWrap:     { flex: 1, alignItems: "center", justifyContent: "center" },
    listContent:     { paddingBottom: 80 },

    pageHeader:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    pageTitle:       { fontSize: FontSize.lg },
    pageSubtitle:    { fontSize: FontSize.xs, color: c.warmMid, marginTop: 2 },

    segmentedWrap:   { paddingVertical: Spacing.sm, alignItems: "center" },

    // Month row — DM Sans Medium (non-italic), FontSize.xl (22)
    monthRow:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 6 },
    monthHeading:    { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xl, color: c.ink, flexShrink: 0 },
    monthSummary:    { fontFamily: FontFamily.sans, fontSize: FontSize.xs, color: c.warmMid, marginLeft: "auto", textAlign: "right" },

    // Day block within an expanded month
    dayBlock:        { paddingHorizontal: Spacing.md, paddingTop: 4, paddingBottom: Spacing.sm },
    dayRow:          { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingLeft: Spacing.sm },
    dayBullet:       { fontSize: FontSize.xs, color: c.queued, marginTop: -1 },
    dayHeading:      { fontFamily: "Lora_400Regular_Italic", fontSize: FontSize.lg, color: c.ink, flexShrink: 1 },

    // Entry block — note text + indented video reference
    itemBlock:       { paddingTop: 6, paddingBottom: 4 },
    entryBlock:      { paddingVertical: 6, paddingLeft: Spacing.lg },
    entryRow:        { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    entryNoteWrap:   { flex: 1, borderLeftWidth: 2, borderLeftColor: c.accent, paddingLeft: 8 },
    entryNote:       { fontFamily: "DMSans_400Regular_Italic", fontSize: FontSize.md, color: c.ink, lineHeight: 22 },
    readMore:        { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xs, color: c.accent, marginTop: 4 },

    entryVideoRef:   { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 14, marginTop: 6 },
    entryThumb:      { width: 40, height: 26, borderRadius: 3, overflow: "hidden", backgroundColor: c.divider, position: "relative" },
    entryVideoMeta:  { flex: 1, minWidth: 0 },
    entryChannel:    { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
    entryTitle:      { fontFamily: FontFamily.sans, fontSize: FontSize.xs, color: c.warmMid, marginTop: 1 },

    tsChip:          { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: `${c.accent}15`, borderWidth: 1, borderColor: c.accent },
    tsChipText:      { fontSize: FontSize.xxs, color: c.accent, fontFamily: FontFamily.sansMedium },

    // Un-entered watched item
    unenteredRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, paddingLeft: Spacing.lg, opacity: 0.45 },
    unenteredLeft:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
    unenteredThumb:  { width: 36, height: 24, borderRadius: 3, overflow: "hidden", backgroundColor: c.divider, position: "relative" },
    unenteredMeta:   { flex: 1, minWidth: 0 },
    unenteredChannel:{ fontFamily: FontFamily.sansMedium, fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
    unenteredTitle:  { fontFamily: FontFamily.sans, fontSize: FontSize.xs, color: c.warmMid, marginTop: 1 },
    addEntryDashed:  { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderStyle: "dashed", borderColor: c.queued },
    addEntryDashedText: { fontSize: FontSize.xs, color: c.queued, fontFamily: FontFamily.sansMedium },

    // History view rows
    historyItemWrap: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, gap: 6 },
    historyRow:      { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    historyThumb:    { width: 64, height: 42, borderRadius: 5, overflow: "hidden", backgroundColor: c.divider, position: "relative", flexShrink: 0 },
    historyMeta:     { flex: 1, minWidth: 0 },
    historyChannel:  { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
    historyTitle:    { fontFamily: FontFamily.sans, fontSize: FontSize.sm, color: c.ink, lineHeight: 18, marginTop: 2 },
    historyMetaLine: { fontFamily: FontFamily.sans, fontSize: FontSize.xs, color: c.queued, marginTop: 2 },

    historyEntryWrap:    { borderLeftWidth: 2, borderLeftColor: c.accent, paddingLeft: 8 },
    historyEntryText:    { fontFamily: "DMSans_400Regular_Italic", fontSize: FontSize.md, color: c.ink, lineHeight: 22 },
    historyAddEntry:     { alignSelf: "flex-start", paddingVertical: 2 },
    historyAddEntryText: { fontFamily: FontFamily.sansMedium, fontSize: FontSize.xs, color: c.accent },

    // ↺ readd circle — copied from HistoryScreen.tsx readdBtn
    readdBtn:        { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.accent, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    readdBtnText:    { fontSize: FontSize.lg, color: c.accent, lineHeight: 24, marginTop: -2 },
  });
}


function composerStyles(c: ColorPalette) {
  return StyleSheet.create({
    backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
    kbContainer:     { flex: 1, justifyContent: "flex-end" },
    sheet:           { backgroundColor: c.cardBg, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingTop: 6 },
    handle:          { alignSelf: "center", width: 32, height: 3, borderRadius: 999, backgroundColor: c.divider, marginBottom: 4 },
    headerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
    headerTitle:     { fontSize: FontSize.md, fontFamily: FontFamily.sansMedium, color: c.ink },
    fullDivider:     { height: 1, backgroundColor: c.divider },
    bodyWrap:        { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, gap: 10 },
    textarea:        { backgroundColor: c.cream, borderWidth: 1, borderColor: c.divider, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 11, fontSize: FontSize.sm, color: c.ink, minHeight: 96, fontFamily: "DMSans_400Regular_Italic" },
    footerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    charCount:       { fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sans },
    saveBtn:         { borderRadius: Radius.pill, paddingVertical: 8, paddingHorizontal: 18 },
    saveBtnText:     { fontSize: FontSize.sm, fontFamily: FontFamily.sansMedium },
  });
}
