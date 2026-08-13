import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Word } from "@/lib/types";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { LevelPills } from "./LevelPills";

type Props = {
  words: Word[];
  header?: ReactNode;
  emptyMessage?: string;
  maxHeight?: number;
};

export function CompactWordList({
  words,
  header,
  emptyMessage,
  maxHeight = 280,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (words.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>
          {emptyMessage ?? t("common.noDescription")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, { maxHeight }]}>
      {header ? <View style={styles.headerWrap}>{header}</View> : null}
      <ScrollView nestedScrollEnabled>
        {words.map((w) => {
          const isOpen = openIds.has(w.id);
          return (
            <View key={w.id} style={styles.rowWrap}>
              <Pressable
                onPress={() => toggle(w.id)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.body}>
                  <Text style={styles.kanji}>{w.kanji}</Text>
                  {w.pronunciation ? (
                    <Text style={styles.sub}>{w.pronunciation}</Text>
                  ) : null}
                  {w.meaning ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {w.meaning}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.right}>
                  {w.jlptLevel ? (
                    <View style={styles.jlptBadge}>
                      <Text style={styles.jlptText}>{w.jlptLevel}</Text>
                    </View>
                  ) : null}
                  <LevelPills word={w} />
                </View>
              </Pressable>
              {isOpen ? (
                <View style={styles.detail}>
                  {w.description ? (
                    <Text style={styles.description}>{w.description}</Text>
                  ) : (
                    <Text style={styles.noDescription}>{t("common.noDescription")}</Text>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    emptyBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      borderRadius: 10,
      backgroundColor: theme.appSurface,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    emptyText: {
      fontSize: 12,
      color: theme.appTextMuted,
      textAlign: "center",
    },
    box: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      borderRadius: 10,
      backgroundColor: theme.appSurface,
      overflow: "hidden",
    },
    headerWrap: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    rowWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    rowPressed: {
      backgroundColor: theme.appMuted,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    kanji: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.appText,
    },
    sub: {
      marginTop: 2,
      fontSize: 11,
      color: theme.appTextSecondary,
    },
    right: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 4,
      flexShrink: 0,
    },
    jlptBadge: {
      backgroundColor: theme.appMuted,
      borderRadius: 999,
      paddingHorizontal: 8,
      minHeight: 26,
      justifyContent: "center",
      alignItems: "center",
    },
    jlptText: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.appTextSecondary,
    },
    detail: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    description: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.appTextSecondary,
    },
    noDescription: {
      fontSize: 12,
      fontStyle: "italic",
      color: theme.appTextMuted,
    },
  });
}
