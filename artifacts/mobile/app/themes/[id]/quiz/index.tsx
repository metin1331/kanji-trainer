import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { HintLinesDisplay } from "@/components/HintLinesEditor";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { ScreenShell } from "@/components/ScreenShell";
import { useTheme } from "@/hooks/useThemes";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme as useAppTheme } from "@/theme/ThemeProvider";
import { backTitleColor } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";

export default function ThemeQuizStudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const themeId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const { theme: colors, colorScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, colorScheme), [colors, colorScheme]);

  const { theme, isLoading } = useTheme(themeId);
  const questions = useMemo(() => theme?.questions ?? [], [theme?.questions]);

  const [index, setIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[index];

  const goNext = useCallback(() => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelectedKey(null);
    setRevealed(false);
    setHintsOpen(false);
  }, [index, questions.length]);

  const headerBar = theme ? (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <ArrowLeft size={18} color={colors.appTextMuted} />
        <Text style={styles.backTitle}>{theme.name}</Text>
      </Pressable>
      {!finished && questions.length > 0 ? (
        <Text style={styles.progress}>
          {t("themeQuiz.progress", { current: index + 1, total: questions.length })}
        </Text>
      ) : null}
    </View>
  ) : null;

  if (isLoading || !theme) {
    return (
      <ScreenShell>
        <LoadingPlaceholder padding="lg" style={styles.center} />
      </ScreenShell>
    );
  }

  if (questions.length === 0) {
    return (
      <ScreenShell header={headerBar}>
        <View style={styles.center}>
          <Text style={styles.empty}>{t("themeQuiz.noQuestions")}</Text>
          <Pressable onPress={() => router.back()} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  if (finished) {
    return (
      <ScreenShell header={headerBar}>
        <View style={styles.center}>
          <Text style={styles.doneTitle}>{t("common.completed")}</Text>
          <Text style={styles.score}>
            {t("themeQuiz.score", { correct: correctCount, total: questions.length })}
          </Text>
          <Pressable
            onPress={() => {
              setIndex(0);
              setSelectedKey(null);
              setRevealed(false);
              setCorrectCount(0);
              setFinished(false);
            }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>{t("themeQuiz.retry")}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>{t("common.goBack")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const isCorrect = revealed && selectedKey === q?.correctKey;

  return (
    <ScreenShell header={headerBar} bottomInset>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.prompt}>{q?.prompt}</Text>

        <View style={styles.choices}>
          {q?.choices.map((c) => {
            const selected = selectedKey === c.key;
            const showCorrect = revealed && c.key === q.correctKey;
            const showWrong = revealed && selected && c.key !== q.correctKey;
            return (
              <Pressable
                key={c.key}
                onPress={() => !revealed && setSelectedKey(c.key)}
                disabled={revealed}
                style={[
                  styles.choice,
                  selected && !revealed && styles.choiceSelected,
                  showCorrect && styles.choiceCorrect,
                  showWrong && styles.choiceWrong,
                ]}
              >
                <Text style={styles.choiceKey}>{c.key.toUpperCase()}</Text>
                <Text style={styles.choiceLabel}>{c.label || "—"}</Text>
              </Pressable>
            );
          })}
        </View>

        {hintsOpen && q ? <HintLinesDisplay hints={q.hints} /> : null}

        {revealed ? (
          <Text
            style={[
              styles.result,
              { color: isCorrect ? colors.main500 : colors.danger },
            ]}
          >
            {isCorrect ? t("themeQuiz.correct") : t("themeQuiz.incorrect")}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {!revealed ? (
          <>
            <Pressable
              onPress={() => setHintsOpen((v) => !v)}
              style={styles.footerBtnOutline}
            >
              <Text style={styles.footerBtnOutlineText}>{t("themeQuiz.showHint")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!q || !selectedKey) return;
                const ok = selectedKey === q.correctKey;
                if (ok) setCorrectCount((c) => c + 1);
                setRevealed(true);
                setHintsOpen(true);
              }}
              disabled={!selectedKey}
              style={[styles.footerBtnPrimary, !selectedKey && { opacity: 0.5 }]}
            >
              <Text style={styles.footerBtnPrimaryText}>{t("themeQuiz.submit")}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={goNext} style={styles.footerBtnPrimary}>
            <Text style={styles.footerBtnPrimaryText}>
              {index + 1 >= questions.length ? t("themeQuiz.finish") : t("themeQuiz.next")}
            </Text>
          </Pressable>
        )}
      </View>
    </ScreenShell>
  );
}

function createStyles(
  theme: ReturnType<typeof useAppTheme>["theme"],
  colorScheme: ColorScheme,
) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    backTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: backTitleColor(theme, colorScheme),
      flex: 1,
    },
    progress: { fontSize: 12, fontWeight: "600", color: theme.appTextMuted },
    content: { padding: 20, gap: 16 },
    prompt: { fontSize: 20, fontWeight: "700", color: theme.appText, lineHeight: 28 },
    choices: { gap: 10 },
    choice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      padding: 14,
      backgroundColor: theme.appSurface,
    },
    choiceSelected: { borderColor: theme.main500, backgroundColor: theme.appAccent },
    choiceCorrect: { borderColor: theme.main500 },
    choiceWrong: { borderColor: theme.danger },
    choiceKey: { fontSize: 14, fontWeight: "800", color: theme.main500, width: 20 },
    choiceLabel: { flex: 1, fontSize: 15, color: theme.appText },
    result: { fontSize: 16, fontWeight: "700", textAlign: "center" },
    footer: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: theme.appSurface },
    footerBtnOutline: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    footerBtnOutlineText: { fontWeight: "700", color: theme.appText },
    footerBtnPrimary: {
      flex: 1,
      backgroundColor: theme.main500,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    footerBtnPrimaryText: { fontWeight: "700", color: "#fff" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    empty: { fontSize: 15, color: theme.appTextMuted, textAlign: "center" },
    doneTitle: { fontSize: 22, fontWeight: "700", color: theme.appText },
    score: { fontSize: 16, color: theme.appTextSecondary },
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
