import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Trash2,
  ArrowUpDown,
  Dices,
  Pin,
} from "lucide-react";
import { useLocation } from "wouter";
import { useWords } from "../hooks/useWords";
import { Word, WordUpdate } from "../types";
import { LevelChart } from "../components/LevelChart";
import {
  RelatedWordsList,
  RelatedWordsButton,
} from "../components/RelatedWordsList";
import { SearchBar } from "../components/SearchBar";
import { ListSortMenuContent } from "../components/ListSortMenuContent";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { LoadingPlaceholder } from "../components/LoadingPlaceholder";
import { filterWords, filterByJlptLevels } from "../utils/filterWords";
import { clusterByKanji } from "../utils/kanjiCluster";
import { startStudy } from "../store/studyStore";
import { useTranslation } from "../i18n/I18nProvider";
import { useConfirm } from "../components/ConfirmProvider";
import { useJlptFilter } from "../hooks/useJlptFilter";
import { usePinnedWords } from "../hooks/usePinnedWords";
import { partitionPinnedWords } from "../lib/pinnedWords";
import {
  getSingleSortListPrefs,
  saveSingleSortListPrefs,
} from "../lib/listPreferences";

type SortMode =
  | "level-asc"
  | "level-desc"
  | "date-asc"
  | "date-desc"
  | "jlpt-asc"
  | "jlpt-desc"
  | "kanji-cluster";
type SortGroup = "jlptOrder" | "level" | "date" | "kanji";

const JLPT_RANK: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
function jlptRank(w: Word): number {
  return w.jlptLevel ? (JLPT_RANK[w.jlptLevel] ?? 99) : 99;
}

