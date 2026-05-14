import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';

export type TabletTab = "Queue" | "Browse" | "Explore" | "History" | "Import";

type ScrollToTopFn = () => void;

interface TabletShellValue {
  inTabletShell: boolean;
  switchTab?: (tab: TabletTab) => void;
  registerScrollToTop?: (tab: TabletTab, fn: ScrollToTopFn) => () => void;
  triggerScrollToTop?: (tab: TabletTab) => void;
}

const TabletSidebarContext = createContext<TabletShellValue>({ inTabletShell: false });

export function TabletSidebarProvider({
  children,
  switchTab,
}: {
  children: React.ReactNode;
  switchTab?: (tab: TabletTab) => void;
}) {
  // Registry of scroll-to-top callbacks keyed by tab. A Set per tab because a
  // screen may have multiple scrollables (e.g. ExploreScreen has landing list
  // + results list). Triggering fires all registered callbacks; unmounted ones
  // have already unregistered via their cleanup so we never call into stale
  // refs.
  const registryRef = useRef<Map<TabletTab, Set<ScrollToTopFn>>>(new Map());

  const registerScrollToTop = useCallback((tab: TabletTab, fn: ScrollToTopFn) => {
    let set = registryRef.current.get(tab);
    if (!set) { set = new Set(); registryRef.current.set(tab, set); }
    set.add(fn);
    return () => { set!.delete(fn); };
  }, []);

  const triggerScrollToTop = useCallback((tab: TabletTab) => {
    const set = registryRef.current.get(tab);
    if (!set) return;
    set.forEach(fn => { try { fn(); } catch { /* ignore individual failures */ } });
  }, []);

  return (
    <TabletSidebarContext.Provider value={{ inTabletShell: true, switchTab, registerScrollToTop, triggerScrollToTop }}>
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

export function useTabletScrollToTopTrigger(): ((tab: TabletTab) => void) | undefined {
  return useContext(TabletSidebarContext).triggerScrollToTop;
}

// Hook for screens to register a scroll-to-top callback against the tablet
// sidebar. No-op when not inside a TabletSidebarProvider (i.e. phone), so
// screens can call it unconditionally — phone uses useScrollToTop from
// @react-navigation/native to get the equivalent behavior on the bottom tab
// navigator.
export function useRegisterTabletScrollToTop(tab: TabletTab, fn: ScrollToTopFn) {
  const register = useContext(TabletSidebarContext).registerScrollToTop;
  useEffect(() => {
    if (!register) return;
    const unregister = register(tab, fn);
    return unregister;
  }, [tab, fn, register]);
}
