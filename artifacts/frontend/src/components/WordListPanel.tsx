import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Trash2,
  Dices,
  Pin,
} from "lucide-react";
import { useLocation } from "wouter";
import { WordCard } from "./WordCard";
import { WordFormModal } from "./WordFormModal";
import { SearchBar } from "./SearchBar";
import { ListSortMenuContent } from "./ListSortMenuContent";
import { LoadingSpinner } from "./LoadingSpinner";
import { LoadingPlaceholder } from "./LoadingPlaceholder";
import { filterWords } from "../utils/filterWords";
import { clusterByKanji } from "../utils/kanjiCluster";
import type { Word, WordUpdate } from "../types";
import { startStudy } from "../store/studyStore";
import { useTranslation } from "../i18n/I18nProvider";
import { pageTitleLabelClass } from "../lib/japaneseScript";
import { useConfirm } from "../components/ConfirmProvider";
import { getWordsListPrefs, saveWordsListPrefs } from "../lib/listPreferences";
import { partitionPinnedWords } from "../lib/pinnedWords";
import { usePinnedWords } from "../hooks/usePinnedWords";

export type SortMode =
  | "level-asc"
  | "level-desc"
  | "date-asc"
  | "date-desc"
  | "jlpt-asc"
  | "jlpt-desc"
  | "kanji-cluster";
type SortGroup = "level" | "date" | "jlpt" | "kanji" | "jlptOrder";

const JLPT_RANK: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
function jlptRank(w: Word): number {
  return w.jlptLevel ? (JLPT_RANK[w.jlptLevel] ?? 99) : 99;
}

function buildComparator(
  sorts: Set<SortMode>,
): ((a: Word, b: Word) => number) | undefined {
  const levelDir = sorts.has("level-asc")
    ? "asc"
    : sorts.has("level-desc")
      ? "desc"
      : null;
  const dateDir = sorts.has("date-asc")
    ? "asc"
    : sorts.has("date-desc")
      ? "desc"
      : null;
  const jlptDir = sorts.has("jlpt-asc")
    ? "asc"
    : sorts.has("jlpt-desc")
      ? "desc"
      : null;
  if (!levelDir && !dateDir && !jlptDir) return undefined;
  return (a: Word, b: Word) => {
    if (jlptDir) {
      const d = jlptRank(a) - jlptRank(b);
      if (d !== 0) return jlptDir === "asc" ? d : -d;
    }
    if (levelDir) {
      const d = a.level - b.level;
      if (d !== 0) return levelDir === "asc" ? d : -d;
    }
    if (dateDir) {
      const d =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (d !== 0) return dateDir === "asc" ? d : -d;
    }
    return 0;
  };
}

export function sortWords(words: Word[], sorts: Set<SortMode>): Word[] {
  const cmp = buildComparator(sorts);
  if (sorts.has("kanji-cluster")) return clusterByKanji(words, cmp);
  const arr = [...words];
  if (!cmp) return arr;
  return arr.sort(cmp);
}

export type WordListPanelProps = {
  words: Word[];
  allWords: Word[];
  isLoading?: boolean;
  isError?: boolean;
  emptyMessage?: string;
  studyTitle: string;
  studyReturnPath: string;
  onUpdate: (id: number, patch: WordUpdate) => void;
  onDelete: (id: number) => void;
  onBulkDelete?: (ids: number[]) => void | Promise<void>;
  bulkMode?: "delete" | "remove";
  onBulkRemove?: (ids: number[]) => void | Promise<void>;
  bulkRemoveLabel?: string;
  showDice?: boolean;
  toolbarExtra?: React.ReactNode;
  /** Full-page layout: sticky header with back + dice row (matches Pronunciation/Meaning). */
  layout?: "embedded" | "page";
  pageTitle?: string;
  pageTitleIcon?: React.ReactNode;
  onBack?: () => void;
};

