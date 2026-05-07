import React from "react";
import { View, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, KewLogo } from "./UI";
import { LogoMark, QueueTabIcon, BrowseTabIcon, ExploreTabIcon, HistoryTabIcon } from "./TabIcons";
import type { TabletTab } from "../contexts/TabletSidebarContext";

export type { TabletTab };

interface TabletSidebarProps {
  activeTab: TabletTab;
  onTabChange: (tab: TabletTab) => void;
  onProfilePress: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const EXPANDED_WIDTH = 172;
const COLLAPSED_WIDTH = 48;

export function TabletSidebar({
  activeTab,
  onTabChange,
  onProfilePress,
  collapsed,
  onToggleCollapse,
}: TabletSidebarProps) {
  const { colors } = useTheme();
  const user = useStore(s => s.user);

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const initial = user?.displayName?.charAt(0).toUpperCase() ?? "?";
  const isPro = user?.plan === "pro";

  const items: { tab: TabletTab; label: string; icon: (color: string) => React.ReactNode }[] = [
    { tab: "Queue",   label: "Queue",   icon: (color) => <QueueTabIcon   color={color} /> },
    { tab: "Browse",  label: "Browse",  icon: (color) => <BrowseTabIcon  color={color} /> },
    { tab: "Explore", label: "Explore", icon: (color) => <ExploreTabIcon color={color} /> },
    { tab: "History", label: "History", icon: (color) => <HistoryTabIcon color={color} /> },
    { tab: "Import",  label: "Import",  icon: (color) => <Feather name="file-text" size={15} color={color} /> },
  ];

  return (
    <SafeAreaView style={[styles.sidebar, { width, backgroundColor: colors.cardBg, borderRightColor: colors.divider }]}>
      {/* Logo area */}
      <View style={[styles.logoArea, { borderBottomColor: colors.divider }, collapsed && styles.logoAreaCollapsed]}>
        {collapsed ? (
          <LogoMark size={16} />
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LogoMark size={16} />
              <KewLogo size={16} />
            </View>
            <TouchableOpacity onPress={onToggleCollapse} activeOpacity={0.7} hitSlop={8}>
              <Feather name="chevron-left" size={16} color={colors.warmMid} />
            </TouchableOpacity>
          </>
        )}
        {collapsed && (
          <TouchableOpacity
            onPress={onToggleCollapse}
            activeOpacity={0.7}
            hitSlop={8}
            style={styles.expandBtnCollapsed}
          >
            <Feather name="chevron-right" size={16} color={colors.warmMid} />
          </TouchableOpacity>
        )}
      </View>

      {/* Nav items */}
      <View style={styles.navItems}>
        {items.map(({ tab, label, icon }) => {
          const isActive = activeTab === tab;
          const tintColor = isActive ? colors.ink : colors.warmMid;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onTabChange(tab)}
              activeOpacity={0.7}
              style={[
                styles.navItem,
                collapsed && styles.navItemCollapsed,
                isActive && { backgroundColor: colors.cream },
              ]}
            >
              <View style={styles.iconWrap}>{icon(tintColor)}</View>
              {!collapsed && (
                <SansText
                  style={[
                    styles.navLabel,
                    { color: tintColor },
                    isActive && { fontFamily: "DMSans_500Medium" },
                  ]}
                >
                  {label}
                </SansText>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Profile */}
      <View style={[styles.profileSection, { borderTopColor: colors.divider }]}>
        <TouchableOpacity
          onPress={onProfilePress}
          activeOpacity={0.7}
          style={[styles.profileRow, collapsed && styles.profileRowCollapsed]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.green }]}>
            <SansText style={styles.avatarInitial}>{initial}</SansText>
          </View>
          {!collapsed && (
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <SansText style={[styles.profileName, { color: colors.ink }]} numberOfLines={1}>
                {user?.displayName ?? "You"}
              </SansText>
              {isPro && (
                <View style={[styles.proBadge, { backgroundColor: colors.accent }]}>
                  <SansText style={styles.proBadgeText}>Kew+</SansText>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    height: "100%",
    borderRightWidth: 1,
    flexDirection: "column",
  },
  logoArea: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoAreaCollapsed: {
    paddingHorizontal: 0,
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  expandBtnCollapsed: {
    alignItems: "center",
  },
  navItems: {
    flex: 1,
    padding: 6,
    gap: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  navItemCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  iconWrap: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 12.5,
  },
  profileSection: {
    borderTopWidth: 1,
    padding: 6,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  profileRowCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "DMSans_500Medium",
  },
  profileName: {
    fontSize: 12.5,
    flexShrink: 1,
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  proBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "DMSans_500Medium",
  },
});
