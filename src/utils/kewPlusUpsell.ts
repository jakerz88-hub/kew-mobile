import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "../store";

const QUEUE_LIMIT_COUNT_KEY = "kew_plus_queue_limit_count";
const SKIP_USED_COUNT_KEY   = "kew_plus_skip_used_count";

/**
 * Increment the queue-limit counter and either show the Kew+ upsell sheet
 * (every 5th hit) or the simple alert (other hits).
 */
export async function handleQueueLimitReached() {
  let nextCount = 1;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_LIMIT_COUNT_KEY);
    const prev = parseInt(raw ?? "0", 10);
    nextCount = (Number.isNaN(prev) ? 0 : prev) + 1;
    await AsyncStorage.setItem(QUEUE_LIMIT_COUNT_KEY, String(nextCount));
  } catch { /* ignore */ }

  if (nextCount % 5 === 0) {
    useStore.getState().showKewPlusUpsell({
      headline: "Your queue is full",
      body: "Free queues hold up to 25 videos. Kew+ gives you unlimited length.",
    });
  } else {
    Alert.alert(
      "Queue limit reached",
      "Free accounts can hold up to 25 videos in their queue.",
      [{ text: "OK" }],
    );
  }
}

/**
 * Increment the last-skip-used counter and show the Kew+ upsell sheet
 * on every 5th hit. No alert on other hits — just silent tracking.
 * Returns true if the sheet was shown.
 */
export async function handleLastSkipUsed(): Promise<boolean> {
  let nextCount = 1;
  try {
    const raw = await AsyncStorage.getItem(SKIP_USED_COUNT_KEY);
    const prev = parseInt(raw ?? "0", 10);
    nextCount = (Number.isNaN(prev) ? 0 : prev) + 1;
    await AsyncStorage.setItem(SKIP_USED_COUNT_KEY, String(nextCount));
  } catch { /* ignore */ }

  if (nextCount % 5 === 0) {
    useStore.getState().showKewPlusUpsell({
      headline: "You've used your last skip",
      body: "Finish a video to earn one back, or upgrade to Kew+ for more.",
    });
    return true;
  }
  return false;
}
