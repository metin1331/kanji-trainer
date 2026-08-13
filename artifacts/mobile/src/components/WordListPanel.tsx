import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { ArrowLeft, ArrowUpDown, Dices } from "lucide-react-native";
import { useRouter } from "expo-router";
import { ScreenShell, useScreenHeaderInset } from "@/components/ScreenShell";
import type { Word } from "@/lib/types";
import { filterWords, filterByJlptLevels } from "@/lib/filterWords";
import { confirmAsync } from "@/lib/confirm";
import {
  getSingleSortListPrefs,
  getWordsListPrefs,
  saveSingleSortListPrefs,
  saveWordsListPrefs,
} from "@/lib/listPreferences";
import { partitionPinnedWords } from "@/lib/pinnedWords";
import { sortWords, sortWordsMulti, type SortMode } from "@/lib/sortWords";
import { startStudy, type StudyMode } from "@/lib/studyStore";
import { usePinnedWords } from "@/hooks/usePinnedWords";
import { useTranslation } from "@/i18n/I18nProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { CategoryTitle } from "./CategoryIcon";
import { navBackTitleStyle } from "@/theme/screenNavStyles";
import { ListSortSheet } from "./ListSortSheet";
import { LoadingSpinner } from "./LoadingSpinner";
import { LoadingPlaceholder } from "./LoadingPlaceholder";
import { SearchBar } from "./SearchBar";
import { SelectActionBar } from "./SelectActionBar";
import { WordCard, type WordCardMode } from "./WordCard";
import { WordFormModal, type WordFormSaveData } from "./WordFormModal";
import { ColorScheme } from "@/settings/appSettings";

type Props = {
  title: string;
  prefsScope: string;
  words: Word[];
  isLoading: boolean;
  isError: boolean;
  mode?: WordCardMode;
  emptyMessage?: string;
  filterLearned?: boolean;
  learnedOnly?: boolean;
  onUpdate?: (id: number, patch: Partial<Word>) => void;
  onDelete?: (id: number) => void;
  onDeleteMany?: (ids: number[]) => Promise<void>;
  bulkMode?: "delete" | "remove";
  onBulkRemove?: (ids: number[]) => Promise<void>;
  bulkRemoveLabel?: string;
  onEditSave?: (id: number, data: WordFormSaveData) => void;
  showDice?: boolean;
  studyTitle?: string;
  studyReturnPath?: string;
  toolbarExtra?: ReactNode;
  iconSvg?: string | null;
  /** @deprecated Use iconSvg instead */
  pageTitleIcon?: ReactNode;
  onBack?: () => void;
  allWords?: Word[];
};

function cardModeToStudyMode(mode: WordCardMode): StudyMode {
  if (mode === "pronunciation") return "okunuş";
  if (mode === "meaning") return "anlam";
  return "kelime";
}

function filterLearnedWords(words: Word[], mode: WordCardMode): Word[] {
  if (mode === "pronunciation") return words.filter((w) => !w.pronStarred);
  if (mode === "meaning") return words.filter((w) => !w.meaningStarred);
  return words.filter((w) => !w.starred);
}

function applyListFilter(
  words: Word[],
  mode: WordCardMode,
  filterLearned: boolean,
  learnedOnly: boolean,
): Word[] {
  if (learnedOnly) {
    if (mode === "pronunciation") return words.filter((w) => w.pronStarred);
    if (mode === "meaning") return words.filter((w) => w.meaningStarred);
    return words.filter((w) => w.starred);
  }
  if (filterLearned) return filterLearnedWords(words, mode);
  return words;
}

