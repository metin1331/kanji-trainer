import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  FlatList,
  ScrollView,
} from "react-native-gesture-handler";
import { useRouter, type Href } from "expo-router";
import { Settings, Layers, BarChart2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DailyGoalCard } from "@/components/DailyGoalCard";
import { MiniHeatmapStrip } from "@/components/progress/MiniHeatmapStrip";
import { BulkImportModal } from "@/components/BulkImportModal";
import { SearchBar } from "@/components/SearchBar";
import { SearchResultItem } from "@/components/SearchResultItem";
import { StudyLinkRow } from "@/components/StudyLinkRow";
import { LoadingPlaceholder } from "@/components/LoadingPlaceholder";
import { WordAddFab } from "@/components/WordAddFab";
import {
  WordFormModal,
  type WordFormSaveData,
} from "@/components/WordFormModal";
import { confirmAsync } from "@/lib/confirm";
import { useTranslation } from "@/i18n/I18nProvider";
import { filterWords } from "@/lib/filterWords";
import { useCategories } from "@/hooks/useCategories";
import { useStudyActivity } from "@/hooks/useStudyActivity";
import { useThemes } from "@/hooks/useThemes";
import { useWords } from "@/hooks/useWords";
import { useTheme } from "@/theme/ThemeProvider";
import type { Word } from "@/lib/types";
import {
  STUDY_LINKS,
  buildStudyCounts,
  studyCountLabel,
} from "@/lib/studyLinks";
import { ColorScheme } from "@/settings/appSettings";