export function WordListPanel({
  words,
  allWords,
  isLoading = false,
  isError = false,
  emptyMessage,
  studyTitle,
  studyReturnPath,
  onUpdate,
  onDelete,
  onBulkDelete,
  bulkMode = "delete",
  onBulkRemove,
  bulkRemoveLabel,
  showDice = true,
  toolbarExtra,
  layout = "embedded",
  pageTitle,
  pageTitleIcon,
  onBack,
}: WordListPanelProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [, navigate] = useLocation();

  const sortOptions: { value: SortMode; label: string; group: SortGroup }[] = [
    { value: "level-asc", label: t("words.sort.levelAsc"), group: "level" },
    { value: "level-desc", label: t("words.sort.levelDesc"), group: "level" },
    { value: "date-asc", label: t("words.sort.dateAsc"), group: "date" },
    { value: "date-desc", label: t("words.sort.dateDesc"), group: "date" },
    { value: "jlpt-asc", label: t("words.sort.jlptAsc"), group: "jlptOrder" },
    { value: "jlpt-desc", label: t("words.sort.jlptDesc"), group: "jlptOrder" },
    {
      value: "kanji-cluster",
      label: t("words.sort.kanjiCluster"),
      group: "kanji",
    },
  ];

  const groups: { key: SortGroup; label: string }[] = [
    // { key: "jlpt", label: t("common.jlpt") },
    { key: "jlptOrder", label: t("common.jlptOrder") },
    { key: "level", label: t("common.level") },
    { key: "date", label: t("common.date") },
    { key: "kanji", label: t("common.clustering") },
  ];

  const prefsScope = studyReturnPath;
  const defaultPrefs = {
    query: "",
    sorts: ["level-asc"] as SortMode[],
    pageSize: 50,
    jlptLevels: [] as string[],
  };
  const savedPrefs = getWordsListPrefs(prefsScope, defaultPrefs);

  const [showForm, setShowForm] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | undefined>(undefined);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [activeSorts, setActiveSorts] = useState<Set<SortMode>>(
    () => new Set<SortMode>(savedPrefs.sorts),
  );
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [query, setQuery] = useState(savedPrefs.query);
  const [pageSize, setPageSize] = useState(savedPrefs.pageSize ?? 50);
  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(
    () => new Set(savedPrefs.jlptLevels ?? []),
  );
  const [visibleCount, setVisibleCount] = useState(savedPrefs.pageSize ?? 50);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { pinnedIds, togglePinMany, isPinned, ready: pinReady } =
    usePinnedWords(studyReturnPath);

  const headerRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    saveWordsListPrefs(prefsScope, {
      query,
      sorts: [...activeSorts],
      pageSize,
      jlptLevels: [...selectedJlpt],
    });
  }, [prefsScope, query, activeSorts, pageSize, selectedJlpt]);

  useEffect(() => {
    if (layout !== "page") return;
    setVisibleCount(pageSize);
  }, [layout, pageSize, query, activeSorts, selectedJlpt, words]);

  useEffect(() => {
    if (!showSortMenu) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node)
      )
        setShowSortMenu(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showSortMenu]);

  const sorted = useMemo(
    () => sortWords(words, activeSorts),
    [words, activeSorts],
  );
  const searched = useMemo(() => filterWords(sorted, query), [sorted, query]);
  const filtered = useMemo(() => {
    if (layout !== "page" || selectedJlpt.size === 0) return searched;
    return searched.filter((w) => w.jlptLevel && selectedJlpt.has(w.jlptLevel));
  }, [searched, layout, selectedJlpt]);
  const orderedWords = useMemo(
    () =>
      pinReady && pinnedIds.size > 0
        ? partitionPinnedWords(filtered, pinnedIds)
        : filtered,
    [filtered, pinnedIds, pinReady],
  );
  const visibleWords = useMemo(
    () =>
      layout === "page" ? orderedWords.slice(0, visibleCount) : orderedWords,
    [orderedWords, layout, visibleCount],
  );
  const hasMore = layout === "page" && visibleCount < orderedWords.length;
  const activeSortCount = activeSorts.size;

  useEffect(() => {
    if (layout !== "page" || !hasMore) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + pageSize);
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout, hasMore, pageSize, visibleWords.length, orderedWords.length]);

  const handleScroll = useCallback(() => {
    if (!headerRef.current || selectMode) return;
    const headerBottom = headerRef.current.getBoundingClientRect().bottom;
    setOpenIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        const el = cardRefs.current.get(id);
        if (el && el.getBoundingClientRect().bottom <= headerBottom) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectMode]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  function toggleJlpt(level: string) {
    setSelectedJlpt((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handlePinSelected() {
    if (selectedIds.size === 0) return;
    togglePinMany(Array.from(selectedIds));
    setSelectedIds(new Set());
  }

  async function handleBulkAction() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (bulkMode === "remove" && onBulkRemove) {
      if (
        !(await confirm({
          message: t("themes.confirmRemoveWords", { count: ids.length }),
          confirmLabel: t("themes.removeFromTheme"),
        }))
      )
        return;
      await onBulkRemove(ids);
    } else {
      if (
        !(await confirm(t("common.confirmBulkDelete", { count: ids.length })))
      )
        return;
      if (onBulkDelete) await onBulkDelete(ids);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  async function handleDelete(id: number) {
    if (!(await confirm(t("common.confirmDeleteWord")))) return;
    onDelete(id);
    setOpenIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  const diceButton = showDice ? (
    <button
      onClick={() => {
        if (filtered.length === 0) return;
        startStudy(orderedWords, "kelime", studyTitle, studyReturnPath);
        navigate("/study");
      }}
      disabled={filtered.length === 0}
      className="text-app-text-muted hover:bg-app-muted shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-30"
    >
      <Dices size={17} strokeWidth={2} />
    </button>
  ) : null;

  const diceInHeader = layout === "page" && showDice;

  const toolbarRow = (
    <div className="flex items-center gap-2">
      <p className="text-app-text-muted flex min-w-[1.25rem] shrink-0 items-center justify-center text-sm tabular-nums">
        {isLoading ? (
          <LoadingSpinner size={18} />
        ) : layout === "page" ? (
          t("words.showingCount", {
            visible: Math.min(visibleCount, filtered.length),
            total: filtered.length,
          })
        ) : (
          t("common.wordCount", { count: filtered.length })
        )}
      </p>
      <div className="min-w-0 flex-1">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {!diceInHeader && diceButton}
      <div className="relative shrink-0" ref={sortMenuRef}>
        <button
          onClick={() => setShowSortMenu((v) => !v)}
          className={`flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors ${activeSortCount > 0 ? "text-main-400 dark:text-main-500 bg-main-50 hover:bg-main-100 dark:bg-main-950 dark:hover:bg-main-900" : "text-app-text-muted hover:text-app-text-secondary hover:bg-app-muted"}`}
        >
          <ArrowUpDown size={14} strokeWidth={2} />
          <span className="text-xs font-medium">
            {activeSortCount > 1
              ? t("common.sortWithCount", { count: activeSortCount })
              : t("common.sort")}
          </span>
        </button>
        {showSortMenu && (
          <ListSortMenuContent
            menuOpen={showSortMenu}
            mode="multi"
            sortOptions={sortOptions}
            groups={groups}
            activeSorts={activeSorts}
            onActiveSortsChange={setActiveSorts}
            showPageSize={layout === "page"}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectedJlpt={selectedJlpt}
            onToggleJlpt={toggleJlpt}
            onClearJlpt={() => setSelectedJlpt(new Set())}
          />
        )}
      </div>
      <button
        onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${selectMode ? "text-main-400 bg-main-50 dark:bg-main-950" : "text-app-text-muted hover:bg-app-muted"}`}
      >
        {selectMode ? t("common.cancel") : t("common.select")}
      </button>
    </div>
  );

  return (
    <>
      <div
        ref={headerRef}
        className={
          layout === "page"
            ? "bg-app-surface border-app-border sticky top-0 z-10 space-y-2 border-b px-4 pt-4 pb-4"
            : "space-y-2"
        }
      >
        {layout === "page" && (
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="text-app-text-muted hover:text-app-text-secondary -ml-1 flex min-w-0 items-center gap-1.5 p-1 transition-colors"
            >
              <ArrowLeft size={18} className="shrink-0" />
              {pageTitle && (
                <span className={pageTitleLabelClass(pageTitle)}>
                  {pageTitleIcon}
                  <span className="truncate">{pageTitle}</span>
                </span>
              )}
            </button>
            <div className="xs:gap-2 mr-2 ml-auto flex items-center gap-1">
              {toolbarExtra}
            </div>
            <span className="text-app-text-muted invisible p-1.5 text-sm font-medium tabular-nums">
              5
            </span>
            {diceButton}
          </div>
        )}
        {toolbarRow}
      </div>

      {isError && (
        <div className="mx-4 mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm text-red-400">
          {t("words.loadError")}
        </div>
      )}

      <div>
        {isLoading ? (
          <LoadingPlaceholder padding="lg" />
        ) : filtered.length === 0 && !isError ? (
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
            {query ? (
              <>
                <p className="text-app-border-strong mb-3 text-4xl">?</p>
                <p className="text-app-text-muted text-sm">
                  {t("common.noResultsForQuery", { query })}
                </p>
              </>
            ) : (
              <>
                <div className="text-app-border-strong mb-4 text-6xl">漢</div>
                <p className="text-app-text-muted font-medium">
                  {emptyMessage ?? t("words.empty")}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-app-surface overflow-hidden">
            {visibleWords.map((word, i) => (
              <WordCard
                key={word.id}
                word={word}
                index={i + 1}
                isOpen={openIds.has(word.id)}
                onToggle={() =>
                  setOpenIds((prev) => {
                    const n = new Set(prev);
                    n.has(word.id) ? n.delete(word.id) : n.add(word.id);
                    return n;
                  })
                }
                onUpdate={onUpdate}
                onDelete={handleDelete}
                onEdit={(w) => {
                  setEditingWord(w);
                  setShowForm(true);
                }}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(word.id, el);
                  else cardRefs.current.delete(word.id);
                }}
                selectMode={selectMode}
                isSelected={selectedIds.has(word.id)}
                onSelect={() =>
                  setSelectedIds((prev) => {
                    const n = new Set(prev);
                    n.has(word.id) ? n.delete(word.id) : n.add(word.id);
                    return n;
                  })
                }
                pinned={isPinned(word.id)}
                allWords={allWords}
              />
            ))}
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex justify-center py-8"
                aria-hidden
              >
                <LoadingSpinner size={22} />
              </div>
            )}
          </div>
        )}
      </div>

      {selectMode && (
        <div className="sm:border-app-border bg-app-surface border-app-border-strong fixed right-0 bottom-0 left-0 z-50 mx-auto flex max-w-2xl items-center gap-3 border-t px-4 py-3 sm:box-content sm:border-r-2 sm:border-l-2">
          <button
            onClick={() => setSelectedIds(new Set(orderedWords.map((w) => w.id)))}
            className="text-app-text-secondary hover:text-app-text shrink-0 text-xs transition-colors"
          >
            {t("common.selectAll")}
          </button>
          <span className="text-app-text-secondary flex-1 text-center text-sm font-medium">
            {selectedIds.size > 0
              ? t("common.selectedCount", { count: selectedIds.size })
              : t("common.selectRows")}
          </span>
          <button
            onClick={handlePinSelected}
            disabled={selectedIds.size === 0}
            className="text-main-400 bg-main-50 dark:bg-main-950 flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
          >
            <Pin size={14} />
            {t("common.pin")}
          </button>
          <button
            onClick={handleBulkAction}
            disabled={selectedIds.size === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[rgb(239,68,68)] px-3 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            <Trash2 size={14} />
            {bulkMode === "remove"
              ? (bulkRemoveLabel ?? t("themes.removeFromTheme"))
              : t("common.delete")}
          </button>
        </div>
      )}

      {showForm && editingWord && (
        <WordFormModal
          initial={editingWord}
          allWords={allWords}
          onSave={(data) => {
            onUpdate(editingWord.id, data);
            setShowForm(false);
            setEditingWord(undefined);
          }}
          onClose={() => {
            setShowForm(false);
            setEditingWord(undefined);
          }}
        />
      )}
    </>
  );
}
