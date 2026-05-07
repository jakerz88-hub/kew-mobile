import { useWindowDimensions } from "react-native";

/**
 * True only when wide enough AND in landscape — i.e. iPad rotated wide.
 * iPad portrait falls back to phone layout (with a centered max-width wrapper
 * applied at the navigator level), since the side-by-side panes feel cramped
 * at portrait widths.
 */
export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return width >= 768 && width > height;
}

/** True when the device is tablet-class (>= 768pt) regardless of orientation. */
export function useIsTabletDevice(): boolean {
  const { width, height } = useWindowDimensions();
  return Math.max(width, height) >= 768;
}
