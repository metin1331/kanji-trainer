import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye } from "lucide-react-native";
import { ScreenShell } from "@/components/ScreenShell";
import { KanjiStrokeModal } from "@/components/KanjiStrokeModal";
import { SrsWordSlideUp } from "@/components/SrsWordSlideUp";
import type { WordFormSaveData } from "@/components/WordFormModal";
import { reviewSrsCard } from "@/hooks/useSrs";
import { useStudyActivity } from "@/hooks/useStudyActivity";
import { useWords } from "@/hooks/useWords";
import { intervalCountsAsDailyLearn, localDateKey } from "@/lib/dailyGoal";
import { hasKanji } from "@/lib/japaneseScript";
import { getSrsSession } from "@/lib/srsStore";
import type { Word } from "@/lib/types";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";
import type { ReviewRating, SrsDeckType, SrsQueueItem } from "@/types/srs";

const RATING_KEYS: {
  rating: ReviewRating;
  labelKey: "again" | "hard" | "good" | "easy";
  intervalKey: keyof SrsQueueItem["card"]["intervals"];
  color: string;
}[] = [
  { rating: 1, labelKey: "again", intervalKey: "again", color: "#dc2626" },
  { rating: 2, labelKey: "hard", intervalKey: "hard", color: "#ca8a04" },
  { rating: 3, labelKey: "good", intervalKey: "good", color: "#2563eb" },
  { rating: 4, labelKey: "easy", intervalKey: "easy", color: "#16a34a" },
];

function getPrimary(item: SrsQueueItem, deck: SrsDeckType, emDash: string): string {
  const { word } = item;
  if (deck === "pronunciation") return word.pronunciation || emDash;
  if (deck === "meaning" || deck === "drawing") return word.meaning || emDash;
  return word.kanji || emDash;
}

function queueWordToWord(item: SrsQueueItem): Word {
  return {
    ...item.word,
    srsExamples: item.word.srsExamples ?? [],
    relatedWordIds: item.word.relatedWordIds ?? [],
  } as Word;
}

