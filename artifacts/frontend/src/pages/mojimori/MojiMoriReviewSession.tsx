import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowBigUpDash,
  ArrowBigDownDash,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  House,
  Inbox,
  ThumbsUp,
  Volume2,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "@/components/smoothui/toast";
import { MojiMoriLoading } from "./MojiMoriLoading";
import {
  useMojiMoriExtra,
  useMojiMoriNotes,
  useMojiMoriReviews,
  useMojiMoriStudySettings,
  mojiMoriSubjectQuery,
  useMojiMoriSubject,
  useStudyFlush,
  type StudyGrade,
} from "../../hooks/useMojiMori";
import { checkStudyCard, predictReviewGrade } from "../../lib/mojiMoriGrade";
import { useTranslation } from "../../i18n/I18nProvider";
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
import { MojiMoriLayout } from "./MojiMoriLayout";
import { SubjectTile, SubjectTileGrid } from "./SubjectTile";
import { audioTracks, pickVoice } from "./mojiVoice";
import { KanjiStrokeQuiz } from "./KanjiStrokeQuiz";

type Prompt = "meaning" | "reading" | "word";
type Task = { subjectId: number; prompt: Prompt; retry: boolean };

function parkMiss(tasks: Task[], missed: Task): Task[] {
  const rest = tasks.slice(1);
  const again: Task = {
    subjectId: missed.subjectId,
    prompt: missed.prompt,
    retry: true,
  };
  const later = [...rest, again];
  const other = later.findIndex((task) => task.subjectId !== missed.subjectId);
  if (other > 0) {
    const copy = later.slice();
    const [picked] = copy.splice(other, 1);
    return picked ? [picked, ...copy] : later;
  }
  return later;
}
type Attempt = { answer: string; correct: boolean };
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
      ["ー", "-"],
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

function Glyph({ card, reading }: { card: MojiMoriStudyCard; reading?: string }) {
  if (reading) return <span lang="ja">{reading}</span>;
  if (card.characters) return <span lang="ja">{card.characters}</span>;
  const src = pickCharacterImage(card.characterImages);
  if (src) return <img src={src} alt="" />;
  return <span>?</span>;
}

