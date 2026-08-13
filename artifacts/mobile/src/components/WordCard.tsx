import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";
import type { Word } from "@/lib/types";
import { useCategories } from "@/hooks/useCategories";
import { useTranslation } from "@/i18n/I18nProvider";
import { hasKanji } from "@/lib/japaneseScript";
import { useTheme } from "@/theme/ThemeProvider";
import { CategoryChip } from "./CategoryChip";
import { CategoryWordsList } from "./CategoryWordsList";
import { KanjiStrokeModal } from "./KanjiStrokeModal";
import { LevelChart } from "./LevelChart";
import { RelatedWordsButton, RelatedWordsList } from "./RelatedWordsList";

export type WordCardMode = "words" | "pronunciation" | "meaning";

type WordUpdate = Partial<
  Pick<
    Word,
    | "level"
    | "starred"
    | "pronLevel"
    | "pronStarred"
    | "meaningLevel"
    | "meaningStarred"
  >
>;

type Props = {
  word: Word;
  index: number;
  mode?: WordCardMode;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate?: (id: number, patch: WordUpdate) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  pinned?: boolean;
  onEdit?: (word: Word) => void;
  onDelete?: (id: number) => void;
  allWords?: Word[];
};

export function WordCard({
  word,
  index,
  mode = "words",
  isOpen,
  onToggle,
  onUpdate,
  selectMode = false,
  isSelected = false,
  onSelect,
  pinned = false,
  onEdit,
  onDelete,
  allWords,
}: Props) {
  const { t, formatCardDate } = useTranslation();
  const { theme } = useTheme();
  const { data: categories = [] } = useCategories();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showStroke, setShowStroke] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowRelated(false);
      setActiveCategoryId(null);
    }
  }, [isOpen]);

  const wordCategories = (word.categoryIds ?? [])
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  const activeCategory =
    activeCategoryId != null
      ? categories.find((c) => c.id === activeCategoryId)
      : undefined;

  const categoryWords =
    activeCategory && allWords
      ? allWords.filter(
          (w) =>
            w.id !== word.id && (w.categoryIds ?? []).includes(activeCategory.id),
        )
      : [];

  const kanjiClickable =
    mode === "words" && hasKanji(word.kanji) && !selectMode;

  const level =
    mode === "pronunciation"
      ? word.pronLevel
      : mode === "meaning"
        ? word.meaningLevel
        : word.level;
  const starred =
    mode === "pronunciation"
      ? word.pronStarred
      : mode === "meaning"
        ? word.meaningStarred
        : word.starred;

  function handleRowPress() {
    if (selectMode) {
      onSelect?.();
      return;
    }
    onToggle();
  }

  function handleLevelChange(l: number) {
    if (!onUpdate || selectMode) return;
    if (mode === "pronunciation") onUpdate(word.id, { pronLevel: l });
    else if (mode === "meaning") onUpdate(word.id, { meaningLevel: l });
    else onUpdate(word.id, { level: l });
  }

  function handleStarToggle() {
    if (!onUpdate || selectMode) return;
    if (mode === "pronunciation")
      onUpdate(word.id, { pronStarred: !word.pronStarred });
    else if (mode === "meaning")
      onUpdate(word.id, { meaningStarred: !word.meaningStarred });
    else onUpdate(word.id, { starred: !word.starred });
  }

  return (
    <>
      <View style={[styles.card, pinned && styles.cardPinned]}>
      <Pressable
        onPress={handleRowPress}
        style={({ pressed }) => [styles.row, pressed && !selectMode && styles.rowPressed]}
      >
        {selectMode ? (
          <View
            style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected,
            ]}
          >
            {isSelected ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.index} numberOfLines={1}>
            {index}
          </Text>
        )}

        {!selectMode ? (
          <View style={styles.levelChartWrap}>
            <LevelChart
              level={level}
              starred={starred}
              onChangeLevel={handleLevelChange}
              onToggleStar={handleStarToggle}
            />
          </View>
        ) : (
          <View style={styles.levelSpacer} />
        )}

        {mode === "words" ? (
          kanjiClickable ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setShowStroke(true);
              }}
              hitSlop={4}
              style={({ pressed }) => [
                styles.kanjiCell,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.kanjiClickable} numberOfLines={1}>
                {word.kanji}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.kanjiCell}>
              <Text style={styles.kanji} numberOfLines={1}>
                {word.kanji || "—"}
              </Text>
            </View>
          )
        ) : mode === "pronunciation" ? (
          word.pronunciation ? (
            <Text style={styles.primaryLine} numberOfLines={1}>
              {word.pronunciation}
            </Text>
          ) : (
            <Text style={[styles.primaryLine, styles.placeholder]} numberOfLines={1}>
              {t("common.noPronunciation")}
            </Text>
          )
        ) : word.meaning ? (
          <Text style={styles.primaryLine} numberOfLines={2}>
            {word.meaning}
          </Text>
        ) : (
          <Text style={[styles.primaryLine, styles.placeholder]} numberOfLines={2}>
            {t("common.noMeaning")}
          </Text>
        )}

        {word.jlptLevel && !selectMode ? (
          <View style={styles.jlptBadge}>
            <Text style={styles.jlptText}>{word.jlptLevel}</Text>
          </View>
        ) : (
          <View style={styles.flex} />
        )}

        {!selectMode && mode === "words" && (onEdit || onDelete) ? (
          <View style={styles.actions}>
            {onEdit ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onEdit(word);
                }}
                hitSlop={6}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
              >
                <Pencil size={14} color={theme.appTextMuted} />
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onDelete(word.id);
                }}
                hitSlop={6}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
              >
                <Trash2 size={14} color={theme.danger} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      {!selectMode && isOpen ? (
        <View style={styles.detail}>
          {mode === "words" ? (
            <>
              <View style={styles.detailTopRow}>
                <Text style={styles.date}>
                  {showRelated ? "" : formatCardDate(word.date)}
                </Text>
                {word.meaning && allWords ? (
                  <RelatedWordsButton
                    active={showRelated}
                    onPress={() => {
                      setActiveCategoryId(null);
                      setShowRelated((v) => !v);
                    }}
                  />
                ) : null}
              </View>

              {showRelated && word.meaning && allWords ? (
                <RelatedWordsList word={word} allWords={allWords} />
              ) : (
                <>
                  {word.pronunciation ? (
                    <Text style={styles.detailLine}>
                      <Text style={styles.detailLabel}>
                        {t("common.pronunciation")}{" "}
                      </Text>
                      {word.pronunciation}
                    </Text>
                  ) : null}
                  {word.meaning ? (
                    <Text style={styles.detailLine}>
                      <Text style={styles.detailLabel}>{t("common.meaning")} </Text>
                      {word.meaning}
                    </Text>
                  ) : null}
                  {wordCategories.length > 0 ? (
                    <View style={styles.chipsRow}>
                      {wordCategories.map((cat) => (
                        <CategoryChip
                          key={cat.id}
                          label={cat.name}
                          iconSvg={cat.iconSvg}
                          active={activeCategoryId === cat.id}
                          onPress={() => {
                            setShowRelated(false);
                            setActiveCategoryId((prev) =>
                              prev === cat.id ? null : cat.id,
                            );
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                  {activeCategory ? (
                    <CategoryWordsList
                      category={activeCategory}
                      words={categoryWords}
                    />
                  ) : word.description ? (
                    <View style={styles.descriptionBlock}>
                      <Text style={styles.description}>{word.description}</Text>
                    </View>
                  ) : null}
                  {!word.pronunciation &&
                  !word.meaning &&
                  !word.description &&
                  wordCategories.length === 0 ? (
                    <Text style={styles.placeholder}>{t("common.noDescription")}</Text>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              {word.kanji ? (
                <Text style={styles.kanjiLarge}>{word.kanji}</Text>
              ) : null}
              {mode === "pronunciation" && word.meaning ? (
                <Text style={styles.detailLine}>{word.meaning}</Text>
              ) : null}
              {mode === "meaning" && word.pronunciation ? (
                <Text style={styles.detailLine}>{word.pronunciation}</Text>
              ) : null}
              {word.description ? (
                <View style={styles.descriptionBlock}>
                  <Text style={styles.descriptionSecondary}>
                    {word.description}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      </View>

      {showStroke ? (
        <KanjiStrokeModal
          kanji={word.kanji}
          visible={showStroke}
          onClose={() => setShowStroke(false)}
        />
      ) : null}
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    card: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.appBorderStrong,
      backgroundColor: theme.appSurface,
    },
    cardPinned: {
      backgroundColor: theme.appAccent,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    rowPressed: {
      backgroundColor: theme.appMuted,
    },
    index: {
      marginBottom: 1,
      alignSelf: "flex-end",
      minWidth: 20,
      flexShrink: 0,
      textAlign: "right",
      fontSize: 14,
      fontWeight: "500",
      color: theme.appTextMuted,
      fontVariant: ["tabular-nums"],
    },
    levelChartWrap: {
      flexShrink: 0,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.appBorderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxSelected: {
      borderColor: theme.main500,
      backgroundColor: theme.main500,
    },
    checkmark: {
      color: theme.white,
      fontSize: 12,
      fontWeight: "700",
    },
    levelSpacer: {
      width: 20,
      flexShrink: 0,
    },
    kanjiCell: {
      flexShrink: 1,
      minWidth: 0,
    },
    kanji: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.appText,
    },
    kanjiClickable: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.appText,
    },
    primaryLine: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: "600",
      color: theme.appText,
    },
    flex: {
      flex: 1,
    },
    placeholder: {
      fontSize: 14,
      fontStyle: "italic",
      color: theme.appTextMuted,
    },
    jlptBadge: {
      flexShrink: 0,
      backgroundColor: theme.appMuted,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    jlptText: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.appTextSecondary,
    },
    actions: {
      flexDirection: "row",
      flexShrink: 0,
      marginLeft: "auto",
      gap: 2,
    },
    actionBtn: {
      padding: 6,
      borderRadius: 8,
    },
    detail: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 8,
    },
    detailTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    date: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.appTextMuted,
    },
    detailLine: {
      fontSize: 14,
      color: theme.appTextSecondary,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: "500",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.appTextMuted,
    },
    descriptionBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
      paddingTop: 8,
    },
    description: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.appText,
    },
    descriptionSecondary: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.appTextSecondary,
    },
    kanjiLarge: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.appText,
    },
  });
}
