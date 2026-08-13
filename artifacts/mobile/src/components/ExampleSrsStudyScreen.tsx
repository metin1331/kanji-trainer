import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Eye } from "lucide-react-native";
import { ScreenShell } from "@/components/ScreenShell";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExampleSentenceDisplay } from "@/components/ExampleSentenceDisplay";
import { SrsWordSlideUp } from "@/components/SrsWordSlideUp";
import type { WordFormSaveData } from "@/components/WordFormModal";
import { reviewSrsExample } from "@/hooks/useSrs";
import { useStudyActivity } from "@/hooks/useStudyActivity";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useWords } from "@/hooks/useWords";
import { localDateKey } from "@/lib/dailyGoal";
import { romajiToKanaInput } from "@/lib/japaneseInput";
import { getSrsSession } from "@/lib/srsStore";
import {
  exampleForStudy,
  gradeClozeAnswer,
  renderHintParts,
} from "@/lib/srsExamples";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";
import type { SrsExample, Word } from "@/lib/types";
import type { SrsQueueItem } from "@/types/srs";

type AnswerPhase = "typing" | "correct" | "partial" | "revealed";

function pickExample(examples: SrsExample[], cursor: number): SrsExample | null {
  if (!examples.length) return null;
  const idx = Math.min(Math.max(cursor, 0), examples.length - 1);
  return examples[idx] ?? examples[0] ?? null;
}

function queueWordToWord(item: SrsQueueItem): Word {
  return {
    ...item.word,
    srsExamples: item.word.srsExamples ?? [],
    relatedWordIds: item.word.relatedWordIds ?? [],
  } as Word;
}

