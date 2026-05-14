import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Manages the seen/unseen state for a named tooltip journey.
 *
 * - `step`        current tip index (0-based); -1 means journey not started yet
 * - `ready`       true once AsyncStorage has been checked (avoid flash)
 * - `visible`     true when the journey is active and the screen has settled
 * - `advance()`   move to next tip, or mark journey complete when on the last tip
 * - `dismiss()`   mark the whole journey complete immediately
 *
 * @param journeyKey  Unique storage key for this journey (e.g. "queue_v2")
 * @param totalSteps  How many tooltip steps this journey has
 * @param enabled     When false the journey is skipped entirely (useful for
 *                    plan-gating or sequencing two journeys on the same screen).
 *                    Defaults to true.
 */
export function useTooltip(journeyKey: string, totalSteps: number, enabled = true) {
  const storageKey = `tooltip_done_${journeyKey}`;
  const [step, setStep]   = useState<number>(-1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // Journey is gated off — mark ready so callers can proceed without waiting
      setReady(true);
      return;
    }

    AsyncStorage.getItem(storageKey).then((val) => {
      if (val !== "1") {
        // Delay first tip slightly so the screen has fully settled
        setTimeout(() => setStep(0), 700);
      }
      setReady(true);
    });
  }, [storageKey, enabled]);

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
