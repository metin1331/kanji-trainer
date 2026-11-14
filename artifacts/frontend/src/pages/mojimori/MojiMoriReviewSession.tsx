import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowBigUpDash,
  ArrowBigDownDash,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  House,
  Info,
  Inbox,
  ListChecks,
  Save,
  SaveOff,
  ThumbsUp,
  Volume2,
  X,
  Plus,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "@/components/smoothui/toast";
import { MojiMoriLoading } from "./MojiMoriLoading";
import {
  useMojiMoriCustom,
  useMojiMoriExtra,
  useMojiMoriNotes,
  useMojiMoriReviews,
  useMojiMoriStudySettings,
  mojiMoriReviewCardsQuery,
  mojiMoriReviewResumeQuery,
  mojiMoriSubjectQuery,
  useMojiMoriSubject,
  useStudyFlush,
  type StudyGrade,
} from "../../hooks/useMojiMori";
import { checkStudyCard, predictReviewGrade } from "../../lib/mojiMoriGrade";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  applyColorScheme,
  getStoredColorScheme,
} from "../../theme/colorScheme";
import {
  blocksReadingLatin,
  readingAnswerIncomplete,
  readingInputAllows,
  romajiToKanaInput,
} from "../../lib/japaneseInput";
import {
  kanjiReadingsByKind,
  pickCharacterImage,
  type MojiMoriStudyCard,
  type MojiMoriSubjectDetail,
} from "../../lib/mojiMori";
import { MnemonicText } from "./MnemonicText";
import { ProgressSquare } from "./SubjectTile";
import type { MojiMoriSubjectSummary } from "../../lib/mojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { CompleteRouteProgress } from "./MojiRouteBar";
import {
  ComposeSubjectItem,
  LevelSubjectCard,
  StudyItem,
} from "./SubjectTile";
import { audioTracks, pickVoice, type AudioTrack } from "./mojiVoice";
import { placeDrawingLast } from "./quizOrder";
import { currentReviewBoot, releaseReviewBoot, retainReviewBoot } from "./reviewBoot";
import { KanjiReview, KanjiStrokeQuiz, WordReveal } from "./KanjiStrokeQuiz";
import { StrokeGlyphTrigger, StrokeSubjectTrigger } from "./MojiStrokeModal";
import {
  nextReviewQueue,
  rememberLapse,
  shuffleLapses,
  type LapseTask,
} from "./lapsesQueue";
import {
  beginPress,
  clearFinishedPress,
  isHolding,
  restorePresses,
  whenPressFinishes,
} from "./pressBounce";
import {
  buildPartialResumedTasks,
  buildReviewQueue,
  deleteReviewCheckpoint,
  mergeCheckpointTasks,
  openRowsFromAnsweredRecords,
  partialCheckpointTasks,
  dropReviewCheckpointTask,
  enqueueReviewPrompt,
  flushReviewOutbox,
  onReviewPromptPersisted,
  pendingReviewPrompts,
  reviewTaskKey,
  saveReviewCheckpoint,
} from "../../lib/reviewProgress";

type Prompt = "meaning" | "reading" | "word";
type Task = {
  subjectId: number;
  prompt: Prompt;
  retry: boolean;
  resumed?: boolean;
};

function sameTask(left: Task, right: Task) {
  return left.subjectId === right.subjectId && left.prompt === right.prompt;
}

function parkMiss(tasks: Task[], missed: Task): Task[] {
  const rest = tasks.slice(1);
  const again: Task = {
    subjectId: missed.subjectId,
    prompt: missed.prompt,
    retry: true,
  };
  if (rest.some((task) => sameTask(task, again))) return rest;
  const later = [...rest, again];
  const other = later.findIndex((task) => task.subjectId !== missed.subjectId);
  if (other > 0) {
    const copy = later.slice();
    const [picked] = copy.splice(other, 1);
    return picked ? [picked, ...copy] : later;
  }
  return later;
}

function queueLapse(tasks: Task[], missed: Task): Task[] {
  const rest = tasks.slice(1);
  const again: Task = {
    subjectId: missed.subjectId,
    prompt: missed.prompt,
    retry: true,
  };
  const regular = rest.filter((task) => !task.retry);
  const lapses = rest.filter((task) => task.retry);
  if (lapses.some((task) => sameTask(task, again)))
    return [...regular, ...lapses];
  return [...regular, ...lapses, again];
}
type Attempt = { answer: string; correct: boolean; reveal?: boolean };
type ItemRecord = {
  meaning?: Attempt;
  reading?: Attempt;
  word?: Attempt;
  grade?: StudyGrade;
};
type Sheet = "none" | "last" | "info" | "kana";

const KANA_PAGES: {
  id: string;
  label: string;
  cells: Array<[string, string] | null>;
}[] = [
  {
    id: "a",
    label: "あ",
    cells: [
      ["あ", "a"],
      ["ー", "—"],
      ["い", "i"],
      ["う", "u"],
      ["え", "e"],
      ["お", "o"],
    ],
  },
  {
    id: "k",
    label: "か",
    cells: [
      ["か", "ka"],
      ["き", "ki"],
      ["く", "ku"],
      ["け", "ke"],
      ["こ", "ko"],
      ["きゃ", "kya"],
      null,
      ["きゅ", "kyu"],
      null,
      ["きょ", "kyo"],
    ],
  },
  {
    id: "s",
    label: "さ",
    cells: [
      ["さ", "sa"],
      ["し", "shi"],
      ["す", "su"],
      ["せ", "se"],
      ["そ", "so"],
      ["しゃ", "sha"],
      null,
      ["しゅ", "shu"],
      null,
      ["しょ", "sho"],
    ],
  },
  {
    id: "t",
    label: "た",
    cells: [
      ["た", "ta"],
      ["ち", "chi"],
      ["つ", "tsu"],
      ["て", "te"],
      ["と", "to"],
      ["ちゃ", "cha"],
      null,
      ["ちゅ", "chu"],
      null,
      ["ちょ", "cho"],
    ],
  },
  {
    id: "n",
    label: "な",
    cells: [
      ["な", "na"],
      ["に", "ni"],
      ["ぬ", "nu"],
      ["ね", "ne"],
      ["の", "no"],
      ["にゃ", "nya"],
      null,
      ["にゅ", "nyu"],
      null,
      ["にょ", "nyo"],
    ],
  },
  {
    id: "h",
    label: "は",
    cells: [
      ["は", "ha"],
      ["ひ", "hi"],
      ["ふ", "fu"],
      ["へ", "he"],
      ["ほ", "ho"],
      ["ひゃ", "hya"],
      null,
      ["ひゅ", "hyu"],
      null,
      ["ひょ", "hyo"],
    ],
  },
  {
    id: "m",
    label: "ま",
    cells: [
      ["ま", "ma"],
      ["み", "mi"],
      ["む", "mu"],
      ["め", "me"],
      ["も", "mo"],
      ["みゃ", "mya"],
      null,
      ["みゅ", "myu"],
      null,
      ["みょ", "myo"],
    ],
  },
  {
    id: "r",
    label: "ら",
    cells: [
      ["ら", "ra"],
      ["り", "ri"],
      ["る", "ru"],
      ["れ", "re"],
      ["ろ", "ro"],
      ["りゃ", "rya"],
      null,
      ["りゅ", "ryu"],
      null,
      ["りょ", "ryo"],
    ],
  },
  {
    id: "x",
    label: "雑",
    cells: [
      ["や", "ya"],
      null,
      ["ゆ", "yu"],
      null,
      ["よ", "yo"],
      ["わ", "wa"],
      null,
      ["を", "wo"],
      ["ん", "n"],
      ["っ", "ltu"],
    ],
  },
];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const left = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = left;
  }
  return copy;
}

function stageGroup(stage: number) {
  if (stage <= 2) return "novice";
  if (stage <= 4) return "apprentice";
  if (stage <= 6) return "proficient";
  if (stage <= 8) return "adept";
  if (stage === 9) return "veteran";
  if (stage === 10) return "expert";
  if (stage === 11) return "master";
  if (stage === 12) return "grandmaster";
  return "legendary";
}

function holdCaret(input: HTMLInputElement | null) {
  const place = () => {
    if (!input || input.disabled || input.readOnly) return;
    const end = input.value.length;
    input.focus({ preventScroll: true });
    input.setSelectionRange(end, end);
  };
  place();
  requestAnimationFrame(place);
  window.setTimeout(place, 40);
}

function Glyph({
  card,
  reading,
}: {
  card: MojiMoriStudyCard;
  reading?: string;
}) {
  if (reading) return <span lang="ja">{reading}</span>;
  if (card.characters) return <span lang="ja">{card.characters}</span>;
  const src = pickCharacterImage(card.characterImages);
  if (src) return <img src={src} alt="" />;
  return <span>?</span>;
}

export function useQuizStageChrome(active: boolean, token: string) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const body = document.body;
    const apply = () => {
      const current = document.querySelector<HTMLElement>(
        ".mm-quiz__stage, .mm-lesson__stage",
      );
      if (!current) return;
      const raw = getComputedStyle(current).backgroundColor;
      const canvas = document.createElement("canvas").getContext("2d");
      let color = raw;
      if (canvas) {
        canvas.fillStyle = "#010101";
        canvas.fillStyle = raw;
        if (canvas.fillStyle && canvas.fillStyle !== "#010101")
          color = canvas.fillStyle;
      }
      document
        .querySelectorAll('meta[name="theme-color"]')
        .forEach((node) => node.remove());
      const next = document.createElement("meta");
      next.name = "theme-color";
      next.content = color;
      document.head.appendChild(next);
      root.style.backgroundColor = color;
      body.style.backgroundColor = color;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      applyColorScheme(getStoredColorScheme(), false);
    };
  }, [active, token]);
}

