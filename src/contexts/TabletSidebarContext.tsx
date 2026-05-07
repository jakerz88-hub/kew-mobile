import React, { createContext, useContext } from 'react';

export type TabletTab = "Queue" | "Browse" | "Explore" | "History" | "Import";

interface TabletShellValue {
  inTabletShell: boolean;
  switchTab?: (tab: TabletTab) => void;
}

const TabletSidebarContext = createContext<TabletShellValue>({ inTabletShell: false });

export function TabletSidebarProvider({
  children,
  switchTab,
}: {
  children: React.ReactNode;
  switchTab?: (tab: TabletTab) => void;
}) {
  return (
    <TabletSidebarContext.Provider value={{ inTabletShell: true, switchTab }}>
      {children}
    </TabletSidebarContext.Provider>
  );
}

export function useInTabletSidebar(): boolean {
  return useContext(TabletSidebarContext).inTabletShell;
}

export function useTabletSwitchTab(): ((tab: TabletTab) => void) | undefined {
  return useContext(TabletSidebarContext).switchTab;
}
