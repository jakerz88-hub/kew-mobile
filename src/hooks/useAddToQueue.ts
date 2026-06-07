import { useState, useEffect } from "react";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { handleQueueLimitReached } from "../utils/kewPlusUpsell";

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
  const { user, queues, addToQueue, fetchQueues } = useStore();

  const [addingId, setAddingId]         = useState<string | null>(null);
  const [pickerVideoId, setPickerVideoId] = useState<string | null>(null);
  const [watchNowVideoId, setWatchNowVideoId] = useState<string | null>(null);
  const [watchNowTitle, setWatchNowTitle]     = useState<string>("");

  // Ensure queues are populated so the picker has data regardless of
  // which tab the user landed on first. Gate on signed-in: signed-out
  // surfaces (e.g. SharedQueueScreen reached via Universal Link) mount
  // this hook too, and an unauthenticated fetchQueues throws an auth
  // error that surfaces a spurious banner before the user even sees
  // the screen.
  useEffect(() => {
    if (user && queues.length === 0) fetchQueues();
  }, [user]);

  /** Low-level add — called directly or from the picker modal. */
  const doAddVideo = async (ytVideoId: string, queueId?: string) => {
    setAddingId(ytVideoId);
    try {
      await addToQueue(ytVideoId, queueId);
      onAdded?.(ytVideoId);
    } catch (e: any) {
      if (e?.code === "queue_limit_reached") {
        await handleQueueLimitReached();
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

  /** Call this on long-press of any "+ Add" button to open WatchNowSheet. */
  const handleWatchNow = (ytVideoId: string, title: string) => {
    setWatchNowVideoId(ytVideoId);
    setWatchNowTitle(title);
  };

  const closeWatchNow = () => {
    setWatchNowVideoId(null);
    setWatchNowTitle("");
  };

  return {
    handleAdd,
    doAddVideo,
    addingId,
    pickerVideoId,
    setPickerVideoId,
    queues,
    handleWatchNow,
    closeWatchNow,
    watchNowVideoId,
    watchNowTitle,
  };
}