export function MojiMoriReviewSession({
  source = "review",
  extraMode = "recent-lessons",
}: {
  source?: "review" | "extra";
  extraMode?: string;
} = {}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const reviews = useMojiMoriReviews(source === "review");
  const extra = useMojiMoriExtra(extraMode, source === "extra");
  const feed = source === "extra" ? extra : reviews;
  const studyFlush = useStudyFlush(source === "extra" ? "extra" : "review");
  const [cards, setCards] = useState<MojiMoriStudyCard[] | null>(null);
  const [queue, setQueue] = useState<Task[]>([]);
  const [records, setRecords] = useState<Record<number, ItemRecord>>({});
  const recordsRef = useRef<Record<number, ItemRecord>>({});
  const [recent, setRecent] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"ask" | "miss">("ask");
  const [missText, setMissText] = useState("");
  const [notice, setNotice] = useState("");
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
  const [kanaTab, setKanaTab] = useState("a");
  const [playing, setPlaying] = useState<string | null>(null);
  const [wordMethod, setWordMethod] = useState<"meaning" | "kanji">("kanji");
  const [wordHint, setWordHint] = useState(false);
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [drawTry, setDrawTry] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const heard = useRef("");
  const leaving = useRef(false);
  const prefs = useMojiMoriStudySettings();
  const showSrs = prefs.data?.showSrsIndicator !== false;
  const queryClient = useQueryClient();
  const ready = cards != null;

  useEffect(() => {
    if (ready) return;
    if (feed.data) {
      const items = feed.data.items;
      const tasks = items.flatMap((item) =>
        item.prompts.map((prompt) => ({
          subjectId: item.id,
          prompt,
          retry: false,
        })),
      );
      setCards(items);
      setQueue(shuffle(tasks));
      return;
    }
    if (!feed.isLoading && !feed.isFetching) {
      setCards([]);
      setQueue([]);
    }
  }, [ready, feed.data, feed.isLoading, feed.isFetching]);

  const byId = useMemo(
    () => new Map((cards ?? []).map((card) => [card.id, card])),
    [cards],
  );
  const current = queue[0];
  const card = current ? byId.get(current.subjectId) : undefined;
  const infoOn = sheet === "info" && Boolean(card);
  const detail = useMojiMoriSubject(card?.id ?? null);
  const tracks = audioTracks(card?.pronunciationAudios);
  const queuedIds = new Set(queue.map((task) => task.subjectId));
  const done = (cards ?? []).filter((item) => !queuedIds.has(item.id)).length;
  const total = cards?.length ?? 0;
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
    const pin = () => {
      const offset = window.visualViewport?.offsetTop ?? 0;
      if (window.scrollX !== 0 || window.scrollY !== 0 || offset !== 0) {
        window.scrollTo(0, 0);
      }
      const still = window.visualViewport?.offsetTop ?? 0;
      if (still !== 0) window.scrollBy(0, -still);
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      const scroller = document.querySelector(".moji-mori.is-bare > main");
      if (scroller instanceof HTMLElement && scroller.scrollTop !== 0) {
        scroller.scrollTop = 0;
      }
    };
    const loop = () => {
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
      target instanceof HTMLElement && Boolean(target.closest(".mm-quiz input"));
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
    window.addEventListener("scroll", pin, { capture: true, passive: true });
    return () => {
      stop();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", pin, { capture: true });
    };
  }, []);

  useLayoutEffect(() => {
    const tools = document.querySelector<HTMLElement>(".mm-quiz__tools");
    if (!tools) return;
    const root = document.documentElement;
    const place = () => {
      const rect = tools.getBoundingClientRect();
      root.style.setProperty("--mm-toast-top", `${Math.round(rect.bottom + 8)}px`);
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
  }, [card?.id, sheet, pending, notice]);

  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".mm-quiz__stage");
    if (!stage) return;
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.backgroundColor;
    const previousBody = body.style.backgroundColor;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const previousTheme = created ? null : meta.getAttribute("content");
    const apply = () => {
      const current = document.querySelector<HTMLElement>(".mm-quiz__stage");
      if (!current || !meta) return;
      const raw = getComputedStyle(current).backgroundColor;
      const canvas = document.createElement("canvas").getContext("2d");
      let color = raw;
      if (canvas) {
        canvas.fillStyle = "#010101";
        canvas.fillStyle = raw;
        if (canvas.fillStyle && canvas.fillStyle !== "#010101") color = canvas.fillStyle;
      }
      meta.setAttribute("content", color);
      root.style.backgroundColor = color;
      body.style.backgroundColor = color;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      root.style.backgroundColor = previousRoot;
      body.style.backgroundColor = previousBody;
      if (!meta) return;
      if (created) meta.remove();
      else if (previousTheme == null) meta.removeAttribute("content");
      else meta.setAttribute("content", previousTheme);
    };
  }, [card?.id, card?.objectType]);

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
    setPending(null);
    setMode("ask");
    setDraft("");
    setNotice("");
    setMissText("");
    setSrsFlash(null);
    setSheet("none");
    setInfoWanted(false);
    setInfoDenied(false);
    setWordMethod("kanji");
    setWordHint(false);
    setStrokeIndex(0);
    setDrawTry(0);
  }

  function advance() {
    if (leaving.current) return;
    leaving.current = true;
    queueMicrotask(() => {
      leaving.current = false;
    });
    const task = current;
    const leave = pending;
    clearCard();
    if (leave === "miss" && task) {
      setQueue((tasks) => parkMiss(tasks, task));
      return;
    }
    setQueue((tasks) => tasks.slice(1));
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
    const track = pickVoice(tracks, prefs.data.preferredVoice);
    if (!track || !audioRef.current) return;
    heard.current = mark;
    audioRef.current.src = track.url;
    void audioRef.current.play();
    setPlaying(track.url);
  }, [prefs.data, card, current, tracks, source]);

  function toggleInfo() {
    if (!card || !current) return;
    const answered =
      mode === "miss" || Boolean(recordsRef.current[card.id]?.[current.prompt]);
    if (!answered) {
      setInfoDenied(true);
      window.setTimeout(() => setInfoDenied(false), 1600);
      return;
    }
    setInfoDenied(false);
    if (sheet === "info") {
      setInfoWanted(false);
      setSheet("none");
      return;
    }
    setInfoWanted(true);
  }

  function toggleWrap() {
    setWrapUp((on) => {
      if (!on) {
        setQueue((tasks) =>
          tasks.filter(
            (task, index) => index === 0 || recordsRef.current[task.subjectId],
          ),
        );
      }
      return !on;
    });
  }

  function submitAnswer(word?: { answer: string; method: "meaning" | "kanji" }) {
    if (!current || !card) return;
    if (pending) {
      advance();
      return;
    }
    const raw = (word?.answer ?? draft).trim();
    if (!raw) return;
    const submitted =
      current.prompt === "reading" ? romajiToKanaInput(raw) : raw;
    if (current.prompt === "reading" && readingAnswerIncomplete(submitted)) {
      setDraft(submitted);
      pulseShake();
      holdCaret(inputRef.current);
      return;
    }
    setNotice("");
    const checked = checkStudyCard(
      card,
      current.prompt,
      submitted,
      word?.method ?? "meaning",
    );
    if (checked.homophone) {
      toast(t("mojimori.study.homophone"));
      if (word?.method === "kanji") {
        setStrokeIndex(0);
        setDrawTry((value) => value + 1);
      } else {
        pulseShake();
        holdCaret(inputRef.current);
      }
      return;
    }
    if (checked.shake) {
      if (checked.exception === "kanjiReading") {
        toast(t("mojimori.study.wantVocabReading"));
        setNotice("");
      } else if (checked.exception === "unusualSpelling") {
        toast(t("mojimori.study.unusualSpelling"));
        setNotice("");
      } else setNotice(shakeFor(checked.wantedType));
      pulseShake();
      holdCaret(inputRef.current);
      return;
    }
    const prev = recordsRef.current[card.id] ?? {};
    const first = !prev[current.prompt];
    const next: ItemRecord = { ...prev };
    if (first) next[current.prompt] = { answer: submitted, correct: checked.correct };
    if (first && card.prompts.every((prompt) => next[prompt]) && !next.grade) {
      studyFlush.queue({
        subjectId: card.id,
        meaning: next.meaning?.answer,
        reading: next.reading?.answer,
        word: next.word?.answer,
        expectedStage: card.srsStage ?? 0,
      });
      if (source !== "extra") {
        next.grade =
          predictReviewGrade(card, {
            meaning: next.meaning?.answer,
            reading: next.reading?.answer,
            word: next.word?.answer,
          }) ?? undefined;
      }
    }
    recordsRef.current = { ...recordsRef.current, [card.id]: next };
    setRecords(recordsRef.current);
    setRecent((list) => [card.id, ...list.filter((id) => id !== card.id)]);
    if (!checked.correct) {
      toast(
        current.prompt === "word"
          ? t("mojimori.study.helpWord")
          : current.prompt === "reading"
            ? t("mojimori.study.helpReading")
            : t("mojimori.study.helpMeaning"),
      );
      setMissText(submitted);
      setMode("miss");
      setPending("miss");
      setInfoWanted(true);
      setInfoDenied(false);
      if (next.grade) setSrsFlash({ stage: next.grade.srsStage, up: next.grade.passed });
      return;
    }
    if (first && checked.lenient && current.prompt !== "reading") {
      toast(t("mojimori.study.helpMeaning"));
    } else if (first && current.prompt === "meaning" && checked.multipleMeanings) {
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
    if (!ready || queue.length > 0 || (cards?.length ?? 0) === 0) return;
    void studyFlush.flush().catch(() => toast(t("mojimori.study.saveFailed")));
  }, [ready, queue.length, cards, studyFlush, t]);

  function goHome(event: { preventDefault: () => void }) {
    event.preventDefault();
    void studyFlush.flush().then(
      () => setLocation("/mojimori"),
      () => toast(t("mojimori.study.saveFailed")),
    );
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
        setSheet((open) => (open === "last" ? "none" : "last"));
      } else if (event.key === "/") {
        event.preventDefault();
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

  if (cards == null && feed.data) {
    const items = feed.data.items;
    const tasks = items.flatMap((item) =>
      item.prompts.map((prompt) => ({
        subjectId: item.id,
        prompt,
        retry: false,
      })),
    );
    setCards(items);
    setQueue(shuffle(tasks));
  }

  const page = (() => {
    if (feed.isLoading || !ready) return <MojiMoriLoading />;
    if (!card || !current) {
      return (
        <section className="glass-panel mm-quiz__done">
          <h1>
            {total === 0
              ? t("mojimori.study.empty")
              : t(
                  source === "extra"
                    ? "mojimori.study.extraDone"
                    : "mojimori.study.reviewsDone",
                )}
          </h1>
          <Link href="/mojimori" className="moji-btn-primary" onClick={goHome}>
            {t("mojimori.study.returnHome")}
          </Link>
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
    const wordDraw =
      current.prompt === "word" &&
      wordMethod === "kanji" &&
      mode === "ask" &&
      pending == null &&
      wordKanji.length > 0;
    const showWordMeaning = current.prompt === "word" && wordHint;
    const audioEnabled = current.prompt === "reading" && tracks.length > 0;
    const infoAnswered =
      mode === "miss" || Boolean(records[card.id]?.[current.prompt]);
    const wrapCount = new Set(
      queue
        .filter((task) => records[task.subjectId])
        .map((task) => task.subjectId),
    ).size;
    return (
      <section className="mm-quiz" data-kind={card.objectType}>
        <div className="mm-quiz__meter" aria-hidden="true">
          <span
            style={{ width: total === 0 ? "0%" : `${(done / total) * 100}%` }}
          />
        </div>
        <header className="mm-quiz__stage" data-kind={card.objectType}>
          <div className="mm-quiz__stage-bar">
            <button
              type="button"
              className="mm-quiz__home"
              title={t("mojimori.study.returnHome")}
              aria-label={t("mojimori.study.returnHome")}
              onClick={goHome}
            >
              <House size={18} />
            </button>
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
          <div
            className={`mm-quiz__glyph${current.prompt === "word" ? " is-word" : ""}`}
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
          </div>
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

        <div className="mm-quiz__ask-container">
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
          {notice ? <p className="mm-quiz__exception">{notice}</p> : null}
          {current.prompt === "word" && mode === "ask" && !pending ? (
            <div className="mm-word__methods">
              <button
                type="button"
                className={wordMethod === "meaning" ? "is-on" : ""}
                onClick={() => setWordMethod("meaning")}
              >
                {t("mojimori.study.wordMeaningMethod")}
              </button>
              <button
                type="button"
                className={wordMethod === "kanji" ? "is-on" : ""}
                disabled={wordKanji.length === 0}
                onClick={() => setWordMethod("kanji")}
              >
                {t("mojimori.study.wordDrawMethod")}
              </button>
              <button
                type="button"
                className={wordHint ? "is-on" : ""}
                onClick={() => setWordHint(true)}
              >
                {t("mojimori.study.wordHint")}
              </button>
            </div>
          ) : null}
          {wordDraw ? (
            <div className="mm-word">
              <p className="mm-word__progress">
                {t("mojimori.study.wordProgress", {
                  current: Math.min(strokeIndex + 1, wordKanji.length),
                  total: wordKanji.length,
                })}
              </p>
              <KanjiStrokeQuiz
                key={`${card.id}-${strokeIndex}-${drawTry}`}
                character={wordKanji[strokeIndex] ?? ""}
                unsupported={t("mojimori.study.wordUnsupported")}
                onDone={() => {
                  const next = strokeIndex + 1;
                  if (next >= wordKanji.length) {
                    void submitAnswer({
                      answer: wordKanji.join(""),
                      method: "kanji",
                    });
                    return;
                  }
                  setStrokeIndex(next);
                }}
              />
            </div>
          ) : (
          <div
            className={`mm-quiz__entry ${shaking ? "is-shaking" : ""}${pending === "ok" ? "is-ok" : ""}${pending === "miss" ? "is-bad" : ""}`}
            onAnimationEnd={() => setShaking(false)}
          >
            {mode === "miss" ? (
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
                readOnly={pending === "ok"}
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
                  const value = event.target.value;
                  if (current.prompt !== "reading") {
                    setDraft(value);
                    return;
                  }
                  const next = romajiToKanaInput(value);
                  if (!readingInputAllows(next)) {
                    pulseShake();
                    return;
                  }
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
            className={`mm-quiz__tool${wrapUp ? "is-on" : ""}`}
            onClick={toggleWrap}
          >
            <span>{t("mojimori.study.wrapUp")}</span>
            <Clock size={16} />
            {wrapUp ? <i>{wrapCount}</i> : null}
          </button>
          <button
            type="button"
            className={`mm-quiz__tool${sheet === "last" ? "is-on" : ""}`}
            onClick={() =>
              setSheet((open) => (open === "last" ? "none" : "last"))
            }
          >
            <span>{t("mojimori.study.lastAnswers")}</span>
            <Check size={16} />
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
            className={`mm-quiz__tool${sheet === "kana" ? "is-on" : ""}`}
            onClick={() =>
              setSheet((open) => (open === "kana" ? "none" : "kana"))
            }
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
        {mode === "miss" ? (
          <p className="mm-quiz__help">
            {current.prompt === "word"
              ? t("mojimori.study.helpWord")
              : current.prompt === "reading"
                ? t("mojimori.study.helpReading")
                : t("mojimori.study.helpMeaning")}
          </p>
        ) : null}
        {sheet !== "none" ? (
          <div className="mm-quiz__sheet">
            {sheet === "last" ? (
              <LastAnswers cards={byId} recent={recent} records={records} />
            ) : null}
            {infoOn && detail.data ? (
              <ReviewInfo
                key={`${card.id}-${current.prompt}`}
                detail={detail.data}
                prompt={current.prompt}
                playing={playing}
                onPlay={play}
              />
            ) : null}
            {sheet === "kana" ? (
              <KanaPad
                tab={kanaTab}
                onTab={setKanaTab}
                onInsert={(kana) => {
                  setDraft((value) => value + kana);
                  inputRef.current?.focus({ preventScroll: true });
                }}
                onBackspace={() => {
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
    <ul className="mm-quiz__last">
      {recent.map((id) => {
        const card = cards.get(id);
        const record = records[id];
        if (!card || !record) return null;
        return (
          <li key={id}>
            <span
              className="mm-quiz__last-glyph"
              data-kind={card.objectType}
              lang="ja"
            >
              <Glyph card={card} />
            </span>
            <span className="mm-quiz__last-body">
              {record.meaning ? (
                <span
                  className={`mm-quiz__last-meanings${record.reading ? "has-reading" : ""}`}
                >
                  <AnswerLine attempt={record.meaning} />
                </span>
              ) : null}
              {record.reading ? (
                <span className="mm-quiz__last-readings" lang="ja">
                  <AnswerLine attempt={record.reading} kana />
                </span>
              ) : null}
              {record.word ? (
                <span className="mm-quiz__last-readings">
                  <AnswerLine attempt={record.word} />
                </span>
              ) : null}
            </span>
            {record.grade ? (
              <span
                className={`mm-quiz__last-srs${record.grade.passed ? "is-up" : "is-down"}`}
              >
                {record.grade.passed ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                {t(`mojimori.srs.${stageGroup(record.grade.srsStage)}`)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AnswerLine({
  attempt,
  kana = false,
}: {
  attempt: Attempt;
  kana?: boolean;
}) {
  return (
    <span
      className={`mm-quiz__answer${attempt.correct ? "is-ok" : "is-bad"}`}
      lang={kana ? "ja" : undefined}
    >
      <span>{attempt.answer}</span>
      {attempt.correct ? <Check size={14} /> : <X size={14} />}
    </span>
  );
}

function ReviewInfo({
  detail,
  prompt,
  playing,
  onPlay,
}: {
  detail: MojiMoriSubjectDetail;
  prompt: Prompt;
  playing: string | null;
  onPlay: (url: string) => void;
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
      {detail.objectType === "kanji" && detail.related.components.length > 0 ? (
        <Fold
          title={t("mojimori.radicalCombination")}
          open={open.radicals}
          onToggle={() => toggle("radicals")}
        >
          <SubjectTileGrid subjects={detail.related.components} compact />
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
            <div className="mm-readings">
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
            {detail.related.components.map((subject) => (
              <div key={subject.id} className="mm-compose__item">
                <SubjectTile subject={subject} compact />
                <span className="mm-compose__meta">
                  {subject.primaryReading ? (
                    <b lang="ja">{subject.primaryReading}</b>
                  ) : null}
                  <small>{subject.primaryMeaning}</small>
                </span>
              </div>
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
          <SubjectTileGrid subjects={detail.related.amalgamations} compact />
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
    <div className={`mm-reading${taught ? "is-taught" : ""}`}>
      <span>{title}</span>
      <strong lang="ja">{value}</strong>
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
    <section className={`mm-fold${open ? "is-open" : ""}`}>
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

function KanaPad({
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
