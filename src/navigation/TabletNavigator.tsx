import React, { useState, useCallback } from "react";
import { View, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { TabletSidebar, TabletTab } from "../components/TabletSidebar";
import { TabletSidebarProvider, useTabletScrollToTopTrigger } from "../contexts/TabletSidebarContext";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../store";
import { SansText, KewLogo, AvatarBubble } from "../components/UI";
import { LogoMark, QueueTabIcon, BrowseTabIcon, ExploreTabIcon, HistoryTabIcon, JournalTabIcon } from "../components/TabIcons";
import { FontSize, Spacing } from "../types/theme";
import QueueScreen from "../screens/QueueScreen";
import BrowseScreen from "../screens/BrowseScreen";
import ExploreScreen from "../screens/ExploreScreen";
import JournalScreen from "../screens/JournalScreen";
import TabletImportScreen from "../screens/tablet/TabletImportScreen";

export default function TabletNavigator() {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [activeTab, setActiveTab] = useState<TabletTab>("Queue");
  const [collapsed, setCollapsed] = useState(false);

  const screens: Record<TabletTab, React.ReactNode> = {
    Queue:   <QueueScreen />,
    Browse:  <BrowseScreen />,
    Explore: <ExploreScreen />,
    History: <JournalScreen />,
    Import:  <TabletImportScreen />,
  };

  const screenStack = (
    <View style={{ flex: 1, overflow: "hidden" }}>
      {(Object.keys(screens) as TabletTab[]).map(tab => (
        <View
          key={tab}
          style={{ flex: 1, display: tab === activeTab ? "flex" : "none" }}
        >
          {screens[tab]}
        </View>
      ))}
    </View>
  );

  return (
    <TabletSidebarProvider switchTab={setActiveTab}>
      <TabletShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLandscape={isLandscape}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
        onProfilePress={() => navigation.navigate("Profile")}
        screenStack={screenStack}
      />
    </TabletSidebarProvider>
  );
}

// Renders the tablet chrome inside the Provider so it can reach the
// scrollToTop registry. Wraps every tab tap so re-taps on the active tab
// scroll the current screen up instead of triggering a no-op state set.
function TabletShell({
  activeTab,
  setActiveTab,
  isLandscape,
  collapsed,
  onToggleCollapse,
  onProfilePress,
  screenStack,
}: {
  activeTab: TabletTab;
  setActiveTab: (tab: TabletTab) => void;
  isLandscape: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onProfilePress: () => void;
  screenStack: React.ReactNode;
}) {
  const triggerScrollToTop = useTabletScrollToTopTrigger();
  const handleTabPress = useCallback((tab: TabletTab) => {
    if (tab === activeTab) {
      triggerScrollToTop?.(tab);
    } else {
      setActiveTab(tab);
    }
  }, [activeTab, setActiveTab, triggerScrollToTop]);

  if (isLandscape) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <TabletSidebar
          activeTab={activeTab}
          onTabChange={handleTabPress}
          onProfilePress={onProfilePress}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
        {screenStack}
      </View>
    );
  }

  // Portrait: full-width tablet content with top bar + bottom tab bar.
  return (
    <View style={{ flex: 1 }}>
      <TabletTopBar onProfilePress={onProfilePress} />
      {screenStack}
      <TabletBottomTabBar activeTab={activeTab} onTabChange={handleTabPress} />
    </View>
  );
}

function TabletTopBar({ onProfilePress }: { onProfilePress: () => void }) {
  const { colors } = useTheme();
  const user = useStore(s => s.user);
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.cardBg, borderBottomColor: colors.divider, borderBottomWidth: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <LogoMark size={20} />
          <KewLogo size={20} />
        </View>
        <AvatarBubble
          avatarUrl={user?.avatarUrl}
          initial={user?.displayName?.charAt(0).toUpperCase() ?? "?"}
          size={32}
          onPress={onProfilePress}
        />
      </View>
    </SafeAreaView>
  );
}

function TabletBottomTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabletTab;
  onTabChange: (tab: TabletTab) => void;
}) {
  const { colors } = useTheme();
  // Plan-aware label + icon for the History/Journal slot. Free users see
  // "History" + clock; paid users see "Journal" + book-open. The internal
  // tab key stays "History" so route state doesn't churn on plan changes.
  const user = useStore(s => s.user);
  const isFree = (user?.plan ?? "free") === "free";
  const bottomTabs: { tab: TabletTab; label: string; icon: (color: string) => React.ReactNode }[] = [
    { tab: "Queue",   label: "Queue",   icon: (color) => <QueueTabIcon   color={color} /> },
    { tab: "Browse",  label: "Browse",  icon: (color) => <BrowseTabIcon  color={color} /> },
    { tab: "Explore", label: "Explore", icon: (color) => <ExploreTabIcon color={color} /> },
    isFree
      ? { tab: "History", label: "History", icon: (color) => <HistoryTabIcon color={color} /> }
      : { tab: "History", label: "Journal", icon: (color) => <JournalTabIcon color={color} /> },
    { tab: "Import",  label: "Import",  icon: (color) => <Feather name="download" size={20} color={color} /> },
  ];
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.cardBg, borderTopColor: colors.divider, borderTopWidth: 1 }}>
      <View style={{ flexDirection: "row" }}>
        {bottomTabs.map(({ tab, label, icon }) => {
          const isActive = activeTab === tab;
          const tintColor = isActive ? colors.accent : colors.warmMid;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onTabChange(tab)}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8, gap: 4 }}
            >
              {icon(tintColor)}
              <SansText
                style={{
                  color: tintColor,
                  fontSize: FontSize.xxs,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontFamily: "DMSans_500Medium",
                }}
              >
                {label}
              </SansText>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
