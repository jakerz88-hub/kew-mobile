import React, { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { TabletSidebar, TabletTab } from "../components/TabletSidebar";
import { TabletSidebarProvider } from "../contexts/TabletSidebarContext";
import QueueScreen from "../screens/QueueScreen";
import BrowseScreen from "../screens/BrowseScreen";
import ExploreScreen from "../screens/ExploreScreen";
import HistoryScreen from "../screens/HistoryScreen";
import TabletImportScreen from "../screens/tablet/TabletImportScreen";

export default function TabletNavigator() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabletTab>("Queue");
  const [collapsed, setCollapsed] = useState(false);

  const screens: Record<TabletTab, React.ReactNode> = {
    Queue:   <QueueScreen />,
    Browse:  <BrowseScreen />,
    Explore: <ExploreScreen />,
    History: <HistoryScreen />,
    Import:  <TabletImportScreen />,
  };

  return (
    <TabletSidebarProvider>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <TabletSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onProfilePress={() => navigation.navigate("Profile")}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />
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
      </View>
    </TabletSidebarProvider>
  );
}