export function SrsStudyScreen() {
  const { t, formatStudyDate } = useTranslation();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const queryClient = useQueryClient();
  const { increment: recordStudy } = useStudyActivity();
  const { words, updateWord } = useWords();

  const sessionRef = useRef(getSrsSession());
  const { deck, title, backPath } = sessionRef.current;

  const [items, setItems] = useState(sessionRef.current.items);
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showStroke, setShowStroke] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [ratingBarHeight, setRatingBarHeight] = useState(0);

  const item = items[index];
  const emDash = t("common.emDash");
  const liveWord = item
    ? (words.find((w) => w.id === item.word.id) ?? queueWordToWord(item))
    : null;

  const submitReview = useCallback(
    async (rating: ReviewRating) => {
      if (reviewing || !item) return;
      setReviewing(true);
      try {
        await reviewSrsCard(item.card.id, rating, localDateKey());
        const meta = RATING_KEYS.find((r) => r.rating === rating);
        const intervalLabel = meta ? item.card.intervals[meta.intervalKey] : "";
        if (intervalCountsAsDailyLearn(intervalLabel)) {
          recordStudy.mutate({ deck, date: localDateKey() });
        }
        queryClient.invalidateQueries({ queryKey: ["trouble-words"] });
        queryClient.invalidateQueries({ queryKey: ["srs"] });
        const next = index + 1;
        if (next >= items.length) setDone(true);
        else {
          setIndex(next);
          setShowDetails(false);
          setShowStroke(false);
        }
      } catch {
        /* ignore */
      } finally {
        setReviewing(false);
      }
    },
    [reviewing, item, deck, index, items.length, queryClient, recordStudy],
  );

  const handleSaveWord = useCallback(
    (wordId: number, data: WordFormSaveData) => {
      updateWord(wordId, {
        kanji: data.kanji,
        pronunciation: data.pronunciation,
        meaning: data.meaning,
        description: data.description,
        level: data.level,
        starred: data.starred,
        pronLevel: data.pronLevel,
        pronStarred: data.pronStarred,
        meaningLevel: data.meaningLevel,
        meaningStarred: data.meaningStarred,
        jlptLevel: data.jlptLevel,
        date: data.date,
        srsExamples: data.srsExamples,
        categoryIds: data.categoryIds,
      });
      setItems((prev) =>
        prev.map((entry) =>
          entry.word.id === wordId
            ? {
                ...entry,
                word: {
                  ...entry.word,
                  ...data,
                },
              }
            : entry,
        ),
      );
    },
    [updateWord],
  );

  if (items.length === 0) {
    return (
      <ScreenShell>
        <View style={styles.center}>
          <Text style={styles.empty}>{t("srs.study.noCards")}</Text>
          <Pressable onPress={() => router.replace(backPath as never)} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  if (done) {
    return (
      <ScreenShell>
        <View style={styles.center}>
          <Text style={styles.doneTitle}>{t("common.completed")}</Text>
          <Text style={styles.doneSub}>{t("srs.study.sessionDone", { count: items.length })}</Text>
          <Pressable onPress={() => router.replace(backPath as never)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const primary = getPrimary(item, deck, emDash);
  const kanjiTapEnabled = deck === "word" && hasKanji(item.word.kanji);
  const showHeaderEye = deck === "drawing";

  const headerBar = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.replace(backPath as never)} style={styles.backRow}>
        <ArrowLeft size={18} color={theme.appTextMuted} />
        <Text style={styles.backTitle} numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
      <View style={styles.headerRight}>
        {showHeaderEye ? (
          <Pressable
            onPress={() => setShowDetails(true)}
            style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.85 }]}
          >
            <Eye size={16} color={theme.appTextSecondary} />
          </Pressable>
        ) : null}
        <Text style={styles.progress}>
          {t("common.cardProgress", { current: index + 1, total: items.length })}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenShell header={headerBar} bottomInset>
      <Pressable
        style={styles.main}
        onPress={() => {
          if (showStroke) return;
          setShowDetails(true);
        }}
      >
        {deck === "drawing" ? (
          <Text style={styles.drawingHint}>{t("srs.study.drawingHint")}</Text>
        ) : null}

        {kanjiTapEnabled ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              setShowStroke(true);
            }}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Text style={styles.primary}>{primary}</Text>
          </Pressable>
        ) : (
          <Text
            style={[
              styles.primary,
              deck === "meaning" && styles.primaryMeaning,
            ]}
          >
            {primary}
          </Text>
        )}

        <View style={styles.metaRow}>
          {item.word.date ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{formatStudyDate(item.word.date)}</Text>
            </View>
          ) : null}
          {item.word.jlptLevel ? (
            <View style={styles.metaChip}>
              <Text style={[styles.metaChipText, styles.metaChipJlpt]}>
                {item.word.jlptLevel}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View
        style={styles.ratingBar}
        onLayout={(e) => setRatingBarHeight(e.nativeEvent.layout.height)}
      >
        {RATING_KEYS.map(({ rating, labelKey, intervalKey, color }) => (
          <Pressable
            key={rating}
            onPress={() => submitReview(rating)}
            disabled={reviewing}
            style={({ pressed }) => [
              styles.ratingBtn,
              { borderColor: color },
              pressed && { opacity: 0.85 },
            ]}
          >
            {reviewing ? (
              <ActivityIndicator size="small" color={color} />
            ) : (
              <>
                <Text style={[styles.ratingLabel, { color }]}>
                  {t(`srs.study.${labelKey}`)}
                </Text>
                <Text style={styles.ratingInterval}>{item.card.intervals[intervalKey]}</Text>
              </>
            )}
          </Pressable>
        ))}
      </View>

      <SrsWordSlideUp
        visible={showDetails}
        word={liveWord}
        allWords={words}
        onClose={() => setShowDetails(false)}
        onSave={handleSaveWord}
        bottomInset={ratingBarHeight}
        deck={deck}
      />

      {showStroke && item.word.kanji ? (
        <KanjiStrokeModal
          kanji={item.word.kanji}
          visible={showStroke}
          onClose={() => setShowStroke(false)}
          variant="sheet"
        />
      ) : null}
    </ScreenShell>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBg },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    backTitle: navBackTitleStyle(theme, colorScheme, { letterSpacing: 1, flex: 1 }),
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    eyeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.appMuted,
    },
    progress: { fontSize: 12, fontWeight: "600", color: theme.appTextMuted },
    main: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 16,
    },
    drawingHint: {
      fontSize: 12,
      color: theme.appTextMuted,
      textAlign: "center",
      marginBottom: 4,
    },
    primary: {
      fontSize: 48,
      fontWeight: "700",
      color: theme.appText,
      textAlign: "center",
      lineHeight: 56,
    },
    primaryMeaning: {
      fontSize: 28,
      lineHeight: 36,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
    },
    metaChip: {
      backgroundColor: theme.appMuted,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    metaChipText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.appTextSecondary,
    },
    metaChipJlpt: { fontWeight: "700" },
    ratingBar: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
      backgroundColor: theme.appSurface,
    },
    ratingBtn: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: theme.appBg,
    },
    ratingLabel: { fontSize: 11, fontWeight: "700" },
    ratingInterval: { fontSize: 10, color: theme.appTextMuted, marginTop: 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    empty: { fontSize: 15, color: theme.appTextMuted, textAlign: "center" },
    doneTitle: { fontSize: 22, fontWeight: "700", color: theme.appText },
    doneSub: { fontSize: 14, color: theme.appTextSecondary, textAlign: "center" },
    primaryBtn: {
      marginTop: 8,
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
    outlineBtn: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    outlineBtnText: { color: theme.main500, fontWeight: "600" },
  });
}
