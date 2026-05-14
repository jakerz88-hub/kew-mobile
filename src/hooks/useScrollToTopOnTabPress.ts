import { useCallback } from "react";
import { useScrollToTop } from "@react-navigation/native";
import { useRegisterTabletScrollToTop, TabletTab } from "../contexts/TabletSidebarContext";

/**
 * Wire a scrollable's ref so that tapping the tab the user is already on
 * scrolls it back to the top — table-stakes mobile UX.
 *
 * - Phone (React Navigation bottom tab navigator): @react-navigation/native's
 *   useScrollToTop fires when the active tab is re-pressed.
 * - Tablet (custom sidebar + bottom tab bar): TabletNavigator calls the
 *   registered callback when the user taps the already-active tab.
 *
 * A screen can call this multiple times if it has multiple FlatLists in
 * conditional renders (e.g. ExploreScreen landing vs. results) — refs whose
 * .current is null at trigger time are no-ops.
 */
export function useScrollToTopOnTabPress<T>(
  ref: React.RefObject<T>,
  tabletTab: TabletTab,
) {
  // Phone — fires on tab-already-active press via NavigationContainer.
  useScrollToTop(ref as any);

  // Tablet — fires on tab-already-active press via TabletSidebarProvider.
  const scrollToTop = useCallback(() => {
    const node = ref.current as any;
    if (!node) return;
    if (typeof node.scrollToOffset === "function") {
      node.scrollToOffset({ offset: 0, animated: true });
    } else if (typeof node.scrollTo === "function") {
      node.scrollTo({ y: 0, animated: true });
    } else if (typeof node.scrollToTop === "function") {
      node.scrollToTop();
    }
  }, [ref]);
  useRegisterTabletScrollToTop(tabletTab, scrollToTop);
}