function sortWords(words: Word[], sort: SortMode): Word[] {
  const arr = [...words];
  if (sort === "jlpt-asc")
    return arr.sort(
      (a, b) => jlptRank(a) - jlptRank(b) || a.pronLevel - b.pronLevel,
    );
  if (sort === "jlpt-desc")
    return arr.sort(
      (a, b) => jlptRank(b) - jlptRank(a) || a.pronLevel - b.pronLevel,
    );
  if (sort === "level-asc")
    return arr.sort(
      (a, b) =>
        a.pronLevel - b.pronLevel ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  if (sort === "level-desc")
    return arr.sort(
      (a, b) =>
        b.pronLevel - a.pronLevel ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  if (sort === "date-asc")
    return arr.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  if (sort === "date-desc")
    return arr.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  if (sort === "kanji-cluster") return clusterByKanji(arr);
  return arr;
}

function PronCard({
  word,
  index,
  isOpen,
  onToggle,
  onUpdate,
  selectMode,
  isSelected,
  onSelect,
  pinned = false,
  cardRef,
  allWords,
}: {
  word: Word;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (id: number, patch: WordUpdate) => void;
  selectMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  pinned?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
  allWords?: Word[];
}) {
  const { t } = useTranslation();
  const [showRelated, setShowRelated] = useState(false);
  useEffect(() => {
    if (!isOpen) setShowRelated(false);
  }, [isOpen]);

  return (
    <div ref={cardRef} className="border-app-border border-b last:border-b-0">
      <div
        className={`flex cursor-pointer items-center gap-2.5 px-4 py-3 select-none ${pinned ? "bg-main-50/50 dark:bg-main-950/50" : ""}`}
        onClick={selectMode ? onSelect : onToggle}
      >
        {selectMode ? (
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-main-500 bg-main-500" : "border-app-border-strong bg-transparent"}`}
          >
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4L4 7L9 1"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        ) : (
          <span className="text-app-text-muted w-5 shrink-0 text-right text-sm font-medium tabular-nums">
            {index}
          </span>
        )}
        <LevelChart
          level={word.pronLevel}
          starred={word.pronStarred}
          onChangeLevel={(l) =>
            !selectMode && onUpdate(word.id, { pronLevel: l })
          }
          onToggleStar={() =>
            !selectMode &&
            onUpdate(word.id, { pronStarred: !word.pronStarred })
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-app-text truncate text-base leading-none font-semibold">
            {word.pronunciation || (
              <span className="text-app-text-muted text-sm font-normal italic">
                {t("common.noPronunciation")}
              </span>
            )}
          </p>
        </div>
        {word.jlptLevel && !selectMode && (
          <span className="bg-app-muted text-app-text-secondary shrink-0 rounded-md px-1.5 py-[3px] text-[10px] leading-none font-semibold">
            {word.jlptLevel}
          </span>
        )}
      </div>
      {!selectMode && (
        <div className={`word-detail ${isOpen ? "open" : ""}`}>
          <div className="space-y-2 px-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {!showRelated && word.kanji && (
                  <p className="text-app-text text-2xl font-bold">
                    {word.kanji}
                  </p>
                )}
                {!showRelated && word.meaning && (
                  <p className="text-app-text-secondary mt-0.5 text-sm">
                    {word.meaning}
                  </p>
                )}
              </div>
              {word.meaning && allWords && (
                <RelatedWordsButton
                  active={showRelated}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRelated((v) => !v);
                  }}
                />
              )}
            </div>
            {showRelated && word.meaning && allWords ? (
              <RelatedWordsList word={word} allWords={allWords} />
            ) : (
              word.description && (
                <div className="border-app-border border-t pt-1.5">
                  <p className="text-app-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                    {word.description}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PronunciationPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [, navigate] = useLocation();
  const { words, isLoading, updateWord, deleteWords } = useWords();

  const sortOptions: { value: SortMode; label: string; group: SortGroup }[] = [
    { value: "jlpt-asc", label: t("words.sort.jlptAsc"), group: "jlptOrder" },
    { value: "jlpt-desc", label: t("words.sort.jlptDesc"), group: "jlptOrder" },
    { value: "level-asc", label: t("words.sort.levelAsc"), group: "level" },
    { value: "level-desc", label: t("words.sort.levelDesc"), group: "level" },
    { value: "date-asc", label: t("words.sort.dateAsc"), group: "date" },
    { value: "date-desc", label: t("words.sort.dateDesc"), group: "date" },
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
  const prefsScope = "pronunciation";
  const defaultPrefs = {
    query: "",
    sort: "level-asc" as SortMode,
    jlptLevels: [] as string[],
  };
  const savedPrefs = getSingleSortListPrefs(prefsScope, defaultPrefs);

  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState(savedPrefs.query);
  const [sort, setSort] = useState<SortMode>(savedPrefs.sort);
  const { selectedJlpt, toggleJlpt, clearJlpt } = useJlptFilter(
    savedPrefs.jlptLevels ?? [],
  );
  const { pinnedIds, togglePinMany, isPinned, ready: pinReady } =
    usePinnedWords(prefsScope);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const headerRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    saveSingleSortListPrefs(prefsScope, {
      query,
      sort,
      jlptLevels: [...selectedJlpt],
    });
  }, [prefsScope, query, sort, selectedJlpt]);

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

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handlePinSelected() {
    if (selectedIds.size === 0) return;
    togglePinMany(Array.from(selectedIds));
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (
      !(await confirm(
        t("common.confirmBulkDelete", { count: selectedIds.size }),
      ))
    )
      return;
    await deleteWords(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  const nonStarred = words.filter((w) => !w.pronStarred);
  const displayed = filterWords(
    partitionPinnedWords(
      filterByJlptLevels(sortWords(nonStarred, sort), selectedJlpt),
      pinReady ? pinnedIds : new Set(),
    ),
    query,
  );

  return (
    <div className="bg-app-surface min-h-dvh">
      <div className="sm:border-app-border mx-auto max-w-2xl pb-8 sm:box-content sm:border-r-2 sm:border-l-2">
        <div
          ref={headerRef}
          className="bg-app-surface border-app-border sticky top-0 z-10 space-y-2 border-b px-4 pt-4 pb-4"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="text-app-text-muted hover:text-app-text-secondary -ml-1 flex items-center gap-1.5 p-1 transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-main-400 dark:text-main-500 text-[11px] font-semibold tracking-widest uppercase">
                {t("nav.pronunciation")}
              </span>
            </button>
            <button
              onClick={() => {
                if (displayed.length === 0) return;
                startStudy(
                  displayed,
                  "okunuş",
                  t("nav.pronunciation"),
                  "/pronunciation",
                );
                navigate("/study");
              }}
              disabled={displayed.length === 0}
              className="text-app-text-muted hover:bg-app-muted rounded-lg p-1.5 transition-colors disabled:opacity-30"
            >
              <Dices size={17} strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-app-text-muted flex min-w-[1.25rem] shrink-0 items-center justify-center text-sm">
              {isLoading ? (
                <LoadingSpinner size={18} />
              ) : (
                t("common.wordCount", { count: displayed.length })
              )}
            </p>
            <div className="flex-1">
              <SearchBar value={query} onChange={setQuery} />
            </div>

            <div className="relative shrink-0" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="text-main-400 dark:text-main-500 bg-main-50 hover:bg-main-100 dark:bg-main-950 dark:hover:bg-main-900 flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors"
              >
                <ArrowUpDown size={14} strokeWidth={2} />
                <span className="text-xs font-medium">{t("common.sort")}</span>
              </button>
              {showSortMenu && (
                <ListSortMenuContent
                  menuOpen={showSortMenu}
                  mode="single"
                  sortOptions={sortOptions}
                  groups={groups}
                  sort={sort}
                  onSortSelect={(value) => {
                    setSort(value);
                    setShowSortMenu(false);
                  }}
                  selectedJlpt={selectedJlpt}
                  onToggleJlpt={toggleJlpt}
                  onClearJlpt={clearJlpt}
                />
              )}
            </div>

            <button
              onClick={() =>
                selectMode ? exitSelectMode() : setSelectMode(true)
              }
              className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${selectMode ? "text-main-400 bg-main-50 dark:bg-main-950" : "text-app-text-muted hover:bg-app-muted"}`}
            >
              {selectMode ? t("common.cancel") : t("common.select")}
            </button>
          </div>
        </div>

        <div>
          {isLoading ? (
            <LoadingPlaceholder padding="lg" />
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              {query ? (
                <p className="text-app-text-muted text-sm">
                  {t("common.noResultsForQuery", { query })}
                </p>
              ) : (
                <p className="text-app-text-muted">{t("words.empty")}</p>
              )}
            </div>
          ) : (
            <div className="bg-app-surface overflow-hidden">
              {displayed.map((word, i) => (
                <PronCard
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
                  onUpdate={updateWord}
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
                  cardRef={(el) => {
                    if (el) cardRefs.current.set(word.id, el);
                    else cardRefs.current.delete(word.id);
                  }}
                  allWords={words}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectMode && (
        <div className="sm:border-app-border bg-app-surface border-app-border-strong fixed right-0 bottom-0 left-0 z-50 mx-auto flex max-w-2xl items-center gap-3 border-t px-4 py-3 sm:box-content sm:border-r-2 sm:border-l-2">
          <button
            onClick={() => setSelectedIds(new Set(displayed.map((w) => w.id)))}
            className="text-app-text-secondary shrink-0 text-xs"
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
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "rgb(239,68,68)" }}
          >
            <Trash2 size={14} />
            {t("common.delete")}
          </button>
        </div>
      )}
    </div>
  );
}
