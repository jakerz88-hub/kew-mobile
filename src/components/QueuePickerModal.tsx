import React from "react";
import { View, TouchableOpacity, Modal, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store";
import { SansText } from "./UI";
import { FontFamily, FontSize, Radius, Spacing } from "../types/theme";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Bottom-sheet modal for selecting a queue on Android.
 * Reads queues directly from the store — no props needed.
 *
 * Usage:
 *   {Platform.OS !== "ios" && pickerVideoId && (
 *     <QueuePickerModal
 *       onSelect={(queueId) => { const vid = pickerVideoId; setPickerVideoId(null); doAddVideo(vid, queueId); }}
 *       onDismiss={() => setPickerVideoId(null)}
 *     />
 *   )}
 */
export function QueuePickerModal({
  onSelect,
  onDismiss,
}: {
  onSelect: (queueId: string) => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const { queues } = useStore();
  const navigation = useNavigation<any>();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(26,23,20,0.5)", justifyContent: "flex-end" }}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <View style={{ backgroundColor: colors.cardBg, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingBottom: 32 }}>
          <View style={{ padding: Spacing.md, paddingBottom: Spacing.sm }}>
            <SansText style={{ fontSize: FontSize.xs, color: colors.warmMid, fontFamily: FontFamily.sansMedium, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Add to queue
            </SansText>
          </View>
          <View style={{ height: 1, backgroundColor: colors.divider }} />
          <FlatList
            data={queues}
            keyExtractor={q => q.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 }}
                onPress={() => onSelect(item.id)}
                activeOpacity={0.7}
              >
                <SansText style={{ fontSize: 18, width: 24 }}>{item.emoji ?? ""}</SansText>
                <View style={{ flex: 1 }}>
                  <SansText style={{ fontSize: FontSize.sm, color: colors.ink, fontFamily: FontFamily.sansMedium }}>{item.name}</SansText>
                  <SansText style={{ fontSize: FontSize.xxs, color: colors.warmMid }}>{item.videoCount} video{item.videoCount !== 1 ? "s" : ""}</SansText>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 56 }} />}
          />
          <View style={{ height: 1, backgroundColor: colors.divider }} />
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 }}
            onPress={() => { onDismiss(); navigation.navigate("NewQueue"); }}
            activeOpacity={0.7}
          >
            <SansText style={{ fontSize: FontSize.sm, color: colors.accent, fontFamily: FontFamily.sansMedium }}>+ New queue</SansText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