export function WordListPanel({
  title,
  prefsScope,
  words,
  isLoading,
  isError,
  mode = "words",
  emptyMessage,
  filterLearned = false,
  learnedOnly = false,
  onUpdate,
  onDelete,
  onDeleteMany,
  bulkMode = "delete",
  onBulkRemove,
  bulkRemoveLabel,
  onEditSave,
  showDice = true,
  studyTitle,
  studyReturnPath,
  toolbarExtra,
  iconSvg,
  pageTitleIcon,
  onBack,
  allWords: allWordsProp,
}: Props) {
  const { t } = useTranslation();
  const { theme, colorScheme } = useTheme();
  const router = useRouter();
  const headerInset = useScreenHeaderInset();
  const styles = useMemo(() => createStyles(theme, colorScheme), [theme, colorScheme]);

  const isWordsMode = mode === "words";
  const allWords = allWordsProp ?? words;

  const [prefsReady, setPrefsReady] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("level-asc");
  const [activeSorts, setActiveSorts] = useState<Set<SortMode>>(
    () => new Set<SortMode>(["level-asc"]),
  );
  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(
    () => new Set(),
  );
  const [pageSize, setPageSize] = useState(50);
  const [visibleCount, setVisibleCount] = useState(50);
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());
  const [showSort, setShowSort] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [editingWord, setEditingWord] = useState<Word | null>(null);

  const {
    pinnedIds,
    togglePinMany,
    isPinned,
    ready: pinReady,
  } = usePinnedWords(prefsScope);

  useEffect(() => {
    if (isWordsMode) {
      getWordsListPrefs(prefsScope, {
        query: "",
        sorts: ["level-asc"],
        pageSize: 50,
        jlptLevels: [],
      }).then((prefs) => {
        setQuery(prefs.query);
        setActiveSorts(new Set(prefs.sorts));
        setPageSize(prefs.pageSize ?? 50);
        setVisibleCount(prefs.pageSize ?? 50);
        setSelectedJlpt(new Set(prefs.jlptLevels ?? []));
        setPrefsReady(true);
      });
    } else {
      getSingleSortListPrefs(prefsScope, { query: "", sort: "level-asc" }).then(
        (prefs) => {
          setQuery(prefs.query);
          setSort(prefs.sort);
          setPrefsReady(true);
        },
      );
    }
  }, [prefsScope, isWordsMode]);

  useEffect(() => {
    if (!prefsReady) return;
    if (isWordsMode) {
      void saveWordsListPrefs(prefsScope, {
        query,
        sorts: [...activeSorts],
        pageSize,
        jlptLevels: [...selectedJlpt],
      });
    } else {
      void saveSingleSortListPrefs(prefsScope, { query, sort });
    }
  }, [
    prefsScope,
    query,
    sort,
    activeSorts,
    pageSize,
    selectedJlpt,
    prefsReady,
    isWordsMode,
  ]);

  useEffect(() => {
    if (!isWordsMode) return;
    setVisibleCount(pageSize);
  }, [isWordsMode, pageSize, query, activeSorts, selectedJlpt, words]);

  const baseWords = applyListFilter(words, mode, filterLearned, learnedOnly);

  const sorted = useMemo(() => {
    if (isWordsMode) {
      return sortWordsMulti(baseWords, activeSorts, mode);
    }
    return sortWords(filterWords(baseWords, query), sort, mode);
  }, [baseWords, isWordsMode, activeSorts, query, sort, mode]);

  const filtered = useMemo(() => {
    const searched = isWordsMode ? filterWords(sorted, query) : sorted;
    if (isWordsMode) {
      return filterByJlptLevels(searched, selectedJlpt);
    }
    return searched;
  }, [sorted, query, isWordsMode, selectedJlpt]);

  const ordered =
    pinReady && pinnedIds.size > 0
      ? partitionPinnedWords(filtered, pinnedIds)
      : filtered;

  const displayed = isWordsMode ? ordered.slice(0, visibleCount) : ordered;
  const hasMore = isWordsMode && visibleCount < ordered.length;
  const totalFiltered = ordered.length;

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteOne = useCallback(
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
      if (ok) onDelete?.(id);
    },
    [words, t, onDelete],
  );

  const handleBulkAction = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];

    if (bulkMode === "remove" && onBulkRemove) {
      const ok = await confirmAsync(
        t("common.confirmTitle"),
        t("themes.confirmRemoveWords", { count: ids.length }),
        bulkRemoveLabel ?? t("themes.removeFromTheme"),
        t("common.cancel"),
      );
      if (!ok) return;
      await onBulkRemove(ids);
      exitSelectMode();
      return;
    }

    if (!onDeleteMany) return;
    const ok = await confirmAsync(
      t("common.confirmTitle"),
      t("common.confirmBulkDelete", { count: ids.length }),
      t("common.delete"),
      t("common.cancel"),
    );
    if (!ok) return;
    await onDeleteMany(ids);
    exitSelectMode();
  }, [
    selectedIds,
    bulkMode,
    onBulkRemove,
    bulkRemoveLabel,
    onDeleteMany,
    t,
    exitSelectMode,
  ]);

  const handlePinSelected = useCallback(() => {
    togglePinMany([...selectedIds]);
    setSelectedIds(new Set());
  }, [selectedIds, togglePinMany]);

  const renderItem: ListRenderItem<Word> = ({ item, index }) => (
    <WordCard
      word={item}
      index={index + 1}
      mode={mode}
      isOpen={openIds.has(item.id)}
      onToggle={() => {
        setOpenIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
      }}
      onUpdate={onUpdate}
      selectMode={selectMode}
      isSelected={selectedIds.has(item.id)}
      onSelect={() => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
      }}
      pinned={isPinned(item.id)}
      onEdit={
        mode === "words" && onEditSave ? (w) => setEditingWord(w) : undefined
      }
      onDelete={onDelete ? handleDeleteOne : undefined}
      allWords={allWords}
    />
  );

  const listHeader = (
    <View style={[styles.headerBlock, { paddingTop: headerInset }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          style={({ pressed }) => [styles.backPressable, pressed && { opacity: 0.7 }]}
        >
          <ArrowLeft size={18} color={theme.appTextMuted} />
          <View style={styles.titleRow}>
            {pageTitleIcon == null ? (
              <CategoryTitle name={title} iconSvg={iconSvg} iconSize={14} tone="nav" />
            ) : (
              <>
                {pageTitleIcon}
                <Text style={styles.backTitle} numberOfLines={1}>
                  {title}
                </Text>
              </>
            )}
          </View>
        </Pressable>
        <View style={styles.topRowActions}>
          {toolbarExtra}
          {showDice ? (
            <Pressable
              onPress={() => {
                if (ordered.length === 0) return;
                startStudy(
                  ordered,
                  cardModeToStudyMode(mode),
                  studyTitle ?? title,
                  studyReturnPath ?? prefsScope,
                );
                router.push("/study");
              }}
              disabled={ordered.length === 0}
              style={({ pressed }) => [
                styles.toolBtn,
                styles.diceBtn,
                ordered.length === 0 && styles.diceDisabled,
                pressed && ordered.length > 0 && { opacity: 0.85 },
              ]}
            >
              <Dices size={16} color={theme.appTextMuted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.toolbarRow}>
        <View style={styles.countCol}>
          {isLoading ? (
            <LoadingSpinner size={18} color={theme.appTextMuted} />
          ) : (
            <Text style={styles.countText}>
              {t("words.showingCount", {
                visible: displayed.length,
                total: isWordsMode ? totalFiltered : baseWords.length,
              })}
            </Text>
          )}
        </View>
        <View style={styles.searchCol}>
          <SearchBar value={query} onChange={setQuery} />
        </View>
        <Pressable
          onPress={() => setShowSort(true)}
          style={({ pressed }) => [
            styles.toolBtn,
            styles.sortBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <ArrowUpDown size={14} color={theme.main500} strokeWidth={2} />
          <Text style={styles.sortBtnText}>{t("common.sort")}</Text>
        </Pressable>
        <Pressable
          onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          style={({ pressed }) => [
            styles.toolBtn,
            selectMode && styles.selectBtnActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text
            style={[
              styles.selectBtnText,
              selectMode && styles.selectBtnTextActive,
            ]}
          >
            {selectMode ? t("common.cancel") : t("common.select")}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const listContent = (
    <>
      {isError ? (
        <>
          {listHeader}
          <View style={styles.center}>
            <Text style={styles.error}>
              {mode === "pronunciation"
                ? t("pronunciation.loadError")
                : mode === "meaning"
                  ? t("meaning.loadError")
                  : t("words.loadError")}
            </Text>
          </View>
        </>
      ) : isLoading ? (
        <>
          {listHeader}
          <LoadingPlaceholder padding="lg" style={styles.center} />
        </>
      ) : displayed.length === 0 ? (
        <>
          {listHeader}
          <View style={styles.center}>
            {query ? (
              <>
                <Text style={styles.emptyIcon}>?</Text>
                <Text style={styles.emptyText}>
                  {t("common.noResultsForQuery", { query: query.trim() })}
                </Text>
              </>
            ) : (
              <Text style={styles.emptyText}>
                {emptyMessage ??
                  (mode === "pronunciation"
                    ? t("pronunciation.empty")
                    : mode === "meaning"
                      ? t("meaning.empty")
                      : t("words.empty"))}
              </Text>
            )}
          </View>
        </>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          stickyHeaderIndices={[0]}
          keyboardShouldPersistTaps="never"
          style={styles.list}
          contentContainerStyle={selectMode ? styles.listWithBar : undefined}
          onEndReached={() => {
            if (hasMore) {
              setVisibleCount((prev) => prev + pageSize);
            }
          }}
          onEndReachedThreshold={0.3}
        />
      )}
    </>
  );

  return (
    <ScreenShell statusBarColor={theme.appSurface}>
      {listContent}
      {selectMode ? (
        <SelectActionBar
          selectedCount={selectedIds.size}
          onSelectAll={() =>
            setSelectedIds(new Set(displayed.map((w) => w.id)))
          }
          onPin={handlePinSelected}
          onDelete={handleBulkAction}
          deleteLabel={
            bulkMode === "remove"
              ? (bulkRemoveLabel ?? t("themes.removeFromTheme"))
              : undefined
          }
        />
      ) : null}
      <ListSortSheet
        visible={showSort}
        onClose={() => setShowSort(false)}
        {...(isWordsMode
          ? {
              mode: "multi" as const,
              activeSorts,
              onActiveSortsChange: setActiveSorts,
              showJlptFilter: true,
              selectedJlpt,
              onToggleJlpt: (level: string) => {
                setSelectedJlpt((prev) => {
                  const next = new Set(prev);
                  if (next.has(level)) next.delete(level);
                  else next.add(level);
                  return next;
                });
              },
              onClearJlpt: () => setSelectedJlpt(new Set()),
              showPageSize: true,
              pageSize,
              onPageSizeChange: setPageSize,
            }
          : {
              sort,
              onSortSelect: setSort,
            })}
      />
      {onEditSave ? (
        <WordFormModal
          visible={editingWord != null}
          initial={editingWord}
          allWords={allWords}
          onClose={() => setEditingWord(null)}
          onSave={(data) => {
            if (editingWord) {
              onEditSave(editingWord.id, data);
              setEditingWord(null);
            }
          }}
        />
      ) : null}
    </ScreenShell>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], colorScheme: ColorScheme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.appBg,
    },
    list: {
      flex: 1,
    },
    listWithBar: {
      paddingBottom: 72,
    },
    headerBlock: {
      backgroundColor: theme.appSurface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.appBorderStrong,
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "space-between",
      padding: 4,
      marginLeft: -4,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    backPressable: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      minWidth: 0,
      padding: 4,
      marginLeft: -4,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    topRowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    backTitle: navBackTitleStyle(theme, colorScheme),
    toolbarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    countCol: {
      minWidth: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    countText: {
      fontSize: 12,
      color: theme.appTextMuted,
      fontVariant: ["tabular-nums"],
    },
    searchCol: {
      flex: 1,
      minWidth: 0,
    },
    toolBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
    },
    sortBtn: {
      backgroundColor: theme.appAccent,
    },
    sortBtnText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.main500,
    },
    diceBtn: {
      paddingHorizontal: 6,
    },
    diceDisabled: {
      opacity: 0.3,
    },
    selectBtnActive: {
      backgroundColor: theme.appAccent,
    },
    selectBtnText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.appTextMuted,
    },
    selectBtnTextActive: {
      color: theme.main500,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    error: {
      color: theme.danger,
      fontSize: 14,
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
  });
}
