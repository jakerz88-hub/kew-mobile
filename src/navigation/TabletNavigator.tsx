import React, { useState } from "react";
import { View, TouchableOpacity, SafeAreaView, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { TabletSidebar, TabletTab } from "../components/TabletSidebar";
import { TabletSidebarProvider } from "../contexts/TabletSidebarContext";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../store";
import { SansText, KewLogo, AvatarBubble } from "../components/UI";
import { LogoMark, QueueTabIcon, BrowseTabIcon, ExploreTabIcon, JournalTabIcon } from "../components/TabIcons";
import { Spacing } from "../types/theme";
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

  if (isLandscape) {
    return (
      <TabletSidebarProvider switchTab={setActiveTab}>
        <View style={{ flex: 1, flexDirection: "row" }}>
          <TabletSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onProfilePress={() => navigation.navigate("Profile")}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(c => !c)}
          />
          {screenStack}
        </View>
      </TabletSidebarProvider>
    );
  }

  // Portrait: full-width tablet content with top bar + bottom tab bar.
  return (
    <TabletSidebarProvider switchTab={setActiveTab}>
      <View style={{ flex: 1 }}>
        <TabletTopBar onProfilePress={() => navigation.navigate("Profile")} />
        {screenStack}
        <TabletBottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </TabletSidebarProvider>
  );
}

function TabletTopBar({ onProfilePress }: { onProfilePress: () => void }) {
  const { colors } = useTheme();
  const user = useStore(s => s.user);
  return (
    <SafeAreaView style={{ backgroundColor: colors.cardBg, borderBottomColor: colors.divider, borderBottomWidth: 1 }}>
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

const BOTTOM_TABS: { tab: TabletTab; label: string; icon: (color: string) => React.ReactNode }[] = [
  { tab: "Queue",   label: "Queue",   icon: (color) => <QueueTabIcon   color={color} /> },
  { tab: "Browse",  label: "Browse",  icon: (color) => <BrowseTabIcon  color={color} /> },
  { tab: "Explore", label: "Explore", icon: (color) => <ExploreTabIcon color={color} /> },
  { tab: "History", label: "Journal", icon: (color) => <JournalTabIcon color={color} /> },
  { tab: "Import",  label: "Import",  icon: (color) => <Feather name="download" size={20} color={color} /> },
];

function TabletBottomTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabletTab;
  onTabChange: (tab: TabletTab) => void;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ backgroundColor: colors.cardBg, borderTopColor: colors.divider, borderTopWidth: 1 }}>
      <View style={{ flexDirection: "row" }}>
        {BOTTOM_TABS.map(({ tab, label, icon }) => {
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
                  fontSize: 10,
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
