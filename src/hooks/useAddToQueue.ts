import { useState, useEffect } from "react";
import { Platform, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";

/**
 * Shared hook for "add to queue" across all screens.
 *
 * - Free users / single-queue pro users → adds directly.
 * - Multi-queue pro users on iOS         → ActionSheetIOS queue picker.
 * - Multi-queue pro users on Android     → sets pickerVideoId so the
 *   screen can render <QueuePickerModal />.
 *
 * @param onAdded  Optional callback fired with the ytVideoId after a
 *                 successful add (useful for updating local UI state).
 */
export function useAddToQueue(onAdded?: (ytVideoId: string) => void) {
  const navigation = useNavigation<any>();
  const { user, queues, addToQueue, fetchQueues, clearError } = useStore();

  const [addingId, setAddingId]         = useState<string | null>(null);
  const [pickerVideoId, setPickerVideoId] = useState<string | null>(null);

  // Ensure queues are populated so the picker has data regardless of
  // which tab the user landed on first.
  useEffect(() => {
    if (queues.length === 0) fetchQueues();
  }, []);

  /** Low-level add — called directly or from the picker modal. */
  const doAddVideo = async (ytVideoId: string, queueId?: string) => {
    setAddingId(ytVideoId);
    try {
      await addToQueue(ytVideoId, queueId);
      onAdded?.(ytVideoId);
    } catch (e: any) {
      if (typeof e?.message === "string" && e.message.includes("queue_limit_reached")) {
        clearError();
        Alert.alert(
          "Queue limit reached",
          "Free accounts can hold up to 25 videos in their queue.",
          [{ text: "OK" }],
        );
      }
      // Other errors: store surfaces the banner.
    } finally {
      setAddingId(null);
    }
  };

  /** Call this on any "+ Add" button press. */
  const handleAdd = (ytVideoId: string) => {
    // Free users or pro users with only one queue → skip picker.
    if (user?.plan !== "pro" || queues.length <= 1) {
      doAddVideo(ytVideoId);
      return;
    }

    if (Platform.OS === "ios") {
      const { ActionSheetIOS } = require("react-native");
      const options = [
        ...queues.map(q => (q.emoji ? `${q.emoji} ${q.name}` : q.name) + ` · ${q.videoCount}`),
        "+ New queue",
        "Cancel",
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1 },
        (idx: number) => {
          if (idx === options.length - 1) return; // Cancel
          if (idx === queues.length) { navigation.navigate("NewQueue"); return; }
          doAddVideo(ytVideoId, queues[idx].id);
        }
      );
    } else {
      // Android — caller renders <QueuePickerModal> when pickerVideoId is set.
      setPickerVideoId(ytVideoId);
    }
  };

  return { handleAdd, doAddVideo, addingId, pickerVideoId, setPickerVideoId, queues };
}
