import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react-native";
import { CategoryTitle } from "@/components/CategoryIcon";
import { ScreenShell } from "@/components/ScreenShell";
import type { ThemeQuizQuestion } from "@workspace/api-client-react";
import { HintLinesEditor } from "@/components/HintLinesEditor";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import {
  defaultChoices,
  emptyQuestion,
  sanitizeThemeQuestions,
} from "@/lib/themeQuiz";
import { useTheme } from "@/hooks/useThemes";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme as useAppTheme } from "@/theme/ThemeProvider";

export default function ThemeQuizEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const themeId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const { theme: colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { theme, isLoading, saveThemeQuestions } = useTheme(themeId);
  const [questions, setQuestions] = useState<ThemeQuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (theme?.questions) {
      setQuestions(
        theme.questions.length > 0
          ? theme.questions.map((q) => ({ ...q }))
          : [emptyQuestion(0, "ab")],
      );
    }
  }, [theme?.questions]);

  function patchQuestion(index: number, patch: Partial<ThemeQuizQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function setQuestionType(index: number, type: "ab" | "four") {
    patchQuestion(index, {
      type,
      choices: defaultChoices(type),
      correctKey: type === "ab" ? "a" : "1",
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveThemeQuestions({ questions: sanitizeThemeQuestions(questions) });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const headerBar = (
    <View style={styles.headerRow}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <ArrowLeft size={18} color={colors.appTextMuted} />
        <CategoryTitle
          name={theme?.name ?? t("nav.themes")}
          iconSvg={(theme as { iconSvg?: string | null } | undefined)?.iconSvg}
          iconSize={14}
          tone="nav"
        />
      </Pressable>
      {theme ? (
        <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>
            {saving ? t("common.loading") : t("common.done")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (isLoading || !theme) {
    return (
      <ScreenShell header={headerBar}>
        <LoadingPlaceholder padding="lg" style={styles.center} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell header={headerBar}>
      <Text style={styles.pageTitle}>{t("themeQuiz.editTitle")}</Text>

      <ScrollView contentContainerStyle={styles.content}>
        {questions.map((q, qi) => (
          <View key={qi} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardNum}>#{qi + 1}</Text>
              <View style={styles.typeRow}>
                {(["ab", "four"] as const).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setQuestionType(qi, type)}
                    style={[styles.typeChip, q.type === type && styles.typeChipActive]}
                  >
                    <Text
                      style={[styles.typeChipText, q.type === type && styles.typeChipTextActive]}
                    >
                      {type === "ab" ? t("themeQuiz.typeAb") : t("themeQuiz.typeFour")}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                hitSlop={8}
              >
                <Trash2 size={16} color={colors.danger} />
              </Pressable>
            </View>

            <Text style={styles.label}>{t("themeQuiz.prompt")}</Text>
            <TextInput
              value={q.prompt}
              onChangeText={(prompt) => patchQuestion(qi, { prompt })}
              placeholder={t("themeQuiz.promptPlaceholder")}
              placeholderTextColor={colors.appTextMuted}
              style={styles.input}
              multiline
            />

            <Text style={styles.label}>{t("themeQuiz.choices")}</Text>
            {q.choices.map((c) => (
              <View key={c.key} style={styles.choiceRow}>
                <Pressable
                  onPress={() => patchQuestion(qi, { correctKey: c.key })}
                  style={[styles.radio, q.correctKey === c.key && styles.radioActive]}
                />
                <Text style={styles.choiceKey}>{c.key.toUpperCase()}</Text>
                <TextInput
                  value={c.label}
                  onChangeText={(label) => {
                    patchQuestion(qi, {
                      choices: q.choices.map((ch) =>
                        ch.key === c.key ? { ...ch, label } : ch,
                      ),
                    });
                  }}
                  placeholder={`${c.key.toUpperCase()}`}
                  placeholderTextColor={colors.appTextMuted}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
            ))}

            <HintLinesEditor
              hints={q.hints}
              onChange={(hints) => patchQuestion(qi, { hints })}
            />
          </View>
        ))}

        <Pressable
          onPress={() =>
            setQuestions((prev) => [...prev, emptyQuestion(prev.length, "ab")])
          }
          style={styles.addQuestion}
        >
          <Plus size={16} color={colors.main500} />
          <Text style={styles.addQuestionText}>{t("themeQuiz.addQuestion")}</Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>["theme"]) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.appBg },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4, flex: 1, minWidth: 0 },
    saveBtn: { padding: 8 },
    saveBtnText: { fontSize: 15, fontWeight: "700", color: theme.main500 },
    pageTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.appText,
      paddingHorizontal: 20,
      marginTop: 8,
      marginBottom: 12,
    },
    content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
    card: {
      backgroundColor: theme.appSurface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.appBorder,
      padding: 16,
      gap: 10,
    },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardNum: { fontSize: 14, fontWeight: "700", color: theme.appText },
    typeRow: { flexDirection: "row", gap: 6, flex: 1 },
    typeChip: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    typeChipActive: { borderColor: theme.main500, backgroundColor: theme.appAccent },
    typeChipText: { fontSize: 11, fontWeight: "600", color: theme.appTextSecondary },
    typeChipTextActive: { color: theme.main500 },
    label: { fontSize: 12, fontWeight: "600", color: theme.appTextSecondary },
    input: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.appText,
      backgroundColor: theme.appMuted,
    },
    choiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: theme.appBorderStrong,
    },
    radioActive: { borderColor: theme.main500, backgroundColor: theme.main500 },
    choiceKey: { fontSize: 12, fontWeight: "700", color: theme.appTextMuted, width: 16 },
    addQuestion: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.appBorderStrong,
      borderRadius: 12,
    },
    addQuestionText: { fontSize: 14, fontWeight: "600", color: theme.main500 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
  });
}
