import React, { useState, useCallback, useMemo } from "react";
import {
  View, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, Alert, TextInput, Platform, Modal,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store";
import { useTheme } from "../contexts/ThemeContext";
import { SansText, SerifText, Divider } from "../components/UI";
import { LogoMark } from "../components/TabIcons";
import { ColorPalette, FontFamily, FontSize, Spacing, Radius } from "../types/theme";
import type { KewQueue } from "../types";

export default function AllQueuesScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const {
    queues, user, fetchQueues, setActiveQueue, updateQueue, pinQueue, deleteQueue, activeQueueId,
  } = useStore();

  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameText, setRenameText]   = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Android action sheet modal state
  const [actionSheetQueue, setActionSheetQueue] = useState<KewQueue | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchQueues();
    }, [])
  );

  const handleRowPress = (q: KewQueue) => {
    setActiveQueue(q.id);
    navigation.navigate("Tabs");
  };

  const handlePinToggle = async (q: KewQueue) => {
    try {
      await pinQueue(q.id, !q.pinned);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not update queue.");
    }
  };

  const openActionSheet = (q: KewQueue) => {
    if (Platform.OS === "ios") {
      const { ActionSheetIOS } = require("react-native");
      const pinLabel = q.pinned ? "Unpin" : "Pin to top";
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Rename", pinLabel, "Delete"],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (idx: number) => {
          if (idx === 1) startRename(q);
          if (idx === 2) handlePinToggle(q);
          if (idx === 3) confirmDelete(q);
        }
      );
    } else {
      setActionSheetQueue(q);
    }
  };

  const startRename = (q: KewQueue) => {
    setRenameText(q.name);
    setRenamingId(q.id);
  };

  const confirmDelete = (q: KewQueue) => {
    Alert.alert(
      "Delete queue",
      `Delete "${q.name}"? All videos in this queue will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteQueue(q.id);
            } catch (e: any) {
              Alert.alert("Error", e.message ?? "Could not delete queue.");
            }
          },
        },
      ]
    );
  };

  const handleSaveRename = async () => {
    if (!renamingId || !renameText.trim()) return;
    setSavingRename(true);
    try {
      await updateQueue(renamingId, renameText.trim(), undefined);
      setRenamingId(null);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not rename queue.");
    } finally {
      setSavingRename(false);
    }
  };

  // Main always first, then pinned non-main, then unpinned non-main
  const mainQueue = queues.find(q => q.isMain);
  const nonMain = queues.filter(q => !q.isMain);
  const sortedQueues = [
    ...(mainQueue ? [mainQueue] : []),
    ...nonMain.filter(q => q.pinned),
    ...nonMain.filter(q => !q.pinned),
  ];

  const renderItem = ({ item }: { item: KewQueue }) => {
    const isActive = item.id === activeQueueId;
    const isRenaming = renamingId === item.id;

    return (
      <TouchableOpacity
        style={[styles.row, isActive && styles.rowActive]}
        onPress={() => handleRowPress(item)}
        onLongPress={() => !item.isMain && openActionSheet(item)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          {item.emoji ? (
            <SansText style={{ fontSize: 20 }}>{item.emoji}</SansText>
          ) : (
            <LogoMark color={isActive ? colors.accent : colors.warmMid} size={18} />
          )}
        </View>

        {/* Name / rename input */}
        <View style={{ flex: 1, minWidth: 0 }}>
          {isRenaming ? (
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveRename}
              onBlur={() => setRenamingId(null)}
            />
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <SansText style={[styles.queueName, isActive && styles.queueNameActive]} numberOfLines={1}>
                  {item.name}
                </SansText>
                {item.pinned && (
                  <SansText style={styles.pinnedBadge}>pinned</SansText>
                )}
              </View>
              <SansText style={styles.queueMeta}>
                {item.videoCount} video{item.videoCount !== 1 ? "s" : ""}
              </SansText>
            </>
          )}
        </View>

        {/* Right action */}
        {isRenaming ? (
          <TouchableOpacity onPress={handleSaveRename} disabled={savingRename} style={styles.saveBtn}>
            <SansText style={styles.saveBtnText}>{savingRename ? "Saving…" : "Save"}</SansText>
          </TouchableOpacity>
        ) : item.isMain ? (
          <View style={styles.mainBadge}>
            <SansText style={styles.mainBadgeText}>Main</SansText>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => openActionSheet(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
          >
            <Feather name="more-horizontal" size={18} color={colors.warmMid} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
        >
          <Feather name="chevron-left" size={24} color={colors.ink} />
        </TouchableOpacity>
        <SerifText style={styles.headerTitle}>Your Queues</SerifText>
        <View style={{ width: 32 }} />
      </View>
      <Divider />

      <FlatList
        data={sortedQueues}
        keyExtractor={q => q.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SansText style={styles.emptyText}>No queues found.</SansText>
          </View>
        }
      />

      {/* Footer */}
      <View style={styles.footer}>
        {user?.plan === "pro" ? (
          <TouchableOpacity
            style={styles.newQueueBtn}
            onPress={() => navigation.navigate("NewQueue")}
            activeOpacity={0.8}
          >
            <SansText style={styles.newQueueBtnText}>+ New queue</SansText>
          </TouchableOpacity>
        ) : (
          <SansText style={styles.proNote}>Multiple queues are a pro feature</SansText>
        )}
      </View>

      {/* Android action sheet modal */}
      {Platform.OS !== "ios" && actionSheetQueue && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActionSheetQueue(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActionSheetQueue(null)}
          >
            <View style={styles.modalCard}>
              <SansText style={styles.modalQueueName}>{actionSheetQueue.name}</SansText>
              <Divider />
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => { setActionSheetQueue(null); startRename(actionSheetQueue); }}
              >
                <Feather name="edit-2" size={16} color={colors.ink} />
                <SansText style={styles.modalOptionText}>Rename</SansText>
              </TouchableOpacity>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => { const q = actionSheetQueue; setActionSheetQueue(null); handlePinToggle(q); }}
              >
                <Feather name="bookmark" size={16} color={colors.ink} />
                <SansText style={styles.modalOptionText}>
                  {actionSheetQueue.pinned ? "Unpin" : "Pin to top"}
                </SansText>
              </TouchableOpacity>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => { setActionSheetQueue(null); confirmDelete(actionSheetQueue); }}
              >
                <Feather name="trash-2" size={16} color={colors.accent} />
                <SansText style={[styles.modalOptionText, { color: colors.accent }]}>Delete</SansText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: c.cream },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    headerTitle:     { fontSize: FontSize.lg },
    separator:       { height: 1, backgroundColor: c.divider, marginLeft: 60 },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
      gap: Spacing.sm, backgroundColor: c.cream,
    },
    rowActive:       { backgroundColor: `${c.accent}0a` },
    iconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.divider,
      alignItems: "center", justifyContent: "center",
    },
    queueName:       { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sansMedium },
    queueNameActive: { color: c.accent },
    queueMeta:       { fontSize: FontSize.xxs, color: c.warmMid, marginTop: 2 },
    pinnedBadge: {
      fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sansMedium,
      borderWidth: 1, borderColor: c.divider, borderRadius: Radius.pill,
      paddingHorizontal: 5, paddingVertical: 1,
    },
    renameInput: {
      fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sans,
      borderBottomWidth: 1, borderBottomColor: c.accent, paddingVertical: 2,
    },
    saveBtn: {
      paddingHorizontal: 12, paddingVertical: 6,
      backgroundColor: c.accent, borderRadius: Radius.pill,
    },
    saveBtnText:     { fontSize: FontSize.xs, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    mainBadge: {
      paddingHorizontal: 8, paddingVertical: 3,
      backgroundColor: c.divider, borderRadius: Radius.pill,
    },
    mainBadgeText:   { fontSize: FontSize.xxs, color: c.warmMid, fontFamily: FontFamily.sansMedium },
    empty: {
      padding: Spacing.xl, alignItems: "center",
    },
    emptyText:       { fontSize: FontSize.sm, color: c.warmMid },
    footer: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: c.cream, borderTopWidth: 1, borderTopColor: c.divider,
      padding: Spacing.md, paddingBottom: Spacing.lg,
    },
    newQueueBtn: {
      backgroundColor: c.accent, borderRadius: Radius.pill,
      paddingVertical: Spacing.sm + 2, alignItems: "center",
    },
    newQueueBtnText: { fontSize: FontSize.sm, color: c.buttonText, fontFamily: FontFamily.sansMedium },
    proNote: {
      textAlign: "center", fontSize: FontSize.xs, color: c.warmMid, fontFamily: FontFamily.sans,
    },
    // Android action sheet modal
    modalOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: c.cardBg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      paddingBottom: Spacing.lg,
    },
    modalQueueName: {
      fontSize: FontSize.sm, color: c.warmMid,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      fontFamily: FontFamily.sansMedium,
    },
    modalOption: {
      flexDirection: "row", alignItems: "center", gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    },
    modalOptionText: { fontSize: FontSize.sm, color: c.ink, fontFamily: FontFamily.sans },
  });
}
