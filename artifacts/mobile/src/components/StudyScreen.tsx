import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft, Dices } from "lucide-react-native";
import { useRouter } from "expo-router";
import { ScreenShell } from "@/components/ScreenShell";
import type { Word } from "@/lib/types";
import { apiFetch } from "@/lib/apiFetch";
import { getStudySession, type StudyMode } from "@/lib/studyStore";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ColorScheme } from "@/settings/appSettings";

function getLevelInfo(word: Word, mode: StudyMode) {
  if (mode === "okunuş")
    return { level: word.pronLevel, starred: word.pronStarred };
  if (mode === "anlam")
    return { level: word.meaningLevel, starred: word.meaningStarred };
  return { level: word.level, starred: word.starred };
}

function getPrimary(word: Word, mode: StudyMode, emDash: string): string {
  if (mode === "okunuş") return word.pronunciation || emDash;
  if (mode === "anlam") return word.meaning || emDash;
  return word.kanji || emDash;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function StudyScreen() {
  const { t, formatStudyDate } = useTranslation();
  const { theme, colorScheme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);

  const session = useMemo(() => getStudySession(), []);
  const { mode, title, backPath } = session;

  const [words, setWords] = useState(session.words);
  const [index, setIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [done, setDone] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const dragX = useRef(new Animated.Value(0)).current;
  const flyingRef = useRef(false);

  const word = words[index];

  const saveLevel = useCallback(
    (wordId: number, level: number, starred: boolean) => {
      const patch: Record<string, unknown> = {};
      if (mode === "kelime") {
        patch.level = level;
        patch.starred = starred;
      } else if (mode === "okunuş") {
        patch.pronLevel = level;
        patch.pronStarred = starred;
      } else {
        patch.meaningLevel = level;
        patch.meaningStarred = starred;
      }

      setWords((prev) =>
        prev.map((w) => (w.id === wordId ? { ...w, ...patch } : w)),
      );

      void apiFetch(`/api/words/${wordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [mode],
  );

  const advanceCard = useCallback(
    (direction: "left" | "right") => {
      if (direction === "left" && word) {
        setWords((prev) => [...prev, word]);
      }
      const nextIndex = index + 1;
      const newLength =
        direction === "left" ? words.length + 1 : words.length;
      if (nextIndex >= newLength) {
        setDone(true);
      } else {
        setIndex(nextIndex);
      }
      setShowDetails(false);
      setShowLevelPicker(false);
      dragX.setValue(0);
      flyingRef.current = false;
    },
    [index, word, words.length, dragX],
  );

  const flyAway = useCallback(
    (direction: "left" | "right") => {
      if (flyingRef.current) return;
      flyingRef.current = true;
      Animated.timing(dragX, {
        toValue: direction === "right" ? 400 : -400,
        duration: 180,
        useNativeDriver: true,
      }).start(() => advanceCard(direction));
    },
    [advanceCard, dragX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (!flyingRef.current) dragX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (flyingRef.current) return;
          if (g.dx > 70) flyAway("right");
          else if (g.dx < -70) flyAway("left");
          else {
            Animated.spring(dragX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [dragX, flyAway],
  );

  const handleRestart = () => {
    setWords(shuffle(words));
    setIndex(0);
    setShowDetails(false);
    setShowLevelPicker(false);
    setDone(false);
    dragX.setValue(0);
    flyingRef.current = false;
  };

  const goBack = () => {
    router.replace(backPath as "/words" | "/pronunciation" | "/meaning" | "/");
  };

  const headerBar = (
    <View style={styles.topBarRow}>
      <Pressable onPress={goBack} style={styles.backRow}>
        <ArrowLeft size={18} color={theme.appTextMuted} />
        <Text style={styles.backTitle}>{title}</Text>
      </Pressable>
      {!done && word ? (
        <Text style={styles.progress}>
          {t("common.cardProgress", { current: index + 1, total: words.length })}
        </Text>
      ) : null}
    </View>
  );

  if (!word && !done) {
    return (
      <ScreenShell>
        <View style={styles.center}>
          <Text style={styles.muted}>{t("study.notFound")}</Text>
          <Pressable onPress={goBack}>
            <Text style={styles.link}>{t("study.backToList")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  if (done) {
    return (
      <ScreenShell header={headerBar} bottomInset>
        <View style={styles.center}>
          <View style={[styles.starCircle, { backgroundColor: theme.starColor }]}>
            <Text style={styles.starIcon}>★</Text>
          </View>
          <Text style={styles.doneTitle}>{t("common.completed")}</Text>
          <Text style={styles.muted}>
            {t("study.finishedCount", { count: words.length })}
          </Text>
          <Pressable
            onPress={handleRestart}
            style={[styles.primaryBtn, { backgroundColor: theme.levelColor(1, 1) }]}
          >
            <Dices size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>{t("study.shuffleAgain")}</Text>
          </Pressable>
          <Pressable onPress={goBack} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>{t("study.backToList")}</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const { level, starred } = getLevelInfo(word!, mode);
  const displayColor = starred ? theme.starColor : theme.levelColor(level, level);
  const primaryFontSize = mode === "anlam" ? 22 : 42;
  const rotate = dragX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  return (
    <ScreenShell header={headerBar} bottomInset>
      <View style={styles.cardArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX: dragX }, { rotate }],
            },
          ]}
        >
          <Pressable onPress={() => setShowDetails((v) => !v)}>
            <Text style={[styles.primary, { fontSize: primaryFontSize }]}>
              {getPrimary(word!, mode, t("common.emDash"))}
            </Text>
          </Pressable>

          <View style={styles.metaRow}>
            {word!.date ? (
              <Text style={styles.metaChip}>{formatStudyDate(word!.date)}</Text>
            ) : null}
            {word!.jlptLevel ? (
              <Text style={styles.metaChip}>{word!.jlptLevel}</Text>
            ) : null}
            <Pressable
              onPress={() => setShowLevelPicker((v) => !v)}
              style={[
                styles.levelBadge,
                {
                  backgroundColor: displayColor,
                  borderWidth: showLevelPicker ? 2 : 0,
                  borderColor: displayColor,
                },
              ]}
            >
              <Text style={styles.levelBadgeText}>{starred ? "★" : level}</Text>
            </Pressable>
          </View>

          {showLevelPicker ? (
            <View style={styles.levelPicker}>
              {[1, 2, 3, 4, 5].map((l) => (
                <Pressable
                  key={l}
                  onPress={() => {
                    saveLevel(word!.id, l, false);
                    setShowLevelPicker(false);
                  }}
                  style={[
                    styles.levelBtn,
                    {
                      backgroundColor:
                        level === l && !starred
                          ? theme.levelColor(l, l)
                          : "transparent",
                      borderColor: theme.levelColor(l, l),
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: level === l && !starred ? "#fff" : theme.levelColor(l, l),
                      fontWeight: "700",
                    }}
                  >
                    {l}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  saveLevel(word!.id, 5, !starred);
                  setShowLevelPicker(false);
                }}
                style={[
                  styles.levelBtn,
                  {
                    backgroundColor: starred ? theme.starColor : "transparent",
                    borderColor: theme.starColor,
                  },
                ]}
              >
                <Text style={{ color: starred ? "#fff" : theme.starColor }}>★</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.swipeHint}>
            ← {t("study.swipeRepeat")} · {t("study.swipeKnow")} →
          </Text>
        </Animated.View>
      </View>

      {showDetails ? (
        <View style={styles.detailSheet}>
          <Pressable onPress={() => setShowDetails(false)} style={styles.detailHandle}>
            <View style={styles.handleBar} />
          </Pressable>
          <ScrollView style={styles.detailScroll}>
            {mode !== "kelime" && word!.kanji ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>{t("study.detailLabels.word")}</Text>
                <Text style={styles.detailKanji}>{word!.kanji}</Text>
              </View>
            ) : null}
            {mode !== "okunuş" && word!.pronunciation ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>
                  {t("study.detailLabels.pronunciation")}
                </Text>
                <Text style={styles.detailText}>{word!.pronunciation}</Text>
              </View>
            ) : null}
            {mode !== "anlam" && word!.meaning ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>
                  {t("study.detailLabels.meaning")}
                </Text>
                <Text style={styles.detailText}>{word!.meaning}</Text>
              </View>
            ) : null}
            {word!.description ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>
                  {t("study.detailLabels.description")}
                </Text>
                <Text style={styles.detailDesc}>{word!.description}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
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
    topBarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    backTitle: navBackTitleStyle(theme, colorScheme, { letterSpacing: 1.2 }),
    progress: {
      fontSize: 13,
      color: theme.appTextMuted,
      fontVariant: ["tabular-nums"],
    },
    cardArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      gap: 16,
    },
    primary: {
      fontWeight: "700",
      color: theme.appText,
      textAlign: "center",
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    metaChip: {
      backgroundColor: theme.appMuted,
      color: theme.appTextSecondary,
      fontSize: 12,
      fontWeight: "500",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: "hidden",
    },
    levelBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    levelBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
    },
    levelPicker: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    levelBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    swipeHint: {
      fontSize: 11,
      color: theme.appTextMuted,
      marginTop: 8,
    },
    detailSheet: {
      maxHeight: "50%",
      backgroundColor: theme.appSurface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.appBorder,
    },
    detailHandle: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.appBorderStrong,
    },
    detailScroll: { paddingHorizontal: 24, paddingBottom: 24 },
    detailBlock: { marginBottom: 16 },
    detailLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.appTextMuted,
      marginBottom: 4,
    },
    detailKanji: { fontSize: 28, fontWeight: "700", color: theme.appText },
    detailText: { fontSize: 16, color: theme.appText },
    detailDesc: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.appTextSecondary,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 12,
    },
    starCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    starIcon: { fontSize: 28, color: "#fff" },
    doneTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.appText,
    },
    muted: { fontSize: 14, color: theme.appTextMuted, textAlign: "center" },
    link: { fontSize: 14, color: theme.main500, marginTop: 12 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 12,
      width: "100%",
      maxWidth: 280,
      justifyContent: "center",
    },
    primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    outlineBtn: {
      borderWidth: 1,
      borderColor: theme.appBorderStrong,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 16,
      width: "100%",
      maxWidth: 280,
      alignItems: "center",
    },
    outlineBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.appTextSecondary,
    },
  });
}