export function ExampleSrsStudyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const queryClient = useQueryClient();
  const { increment: recordStudy } = useStudyActivity();
  const { settings } = useAppSettings();
  const { words, updateWord } = useWords();
  const insets = useSafeAreaInsets();

  const sessionRef = useRef(getSrsSession());
  const { title, backPath } = sessionRef.current;

  const [items] = useState(sessionRef.current.items);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>("typing");
  const [emptyChecked, setEmptyChecked] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);

  const answerInputRef = useRef<TextInput>(null);
  const keepKeyboardRef = useRef(false);
  const reviewingRef = useRef(false);
  const indexRef = useRef(index);
  const itemsRef = useRef(items);
  indexRef.current = index;
  itemsRef.current = items;

  const item = items[index];
  const liveWord = item
    ? (words.find((w) => w.id === item.word.id) ?? queueWordToWord(item))
    : null;
  const rawExample = liveWord
    ? pickExample(liveWord.srsExamples ?? [], item?.card.exampleCursor ?? 0)
    : null;
  const example = rawExample ? exampleForStudy(rawExample) : null;

  const focusAnswerInput = useCallback(() => {
    requestAnimationFrame(() => {
      answerInputRef.current?.focus();
    });
  }, []);

  const keepInputFocused = useCallback(() => {
    keepKeyboardRef.current = true;
    answerInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setAnswer("");
    setAnswerPhase("typing");
    setEmptyChecked(false);
  }, [index]);

  useLayoutEffect(() => {
    focusAnswerInput();
  }, [index, answerPhase, reviewing, focusAnswerInput]);

  const advanceAfterReview = useCallback(() => {
    const nextIndex = indexRef.current + 1;
    if (nextIndex >= itemsRef.current.length) {
      setDone(true);
    } else {
      setIndex(nextIndex);
    }
  }, []);

  const submitReview = useCallback(
    async (correct: boolean) => {
      const current = itemsRef.current[indexRef.current];
      if (!current || reviewingRef.current) return;

      reviewingRef.current = true;
      setReviewing(true);
      try {
        await reviewSrsExample(current.card.id, correct, localDateKey());
        if (correct) {
          recordStudy.mutate({ deck: "example", date: localDateKey() });
        }
        queryClient.invalidateQueries({ queryKey: ["trouble-words"] });
        queryClient.invalidateQueries({ queryKey: ["srs"] });
      } finally {
        reviewingRef.current = false;
        setReviewing(false);
      }
    },
    [queryClient, recordStudy],
  );

  const handleAnswerChange = useCallback(
    (raw: string) => {
      const current = itemsRef.current[indexRef.current];
      const word = current
        ? (words.find((w) => w.id === current.word.id) ?? queueWordToWord(current))
        : null;
      const examples = word?.srsExamples ?? [];
      const cursor = current?.card.exampleCursor ?? 0;
      const ex = examples[cursor];
      const script = ex?.hiddenScript ?? "kanji";

      setAnswer(
        settings.srsRomajiInput ? romajiToKanaInput(raw, script) : raw,
      );
      if (answerPhase !== "typing") {
        setAnswerPhase("typing");
      }
      setEmptyChecked(false);
    },
    [answerPhase, settings.srsRomajiInput, words],
  );

  const handlePrimaryAction = useCallback(async () => {
    if (reviewingRef.current) return;
    keepInputFocused();
    const current = itemsRef.current[indexRef.current];
    if (!current) return;

    const word =
      words.find((w) => w.id === current.word.id) ?? queueWordToWord(current);
    const examples = word.srsExamples ?? [];
    const cursor = current.card.exampleCursor ?? 0;
    const ex = examples[cursor];
    if (!ex) return;

    const studyEx = exampleForStudy(ex);

    if (answerPhase === "correct") {
      try {
        await submitReview(true);
        advanceAfterReview();
      } catch {
        focusAnswerInput();
      }
      return;
    }

    if (answerPhase === "partial" || answerPhase === "revealed") {
      try {
        await submitReview(false);
        advanceAfterReview();
      } catch {
        focusAnswerInput();
      }
      return;
    }

    if (!answer.trim()) {
      if (!emptyChecked) {
        setEmptyChecked(true);
        focusAnswerInput();
        return;
      }
      setAnswerPhase("revealed");
      focusAnswerInput();
      return;
    }

    setEmptyChecked(false);
    const correct = gradeClozeAnswer(
      answer,
      studyEx.hiddenWord,
      word.pronunciation,
      word.kanji,
      studyEx.hiddenReading,
      studyEx.hiddenScript,
    );
    setAnswerPhase(correct ? "correct" : "partial");
    focusAnswerInput();
  }, [
    advanceAfterReview,
    answer,
    answerPhase,
    emptyChecked,
    focusAnswerInput,
    keepInputFocused,
    submitReview,
    words,
  ]);

  const insertProlongedMark = useCallback(() => {
    handleAnswerChange(answer + "ー");
    focusAnswerInput();
  }, [answer, focusAnswerInput, handleAnswerChange]);

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
    },
    [updateWord],
  );

  const handleScreenPress = useCallback(() => {
    focusAnswerInput();
  }, [focusAnswerInput]);

  if (done) {
    return (
      <ScreenShell>
        <View style={styles.center}>
          <Text style={styles.doneTitle}>{t("common.completed")}</Text>
          <Pressable onPress={() => router.replace(backPath as never)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  if (!item || !example || !liveWord) {
    return (
      <ScreenShell>
        <View style={styles.center}>
          <Text style={styles.empty}>{t("srs.study.noExample")}</Text>
          <Pressable onPress={() => router.replace(backPath as never)} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const cursor = item.card.exampleCursor ?? 0;
  const examples = liveWord.srsExamples ?? [];
  const inputBorderColor =
    answerPhase === "revealed"
      ? "#dc2626"
      : answerPhase === "correct"
        ? "#22c55e"
        : inputFocused
          ? theme.main400
          : theme.appBorderStrong;

  const headerBar = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.replace(backPath as never)} style={styles.backRow}>
        <ArrowLeft size={18} color={theme.appTextMuted} />
        <Text style={styles.backTitle} numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
      <View style={styles.headerRight}>
        <Pressable
          onPress={() => setShowCardDetails(true)}
          style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.85 }]}
        >
          <Eye size={16} color={theme.appTextSecondary} />
        </Pressable>
        <Text style={styles.progress}>
          {t("common.cardProgress", { current: index + 1, total: items.length })}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenShell header={headerBar}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
            onTouchStart={handleScreenPress}
          >
            <View style={styles.sentenceCard}>
              <ExampleSentenceDisplay
                example={example}
                headwordKanji={liveWord.kanji}
                liveAnswer={answer}
                answerState={answerPhase}
              />
              {examples.length > 1 ? (
                <Text style={styles.exampleProgress}>
                  {t("common.exampleProgress", {
                    current: (cursor % examples.length) + 1,
                    total: examples.length,
                  })}
                </Text>
              ) : null}
            </View>

            {example.hints.length > 0 ? (
              <View style={styles.hints}>
                {example.hints.map((hint, i) => (
                  <Text key={i} style={styles.hintLine}>
                    {renderHintParts(hint.text, hint.highlights).map((p, j) =>
                      p.highlight ? (
                        <Text key={j} style={styles.hintHighlight}>
                          {p.text}
                        </Text>
                      ) : (
                        <Text key={j}>{p.text}</Text>
                      ),
                    )}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View
          style={[
            styles.answerFooter,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.inputWrap}>
            <TextInput
              ref={answerInputRef}
              value={answer}
              onChangeText={handleAnswerChange}
              placeholder="答え"
              placeholderTextColor={theme.appTextMuted}
              style={[
                styles.input,
                {
                  borderColor: inputBorderColor,
                  backgroundColor: theme.appMuted ?? theme.appSurface,
                },
              ]}
              editable
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              blurOnSubmit={false}
              showSoftInputOnFocus
              returnKeyType="send"
              enterKeyHint="send"
              onSubmitEditing={() => {
                keepInputFocused();
                void handlePrimaryAction();
              }}
              onFocus={() => {
                keepKeyboardRef.current = false;
                setInputFocused(true);
              }}
              onBlur={() => {
                setInputFocused(false);
                if (keepKeyboardRef.current) {
                  keepKeyboardRef.current = false;
                  focusAnswerInput();
                  return;
                }
                focusAnswerInput();
              }}
            />
            <Pressable
              onPressIn={keepInputFocused}
              onPress={insertProlongedMark}
              style={styles.prolongedBtn}
              hitSlop={8}
            >
              <Text style={styles.prolongedBtnText}>ー</Text>
            </Pressable>
          </View>

          <Pressable
            onPressIn={keepInputFocused}
            onPress={() => {
              keepInputFocused();
              void handlePrimaryAction();
            }}
            disabled={reviewing}
            style={[styles.submitBtn, reviewing && styles.submitBtnDisabled]}
          >
            {reviewing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {answerPhase === "typing"
                    ? t("common.check")
                    : t("common.continue")}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SrsWordSlideUp
        visible={showCardDetails}
        word={liveWord}
        allWords={words}
        onClose={() => setShowCardDetails(false)}
        onSave={handleSaveWord}
      />
    </ScreenShell>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  colorScheme: ColorScheme,
) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBg },
    flex: { flex: 1 },
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
    scrollContent: { padding: 20, gap: 16, paddingBottom: 24 },
    sentenceCard: {
      backgroundColor: theme.appMuted ?? theme.appSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 24,
      alignItems: "center",
    },
    exampleProgress: {
      marginTop: 12,
      fontSize: 12,
      color: theme.appTextMuted,
    },
    hints: { gap: 8, alignItems: "center" },
    hintLine: {
      fontSize: 15,
      color: theme.appTextSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    hintHighlight: {
      color: theme.main600 ?? theme.main500,
      fontWeight: "700",
      backgroundColor: theme.main100 ?? `${theme.main500}22`,
      borderRadius: 4,
    },
    answerFooter: {
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
      backgroundColor: theme.appSurface,
    },
    inputWrap: { position: "relative" },
    input: {
      borderWidth: 2,
      borderRadius: 12,
      paddingHorizontal: 48,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: "700",
      color: theme.appText,
      textAlign: "center",
    },
    prolongedBtn: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    prolongedBtnText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.appTextMuted,
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingVertical: 14,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    empty: { fontSize: 15, color: theme.appTextMuted, textAlign: "center" },
    doneTitle: { fontSize: 22, fontWeight: "700", color: theme.appText },
    primaryBtn: {
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    primaryBtnText: { color: "#fff", fontWeight: "600" },
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
