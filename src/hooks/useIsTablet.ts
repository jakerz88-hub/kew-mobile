import { useWindowDimensions } from "react-native";

/**
 * Returns true when the screen is tablet-width (≥ 768pt).
 * Reacts to orientation changes automatically via useWindowDimensions.
 */
export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= 768;
}
