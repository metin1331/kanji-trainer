import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Pin, Trash2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  selectedCount: number;
  onSelectAll: () => void;
  onPin: () => void;
  onDelete: () => void;
  deleteLabel?: string;
};

export function SelectActionBar({
  selectedCount,
  onSelectAll,
  onPin,
  onDelete,
  deleteLabel,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const disabled = selectedCount === 0;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable onPress={onSelectAll} hitSlop={8}>
        <Text style={styles.selectAll}>{t("common.selectAll")}</Text>
      </Pressable>
      <Text style={styles.centerLabel}>
        {selectedCount > 0
          ? t("common.selectedCount", { count: selectedCount })
          : t("common.selectRows")}
      </Text>
      <Pressable
        onPress={onPin}
        disabled={disabled}
        style={[styles.actionBtn, styles.pinBtn, disabled && styles.disabled]}
      >
        <Pin size={14} color={theme.main500} />
        <Text style={styles.pinText}>{t("common.pin")}</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        disabled={disabled}
        style={[styles.actionBtn, styles.deleteBtn, disabled && styles.disabled]}
      >
        <Trash2 size={14} color={theme.danger} />
        <Text style={styles.deleteText}>{deleteLabel ?? t("common.delete")}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
      backgroundColor: theme.appSurface,
    },
    selectAll: {
      fontSize: 12,
      color: theme.appTextSecondary,
    },
    centerLabel: {
      flex: 1,
      textAlign: "center",
      fontSize: 14,
      fontWeight: "500",
      color: theme.appTextSecondary,
    },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
    },
    pinBtn: {
      backgroundColor: theme.appAccent,
    },
    deleteBtn: {
      backgroundColor: theme.appMuted,
    },
    pinText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.main500,
    },
    deleteText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.danger,
    },
    disabled: {
      opacity: 0.4,
    },
  });
}
