import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { SansText, SerifText, Divider } from "../components/UI";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../store";

// Article body is stored as an array of paragraphs.
// Use { text, italic } tuples within a paragraph for inline italic runs.
type Run = { text: string; italic?: boolean };
type Paragraph = Run[] | string;
type ArticleBody = Paragraph[];

const ARTICLES: Record<string, ArticleBody> = {
  "How do skips work?": [
    "Maybe you're not feeling the video you're watching. Skips let you send it to the end of your queue for later. You start with 3 skips (5 with Kew+), and each finished video earns you one back, up to your max.",
    "The limit gives you a chance to pause before skipping, to increase intention and decrease distraction.",
  ],
  "Arranging your queue": [
    "You can set your queue order however you like by dragging any video to a new position. Long-press and drag on mobile, or click and drag on the web.",
    "Once you start playing your first video, the top three 'up next' spots are locked in. Changes to your top three costs a skip, but videos anywhere below that can be reordered for free.",
  ],
  "Shuffling your queue": [
    "Shuffling your queue randomizes the order of the upcoming videos in your queue. It's a good way to mix things up when your queue has grown long.",
    "Shuffling does not count against your skip limit.",
  ],
  "Removing videos from your queue": [
    "If you've decided you're just not interested in a video, you can tap Remove to take it out of your queue altogether.",
    "Removing videos does not count against your skip limit.",
  ],
  "Importing from a playlist": [
    "Already have a playlist in YouTube you don't want to rebuild? Kew lets you import videos from an existing YouTube playlist into your queue. Tap + Import, choose a playlist, select the videos you want, and they'll be added in order.",
    "Note: YouTube Watch Later playlists are not available for import. Only playlists you've created yourself will appear.",
  ],
  "Sharing your queue": [
    "Share what you're watching with friends and family, or post your queue online. Anyone with the link can preview your queue. Those with a Kew account can add videos from your queue directly to their own!",
  ],
  "Browsing your subscribed channels": [
    "The Browse tab is where you can find all your subscribed YouTube channels. Tap any channel to see their recent uploads, then tap + Add on any video to drop it into your queue.",
    "Your channel list is pulled from your YouTube account. If you've recently subscribed to new channels and they're not showing up, tap Sync to refresh.",
  ],
  "Using the Explore tab": [
    "The Explore tab lets you search for any topic, creator, or keyword on YouTube, even for channels you don't follow. Results show up as videos you can add directly to your queue.",
    "There's no feed, no trending section, and no algorithm deciding what to show you. You search, you choose. That's it.",
  ],
  "What is the 'Surprise me!' button?": [
    "Surprise me! on the Explore tab picks a random topic and finds a video for you. If you like it, add it to your queue. If not, try again for something different.",
    "This can be a good way to break out of your usual watch patterns and stumble onto something you may not have searched for on your own.",
  ],
  "Updating your Kew profile": [
    "You can set your username and photo from the profile screen. This is how you appear to others on Kew.",
    [
      { text: "Tap Edit to set your username, which must be unique, contain only letters, numbers, and underscores, and is limited to 24 characters. Usernames are permanent and " },
      { text: "cannot be changed", italic: true },
      { text: " once set." },
    ],
    "Tap your profile photo to upload a new one. You can use any photo from your camera roll.",
  ],
  "Changing the app theme": [
    "Kew supports light and dark mode color themes, or can automatically follow your device settings. You can change your theme on the profile screen under Appearance.",
    "With Kew+, you also get access to a selection of premium color themes, each with a light and dark mode variant.",
  ],
  "Signing out": [
    "To sign out, scroll to the bottom of the profile screen and tap Sign out. You'll be returned to the login screen.",
    "Signing out does not delete your account or your queue. Everything will be waiting when you sign back in.",
  ],
  "How does Kew work?": [
    "Kew is a video queue designed for minimal distraction and maximum intentionality. It connects to YouTube through your Google account and allows you to hand-pick videos to place in your queue. Videos are watched in the order you added them, one after another.",
    [
      { text: "Kew is focused not on time spent, but time " },
      { text: "well", italic: true },
      { text: " spent. It will never autoplay, never serve you recommendations, and never try to exploit your attention." },
    ],
  ],
  "Connecting your YouTube account": [
    "When you sign in, choose the Google account linked to your YouTube channel. Kew will ask for permission to view your subscriptions so your channels appear in the Browse tab. If needed, you can re-sync if your subscriptions ever fall out of sync.",
    "Kew does not post to your account or modify your YouTube data in any way. Your YouTube account status carries over. If you have YouTube Premium, videos will play ad-free in Kew. If not, you may see ads served by YouTube's player.",
  ],
  "Adding your first video": [
    "There are three ways to add a video to your queue:",
    "1. From the Browse tab, find a video from one of your subscribed channels and tap + Add.",
    "2. From the Explore tab, search any topic and tap + Add to queue on any result.",
    "3. From the Queue tab, tap + Import to select videos from an existing YouTube playlist.",
    "Once a video is in your queue, head to the Queue tab to start watching.",
    "YouTube Watch Later playlists are not available, only playlists you created yourself.",
  ],
  "Liking or commenting on a video": [
    "The Interact button on the player screen lets you like a video or leave a comment on YouTube without leaving Kew. Tap it while a video is playing, and a sheet will appear where you can do either or both.",
    "Likes and comments go directly to YouTube and show up on the video just as they would if you'd used YouTube itself.",
  ],
  "Managing multiple queues": [
    "With Kew+, you can create as many queues as you like and organize them however works for you.",
    "To create a new queue, tap the + button on the Queues screen. Give it a name and optionally pick an emoji to go with it. Your main queue is always at the top and can't be deleted or renamed.",
    "To pin a queue, tap the ... button and select Pin. Pinned queues appear near the top of your list for easy access. You can have up to 3 pinned queues at a time.",
    "To move a video from one queue to another, long-press it to open the menu, tap \"Move to another queue,\" and choose your destination.",
  ],
  "Adding or editing a Journal entry": [
    "Journal entries are attached to individual videos and are completely private. To add one, find the video under the Journal tab and tap the entry area to open the composer. Entries are capped at 750 characters.",
    "You can edit an entry at any time by tapping it again. Entries are grouped by day and month, and sit alongside your watch history so you can see what you wrote in context.",
  ],
  "Understanding your Insights": [
    "The Insights screen shows your watching data across three time windows: this week, this month, and this year. Switch between them at the top of the screen.",
    "The stats shown are videos watched, total watch time, completion rate, and skips used. Each includes a comparison to the previous period so you can see how your habits are shifting. A daily bar chart below breaks your watch time down day by day.",
    "Insights are a mirror, not a report card. There are no scores, no streaks, and no comparisons to other users.",
  ],
  "Setting a Watch Limit": [
    "Watch limits are personal targets you set for yourself on the Insights & Limits screen. You can set limits on daily videos watched, daily watch time, or consecutive videos watched.",
    "Kew will not prevent you from exceeding your personal limits. These limits are a tool to help you hold yourself accountable.",
  ],
};