function HomeHeader({
  styles,
  theme,
  colorScheme,
  topInset,
  t,
  formatToday,
  router,
  query,
  setQuery,
  words,
  isLoading,
  isSearching,
  activityByDate,
  activityLoading,
}: {
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useTheme>["theme"];
  colorScheme: ColorScheme;
  topInset: number;
  t: ReturnType<typeof useTranslation>["t"];
  formatToday: ReturnType<typeof useTranslation>["formatToday"];
  router: ReturnType<typeof useRouter>;
  query: string;
  setQuery: (v: string) => void;
  words: Word[];
  isLoading: boolean;
  isSearching: boolean;
  activityByDate: ReturnType<typeof useStudyActivity>["activityByDate"];
  activityLoading: boolean;
}) {
  return (
    <View style={[styles.header, { paddingTop: topInset + 12 }]}>
      <View style={styles.headerTop}>
        <Text style={styles.subtitle}>{t("home.appSubtitle")}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/srs")}
            style={({ pressed }) => [
              styles.headerIconBtn,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel={t("a11y.srs")}
          >
            <Layers size={20} color={theme.appTextMuted} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/progress" as Href)}
            style={({ pressed }) => [
              styles.headerIconBtn,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel={t("a11y.progress")}
          >
            <BarChart2 size={20} color={theme.appTextMuted} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.headerIconBtn,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel={t("a11y.settings")}
          >
            <Settings size={20} color={theme.appTextMuted} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.title}>{formatToday()}</Text>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={t("home.searchPlaceholder")}
        wordCount={words.length}
        wordCountLoading={isLoading}
        onWordCountClick={() =>
          router.push({ pathname: "/words", params: { all: "1" } })
        }
      />
      {!isSearching ? (
        <>
          <DailyGoalCard />
          <MiniHeatmapStrip
            activityByDate={activityByDate}
            isActivityLoading={activityLoading}
          />
        </>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const { t, formatToday } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);
  const { words, isLoading, addWord, updateWord, deleteWord, bulkCreate } =
    useWords();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { themes, isLoading: themesLoading } = useThemes();
  const { activityByDate, isLoading: activityLoading } = useStudyActivity();
  const studyCounts = useMemo(
    () => buildStudyCounts(words, themes, categories),
    [words, themes, categories],
  );
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());
  const [relatedOpenIds, setRelatedOpenIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [formVisible, setFormVisible] = useState(false);
  const [bulkVisible, setBulkVisible] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);

  const isSearching = query.trim().length > 0;
  const results = filterWords(words, query);

  const handleDelete = useCallback(
    async (id: number) => {
      const word = words.find((w) => w.id === id);
      const ok = await confirmAsync(
        t("common.confirmTitle"),
        word?.kanji
          ? t("home.confirmDelete", { kanji: word.kanji })
          : t("common.confirmDeleteWord"),
        t("common.delete"),
        t("common.cancel"),
      );
      if (ok) deleteWord(id);
    },
    [words, t, deleteWord],
  );

  const handleEdit = useCallback((word: Word) => {
    setEditingWord(word);
    setFormVisible(true);
  }, []);

  const handleNewWord = useCallback(() => {
    setEditingWord(null);
    setFormVisible(true);
  }, []);

  const handleFormSave = useCallback(
    (data: WordFormSaveData) => {
      if (editingWord) {
        updateWord(editingWord.id, {
          ...data,
          relatedWordIds: editingWord.relatedWordIds,
          categoryIds: data.categoryIds,
        });
      } else {
        addWord({
          ...data,
          relatedWordIds: [],
          categoryIds: data.categoryIds,
        });
      }
      setFormVisible(false);
      setEditingWord(null);
    },
    [editingWord, addWord, updateWord],
  );

  const handleBulkImport = useCallback(() => {
    setBulkVisible(true);
  }, []);

  const headerProps = {
    styles,
    theme,
    colorScheme,
    topInset: insets.top,
    t,
    formatToday,
    router,
    query,
    setQuery,
    words,
    isLoading,
    isSearching,
    activityByDate,
    activityLoading,
  };

  return (
    <View style={styles.root}>
      {Platform.OS === "android" ? (
        <RNStatusBar
          backgroundColor={theme.appSurface}
          barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
        />
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {isSearching ? (
          <>
            <HomeHeader {...headerProps} />
            {isLoading ? (
              <LoadingPlaceholder style={styles.flex} />
            ) : results.length === 0 ? (
              <ScrollView
                keyboardShouldPersistTaps="never"
                style={styles.flex}
                contentContainerStyle={styles.flexGrow}
              >
                <View style={styles.center}>
                  <Text style={styles.emptyIcon}>?</Text>
                  <Text style={styles.emptyText}>
                    {t("common.noResultsForQuery", { query: query.trim() })}
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => String(item.id)}
                ListHeaderComponent={
                  <Text style={styles.resultCount}>
                    {t("common.resultCount", { count: results.length })}
                  </Text>
                }
                renderItem={({ item }) => (
                  <SearchResultItem
                    word={item}
                    allWords={words}
                    isOpen={openIds.has(item.id)}
                    isRelatedOpen={relatedOpenIds.has(item.id)}
                    onToggle={() => {
                      setOpenIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    onToggleRelated={() => {
                      setRelatedOpenIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                )}
                keyboardShouldPersistTaps="never"
                style={styles.flex}
                contentContainerStyle={styles.listContent}
              />
            )}
          </>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="never"
            style={styles.flex}
            contentContainerStyle={styles.homeScrollContent}
          >
            <HomeHeader {...headerProps} />
            <View style={styles.linksSection}>
              <Text style={styles.sectionLabel}>{t("home.studySection")}</Text>
              <View style={styles.links}>
                {STUDY_LINKS.map(({ path, Icon, titleKey }) => {
                  const count = studyCounts[titleKey];
                  const linkLoading =
                    isLoading ||
                    (titleKey === "nav.categories" && categoriesLoading) ||
                    (titleKey === "nav.themes" && themesLoading);
                  return (
                    <StudyLinkRow
                      key={path}
                      Icon={Icon}
                      title={t(titleKey)}
                      subtitle={studyCountLabel(titleKey, count, t)}
                      loading={linkLoading}
                      onPress={() => router.push(path as Href)}
                    />
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {!isSearching ? (
        <WordAddFab onNewWord={handleNewWord} onBulkImport={handleBulkImport} />
      ) : null}

      <WordFormModal
        visible={formVisible}
        initial={editingWord}
        allWords={words}
        onClose={() => {
          setFormVisible(false);
          setEditingWord(null);
        }}
        onSave={handleFormSave}
      />

      <BulkImportModal
        visible={bulkVisible}
        allWords={words}
        onClose={() => setBulkVisible(false)}
        onImport={bulkCreate}
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], colorScheme: ColorScheme) {
  const isDark = colorScheme === "dark";
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.appBg,
    },
    flex: {
      flex: 1,
    },
    flexGrow: {
      flexGrow: 1,
    },
    homeScrollContent: {
      flexGrow: 1,
      paddingBottom: 100,
    },
    listContent: {
      paddingBottom: 32,
    },
    header: {
      backgroundColor: theme.appSurface,
      borderBottomWidth: 1,
      borderBottomColor: theme.appBorder,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    subtitle: {
      flex: 1,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: isDark ? theme.main500 : theme.main400,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: -8,
      marginTop: -4,
    },
    headerIconBtn: {
      padding: 8,
      borderRadius: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.appText,
      marginBottom: 12,
    },
    linksSection: {
      backgroundColor: theme.appBg,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.appTextMuted,
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    links: {
      gap: 8,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      backgroundColor: theme.appBg,
      minHeight: 240,
    },
    emptyIcon: {
      fontSize: 36,
      color: theme.appBorderStrong,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.appTextMuted,
      textAlign: "center",
    },
    resultCount: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.appTextMuted,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: theme.appBg,
    },
  });
}
