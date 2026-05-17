import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View, TextInput, FlatList, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator, Keyboard, Platform, RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../services/api";
import type { BrowseVideo } from "../types";
import { formatDuration } from "../types";
import {
  KewLogo, SansText, SerifText, Divider, ThumbPlaceholder, AvatarBubble,
} from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { useStore } from "../store";
import { useAddToQueue } from "../hooks/useAddToQueue";
import { QueuePickerModal } from "../components/QueuePickerModal";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { timeAgo } from "../types";
import { useTheme } from "../contexts/ThemeContext";
import { useInTabletSidebar } from "../contexts/TabletSidebarContext";
import { useScrollToTopOnTabPress } from "../hooks/useScrollToTopOnTabPress";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHIPS = [
  "Philosophy", "Craft", "Film", "Nature", "Science",
  "History", "Architecture", "Music", "Language", "Cooking",
  "Technology", "Sports",
];

const MAX_RECENT  = 5;
const STORAGE_KEY = "kew_recent_searches";
const MAX_AGE_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

type RecentEntry =
  | { kind: "search"; query: string; savedAt: string }
  | { kind: "surprise"; topic: string; video: BrowseVideo; savedAt: string };

async function loadRecentSearches(): Promise<RecentEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: RecentEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;
    return parsed.filter(e => new Date(e.savedAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

async function saveRecentSearches(entries: RecentEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable
  }
}

const SURPRISE_TOPICS = [
  "Philosophy", "Craft", "Film", "Nature", "Science",
  "History", "Architecture", "Music", "Language", "Cooking",
  "Technology", "Sports", "Astronomy", "Ethics", "Animation",
  "Jazz", "Poetry", "Urban Planning", "Marine Biology", "Mathematics",
  "Psychology", "Ceramics", "Photography", "Theatre", "Linguistics",
  "Climate", "Neuroscience", "Economics", "Folklore", "Meditation",
  "Skateboarding", "Calligraphy", "Fungi", "Geology", "Typography",
  "Mythology", "Chess", "Ornithology", "Fermentation", "Printmaking",
  "Anthropology", "Botany", "Sailing", "Cryptography", "Woodworking",
  "Entomology", "Cartography", "Weaving", "Volcanology", "Beekeeping",
];

export default function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const inSidebar = useInTabletSidebar();
  const { user } = useStore();
  const queuedVideos = useStore(s => s.queuedVideos);
  const { handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId } = useAddToQueue();

  const [query, setQuery]                   = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults]               = useState<BrowseVideo[]>([]);
  const [searching, setSearching]           = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  // Separate state for pull-to-refresh so the FlatList doesn't unmount
  // mid-refresh. If we reused `searching`, the FlatList's `!searching`
  // render gate would unmount its parent while RefreshControl is still
  // animating — iOS crash. Pull-to-refresh keeps results visible.
  const [refreshing, setRefreshing]         = useState(false);
  const [searchError, setSearchError]       = useState<string | null>(null);
  const [resultLimit, setResultLimit]       = useState(12);
  const [recentSearches, setRecentSearches] = useState<RecentEntry[]>([]);
  const [surpriseMode, setSurpriseMode]     = useState(false);
  const [surpriseTopic, setSurpriseTopic]   = useState("");
  const [surpriseVideo, setSurpriseVideo]   = useState<BrowseVideo | null>(null);
  const [surpriseSearching, setSurpriseSearching] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const hasResults = submittedQuery.length > 0;

  // Tab-icon re-tap → scroll to top. Three potential scrollables (landing,
  // results, surprise-mode); only one is mounted at a time so the others'
  // refs are null no-ops on trigger.
  const landingListRef = useRef<FlatList | null>(null);
  const resultsListRef = useRef<FlatList | null>(null);
  const surpriseScrollRef = useRef<ScrollView | null>(null);
  useScrollToTopOnTabPress(landingListRef, "Explore");
  useScrollToTopOnTabPress(resultsListRef, "Explore");
  useScrollToTopOnTabPress(surpriseScrollRef, "Explore");

  // ── Persist recent searches ──
  useEffect(() => { loadRecentSearches().then(setRecentSearches); }, []);
  useEffect(() => { saveRecentSearches(recentSearches); }, [recentSearches]);

  const performSearch = useCallback(async (q: string, limit: number = 12) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError(null);
    setSubmittedQuery(trimmed);
    setResults([]);
    setResultLimit(limit);
    setRecentSearches(prev => {
      const deduped = prev.filter(e => !(e.kind === "search" && e.query.toLowerCase() === trimmed.toLowerCase()));
      return [{ kind: "search" as const, query: trimmed, savedAt: new Date().toISOString() }, ...deduped].slice(0, MAX_RECENT);
    });
    try {
      const res = await api.searchYouTube(trimmed, limit);
      setResults(res);
    } catch (e: any) {
      setSearchError(e.message ?? "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!submittedQuery) return;
    setLoadingMore(true);
    try {
      const limits = [12, 20, 32, 50];
      const nextLimit = limits.find(l => l > resultLimit) || 50;
      const res = await api.searchYouTube(submittedQuery, nextLimit);
      setResults(res);
      setResultLimit(nextLimit);
    } catch (e: any) {
      setSearchError(e.message ?? "Failed to load more results.");
    } finally {
      setLoadingMore(false);
    }
  }, [submittedQuery, resultLimit]);

  // Pull-to-refresh re-runs the current query at the current limit, without
  // toggling `searching` (which would unmount the FlatList mid-refresh and
  // crash iOS — see the comment on the `refreshing` state above).
  const handleRefresh = useCallback(async () => {
    if (!submittedQuery) return;
    setRefreshing(true);
    setSearchError(null);
    try {
      const res = await api.searchYouTube(submittedQuery, resultLimit);
      setResults(res);
    } catch (e: any) {
      setSearchError(e.message ?? "Refresh failed. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [submittedQuery, resultLimit]);

  const handleChipPress = useCallback((chip: string) => {
    setQuery(chip);
    performSearch(chip);
  }, [performSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
    setSubmittedQuery("");
    setResults([]);
    setSearchError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSurprise = useCallback(async () => {
    const topic = SURPRISE_TOPICS[Math.floor(Math.random() * SURPRISE_TOPICS.length)];
    setSurpriseTopic(topic);
    setSurpriseMode(true);
    setSurpriseSearching(true);
    setSurpriseVideo(null);
    try {
      const res = await api.searchYouTube(topic);
      const pool = res.slice(1, 7).filter(Boolean);
      if (pool.length > 0) {
        const video = pool[Math.floor(Math.random() * pool.length)];
        setSurpriseVideo(video);
        // Save to recent searches, replacing any previous entry for the same topic
        setRecentSearches(prev => {
          const deduped = prev.filter(e => !(e.kind === "surprise" && e.topic === topic));
          return [{ kind: "surprise" as const, topic, video, savedAt: new Date().toISOString() }, ...deduped].slice(0, MAX_RECENT);
        });
      }
    } catch {
      // stay in surprise mode, no video — user can try again
    } finally {
      setSurpriseSearching(false);
    }
  }, []);

  const handleAddToQueue = (video: BrowseVideo) => handleAdd(video.ytVideoId);

  const isInQueue = (ytVideoId: string) => !!queuedVideos[ytVideoId];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {!inSidebar && (
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
      {!inSidebar && <Divider />}

      {/* Page title — always visible, matches other tabs */}
      <View style={styles.pageTitleRow}>
        <SerifText style={styles.pageTitle}>Explore New Topics</SerifText>
      </View>

      {/* Search bar — always visible */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={colors.warmMid} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => performSearch(query)}
            placeholder="Search videos, channels, topics..."
            placeholderTextColor={colors.warmMid}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => { setQuery(""); inputRef.current?.focus(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={15} color={colors.warmMid} />
            </TouchableOpacity>
          )}
        </View>
        {hasResults && (
          <TouchableOpacity onPress={handleClear} style={styles.cancelBtn} activeOpacity={0.6}>
            <SansText style={styles.cancelText}>Clear</SansText>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Landing state ─────────────────────────────────────────────────── */}
      {!hasResults && (
        surpriseMode ? (
          /* ── Surprise reveal ─────────────────────────────────────────────── */
          <ScrollView ref={surpriseScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.surpriseContainer}>
            {/* Back link */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setSurpriseMode(false); setSurpriseVideo(null); }}
              activeOpacity={0.6}
            >
              <Feather name="chevron-left" size={15} color={colors.accent} />
              <SansText style={styles.backText}>Back to explore</SansText>
            </TouchableOpacity>

            {surpriseSearching ? (
              <View style={styles.surpriseLoading}>
                <ActivityIndicator size="small" color={colors.accent} />
                <SansText style={styles.surpriseLoadingText}>Finding something good…</SansText>
              </View>
            ) : surpriseVideo ? (
              <>
                {/* Topic label */}
                <SansText style={styles.surpriseTopicLabel}>Topic: {surpriseTopic}</SansText>

                {/* Video card */}
                <View style={styles.surpriseCard}>
                  <View style={styles.surpriseThumb}>
                    {surpriseVideo.thumbnailUrl
                      ? <Image
                          source={{ uri: surpriseVideo.thumbnailUrl }}
                          style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }]}
                          resizeMode="cover"
                        />
                      : <ThumbPlaceholder seed={surpriseVideo.ytVideoId} style={StyleSheet.absoluteFill} />
                    }
                    {surpriseVideo.durationSecs > 0 && (
                      <View style={styles.durationBadge}>
                        <SansText style={styles.durationText}>
                          {formatDuration(surpriseVideo.durationSecs)}
                        </SansText>
                      </View>
                    )}
                  </View>
                  <View style={styles.surpriseInfo}>
                    <SansText style={styles.surpriseChannel} numberOfLines={1}>
                      {surpriseVideo.channelTitle}
                    </SansText>
                    <SansText style={styles.surpriseTitle} numberOfLines={3}>
                      {surpriseVideo.title}
                    </SansText>
                  </View>
                </View>

                {/* Actions — stacked vertically on mobile */}
                <View style={styles.surpriseActions}>
                  {!!queuedVideos[surpriseVideo.ytVideoId] ? (
                    <View style={[styles.surpriseActionBtn, styles.surpriseActionBtnQueued]}>
                      <SansText style={styles.surpriseActionBtnTextQueued}>In queue ✓</SansText>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.surpriseActionBtn}
                      onPress={() => handleAddToQueue(surpriseVideo)}
                      disabled={addingId === surpriseVideo.ytVideoId}
                      activeOpacity={0.75}
                    >
                      {addingId === surpriseVideo.ytVideoId
                        ? <ActivityIndicator size="small" color={colors.buttonText} />
                        : <SansText style={styles.surpriseActionBtnText}>+ Add to queue</SansText>
                      }
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.surpriseTryBtn}
                    onPress={handleSurprise}
                    disabled={surpriseSearching}
                    activeOpacity={0.75}
                  >
                    <SansText style={styles.surpriseTryBtnText}>Try another</SansText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* No video found */
              <View style={styles.surpriseEmpty}>
                <SansText style={styles.surpriseEmptyTitle}>No video found</SansText>
                <SansText style={styles.surpriseEmptySubtitle}>Try again. The internet is vast.</SansText>
                <TouchableOpacity style={styles.surpriseActionBtn} onPress={handleSurprise} activeOpacity={0.75}>
                  <SansText style={styles.surpriseActionBtnText}>Try again</SansText>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        ) : (
          /* ── Original landing ──────────────────────────────────────────────── */
          <FlatList
            ref={landingListRef}
            data={[]}
            renderItem={() => null}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* Hero */}
                <View style={styles.hero}>
                  <SerifText style={styles.heroTitle}>
                    What do you{"\n"}want to watch?
                  </SerifText>
                  <SansText style={styles.heroSub}>
                    Explore without a feed pulling you in.
                  </SansText>
                </View>

                {/* Topic chips */}
                <View style={styles.section}>
                  <SansText style={styles.sectionLabel}>Start somewhere</SansText>
                  <View style={styles.chipRow}>
                    {CHIPS.map(chip => (
                      <TouchableOpacity
                        key={chip}
                        style={styles.chip}
                        onPress={() => handleChipPress(chip)}
                        activeOpacity={0.7}
                      >
                        <SansText style={styles.chipText}>{chip}</SansText>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.surpriseChip}
                      onPress={handleSurprise}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="dice-5" size={14} color={colors.accent} />
                      <SansText style={styles.surpriseChipText}>Surprise me!</SansText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Recent searches */}
                {recentSearches.length > 0 && (
                  <>
                    <Divider style={{ marginHorizontal: Spacing.md }} />
                    <View style={styles.section}>
                      <View style={styles.recentHeader}>
                        <SansText style={styles.sectionLabel}>Recent searches</SansText>
                        <TouchableOpacity onPress={() => setRecentSearches([])}>
                          <SansText style={styles.clearText}>Clear</SansText>
                        </TouchableOpacity>
                      </View>
                      {recentSearches.map(entry => {
                        if (entry.kind === "search") {
                          return (
                            <TouchableOpacity
                              key={`s-${entry.query}`}
                              style={styles.recentItem}
                              onPress={() => { setQuery(entry.query); performSearch(entry.query); }}
                              activeOpacity={0.7}
                            >
                              <Feather name="clock" size={13} color={colors.warmMid} />
                              <SansText style={styles.recentText}>{entry.query}</SansText>
                            </TouchableOpacity>
                          );
                        } else {
                          return (
                            <TouchableOpacity
                              key={`surprise-${entry.topic}`}
                              style={styles.recentSurpriseItem}
                              onPress={() => {
                                setSurpriseTopic(entry.topic);
                                setSurpriseVideo(entry.video);
                                setSurpriseMode(true);
                                setSurpriseSearching(false);
                              }}
                              activeOpacity={0.7}
                            >
                              {/* Small thumbnail */}
                              <View style={styles.recentSurpriseThumb}>
                                {entry.video.thumbnailUrl ? (
                                  <Image
                                    source={{ uri: entry.video.thumbnailUrl }}
                                    style={[StyleSheet.absoluteFill, { borderRadius: 4 }]}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.divider, borderRadius: 4 }]} />
                                )}
                              </View>
                              <View style={styles.recentSurpriseInfo}>
                                <SansText style={styles.recentSurpriseLabel} numberOfLines={1}>
                                  {entry.topic}
                                </SansText>
                                <SansText style={styles.recentSurpriseTitle} numberOfLines={2}>
                                  {entry.video.title}
                                </SansText>
                              </View>
                            </TouchableOpacity>
                          );
                        }
                      })}
                    </View>
                  </>
                )}

                <SansText style={styles.footNote}>
                  Search on your own terms. No recommendations, no algorithm.
                </SansText>
              </View>
            }
          />
        )
      )}

      {/* ── Results state ─────────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {searching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}

          {searchError && (
            <View style={styles.errorRow}>
              <SansText style={styles.errorText}>{searchError}</SansText>
            </View>
          )}

          {!searching && !searchError && (
            <FlatList
              ref={resultsListRef}
              data={results}
              keyExtractor={item => item.ytVideoId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.accent}
                />
              }
              ListHeaderComponent={
                results.length > 0 ? (
                  <SansText style={styles.resultsLabel}>
                    {results.length} result{results.length !== 1 ? "s" : ""} for "{submittedQuery}"
                  </SansText>
                ) : (
                  <View style={styles.emptyResults}>
                    <SerifText style={styles.emptyTitle}>No results found.</SerifText>
                    <SansText style={styles.emptySub}>
                      Try a different search or tap a topic chip.
                    </SansText>
                  </View>
                )
              }
              ListFooterComponent={
                results.length >= resultLimit ? (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, loadingMore && { opacity: 0.6 }]}
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                    activeOpacity={0.7}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={colors.warmMid} />
                    ) : (
                      <SansText style={styles.loadMoreText}>Load more</SansText>
                    )}
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => {
                const queued  = isInQueue(item.ytVideoId);
                const adding  = addingId === item.ytVideoId;
                return (
                  <View style={styles.resultCard}>
                    <View style={styles.resultThumb}>
                      {item.thumbnailUrl
                        ? <Image
                            source={{ uri: item.thumbnailUrl }}
                            style={[StyleSheet.absoluteFill, { borderRadius: Radius.sm }]}
                            resizeMode="cover"
                          />
                        : <ThumbPlaceholder seed={item.ytVideoId} style={StyleSheet.absoluteFill} />
                      }
                      <View style={styles.durationBadge}>
                        <SansText style={styles.durationText}>
                          {formatDuration(item.durationSecs)}
                        </SansText>
                      </View>
                    </View>

                    <View style={styles.resultInfo}>
                      <SansText style={styles.resultChannel} numberOfLines={1}>
                        {item.channelTitle}
                      </SansText>
                      <SansText style={styles.resultTitle} numberOfLines={2}>
                        {item.title}
                      </SansText>
                      {item.publishedAt && (
                        <SansText style={styles.resultDate}>
                          {timeAgo(item.publishedAt)}
                        </SansText>
                      )}
                      <TouchableOpacity
                        style={[styles.addBtn, queued && styles.addBtnQueued]}
                        onPress={() => !queued && handleAddToQueue(item)}
                        disabled={queued || adding}
                        activeOpacity={0.75}
                      >
                        {adding
                          ? <ActivityIndicator size="small" color={colors.buttonText} />
                          : <SansText style={[styles.addBtnText, queued && styles.addBtnTextQueued]}>
                              {queued ? "In queue ✓" : "+ Add to queue"}
                            </SansText>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {Platform.OS !== "ios" && pickerVideoId && (
        <QueuePickerModal
          onSelect={(queueId) => { const vid = pickerVideoId; setPickerVideoId(null); doAddVideo(vid, queueId); }}
          onDismiss={() => setPickerVideoId(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Static styles (layout only — colors applied via makeStyles) ───────────────
function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: c.cream },

    // Header
    header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },

    // Page title
    pageTitleRow:   { padding: Spacing.md, paddingBottom: Spacing.sm },
    pageTitle:      { fontSize: FontSize.lg },

    // Search bar
    searchRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
    searchBar:      { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 8, gap: 6 },
    searchInput:    { flex: 1, fontFamily: FontFamily.sans, fontSize: FontSize.sm, color: c.ink, padding: 0 },
    cancelBtn:      { paddingVertical: 4 },
    cancelText:     { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sansMedium },

    // Landing hero
    hero:           { alignItems: "center", paddingTop: Spacing.lg + 4, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.xs },
    heroTitle:      { fontSize: FontSize.xxl, textAlign: "center", lineHeight: 34 },
    heroSub:        { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center", lineHeight: 20 },

    // Sections & chips
    section:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
    sectionLabel:   { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium },
    chipRow:        { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 },
    chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.divider, backgroundColor: c.cardBg },
    chipText:       { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sans },

    // Recent searches
    recentHeader:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    clearText:             { fontSize: FontSize.xs, color: c.accent },
    recentItem:            { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: c.divider },
    recentText:            { fontSize: FontSize.sm, color: c.ink },
    // Surprise recent entry
    recentSurpriseItem:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: c.divider },
    recentSurpriseThumb:   { width: 52, height: 34, borderRadius: 4, overflow: "hidden", flexShrink: 0, backgroundColor: c.divider },
    recentSurpriseInfo:    { flex: 1, gap: 2 },
    recentSurpriseLabel:   { fontSize: 10, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium },
    recentSurpriseTitle:   { fontSize: FontSize.sm, color: c.ink, lineHeight: 16 },

    // Footer note
    footNote:       { fontSize: FontSize.xxs, color: c.warmMid, textAlign: "center", lineHeight: 18, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },

    // Results
    loadingRow:     { flex: 1, alignItems: "center", justifyContent: "center" },
    errorRow:       { margin: Spacing.md, padding: Spacing.md, backgroundColor: `${c.accent}18`, borderRadius: Radius.md },
    errorText:      { fontSize: FontSize.sm, color: c.accent },
    resultsList:    { paddingBottom: 40 },
    resultsLabel:   { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
    emptyResults:   { alignItems: "center", paddingTop: 60, gap: Spacing.xs },
    emptyTitle:     { fontSize: FontSize.lg, color: c.ink },
    emptySub:       { fontSize: FontSize.sm, color: c.warmMid },

    // Surprise me! chip
    surpriseChip:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.accent },
    surpriseChipText:   { fontSize: FontSize.sm, color: c.accent, fontFamily: FontFamily.sans },

    // Surprise reveal view
    surpriseContainer:  { padding: Spacing.md, gap: Spacing.sm },
    backBtn:            { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, alignSelf: "flex-start" },
    backText:           { fontSize: FontSize.xs, color: c.accent, fontFamily: FontFamily.sans },
    surpriseLoading:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 60 },
    surpriseLoadingText:{ fontSize: FontSize.sm, color: c.warmMid },
    surpriseTopicLabel: { fontSize: 10, color: c.warmMid, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: FontFamily.sansMedium, marginTop: Spacing.xs },
    surpriseCard:       { borderRadius: Radius.md, borderWidth: 1, borderColor: c.divider, backgroundColor: c.cardBg, overflow: "hidden" },
    surpriseThumb:      { width: "100%", aspectRatio: 16 / 9, backgroundColor: c.divider },
    surpriseInfo:       { padding: Spacing.sm, gap: 4 },
    surpriseChannel:    { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FontFamily.sansMedium },
    surpriseTitle:      { fontSize: FontSize.sm, color: c.ink, lineHeight: 18 },
    surpriseActions:    { gap: Spacing.sm, marginTop: Spacing.xs },
    surpriseActionBtn:  { paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: c.accent, alignItems: "center" },
    surpriseActionBtnText: { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    surpriseActionBtnQueued: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: c.greenText },
    surpriseActionBtnTextQueued: { fontSize: FontSize.sm, color: c.greenText, fontFamily: FontFamily.sansMedium },
    surpriseTryBtn:     { paddingVertical: 12, borderRadius: Radius.pill, borderWidth: 1, borderColor: c.divider, alignItems: "center" },
    surpriseTryBtnText: { fontSize: FontSize.sm, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    surpriseEmpty:      { alignItems: "center", paddingVertical: 60, gap: Spacing.sm },
    surpriseEmptyTitle: { fontSize: FontSize.md, color: c.ink },
    surpriseEmptySubtitle: { fontSize: FontSize.sm, color: c.warmMid, textAlign: "center" },

    // Result card
    resultCard:     { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: c.divider },
    resultThumb:    { width: 100, height: 64, borderRadius: Radius.sm, overflow: "hidden", flexShrink: 0 },
    durationBadge:  { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(26,23,20,0.78)", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
    durationText:   { fontSize: 10, color: "white", fontFamily: FontFamily.sansMedium },
    resultInfo:     { flex: 1, justifyContent: "center", gap: 3 },
    resultChannel:  { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.5 },
    resultTitle:    { fontSize: FontSize.sm, color: c.ink, lineHeight: 17 },
    resultDate:     { fontSize: FontSize.xxs, color: c.queued },
    addBtn:         { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: c.accent },
    addBtnQueued:   { backgroundColor: "transparent", borderWidth: 1.5, borderColor: c.greenText },
    addBtnText:     { fontSize: FontSize.xxs, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    addBtnTextQueued: { color: c.greenText },
    loadMoreBtn:    { alignSelf: "center", marginVertical: Spacing.md, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: c.divider },
    loadMoreText:   { fontSize: FontSize.sm, color: c.warmMid, fontFamily: FontFamily.sansMedium },
  });
}