export function MojiMoriReviewSession({
  source = "review",
  extraMode = "recent-lessons",
  onContinue,
}: {
  source?: "review" | "extra";
  extraMode?: string;
  onContinue?: () => void;
} = {}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const reviews = useMojiMoriReviews(source === "review");
  const customMode = source === "extra" && extraMode === "custom";
  const extra = useMojiMoriExtra(extraMode, source === "extra" && !customMode);
  const custom = useMojiMoriCustom(customMode);
  const feed = source === "extra" ? (customMode ? custom : extra) : reviews;
  const studyFlush = useStudyFlush(source === "extra" ? "extra" : "review");
  const [boot] = useState(() => {
    if (source !== "review") return null;
    retainReviewBoot();
    return currentReviewBoot();
  });
  const [cards, setCards] = useState<MojiMoriStudyCard[] | null>(boot?.items ?? null);
  const [queue, setQueue] = useState<Task[]>(boot?.queue ?? []);
  const [records, setRecords] = useState<Record<number, ItemRecord>>(boot?.records ?? {});
  const recordsRef = useRef<Record<number, ItemRecord>>(boot?.records ?? {});
  const [recent, setRecent] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"ask" | "miss">("ask");
  const [missText, setMissText] = useState("");
  const [missTint, setMissTint] = useState(false);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [infoDenied, setInfoDenied] = useState(false);
  const [pending, setPending] = useState<null | "ok" | "miss">(null);
  const [wrapUp, setWrapUp] = useState(false);
  const [srsFlash, setSrsFlash] = useState<{
    stage: number;
    up: boolean;
  } | null>(null);
  const [infoWanted, setInfoWanted] = useState(false);
  const [infoStack, setInfoStack] = useState<number[]>([]);
  const methodsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    restorePresses(methodsRef.current);
  });
  const [kanaTab, setKanaTab] = useState("a");
  const [playing, setPlaying] = useState<string | null>(null);
  const [wordMethod, setWordMethod] = useState<"meaning" | "kanji">("kanji");
  const [wordHint, setWordHint] = useState(0);
  const [spellingHint, setSpellingHint] = useState(false);
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [drawn, setDrawn] = useState(0);
  const [wordBoard, setWordBoard] = useState(false);
  const [drawTry, setDrawTry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const quizRef = useRef<HTMLElement>(null);
  const deferredWrap = useRef<Task[]>([]);
  const inLapses = useRef(false);
  const lapses = useRef<LapseTask[]>([]);
  const lapseSeen = useRef(new Set<string>());
  const [lapsesOn, setLapsesOn] = useState(false);
  const [lapseTotal, setLapseTotal] = useState(0);
  const [checkpointSaved, setCheckpointSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const resumeQuery = useQuery({
    ...mojiMoriReviewResumeQuery(),
    enabled: source === "review",
  });
  const resumeRef = useRef<{
    tasks: Array<{ subjectId: number; prompt: Prompt; expectedStage: number }>;
    open: Array<{
      subjectId: number;
      prompt: string;
      answer: string;
      correct: boolean;
    }>;
  }>({ tasks: [], open: [] });
  const goRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const heard = useRef("");
  const leaving = useRef(false);
  const prefs = useMojiMoriStudySettings();
  const showSrs = prefs.data?.showSrsIndicator !== false;
  const drawingLast = prefs.data?.drawingCardsLast === true;
  const settingsReady = prefs.isFetched;
  const queryClient = useQueryClient();
  const ready = cards != null;
  const reviewResumePending = source === "review" && resumeQuery.isPending;
  const hydrating = useRef(new Set<number>());

  useEffect(() => {
    if (!boot) return;
    retainReviewBoot();
    return () => releaseReviewBoot();
  }, [boot]);

  useEffect(() => {
    if (source !== "review" || !resumeQuery.data) return;
    const data = resumeQuery.data;
    resumeRef.current = {
      tasks: (data.checkpoint?.tasks ?? []).flatMap((task) =>
        task.prompt === "meaning" || task.prompt === "reading" || task.prompt === "word"
          ? [task]
          : [],
      ),
      open: data.openPrompts,
    };
    setCheckpointSaved(false);
  }, [source, resumeQuery.data]);

  useEffect(() => {
    if (source !== "review") return;
    return onReviewPromptPersisted((item) => {
      if (
        item.prompt !== "meaning" &&
        item.prompt !== "reading" &&
        item.prompt !== "word"
      )
        return;
      void dropReviewCheckpointTask(item.subjectId, item.prompt).then(
        (result) => {
          if (result.tasks.length === 0) setCheckpointSaved(false);
        },
        () => undefined,
      );
    });
  }, [source]);

  useEffect(() => {
    if (ready || !settingsReady || reviewResumePending) return;
    if (feed.data) {
      const items = feed.data.items;
      const tasks = items.flatMap((item) =>
        item.prompts.map((prompt) => ({
          subjectId: item.id,
          prompt,
          retry: false,
        })),
      );
      if (source !== "review") {
        setCards(items);
        setQueue(extraMode === "custom" ? tasks : placeDrawingLast(shuffle(tasks), drawingLast));
        return;
      }
      const byCard = new Map(items.map((item) => [item.id, item]));
      const openKeys = new Set<string>();
      for (const item of resumeRef.current.open)
        openKeys.add(reviewTaskKey(item.subjectId, item.prompt));
      for (const item of pendingReviewPrompts())
        openKeys.add(reviewTaskKey(item.subjectId, item.prompt));
      const restoredFromCheckpoint = resumeRef.current.tasks.flatMap((task) => {
        const item = byCard.get(task.subjectId);
        if (!item?.prompts.includes(task.prompt)) return [];
        return [
          {
            subjectId: task.subjectId,
            prompt: task.prompt,
            retry: false,
            resumed: true as const,
          },
        ];
      });
      const seeded: Record<number, ItemRecord> = {};
      const remember = (
        subjectId: number,
        prompt: string,
        answer: string,
        correct: boolean,
      ) => {
        if (prompt !== "meaning" && prompt !== "reading" && prompt !== "word")
          return;
        const item = byCard.get(subjectId);
        if (!item?.prompts.includes(prompt)) return;
        const record = seeded[subjectId] ?? {};
        if (record[prompt]) return;
        record[prompt] = { answer, correct };
        seeded[subjectId] = record;
      };
      for (const item of resumeRef.current.open) {
        remember(item.subjectId, item.prompt, item.answer, item.correct);
      }
      for (const item of pendingReviewPrompts()) {
        remember(item.subjectId, item.prompt, item.answer, item.correct);
      }
      recordsRef.current = seeded;
      setRecords(seeded);
      const openRows = [
        ...resumeRef.current.open,
        ...pendingReviewPrompts().map((item) => ({
          subjectId: item.subjectId,
          prompt: item.prompt,
          answer: item.answer,
          correct: item.correct,
        })),
        ...openRowsFromAnsweredRecords(items, seeded),
      ];
      const restoredFromAutosave = buildPartialResumedTasks(items, openRows);
      const restoredKeys = new Set<string>();
      const restored: Task[] = [];
      const pushRestored = (task: Task) => {
        const key = reviewTaskKey(task.subjectId, task.prompt);
        if (openKeys.has(key) || restoredKeys.has(key)) return;
        restoredKeys.add(key);
        restored.push(task);
      };
      for (const task of restoredFromAutosave) pushRestored(task);
      for (const task of restoredFromCheckpoint) pushRestored(task);
      setCards(items);
      setQueue(
        buildReviewQueue({
          restored,
          due: tasks,
          openKeys,
          shuffle: (items) => placeDrawingLast(shuffle(items), drawingLast),
        }),
      );
      return;
    }
    if (!feed.isLoading && !feed.isFetching) {
      setCards([]);
      setQueue([]);
    }
  }, [
    ready,
    settingsReady,
    reviewResumePending,
    drawingLast,
    feed.data,
    feed.isLoading,
    feed.isFetching,
    source,
    extraMode,
  ]);

  const byId = useMemo(
    () => new Map((cards ?? []).map((card) => [card.id, card])),
    [cards],
  );

  useEffect(() => {
    if (source !== "review" || !ready) return;
    const needed: number[] = [];
    for (const task of queue) {
      if (!needed.includes(task.subjectId)) needed.push(task.subjectId);
      if (needed.length >= 2) break;
    }
    const missing = needed.filter((id) => {
      const loaded = byId.get(id);
      if (hydrating.current.has(id)) return false;
      return !loaded?.gradeKey || loaded.partial === true;
    });
    if (missing.length === 0) return;
    for (const id of missing) hydrating.current.add(id);
    void queryClient
      .fetchQuery(mojiMoriReviewCardsQuery(missing))
      .then((data) => {
        const loaded = new Map(data.items.map((item) => [item.id, item]));
        setCards((current) =>
          (current ?? []).map((item) => loaded.get(item.id) ?? item),
        );
      })
      .finally(() => {
        for (const id of missing) hydrating.current.delete(id);
      });
  }, [source, ready, queue, byId, queryClient]);
  const current = queue[0];
  const card = current ? byId.get(current.subjectId) : undefined;
  const infoOn = sheet === "info" && Boolean(card);
  const viewedId =
    infoStack.length > 0
      ? infoStack[infoStack.length - 1]!
      : (card?.id ?? null);
  const detail = useMojiMoriSubject(viewedId);
  const tracks = audioTracks(card?.pronunciationAudios);
  const queuedIds = new Set(queue.map((task) => task.subjectId));
  const reviewDone = (cards ?? []).filter(
    (item) => !queuedIds.has(item.id),
  ).length;
  const reviewTotal = cards?.length ?? 0;
  const done = lapsesOn ? Math.max(0, lapseTotal - queue.length) : reviewDone;
  const total = lapsesOn ? lapseTotal : reviewTotal;
  const asked = Object.values(records).reduce((sum, record) => {
    return (
      sum +
      (record.meaning ? 1 : 0) +
      (record.reading ? 1 : 0) +
      (record.word ? 1 : 0)
    );
  }, 0);
  const correct = Object.values(records).reduce((sum, record) => {
    return (
      sum +
      (record.meaning?.correct ? 1 : 0) +
      (record.reading?.correct ? 1 : 0) +
      (record.word?.correct ? 1 : 0)
    );
  }, 0);
  const percent = asked === 0 ? 100 : Math.round((100 * correct) / asked);

  useEffect(() => {
    const ids = [...new Set(queue.slice(0, 8).map((task) => task.subjectId))];
    for (const id of ids) {
      void queryClient.prefetchQuery(mojiMoriSubjectQuery(id));
    }
  }, [queue, queryClient]);

  useEffect(() => {
    if (!infoWanted || detail.data?.id !== card?.id) return;
    setSheet("info");
  }, [infoWanted, detail.data, card?.id]);

  useEffect(() => {
    if (mode === "ask") inputRef.current?.focus({ preventScroll: true });
    else goRef.current?.focus({ preventScroll: true });
  }, [current?.subjectId, current?.prompt, current?.retry, mode, wordMethod]);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 640px)");
    if (!narrow.matches) return;
    const root = document.documentElement;
    let typing = false;
    let frame = 0;
    let releaseTimer = 0;
    const sheetOpen = () => Boolean(document.querySelector(".mm-quiz__sheet"));
    const pin = () => {
      if (sheetOpen()) return;
      const offset = window.visualViewport?.offsetTop ?? 0;
      if (window.scrollX !== 0 || window.scrollY !== 0 || offset !== 0) {
        window.scrollTo(0, 0);
      }
      const still = window.visualViewport?.offsetTop ?? 0;
      if (still !== 0) window.scrollBy(0, -still);
      root.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    const loop = () => {
      if (sheetOpen()) {
        stop();
        return;
      }
      pin();
      if (typing) frame = window.requestAnimationFrame(loop);
    };
    const start = () => {
      if (typing) return;
      typing = true;
      root.classList.add("mm-quiz-lock");
      frame = window.requestAnimationFrame(loop);
      window.visualViewport?.addEventListener("scroll", pin);
      window.visualViewport?.addEventListener("resize", pin);
    };
    const stop = () => {
      typing = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(releaseTimer);
      root.classList.remove("mm-quiz-lock");
      window.visualViewport?.removeEventListener("scroll", pin);
      window.visualViewport?.removeEventListener("resize", pin);
      pin();
    };
    const isQuizInput = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest(".mm-quiz input"));
    const onPointerDown = (event: PointerEvent) => {
      if (!isQuizInput(event.target)) return;
      start();
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        if (!isQuizInput(document.activeElement)) stop();
      }, 500);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!isQuizInput(event.target)) return;
      stop();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusout", onFocusOut);
    const onWindowScroll = (event: Event) => {
      if (sheetOpen()) return;
      const target = event.target;
      if (target instanceof Element && target.closest(".mm-quiz")) return;
      pin();
    };
    window.addEventListener("scroll", onWindowScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      stop();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", onWindowScroll, { capture: true });
    };
  }, []);

  useLayoutEffect(() => {
    const tools = document.querySelector<HTMLElement>(".mm-quiz__tools");
    if (!tools) return;
    const root = document.documentElement;
    const place = () => {
      const rect = tools.getBoundingClientRect();
      root.style.setProperty(
        "--mm-toast-top",
        `${Math.round(rect.bottom + 8)}px`,
      );
      root.style.setProperty("--mm-toast-left", `${Math.round(rect.left)}px`);
      root.style.setProperty("--mm-toast-width", `${Math.round(rect.width)}px`);
    };
    place();
    const box = tools.closest(".mm-quiz") ?? tools;
    const observer = new ResizeObserver(place);
    observer.observe(box);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
      root.style.removeProperty("--mm-toast-top");
      root.style.removeProperty("--mm-toast-left");
      root.style.removeProperty("--mm-toast-width");
    };
  }, [card?.id, sheet, pending]);

  useQuizStageChrome(
    Boolean(card),
    `${card?.id ?? ""}:${card?.objectType ?? ""}`,
  );

  useLayoutEffect(() => {
    if (sheet !== "info") return;
    quizRef.current?.scrollTo({ top: 0 });
  }, [sheet, viewedId]);

  function shakeFor(wanted: string | null) {
    if (wanted === "meaning") return t("mojimori.study.lookingMeaning");
    if (wanted === "reading") return t("mojimori.study.lookingReading");
    return t("mojimori.study.shake", { type: wanted ?? "" });
  }

  function pulseShake() {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  }

  function kindLabel(type: string) {
    if (type === "radical") return t("mojimori.study.quizRadical");
    if (type === "kanji") return t("mojimori.study.quizKanji");
    return t("mojimori.study.quizVocabulary");
  }

  function clearCard() {
    toast.dismissNow();
    setPending(null);
    setMode("ask");
    setDraft("");
    setMissText("");
    setMissTint(false);
    setAnswerLocked(false);
    setSrsFlash(null);
    setSheet("none");
    setInfoWanted(false);
    setInfoDenied(false);
    setInfoStack([]);
    setWordMethod("kanji");
    setWordHint(0);
    setSpellingHint(false);
    setStrokeIndex(0);
    setDrawn(0);
    setWordBoard(false);
    setDrawTry(0);
  }

  function noteLapse(task: Task) {
    if (source !== "review") return;
    rememberLapse(lapseSeen.current, lapses.current, task, inLapses.current);
  }

  function persistReviewPrompt(
    item: MojiMoriStudyCard,
    prompt: Prompt,
    attempt: Attempt,
  ) {
    if (source !== "review" || inLapses.current) return;
    try {
      enqueueReviewPrompt({
        idempotencyKey: crypto.randomUUID(),
        subjectId: item.id,
        prompt,
        answer: prompt === "word" && attempt.reveal ? "\u00d7" : attempt.answer,
        correct: attempt.correct,
        expectedStage: item.srsStage ?? 0,
      });
    } catch {
      // The answer stays in this session. A later flush retries once storage accepts it.
    }
  }

  function advance(leave: "ok" | "miss" | null = pending) {
    if (leaving.current) return;
    leaving.current = true;
    queueMicrotask(() => {
      leaving.current = false;
    });
    const task = current;
    const practicing = inLapses.current;
    const requeueMiss = leave === "miss" && Boolean(task) && !practicing;
    const practice = practicing
      ? []
      : shuffleLapses(lapses.current).map((item) => ({
          ...item,
          retry: false,
        }));
    const parked =
      requeueMiss && task
        ? placeDrawingLast(
            wrapUp ? queueLapse(queue, task) : parkMiss(queue, task),
            drawingLast,
          )
        : [];
    const result = nextReviewQueue({
      tasks: queue,
      requeueMiss,
      inLapses: practicing,
      parked,
      lapses: practice,
    });
    clearCard();
    setQueue(result.tasks);
    if (result.enterLapses) {
      inLapses.current = true;
      setLapsesOn(true);
      setLapseTotal(practice.length);
      setWrapUp(false);
    }
  }

  function play(url: string) {
    const el = audioRef.current;
    if (!el) return;
    if (playing === url) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = url;
    void el.play();
    setPlaying(url);
  }

  useEffect(() => {
    const autoplay =
      source === "extra"
        ? prefs.data?.extraStudyAutoplay
        : prefs.data?.reviewsAutoplay;
    if (!autoplay || !card || card.objectType !== "vocabulary") return;
    if (!current || current.prompt !== "reading") return;
    const mark = `${card.id}:${source}`;
    if (heard.current === mark) return;
    const track = pickVoice(tracks, prefs.data?.preferredVoice ?? "random");
    if (!track || !audioRef.current) return;
    heard.current = mark;
    audioRef.current.src = track.url;
    void audioRef.current.play();
    setPlaying(track.url);
  }, [prefs.data, card, current, tracks, source]);

  function commitMiss(answer: string) {
    if (!current || !card) return;
    if (!inLapses.current) {
      const prev = recordsRef.current[card.id] ?? {};
      if (!prev[current.prompt]) {
        const attempt = { answer, correct: false };
        const next: ItemRecord = {
          ...prev,
          [current.prompt]: attempt,
        };
        persistReviewPrompt(card, current.prompt, attempt);
        const storedWord = next.word?.reveal ? "\u00d7" : next.word?.answer;
        if (card.prompts.every((prompt) => next[prompt]) && !next.grade) {
          if (source === "extra") {
            studyFlush.queue({
              subjectId: card.id,
              meaning: next.meaning?.answer,
              reading: next.reading?.answer,
              word: storedWord,
              expectedStage: card.srsStage ?? 0,
            });
          } else {
            next.grade =
              predictReviewGrade(card, {
                meaning: next.meaning?.answer,
                reading: next.reading?.answer,
                word: storedWord,
              }) ?? undefined;
          }
        }
        recordsRef.current = { ...recordsRef.current, [card.id]: next };
        setRecords(recordsRef.current);
        setRecent((list) => [card.id, ...list.filter((id) => id !== card.id)]);
        noteLapse(current);
        if (next.grade)
          setSrsFlash({ stage: next.grade.srsStage, up: next.grade.passed });
      }
    }
    setPending("miss");
    setAnswerLocked(true);
    setMissTint(true);
  }

  function dismissQuizToast() {
    toast.dismissNow();
  }

  function toggleInfo() {
    dismissQuizToast();
    if (!card || !current) return;
    const answered =
      missTint ||
      answerLocked ||
      mode === "miss" ||
      (!inLapses.current &&
        Boolean(recordsRef.current[card.id]?.[current.prompt]));
    if (!answered) {
      setInfoDenied(true);
      window.setTimeout(() => setInfoDenied(false), 1600);
      return;
    }
    setInfoDenied(false);
    if (sheet === "info") {
      setInfoWanted(false);
      setInfoStack([]);
      setSheet("none");
      return;
    }
    inputRef.current?.blur();
    if (
      missTint &&
      (inLapses.current || !recordsRef.current[card.id]?.[current.prompt])
    ) {
      commitMiss(missText);
    }
    setAnswerLocked(true);
    setInfoWanted(true);
  }

  function toggleWrap() {
    dismissQuizToast();
    if (inLapses.current) return;
    setWrapUp((on) => {
      if (!on) {
        setQueue((tasks) => {
          const [current, ...rest] = tasks;
          const keep: Task[] = [];
          const later: Task[] = [];
          rest.forEach((task) => {
            if (recordsRef.current[task.subjectId]) keep.push(task);
            else later.push(task);
          });
          deferredWrap.current = later;
          const regular = keep.filter((task) => !task.retry);
          const lapses = keep.filter((task) => task.retry);
          const next = current
            ? [current, ...regular, ...lapses]
            : [...regular, ...lapses];
          const [head, ...tail] = next;
          return head ? [head, ...placeDrawingLast(tail, drawingLast)] : next;
        });
      } else {
        const later = deferredWrap.current;
        deferredWrap.current = [];
        setQueue((tasks) => {
          const next = [...tasks, ...later];
          const [head, ...rest] = next;
          return head ? [head, ...placeDrawingLast(rest, drawingLast)] : next;
        });
      }
      return !on;
    });
  }

  function submitAnswer(word?: {
    answer: string;
    method: "meaning" | "kanji";
    reveal?: boolean;
  }) {
    if (!current || !card) return;
    if (!card.gradeKey) return;
    if (pending) {
      advance();
      return;
    }
    const raw = (word?.answer ?? draft).trim();
    if (!raw) {
      pulseShake();
      holdCaret(inputRef.current);
      return;
    }
    const submitted =
      current.prompt === "reading" ? romajiToKanaInput(raw) : raw;
    if (current.prompt === "reading" && readingAnswerIncomplete(submitted)) {
      setDraft(submitted);
      pulseShake();
      holdCaret(inputRef.current);
      return;
    }
    const gradedWord = word?.reveal ? "\u00d7" : submitted;
    const checked = checkStudyCard(
      card,
      current.prompt,
      gradedWord,
      word?.method ?? "meaning",
    );
    if (checked.homophone) {
      toast(t("mojimori.study.homophone"));
      if (word?.method === "kanji") {
        setStrokeIndex(0);
        setDrawn(0);
        setWordBoard(false);
        setDrawTry((value) => value + 1);
      } else {
        pulseShake();
        holdCaret(inputRef.current);
      }
      return;
    }
    if (checked.shake) {
      if (checked.exception === "radicalMeaning") {
        toast(t("mojimori.study.wantKanjiMeaning"));
      } else if (checked.exception === "kanjiReading") {
        toast(t("mojimori.study.wantVocabReading"));
      } else if (checked.exception === "unusualSpelling") {
        toast(t("mojimori.study.unusualSpelling"));
      } else if (checked.enteredType && checked.wantedType) {
        const readingName = (kind: string) =>
          kind === "onyomi" || kind === "kunyomi" || kind === "nanori"
            ? t(`mojimori.${kind}`)
            : kind;
        toast(
          t("mojimori.study.readingType", {
            answer: submitted,
            entered: readingName(checked.enteredType),
            wanted: readingName(checked.wantedType),
          }),
        );
      } else toast(shakeFor(checked.wantedType));
      pulseShake();
      holdCaret(inputRef.current);
      return;
    }
    if (!checked.correct && !word?.reveal) {
      if (missTint && submitted === missText) {
        commitMiss(submitted);
        advance("miss");
        return;
      }
      if (current.prompt !== "meaning") {
        toast(
          current.prompt === "word"
            ? t("mojimori.study.helpWord")
            : t("mojimori.study.helpReading"),
        );
      }
      setMissText(submitted);
      setDraft(submitted);
      setMissTint(true);
      setInfoDenied(false);
      holdCaret(inputRef.current);
      return;
    }
    const prev = recordsRef.current[card.id] ?? {};
    const first = !inLapses.current && !prev[current.prompt];
    const next: ItemRecord = { ...prev };
    if (first) {
      next[current.prompt] = {
        answer: submitted,
        correct: checked.correct,
        reveal: word?.reveal,
      };
      persistReviewPrompt(card, current.prompt, next[current.prompt]!);
      if (!checked.correct) noteLapse(current);
    }
    const storedWord = next.word?.reveal ? "\u00d7" : next.word?.answer;
    if (first && card.prompts.every((prompt) => next[prompt]) && !next.grade) {
      if (source === "extra") {
        studyFlush.queue({
          subjectId: card.id,
          meaning: next.meaning?.answer,
          reading: next.reading?.answer,
          word: storedWord,
          expectedStage: card.srsStage ?? 0,
        });
      } else {
        next.grade =
          predictReviewGrade(card, {
            meaning: next.meaning?.answer,
            reading: next.reading?.answer,
            word: storedWord,
          }) ?? undefined;
      }
    }
    recordsRef.current = { ...recordsRef.current, [card.id]: next };
    setRecords(recordsRef.current);
    setRecent((list) => [card.id, ...list.filter((id) => id !== card.id)]);
    if (!checked.correct) {
      if (current.prompt !== "meaning") {
        toast(
          current.prompt === "word"
            ? t("mojimori.study.helpWord")
            : t("mojimori.study.helpReading"),
        );
      }
      setMissText(submitted);
      setMissTint(true);
      setAnswerLocked(true);
      setMode("miss");
      setPending("miss");
      setInfoDenied(false);
      if (next.grade)
        setSrsFlash({ stage: next.grade.srsStage, up: next.grade.passed });
      return;
    }
    if (first && checked.lenient && current.prompt !== "reading") {
      toast(t("mojimori.study.helpMeaning"));
    } else if (
      first &&
      current.prompt === "meaning" &&
      checked.multipleMeanings
    ) {
      toast(t("mojimori.study.multipleMeanings"));
    }
    if (first && current.prompt === "reading" && checked.multipleReadings) {
      toast(t("mojimori.study.multipleReadings"));
    }
    if (next.grade && first) {
      setSrsFlash({ stage: next.grade.srsStage, up: next.grade.passed });
    }
    setPending("ok");
  }

  useEffect(() => {
    if (
      !ready ||
      reviewResumePending ||
      queue.length > 0 ||
      (cards?.length ?? 0) === 0
    )
      return;
    if (source === "review") {
      void flushReviewOutbox()
        .then(() => deleteReviewCheckpoint())
        .then(() => {
          setCheckpointSaved(false);
          return queryClient.invalidateQueries({ queryKey: ["mojimori"] });
        })
        .catch(() => toast(t("mojimori.study.saveFailed")));
      return;
    }
    void studyFlush.flush().catch(() => toast(t("mojimori.study.saveFailed")));
  }, [
    ready,
    reviewResumePending,
    queue.length,
    cards,
    studyFlush,
    source,
    t,
    queryClient,
  ]);

  function goHome(event: { preventDefault: () => void }) {
    event.preventDefault();
    const flush =
      source === "review" ? flushReviewOutbox() : studyFlush.flush();
    void flush.then(
      () => {
        if (source === "review")
          void queryClient.invalidateQueries({ queryKey: ["mojimori"] });
        setLocation("/mojimori");
      },
      () => toast(t("mojimori.study.saveFailed")),
    );
  }

  function continueSession() {
    if (!onContinue) return;
    const flush = source === "review" ? flushReviewOutbox() : studyFlush.flush();
    void flush.finally(() => onContinue());
  }

  function finishHome() {
    if (source !== "review") {
      void studyFlush
        .flush()
        .catch(() => toast(t("mojimori.study.saveFailed")));
      setLocation("/mojimori");
      return;
    }
    void flushReviewOutbox().then(
      () => setLocation("/mojimori"),
      () => toast(t("mojimori.study.saveFailed")),
    );
  }

  async function toggleCheckpoint() {
    if (source !== "review" || saving) return;
    setSaving(true);
    try {
      if (checkpointSaved) {
        await deleteReviewCheckpoint();
        setCheckpointSaved(false);
        toast(t("mojimori.study.progressCancelled"));
        return;
      }
      if (inLapses.current || queue.length === 0) return;
      await flushReviewOutbox();
      const items = cards ?? [];
      const openRows = [
        ...resumeRef.current.open,
        ...pendingReviewPrompts().map((item) => ({
          subjectId: item.subjectId,
          prompt: item.prompt,
          answer: item.answer,
          correct: item.correct,
        })),
        ...openRowsFromAnsweredRecords(items, recordsRef.current),
      ];
      const queued = queue.map((task) => ({
        subjectId: task.subjectId,
        prompt: task.prompt,
        expectedStage: byId.get(task.subjectId)?.srsStage ?? 0,
      }));
      const tasks = mergeCheckpointTasks(
        partialCheckpointTasks(items, openRows),
        queued,
      );
      const saved = await saveReviewCheckpoint(tasks);
      setCheckpointSaved(saved.tasks.length > 0);
      if (saved.tasks.length > 0) toast(t("mojimori.study.progressSaved"));
    } catch {
      toast(t("mojimori.study.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (event.key === "Enter" && pending) {
        if (typing && event.target !== inputRef.current) return;
        event.preventDefault();
        advance();
        return;
      }
      if (typing) return;
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleInfo();
      } else if (event.key === ",") {
        event.preventDefault();
        dismissQuizToast();
        setSheet((open) => (open === "last" ? "none" : "last"));
      } else if (event.key === "/") {
        event.preventDefault();
        dismissQuizToast();
        setSheet((open) => (open === "kana" ? "none" : "kana"));
      } else if (
        (event.key === "j" || event.key === "J") &&
        current?.prompt === "reading" &&
        tracks[0]
      ) {
        event.preventDefault();
        play(tracks[0].url);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (source !== "review" && cards == null && settingsReady && feed.data) {
    const items = feed.data.items;
    const tasks = items.flatMap((item) =>
      item.prompts.map((prompt) => ({
        subjectId: item.id,
        prompt,
        retry: false,
      })),
    );
    setCards(items);
    setQueue(extraMode === "custom" ? tasks : placeDrawingLast(shuffle(tasks), drawingLast));
  }

  const page = (() => {
    const headNeedsCard =
      source === "review" && Boolean(current) && !card?.gradeKey;
    if (
      feed.isLoading ||
      !settingsReady ||
      !ready ||
      reviewResumePending ||
      (headNeedsCard && !boot)
    )
      return <MojiMoriLoading />;
    if (headNeedsCard) return null;
    if (!card || !current) {
      if (source === "review" && total > 0) {
        return (
          <ReviewCompletePanel
            cards={cards ?? []}
            records={records}
            asked={asked}
            correct={correct}
            percent={percent}
            onHome={finishHome}
            onContinue={onContinue ? continueSession : undefined}
            title={t("mojimori.study.reviewsDone")}
          />
        );
      }
      return (
        <section className="glass-panel mm-quiz__done">
          <h1>
            {total === 0
              ? t(extraMode === "custom" ? "mojimori.study.customEmpty" : "mojimori.study.empty")
              : t(
                  source === "extra"
                    ? "mojimori.study.extraDone"
                    : "mojimori.study.reviewsDone",
                )}
          </h1>
          {total > 0 ? (
            <p className="mm-quiz__results">
              <span className="mm-quiz__results-ok">
                {t("mojimori.study.correctTotal", { count: correct })}
              </span>
              <span className="mm-quiz__results-bad">
                {t("mojimori.study.incorrectTotal", { count: asked - correct })}
              </span>
            </p>
          ) : null}
          <button
            type="button"
            className="moji-btn-primary"
            onClick={finishHome}
          >
            {t("mojimori.study.returnHome")}
          </button>
        </section>
      );
    }
    const promptWord =
      current.prompt === "meaning"
        ? t("mojimori.study.meaningWord")
        : current.prompt === "word"
          ? t("mojimori.study.wordWord")
          : t("mojimori.study.readingWord");
    const wordKanji = card.wordKanji ?? [];
    const showBoard =
      current.prompt === "word" &&
      wordMethod === "kanji" &&
      wordKanji.length > 0 &&
      (wordBoard || (mode === "ask" && pending == null));
    const showWordMeaning =
      current.prompt === "word" && wordMethod === "kanji" && wordHint > 0;
    const showWordSpelling =
      current.prompt === "word" && wordMethod === "meaning" && spellingHint;
    const audioEnabled = current.prompt === "reading" && tracks.length > 0;
    const infoAnswered =
      missTint ||
      answerLocked ||
      mode === "miss" ||
      (!lapsesOn && Boolean(records[card.id]?.[current.prompt]));
    const wrapCount = new Set(
      queue
        .filter((task) => records[task.subjectId])
        .map((task) => task.subjectId),
    ).size;
    return (
      <section
        ref={quizRef}
        className={`mm-quiz ${wrapUp ? "is-wrapping" : ""}`}
        data-kind={card.objectType}
      >
        <div className="mm-quiz__meter" aria-hidden="true">
          <span
            style={{ width: total === 0 ? "0%" : `${(done / total) * 100}%` }}
          />
        </div>
        <header className="mm-quiz__stage" data-kind={card.objectType}>
          <div className="mm-quiz__stage-bar">
            <div className="mm-quiz__stage-tools">
              <button
                type="button"
                className="mm-quiz__home"
                title={t("mojimori.study.returnHome")}
                aria-label={t("mojimori.study.returnHome")}
                onClick={goHome}
              >
                <House size={18} />
              </button>
              {source === "review" ? (
                <button
                  type="button"
                  className="mm-quiz__home"
                  title={
                    checkpointSaved
                      ? t("mojimori.study.cancelSavedProgress")
                      : t("mojimori.study.saveProgress")
                  }
                  aria-label={
                    checkpointSaved
                      ? t("mojimori.study.cancelSavedProgress")
                      : t("mojimori.study.saveProgress")
                  }
                  aria-pressed={checkpointSaved}
                  disabled={saving || (lapsesOn && !checkpointSaved)}
                  onClick={() => void toggleCheckpoint()}
                >
                  {checkpointSaved ? <SaveOff size={18} /> : <Save size={18} />}
                </button>
              ) : null}
            </div>
            <div className="mm-quiz__stats">
              <span title={t("mojimori.study.percentTitle")}>
                <ThumbsUp size={15} />
                {percent}%
              </span>
              <span title={t("mojimori.study.completedTitle")}>
                <Check size={15} />
                {done}
              </span>
              <span title={t("mojimori.study.remainingTitle")}>
                <Inbox size={15} />
                {Math.max(0, total - done)}
              </span>
            </div>
          </div>
          <StrokeGlyphTrigger
            card={card}
            className={`mm-quiz__glyph ${current.prompt === "word" ? "is-word" : ""}`}
          >
            {source === "extra" ? (
              <p className="mm-quiz__mode">
                {extraMode === "recent-mistakes"
                  ? t("mojimori.study.extraRecentMistakes")
                  : extraMode === "cooked"
                    ? t("mojimori.study.extraLegendary")
                    : t("mojimori.study.extraRecentLessons")}
              </p>
            ) : null}
            <Glyph
              card={card}
              reading={
                current.prompt === "word" ? card.wordReading || "…" : undefined
              }
            />
            {showWordMeaning && card.wordMeaning ? (
              <p className="mm-quiz__word-meaning">{card.wordMeaning}</p>
            ) : null}
            {showWordSpelling && card.characters ? (
              <p className="mm-quiz__word-spelling" lang="ja">
                {card.characters}
              </p>
            ) : null}
          </StrokeGlyphTrigger>
          <div className="mm-quiz__stage-footer">
            <AnimatePresence>
              {showSrs && srsFlash ? (
                <motion.span
                  key={`${srsFlash.up ? "up" : "down"}-${srsFlash.stage}`}
                  className={`mm-quiz__srs ${srsFlash.up ? "is-up" : "is-down"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  {srsFlash.up ? (
                    <ArrowBigUpDash size={16} />
                  ) : (
                    <ArrowBigDownDash size={16} />
                  )}
                  {t(`mojimori.srs.${stageGroup(srsFlash.stage)}`)}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </header>

        <div
          className={`mm-quiz__ask-container ${lapsesOn ? "is-lapses" : ""}${current.resumed && !lapsesOn ? "is-resumed" : ""}`}
        >
          {current.resumed && !lapsesOn ? (
            <p className="mm-quiz__resumed">{t("mojimori.study.resumed")}</p>
          ) : null}
          {lapsesOn ? (
            <p className="mm-quiz__lapses">
              <span>{t("mojimori.study.lapses")}</span>
              <button
                type="button"
                aria-label={t("mojimori.study.lapsesInfo")}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "mouse") return;
                  toast(t("mojimori.study.lapsesInfo"));
                }}
                onClick={(event) => {
                  event.preventDefault();
                  const finePointer = window.matchMedia(
                    "(hover: hover) and (pointer: fine)",
                  ).matches;
                  if (finePointer && event.detail !== 0) return;
                  toast(t("mojimori.study.lapsesInfo"));
                }}
              >
                <Info size={14} />
              </button>
            </p>
          ) : null}
          <p className="mm-quiz__ask" data-kind={card.objectType}>
            <span>{kindLabel(card.objectType)}</span>
            <span>{promptWord}</span>
          </p>
        </div>
        <form
          className="mm-quiz__form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer();
          }}
        >
          {current.prompt === "word" && mode === "ask" && !pending ? (
            <div
              ref={methodsRef}
              className="mm-word__methods"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const button = (event.target as HTMLElement).closest("button");
                if (!button || button.disabled) return;
                beginPress(button, event.pointerId);
              }}
              onAnimationEnd={(event: AnimationEvent<HTMLDivElement>) => {
                const target = event.target;
                if (
                  !(target instanceof HTMLElement) ||
                  event.animationName !== "mm-press" ||
                  isHolding(target)
                )
                  return;
                clearFinishedPress(target);
              }}
            >
              <button
                type="button"
                className={wordMethod === "meaning" ? "is-on" : undefined}
                disabled={wordHint > 0}
                onClick={() => setWordMethod("meaning")}
              >
                {t("mojimori.study.wordMeaningMethod")}
              </button>
              <button
                type="button"
                className={wordMethod === "kanji" ? "is-on" : undefined}
                disabled={wordKanji.length === 0 || spellingHint}
                onClick={() => setWordMethod("kanji")}
              >
                {t("mojimori.study.wordDrawMethod")}
              </button>
              {wordMethod === "meaning" || wordHint < 1 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    const button = event.currentTarget;
                    whenPressFinishes(button, () => {
                      if (wordMethod === "meaning") {
                        setSpellingHint(true);
                        return;
                      }
                      setWordHint(1);
                    });
                  }}
                >
                  {wordMethod === "meaning"
                    ? t("mojimori.study.wordHint")
                    : t("mojimori.study.wordHint1")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    const button = event.currentTarget;
                    whenPressFinishes(button, () => {
                      if (wordBoard || !card) return;
                      setWordBoard(true);
                      submitAnswer({
                        answer: card.characters || wordKanji.join(""),
                        method: "kanji",
                        reveal: true,
                      });
                    });
                  }}
                >
                  {t("mojimori.study.wordHint2")}
                </button>
              )}
            </div>
          ) : null}
          {showBoard ? (
            <div className="mm-word">
              {wordBoard ? (
                <WordReveal
                  characters={card.characters || wordKanji.join("")}
                  kanji={wordKanji}
                  advanceLabel={t("mojimori.study.next")}
                  onAdvance={advance}
                />
              ) : (
                <>
                  <div className="mm-word__steps">
                    {wordKanji.map((_, index) => (
                      <span key={index}>
                        {index > 0 ? <span>/</span> : null}
                        <button
                          type="button"
                          className={index === strokeIndex ? "is-on" : ""}
                          disabled={index > drawn}
                          onClick={() => setStrokeIndex(index)}
                        >
                          {index + 1}
                        </button>
                      </span>
                    ))}
                  </div>
                  {strokeIndex < drawn ? (
                    <KanjiReview
                      key={`${card.id}-done-${strokeIndex}`}
                      character={wordKanji[strokeIndex] ?? ""}
                    />
                  ) : (
                    <KanjiStrokeQuiz
                      key={`${card.id}-${strokeIndex}-${drawTry}`}
                      character={wordKanji[strokeIndex] ?? ""}
                      unsupported={t("mojimori.study.wordUnsupported")}
                      onDone={() => {
                        const next = strokeIndex + 1;
                        setDrawn(next);
                        if (next >= wordKanji.length) {
                          setWordBoard(true);
                          submitAnswer({
                            answer: wordKanji.join(""),
                            method: "kanji",
                          });
                          return;
                        }
                        setStrokeIndex(next);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <div
              className={`mm-quiz__entry ${shaking ? "is-shaking" : ""}${pending === "ok" ? "is-ok" : ""}${missTint ? "is-bad" : ""}`}
              onAnimationEnd={() => setShaking(false)}
            >
              {mode === "miss" && answerLocked ? (
                <p className="mm-quiz__wrong">{missText}</p>
              ) : (
                <input
                  ref={inputRef}
                  value={draft}
                  placeholder={t("mojimori.study.yourResponse")}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={pending === "ok" || answerLocked}
                  onKeyDown={(event) => {
                    if (current.prompt !== "reading") return;
                    if (
                      event.ctrlKey ||
                      event.metaKey ||
                      event.altKey ||
                      event.nativeEvent.isComposing
                    )
                      return;
                    const el = event.currentTarget;
                    if (
                      blocksReadingLatin(
                        draft,
                        event.key,
                        el.selectionStart ?? draft.length,
                        el.selectionEnd ?? draft.length,
                      )
                    ) {
                      event.preventDefault();
                      pulseShake();
                    }
                  }}
                  onChange={(event) => {
                    if (answerLocked) return;
                    const value = event.target.value;
                    const next =
                      current.prompt === "reading"
                        ? romajiToKanaInput(value)
                        : value;
                    if (
                      current.prompt === "reading" &&
                      !readingInputAllows(next)
                    ) {
                      pulseShake();
                      return;
                    }
                    if (missTint && next !== missText) setMissTint(false);
                    setDraft(next);
                  }}
                />
              )}
              <button
                ref={goRef}
                type="submit"
                className="mm-quiz__go"
                aria-label={t("mojimori.study.check")}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </form>
        <div className="mm-quiz__tools">
          <button
            type="button"
            className={`mm-quiz__tool ${wrapUp ? "is-on mm-quiz__tool--count" : ""}`}
            disabled={lapsesOn}
            onClick={() => {
              dismissQuizToast();
              toggleWrap();
            }}
          >
            <span>{t("mojimori.study.wrapUp")}</span>
            <Clock size={16} />
            {wrapUp ? <i>{wrapCount}</i> : null}
          </button>
          <button
            type="button"
            className={`mm-quiz__tool ${sheet === "last" ? "is-on" : ""}`}
            onClick={() => {
              dismissQuizToast();
              setSheet((open) => (open === "last" ? "none" : "last"));
            }}
          >
            <span>{t("mojimori.study.lastAnswers")}</span>
            <ListChecks size={16} />
          </button>
          <span className="mm-quiz__tool-wrap">
            <button
              type="button"
              className={`mm-quiz__tool ${sheet === "info" ? "is-on" : ""}${infoAnswered ? "" : "is-locked"}`}
              onClick={toggleInfo}
            >
              <span>{t("mojimori.study.itemInfo")}</span>
              <Eye size={16} />
            </button>
            {infoDenied && mode !== "miss" ? (
              <em className="mm-quiz__tool-note">
                {t("mojimori.study.infoLocked")}
              </em>
            ) : null}
          </span>
          <button
            type="button"
            className={`mm-quiz__tool ${sheet === "kana" ? "is-on" : ""}`}
            onClick={() => {
              dismissQuizToast();
              setSheet((open) => (open === "kana" ? "none" : "kana"));
            }}
          >
            <span>{t("mojimori.study.kanaChart")}</span>
            <b lang="ja">ひ</b>
          </button>
          <button
            type="button"
            className="mm-quiz__tool mm-quiz__tool--icon"
            disabled={!audioEnabled}
            title={t("mojimori.playAudio")}
            onClick={() => {
              dismissQuizToast();
              const track = pickVoice(
                tracks,
                prefs.data?.preferredVoice ?? "random",
              );
              if (track) play(track.url);
            }}
          >
            <Volume2 size={16} />
          </button>
        </div>
        {missTint || mode === "miss" ? (
          <p className="mm-quiz__help">
            {current.prompt === "word"
              ? t("mojimori.study.helpWord")
              : current.prompt === "reading"
                ? t("mojimori.study.helpReading")
                : t("mojimori.study.incorrect")}
          </p>
        ) : null}
        {sheet !== "none" ? (
          <div className="mm-quiz__sheet">
            {sheet === "last" ? (
              <LastAnswers cards={byId} recent={recent} records={records} />
            ) : null}
            {infoOn && detail.data ? (
              <>
                {infoStack.length > 0 ? (
                  <button
                    type="button"
                    className="moji-btn mm-quiz__back"
                    onClick={() => setInfoStack((stack) => stack.slice(0, -1))}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    <span>{t("mojimori.study.detailBack")}</span>
                  </button>
                ) : null}
                <ReviewInfo
                  key={`${detail.data.id}-${infoStack.length === 0 ? current.prompt : "browse"}`}
                  detail={detail.data}
                  prompt={infoStack.length === 0 ? current.prompt : "meaning"}
                  playing={playing}
                  onPlay={play}
                  showHeadline={infoStack.length > 0}
                  onOpen={(subject) =>
                    setInfoStack((stack) =>
                      stack[stack.length - 1] === subject.id
                        ? stack
                        : [...stack, subject.id],
                    )
                  }
                />
              </>
            ) : null}
            {sheet === "kana" ? (
              <KanaPad
                tab={kanaTab}
                onTab={setKanaTab}
                onInsert={(kana) => {
                  if (answerLocked) return;
                  setMissTint(false);
                  setDraft((value) => value + kana);
                  inputRef.current?.focus({ preventScroll: true });
                }}
                onBackspace={() => {
                  if (answerLocked) return;
                  setMissTint(false);
                  setDraft((value) => [...value].slice(0, -1).join(""));
                  inputRef.current?.focus({ preventScroll: true });
                }}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    );
  })();

  return (
    <MojiMoriLayout showHeader={false}>
      <div className="mm-quiz-page">
        {feed.isError ? (
          <section className="glass-panel p-6 text-sm">
            {feed.error.message}
          </section>
        ) : (
          page
        )}
        <audio ref={audioRef} onEnded={() => setPlaying(null)} />
      </div>
    </MojiMoriLayout>
  );
}

export function studyCardToSummary(card: MojiMoriStudyCard): MojiMoriSubjectSummary {
  const primaryMeaning =
    card.wordMeaning ??
    card.meanings?.find((item) => item.primary)?.meaning ??
    "";
  const primaryReading =
    card.wordReading ??
    card.readings?.find((item) => item.primary)?.reading ??
    "";
  return {
    id: card.id,
    objectType: card.objectType,
    level: card.level,
    slug: String(card.id),
    characters: card.characters,
    primaryMeaning,
    primaryReading,
    characterImages: card.characterImages,
    lessonPosition: 0,
    progress: {
      status: "review",
      srsStage: card.srsStage ?? 1,
      passed: false,
    },
  };
}

function reviewOutcome(record: ItemRecord, prompts: readonly Prompt[]) {
  const answered = prompts.filter((prompt) => record[prompt]);
  if (answered.length === 0) return null;
  const ok = answered.every((prompt) => record[prompt]?.correct === true);
  return ok ? "correct" : "incorrect";
}

export function ReviewCompletePanel({
  cards,
  records,
  asked,
  correct,
  percent,
  onHome,
  onContinue,
  title,
}: {
  cards: MojiMoriStudyCard[];
  records: Record<number, ItemRecord>;
  asked: number;
  correct: number;
  percent: number;
  onHome: () => void;
  onContinue?: () => void;
  title: string;
}) {
  const { t } = useTranslation();
  const [sheetOn, setSheetOn] = useState(false);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const wrongPercent =
    asked === 0 ? 0 : Math.round((100 * (asked - correct)) / asked);
  const byId = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const tiles = useMemo(
    () =>
      Object.keys(records)
        .map(Number)
        .flatMap((id) => {
          const card = byId.get(id);
          const record = records[id];
          if (!card || !record) return [];
          const outcome = reviewOutcome(record, card.prompts);
          if (!outcome) return [];
          return [{ id, card, outcome }];
        }),
    [byId, records],
  );

  useEffect(() => {
    if (!sheetOn || phase !== "closed") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [sheetOn, phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => {
      setSheetOn(false);
      setPhase("closed");
    }, 440);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function openAnswers() {
    setSheetOn(true);
    if (phase !== "closed") setPhase("open");
  }

  function closeAnswers() {
    if (!sheetOn || phase === "closing") return;
    setPhase("closing");
  }

  return (
    <section className="glass-panel level-progress review-complete">
      <CompleteRouteProgress />
      <div className="review-complete__inner p-6 sm:p-8">
        <h1 className="review-complete__title">{title}</h1>
        <div className="review-complete__stats">
          <article className="level-type-card review-complete__stat p-3 text-left">
            <p className="review-complete__stat-label">
              {t("mojimori.study.correctRate")}
            </p>
            <p className="review-complete__stat-value is-ok">{percent}%</p>
            <p className="review-complete__stat-sub">
              {t("mojimori.study.correctTotal", { count: correct })}
            </p>
          </article>
          <article className="level-type-card review-complete__stat p-3 text-left">
            <p className="review-complete__stat-label">
              {t("mojimori.study.incorrectRate")}
            </p>
            <p className="review-complete__stat-value is-bad">
              {wrongPercent}%
            </p>
            <p className="review-complete__stat-sub">
              {t("mojimori.study.incorrectTotal", { count: asked - correct })}
            </p>
          </article>
        </div>
        <div className="review-complete__bar" aria-hidden="true">
          <span
            className="review-complete__bar-ok"
            style={{ width: `${percent}%` }}
          />
          <span
            className="review-complete__bar-bad"
            style={{ width: `${wrongPercent}%` }}
          />
        </div>
        <div className="review-complete__actions">
          <div className="review-complete__pair">
            <button type="button" className="moji-btn" onClick={openAnswers}>
              {t("mojimori.study.answers")}
            </button>
            {onContinue ? (
              <button type="button" className="moji-btn-primary" onClick={onContinue}>
                {t("common.continue")}
              </button>
            ) : null}
          </div>
          <button type="button" className="moji-btn-primary" onClick={onHome}>
            {t("mojimori.study.returnHome")}
          </button>
        </div>
      </div>
      {sheetOn ? (
        <div
          className={`level-sheet p-5 sm:p-6 ${phase === "open" ? "is-open" : ""}`}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <button type="button" className="moji-btn" onClick={closeAnswers}>
              <ChevronLeft size={14} />
              {t("mojimori.back")}
            </button>
            <span className="text-base font-semibold">
              {t("mojimori.study.answers")}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="review-complete__answers flex flex-wrap justify-center gap-x-3.5 gap-y-2">
              {tiles.map(({ id, card, outcome }) => (
                <div
                  key={id}
                  className={`level-subject-card review-complete__card flex w-max max-w-full flex-col items-center px-2 py-3 text-center review-complete__card--${outcome}`}
                >
                  <ProgressSquare
                    subject={studyCardToSummary(card)}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LastAnswers({
  cards,
  recent,
  records,
}: {
  cards: Map<number, MojiMoriStudyCard>;
  recent: number[];
  records: Record<number, ItemRecord>;
}) {
  const { t } = useTranslation();
  if (recent.length === 0) {
    return <p className="mm-quiz__empty">{t("mojimori.study.lastEmpty")}</p>;
  }
  return (
    <ul className="last-answers">
      {recent.map((id) => {
        const card = cards.get(id);
        const record = records[id];
        if (!card || !record) return null;
        const kind =
          card.objectType === "radical" || card.objectType === "kanji"
            ? card.objectType
            : "vocabulary";
        return (
          <li key={id} className="last-answers__list-item" data-item={id}>
            <span className="last-answer">
              <span
                className={`last-answer__characters last-answer__characters--${kind}`}
                lang="ja"
                data-characters=""
              >
                <Glyph card={card} />
              </span>
              <span className="last-answer__content">
                {record.meaning ? (
                  <AnswerList
                    attempt={record.meaning}
                    className={`last-answer__meanings ${
                      record.reading || record.word
                        ? "last-answer__meanings--with-divider"
                        : ""
                    }`}
                  />
                ) : null}
                {record.reading ? (
                  <AnswerList
                    attempt={record.reading}
                    className="last-answer__readings"
                    kana
                  />
                ) : null}
                {record.word ? (
                  <AnswerList
                    attempt={record.word}
                    className="last-answer__words"
                  />
                ) : null}
              </span>
              {record.grade ? (
                <div
                  className="last-answer__srs"
                  data-srs=""
                  data-went-up={record.grade.passed ? "true" : "false"}
                >
                  <div className="last-answer__srs-value" data-srs-value="">
                    {t(`mojimori.srs.${stageGroup(record.grade.srsStage)}`)}
                  </div>
                  <div className="last-answer__srs-icon" data-srs-icon="">
                    {record.grade.passed ? (
                      <ArrowBigUpDash size={16} aria-hidden="true" />
                    ) : (
                      <ArrowBigDownDash size={16} aria-hidden="true" />
                    )}
                  </div>
                </div>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AnswerList({
  attempt,
  className,
  kana = false,
}: {
  attempt: Attempt;
  className: string;
  kana?: boolean;
}) {
  return (
    <ul className={className} lang={kana ? "ja" : undefined}>
      <li
        className={`last-answer__answer last-answer__answer--${
          attempt.correct ? "correct" : "incorrect"
        }`}
        data-answer-item=""
      >
        <span className="last-answer__value" data-value="">
          {attempt.answer}
        </span>
        <span className="last-answer__icon" data-icon="">
          {attempt.correct ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <X size={14} aria-hidden="true" />
          )}
        </span>
      </li>
    </ul>
  );
}

export function ReviewInfo({
  detail,
  prompt,
  playing,
  onPlay,
  onOpen,
  showHeadline = false,
}: {
  detail: MojiMoriSubjectDetail;
  prompt: Prompt;
  playing: string | null;
  onPlay: (url: string) => void;
  onOpen: (
    subject: MojiMoriSubjectDetail["related"]["components"][number],
  ) => void;
  /** Subject tile + meaning above the folds when browsing nested items in quiz info. */
  showHeadline?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState({
    radicals: prompt === "meaning" && detail.objectType === "kanji",
    meaning: prompt === "meaning" || prompt === "word",
    reading: prompt === "reading" || prompt === "word",
    context:
      (prompt === "meaning" || prompt === "word") &&
      detail.objectType === "vocabulary",
    parts: false,
    found: false,
    similar: false,
  });
  const primary =
    detail.meanings.find((item) => item.primary)?.meaning ??
    detail.primaryMeaning;
  const alternatives = detail.meanings.filter(
    (item) => item.acceptedAnswer && !item.primary,
  );
  const tracks = audioTracks(detail.pronunciationAudios);
  const readings = kanjiReadingsByKind(detail.readings);
  const storyLabel =
    detail.objectType === "vocabulary"
      ? t("mojimori.study.explanation")
      : t("mojimori.study.mnemonic");
  function toggle(key: keyof typeof open) {
    setOpen((current) => ({ ...current, [key]: !current[key] }));
  }
  function readingText(items: { reading: string }[]) {
    return items.length > 0
      ? items.map((item) => item.reading).join(", ")
      : t("mojimori.study.noReading");
  }
  return (
    <div className="mm-quiz__info">
      {showHeadline ? (
        <div className="mm-quiz__info-head subject-hero">
          <StrokeSubjectTrigger
            characters={detail.characters}
            objectType={detail.objectType}
            className="is-inline"
          >
            <StudyItem subject={detail} />
          </StrokeSubjectTrigger>
          <div className="subject-hero__copy">
            <p className="subject-hero__title">{detail.primaryMeaning}</p>
            {detail.objectType !== "radical" && detail.primaryReading ? (
              <p className="mm-quiz__info-reading" lang="ja">
                {detail.primaryReading}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {detail.objectType === "kanji" && detail.related.components.length > 0 ? (
        <Fold
          title={t("mojimori.radicalCombination")}
          open={open.radicals}
          onToggle={() => toggle("radicals")}
        >
          <div className="mm-compose">
            {detail.related.components.map((subject, index) => (
              <>
                <ComposeSubjectItem
                  key={subject.id}
                  subject={subject}
                  onOpen={onOpen}
                  reading={false}
                />
                {detail.related.components.length > 1 &&
                index !== detail.related.components.length - 1 ? (
                  <div className="mm-compose__plus" key={`plus-${subject.id}`}>
                    <span>
                      <Plus size={16} />
                    </span>
                  </div>
                ) : null}
              </>
            ))}
          </div>
        </Fold>
      ) : null}
      <Fold
        title={t("mojimori.meaning")}
        open={open.meaning}
        onToggle={() => toggle("meaning")}
      >
        <Fact label={t("mojimori.primary")} value={primary} />
        {alternatives.length > 0 ? (
          <Fact
            label={t("mojimori.study.alternative")}
            value={alternatives.map((item) => item.meaning).join(", ")}
          />
        ) : null}
        {detail.partsOfSpeech.length > 0 ? (
          <Fact
            label={t("mojimori.wordType")}
            value={detail.partsOfSpeech.join(", ")}
          />
        ) : null}
        <h3>{storyLabel}</h3>
        <MnemonicText text={detail.meaningMnemonic} />
        {detail.objectType === "radical" && detail.mnemonicImageUrl ? (
          <img
            className="moji-mnemonic-image"
            src={detail.mnemonicImageUrl}
            alt=""
          />
        ) : null}
        <Hint text={detail.meaningHint} />
        <NoteBox detail={detail} field="meaning" />
      </Fold>
      {detail.objectType !== "radical" ? (
        <Fold
          title={
            detail.objectType === "kanji"
              ? t("mojimori.readings")
              : t("mojimori.study.readingTitle")
          }
          open={open.reading}
          onToggle={() => toggle("reading")}
        >
          {detail.objectType === "kanji" ? (
            <div className="mm-vocab-readings">
              <ReadingGroup
                title={t("mojimori.onyomi")}
                value={readingText(readings.onyomi)}
                taught={readings.onyomi.some((item) => item.primary)}
              />
              <ReadingGroup
                title={t("mojimori.kunyomi")}
                value={readingText(readings.kunyomi)}
                taught={readings.kunyomi.some((item) => item.primary)}
              />
              <ReadingGroup
                title={t("mojimori.nanori")}
                value={readingText(readings.nanori)}
                taught={readings.nanori.some((item) => item.primary)}
              />
            </div>
          ) : (
            <VocabReadings
              detail={detail}
              tracks={tracks}
              playing={playing}
              onPlay={onPlay}
            />
          )}
          {detail.objectType === "kanji" && tracks.length > 0 ? (
            <ul className="mm-quiz__voices">
              {tracks.map((track) => (
                <li key={track.url}>
                  <button
                    type="button"
                    onClick={() => onPlay(track.url)}
                    aria-pressed={playing === track.url}
                  >
                    <Volume2 size={16} />
                  </button>
                  <span>
                    <strong>{track.name}</strong>
                    {track.description ? (
                      <small>{track.description}</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <h3>{storyLabel}</h3>
          <MnemonicText text={detail.readingMnemonic} />
          <Hint text={detail.readingHint} />
          <NoteBox detail={detail} field="reading" />
        </Fold>
      ) : null}
      {detail.objectType === "vocabulary" &&
      detail.contextSentences.length > 0 ? (
        <Fold
          title={t("mojimori.context")}
          open={open.context}
          onToggle={() => toggle("context")}
        >
          <h3>{t("mojimori.study.contextSentences")}</h3>
          <div className="mm-quiz__sentences">
            {detail.contextSentences.map((sentence, index) => (
              <p key={index}>
                <span lang="ja">{sentence.ja}</span>
                <small>{sentence.en}</small>
              </p>
            ))}
          </div>
        </Fold>
      ) : null}
      {detail.objectType === "vocabulary" &&
      detail.related.components.length > 0 ? (
        <Fold
          title={t("mojimori.kanjiComposition")}
          open={open.parts}
          onToggle={() => toggle("parts")}
        >
           <div className="mm-compose">
                {detail.related.components.map((subject, index) => (
                  <>
                    <ComposeSubjectItem
                      key={subject.id}
                      subject={subject}
                      onOpen={onOpen}
                    />
                    {index !== detail.related.components.length - 1 ? (
                      <div className="mm-compose__plus" key={`plus-${subject.id}`}>
                        <span>
                          <Plus size={16} />
                        </span>
                      </div>
                    ) : null}
                  </>
                ))}
              </div>
        </Fold>
      ) : null}
      {detail.objectType === "kanji" &&
      detail.related.amalgamations.length > 0 ? (
        <Fold
          title={t("mojimori.foundInVocabulary")}
          open={open.found}
          onToggle={() => toggle("found")}
        >
          <div className="flex flex-wrap gap-3">
            {detail.related.amalgamations.map((subject) => (
              <LevelSubjectCard
                key={subject.id}
                subject={subject}
                caption
                showBar={false}
                onOpen={onOpen}
              />
            ))}
          </div>
        </Fold>
      ) : null}
      {detail.objectType === "radical" &&
      detail.related.amalgamations.length > 0 ? (
        <Fold
          title={t("mojimori.foundInKanji")}
          open={open.found}
          onToggle={() => toggle("found")}
        >
          <div className="mm-compose">
            {detail.related.amalgamations.map((subject) => (
              <LevelSubjectCard key={subject.id} subject={subject} showBar={false} onOpen={onOpen} />
            ))}
          </div>
        </Fold>
      ) : null}
      {detail.related.visuallySimilar.length > 0 ? (
        <Fold
          title={t("mojimori.visuallySimilar")}
          open={open.similar}
          onToggle={() => toggle("similar")}
        >
          <div className="flex flex-wrap gap-3">
            {detail.related.visuallySimilar.map((subject) => (
              <LevelSubjectCard
                key={subject.id}
                subject={subject}
                caption
                showBar={false}
                onOpen={onOpen}
              />
            ))}
          </div>
        </Fold>
      ) : null}
    </div>
  );
}

function VocabReadings({
  detail,
  tracks,
  playing,
  onPlay,
}: {
  detail: MojiMoriSubjectDetail;
  tracks: AudioTrack[];
  playing: string | null;
  onPlay: (url: string) => void;
}) {
  const accepted = detail.readings.filter((item) => item.acceptedAnswer);
  const readings =
    accepted.length > 0 ? accepted : [{ reading: detail.primaryReading }];
  return (
    <div className="mm-vocab-readings">
      {readings.map((item) => {
        const matched = tracks.filter(
          (track) => track.pronunciation === item.reading,
        );
        const voices =
          matched.length > 0 || readings.length > 1 ? matched : tracks;
        return (
          <div key={item.reading} className="mm-vocab-reading">
            <p lang="ja">{item.reading}</p>
            {voices.length > 0 ? (
              <ul className="mm-quiz__voices">
                {voices.map((track) => (
                  <li key={track.url}>
                    <button
                      type="button"
                      onClick={() => onPlay(track.url)}
                      aria-pressed={playing === track.url}
                    >
                      <Volume2 size={16} />
                    </button>
                    <span>
                      <strong>{track.name}</strong>
                      {track.description ? (
                        <small>{track.description}</small>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ReadingGroup({
  title,
  value,
  taught,
}: {
  title: string;
  value: string;
  taught: boolean;
}) {
  return (
    <div className={`mm-vocab-reading ${taught ? "is-taught" : ""}`}>
      <p lang="ja">{value}</p>
      <span>{title}</span>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  const { t } = useTranslation();
  if (!text) return null;
  return (
    <aside className="mm-quiz__hint">
      <strong>{t("mojimori.hints")}</strong>
      <MnemonicText text={text} />
    </aside>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p className="mm-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function Fold({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`mm-fold ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="mm-fold__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronRight size={16} />
      </button>
      {open ? <div className="mm-fold__body">{children}</div> : null}
    </section>
  );
}

function NoteBox({
  detail,
  field,
}: {
  detail: MojiMoriSubjectDetail;
  field: "meaning" | "reading";
}) {
  const { t } = useTranslation();
  const save = useMojiMoriNotes();
  const meaningNote = detail.progress?.meaningNote ?? "";
  const readingNote = detail.progress?.readingNote ?? "";
  const current = field === "meaning" ? meaningNote : readingNote;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  return (
    <div className="mm-quiz__note">
      <h3>
        {t(
          field === "meaning"
            ? "mojimori.study.meaningNote"
            : "mojimori.study.readingNote",
        )}
      </h3>
      {editing ? (
        <>
          <textarea
            className="moji-field"
            rows={3}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="button"
            className="moji-btn"
            disabled={save.isPending}
            onClick={() => {
              const nextMeaning = field === "meaning" ? value : meaningNote;
              const nextReading = field === "reading" ? value : readingNote;
              save.mutate(
                {
                  id: detail.id,
                  meaningNote: nextMeaning,
                  readingNote: nextReading,
                },
                { onSuccess: () => setEditing(false) },
              );
            }}
          >
            {t("mojimori.study.saveNotes")}
          </button>
        </>
      ) : current ? (
        <button
          type="button"
          className="mm-quiz__note-text"
          onClick={() => setEditing(true)}
        >
          {current}
        </button>
      ) : (
        <button
          type="button"
          className="moji-btn"
          onClick={() => setEditing(true)}
        >
          {t("mojimori.study.addNote")}
        </button>
      )}
    </div>
  );
}

export function KanaPad({
  tab,
  onTab,
  onInsert,
  onBackspace,
}: {
  tab: string;
  onTab: (id: string) => void;
  onInsert: (kana: string) => void;
  onBackspace: () => void;
}) {
  const { t } = useTranslation();
  const page = KANA_PAGES.find((item) => item.id === tab) ?? KANA_PAGES[0]!;
  return (
    <div className="mm-kana">
      <div className="mm-kana__tabs">
        {KANA_PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            lang="ja"
            className={item.id === page.id ? "is-on" : ""}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" onClick={onBackspace}>
          {t("mojimori.study.backspace")}
        </button>
      </div>
      <div className="mm-kana__grid">
        {page.cells.map((cell, index) =>
          cell ? (
            <button
              key={cell[0]}
              type="button"
              onClick={() => onInsert(cell[0])}
            >
              <span lang="ja">{cell[0]}</span>
              <small>{cell[1]}</small>
            </button>
          ) : (
            <span key={`gap-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}
