import React, { createContext, useContext } from 'react';

const TabletSidebarContext = createContext(false);

export function TabletSidebarProvider({ children }: { children: React.ReactNode }) {
  return <TabletSidebarContext.Provider value={true}>{children}</TabletSidebarContext.Provider>;
}

export function useInTabletSidebar(): boolean {
  return useContext(TabletSidebarContext);
}
