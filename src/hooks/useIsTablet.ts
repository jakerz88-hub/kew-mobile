import { useWindowDimensions } from "react-native";

/**
 * Returns true when the screen is tablet-width (>= 768pt) — i.e. iPad, in
 * either orientation. Screens use this to render their two-column tablet
 * layout. The choice between sidebar and bottom-tab chrome is made by
 * TabletNavigator based on orientation, so screens themselves don't need
 * to know which one is wrapping them.
 */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= 768;
}