const SECTIONS = [
  {
    title: "Getting started",
    items: ["How does Kew work?", "Connecting your YouTube account", "Adding your first video"],
  },
  {
    title: "Managing your queue",
    items: ["How do skips work?", "Arranging your queue", "Shuffling your queue", "Removing videos from your queue", "Importing from a playlist", "Sharing your queue", "Liking or commenting on a video"],
  },
  {
    title: "Browsing & exploring",
    items: ["Browsing your subscribed channels", "Using the Explore tab", "What is the 'Surprise me!' button?"],
  },
  {
    title: "Account & settings",
    items: ["Updating your Kew profile", "Changing the app theme", "Signing out"],
  },
];

const KEW_PLUS_SECTIONS = [
  {
    title: "Kew+",
    items: [
      "Managing multiple queues",
      "Adding or editing a Journal entry",
      "Understanding your Insights",
      "Setting a Watch Limit",
    ],
  },
];

function ArticleBody({ body, styles }: { body: ArticleBody; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.articleBody}>
      {body.map((para, i) => {
        if (typeof para === "string") {
          return <SansText key={i} style={styles.articlePara}>{para}</SansText>;
        }
        return (
          <Text key={i} style={styles.articlePara}>
            {para.map((run, j) => (
              <Text key={j} style={run.italic ? styles.italic : undefined}>{run.text}</Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

export default function HelpScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const { user } = useStore();

  function toggleArticle(item: string) {
    setOpenArticle((prev) => (prev === item ? null : item));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.warmMid} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Help</SerifText>
        <View style={{ flex: 1 }} />
      </View>
      <Divider />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <SansText style={styles.sectionTitle}>{section.title}</SansText>
            {section.items.map((item, i) => {
              const isOpen = openArticle === item;
              const hasArticle = !!ARTICLES[item];
              const isLast = i === section.items.length - 1;
              return (
                <View key={item}>
                  <TouchableOpacity
                    onPress={() => hasArticle && toggleArticle(item)}
                    activeOpacity={hasArticle ? 0.6 : 1}
                    style={[styles.row, !isOpen && !isLast && styles.rowBorder]}
                  >
                    <SansText style={styles.rowText}>{item}</SansText>
                    <Feather
                      name={isOpen ? "chevron-down" : "chevron-right"}
                      size={15}
                      color={colors.warmMid}
                    />
                  </TouchableOpacity>
                  {isOpen && hasArticle && (
                    <View style={[styles.articleContainer, !isLast && styles.rowBorder]}>
                      <ArticleBody body={ARTICLES[item]} styles={styles} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {user?.plan === "pro" && KEW_PLUS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <SansText style={styles.sectionTitle}>{section.title}</SansText>
            {section.items.map((item, i) => {
              const isOpen = openArticle === item;
              const hasArticle = !!ARTICLES[item];
              const isLast = i === section.items.length - 1;
              return (
                <View key={item}>
                  <TouchableOpacity
                    onPress={() => hasArticle && toggleArticle(item)}
                    activeOpacity={hasArticle ? 0.6 : 1}
                    style={[styles.row, !isOpen && !isLast && styles.rowBorder]}
                  >
                    <SansText style={styles.rowText}>{item}</SansText>
                    <Feather
                      name={isOpen ? "chevron-down" : "chevron-right"}
                      size={15}
                      color={colors.warmMid}
                    />
                  </TouchableOpacity>
                  {isOpen && hasArticle && (
                    <View style={[styles.articleContainer, !isLast && styles.rowBorder]}>
                      <ArticleBody body={ARTICLES[item]} styles={styles} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: c.cream },
    header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    headerTitle:      { fontSize: FontSize.md, color: c.ink, textAlign: "center" },
    backBtn:          { flex: 1, padding: 4 },
    content:          { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 48, gap: Spacing.md },
    section:          { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider, borderRadius: Radius.md, overflow: "hidden" },
    sectionTitle:     { fontSize: FontSize.xxs, color: c.warmMid, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FontFamily.sansMedium, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm + 2, paddingBottom: Spacing.xs },
    row:              { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
    rowBorder:        { borderBottomWidth: 0.5, borderBottomColor: c.divider },
    rowText:          { fontSize: FontSize.sm, color: c.ink, flex: 1, marginRight: Spacing.sm },
    articleContainer: { backgroundColor: c.cream, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
    articleBody:      { gap: Spacing.sm },
    articlePara:      { fontSize: FontSize.sm, color: c.warmMid, lineHeight: 21, fontFamily: FontFamily.sans },
    italic:           { fontFamily: "DMSans_400Regular_Italic" },
  });
}
