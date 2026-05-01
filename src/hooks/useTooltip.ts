import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Manages the seen/unseen state for a named tooltip journey.
 *
 * - `step`        current tip index (0-based); -1 means journey not started yet
 * - `ready`       true once AsyncStorage has been checked (avoid flash)
 * - `advance()`   move to next tip, or mark journey complete when on the last tip
 * - `dismiss()`   mark the whole journey complete immediately
 */
export function useTooltip(journeyKey: string, totalSteps: number) {
  const storageKey = `tooltip_done_${journeyKey}`;
  const [step, setStep]   = useState<number>(-1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val !== "1") {
        // Delay first tip slightly so the screen has settled
        setTimeout(() => setStep(0), 700);
      }
      setReady(true);
    });
  }, [storageKey]);

  const advance = useCallback(() => {
    setStep((s) => {
      const next = s + 1;
      if (next >= totalSteps) {
        AsyncStorage.setItem(storageKey, "1");
        return -1;
      }
      return next;
    });
  }, [storageKey, totalSteps]);

  const dismiss = useCallback(() => {
    AsyncStorage.setItem(storageKey, "1");
    setStep(-1);
  }, [storageKey]);

  const visible = ready && step >= 0;

  return { step, visible, advance, dismiss };
}
