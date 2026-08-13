import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Word } from "@/lib/types";
import { filterWords } from "@/lib/filterWords";
import { SlideUpModal } from "@/components/SlideUpModal";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  words: Word[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
};

export function WordPickerSheet({
  visible,
  words,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
  title,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) {
      setQuery("");
    }
  }, [visible]);

  const filtered = filterWords(words, query);

  const handleCancel = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <SlideUpModal
      visible={visible}
      onClose={handleCancel}
      title={title ?? t("themes.pickWords")}
      maxHeight="85%"
      expanded
    >
      <View style={styles.content}>
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("home.searchPlaceholder")}
            placeholderTextColor={theme.appTextMuted}
            style={styles.search}
          />
          <Text style={styles.selectedCount}>
            {t("themes.selectedWordCount", { count: selectedIds.size })}
          </Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="never"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          style={styles.list}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable
                onPress={() => onToggle(item.id)}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={[styles.check, selected && styles.checkSelected]}>
                  {selected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.kanji}>{item.kanji}</Text>
                  {item.pronunciation ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.pronunciation}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("common.noResultsForQuery", { query })}</Text>
          }
        />

        <View style={styles.footer}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.confirmBtnText}>{t("common.add")}</Text>
          </Pressable>
        </View>
      </View>
    </SlideUpModal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    content: {
      flex: 1,
      minHeight: 0,
    },
    searchWrap: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.appBorder,
    },
    search: {
      backgroundColor: theme.appMuted,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.appText,
    },
    selectedCount: {
      marginTop: 8,
      fontSize: 12,
      color: theme.appTextMuted,
    },
    list: {
      flex: 1,
      minHeight: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.appBorder,
    },
    rowSelected: { backgroundColor: theme.appAccent },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.appBorderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkSelected: {
      borderColor: theme.main500,
      backgroundColor: theme.main500,
    },
    checkMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
    rowBody: { flex: 1, minWidth: 0 },
    kanji: { fontSize: 16, fontWeight: "700", color: theme.appText },
    sub: { fontSize: 12, color: theme.appTextMuted, marginTop: 2 },
    empty: {
      textAlign: "center",
      color: theme.appTextMuted,
      padding: 32,
      fontSize: 14,
    },
    footer: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
      backgroundColor: theme.appSurface,
    },
    cancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.appTextSecondary,
    },
    confirmBtn: {
      flex: 1,
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    confirmBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
