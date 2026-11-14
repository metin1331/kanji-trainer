import { useEffect, useLayoutEffect, useMemo, useRef, useState, type AnimationEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  House,
  Inbox,
  Keyboard,
  Plus,
  Volume2,
} from "lucide-react";
import { MojiMoriLoading } from "./MojiMoriLoading";
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
  type MojiMoriSubjectSummary,
} from "../../lib/mojiMori";
import {
  mojiMoriSubjectQuery,
  useMojiMoriLessons,
  useMojiMoriNotes,
  useMojiMoriStudySettings,
  useMojiMoriSubject,
  useStudyFlush,
} from "../../hooks/useMojiMori";
import { checkStudyCard } from "../../lib/mojiMoriGrade";
import { audioTracks, pickVoice, type AudioTrack } from "./mojiVoice";
import { toast } from "@/components/smoothui/toast";
import { MnemonicText } from "./MnemonicText";
import { LevelSubjectCard } from "./SubjectTile";
import {
  KanaPad,
  ReviewCompletePanel,
  ReviewInfo,
  studyCardToSummary,
  useQuizStageChrome,
} from "./MojiMoriReviewSession";
import { KanjiReview, KanjiStrokeQuiz, WordReveal } from "./KanjiStrokeQuiz";
import { StrokeGlyphTrigger } from "./MojiStrokeModal";
import { beginPress, clearFinishedPress, isHolding, restorePresses, whenPressFinishes } from "./pressBounce";
import { placeDrawingLast } from "./quizOrder";

type SlideId = "composition" | "meaning" | "reading" | "context";
type Phase = "teach" | "quiz";
type Prompt = "meaning" | "reading" | "word";
type Task = { id: number; prompt: Prompt };
type Attempt = { answer: string; correct: boolean };
type Saved = { meaning?: Attempt; reading?: Attempt };

function lessonQuizStats(order: MojiMoriStudyCard[], answers: Record<number, Saved>) {
  let asked = 0;
  let correct = 0;
  for (const card of order) {
    const saved = answers[card.id];
    if (!saved) continue;
    for (const prompt of card.prompts) {
      if (prompt === "word") continue;
      const row = saved[prompt];
      if (row) {
        asked += 1;
        if (row.correct) correct += 1;
      }
    }
  }
  const percent = asked === 0 ? 100 : Math.round((100 * correct) / asked);
  return { asked, correct, percent };
}

function lessonRecordsFromAnswers(
  answers: Record<number, Saved>,
): Record<number, { meaning?: Attempt; reading?: Attempt }> {
  return answers;
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

function slidesFor(card: MojiMoriStudyCard, detail: MojiMoriSubjectDetail | null): SlideId[] {
  const slides: SlideId[] = [];
  const components = detail?.related.components.length ?? 0;
  const related =
    (detail?.related.visuallySimilar.length ?? 0) +
    (detail?.related.amalgamations.length ?? 0);
  if (
    card.objectType === "kanji"
      ? components > 0 || related > 0
      : card.objectType !== "radical" && components > 0
  ) {
    slides.push("composition");
  }
  slides.push("meaning");
  if (card.prompts.includes("reading")) slides.push("reading");
  const sentences = detail?.contextSentences ?? card.contextSentences ?? [];
  if (card.objectType === "vocabulary" && sentences.length > 0) slides.push("context");
  return slides;
}

function primaryMeaning(card: MojiMoriStudyCard): string {
  return card.meanings?.find((item) => item.primary)?.meaning ?? card.meanings?.[0]?.meaning ?? "";
}

function primaryReading(card: MojiMoriStudyCard): string {
  return card.readings?.find((item) => item.primary)?.reading ?? card.readings?.[0]?.reading ?? "";
}

function Glyph({ card }: { card: MojiMoriStudyCard }) {
  if (card.characters) return <span lang="ja">{card.characters}</span>;
  const src = pickCharacterImage(card.characterImages);
  if (src) return <img src={src} alt="" className="mm-lesson__image" />;
  return <span>?</span>;
}

export function MojiMoriLessonSession({ ids }: { ids?: number[] }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const lessons = useMojiMoriLessons(ids);
  const studyFlush = useStudyFlush("lesson");
  const [order, setOrder] = useState<MojiMoriStudyCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [slide, setSlide] = useState<SlideId>("meaning");
  const [phase, setPhase] = useState<Phase>("teach");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quizTotal, setQuizTotal] = useState(0);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<null | "ok" | "miss">(null);
  const [missText, setMissText] = useState("");
  const [shaking, setShaking] = useState(false);
  const [hotkeys, setHotkeys] = useState(false);
  const [sheet, setSheet] = useState<"none" | "info" | "kana">("none");
  const [kanaTab, setKanaTab] = useState("a");
  const [infoDenied, setInfoDenied] = useState(false);
  const [missTint, setMissTint] = useState(false);
  const [browse, setBrowse] = useState<number[]>([]);
  const [quizInfoStack, setQuizInfoStack] = useState<number[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [wordMethod, setWordMethod] = useState<"meaning" | "kanji">("kanji");
  const [wordHint, setWordHint] = useState(0);
  const [spellingHint, setSpellingHint] = useState(false);
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [drawn, setDrawn] = useState(0);
  const [wordBoard, setWordBoard] = useState(false);
  const [drawTry, setDrawTry] = useState(0);
  const methodsRef = useRef<HTMLDivElement>(null);
  const answers = useRef<Record<number, Saved>>({});
  const leaving = useRef(false);
  const land = useRef<"start" | "end" | "stay">("start");
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prefs = useMojiMoriStudySettings();
  const queryClient = useQueryClient();
  const stageCardId =
    phase === "quiz" ? tasks[0]?.id ?? null : order?.[index]?.id ?? null;
  useQuizStageChrome(
    Boolean(order && order.length > 0 && stageCardId != null),
    `${stageCardId ?? ""}:${phase}`,
  );
  const heard = useRef("");
  useLayoutEffect(() => {
    restorePresses(methodsRef.current);
  });

  useEffect(() => {
    if (order != null || !lessons.data) return;
    if (lessons.data.items.length === 0 && lessons.isFetching) return;
    setOrder(lessons.data.items);
  }, [order, lessons.data, lessons.isFetching]);

  const card = order?.[index] ?? null;

  useEffect(() => {
    if (!order || phase !== "teach") return;
    const nextId = order[index + 1]?.id;
    if (!nextId) return;
    void queryClient.prefetchQuery(mojiMoriSubjectQuery(nextId));
  }, [order, index, phase, queryClient]);
  const task = phase === "quiz" ? tasks[0] ?? null : null;
  const activeId = phase === "quiz" ? task?.id ?? null : card?.id ?? null;
  const detailQuery = useMojiMoriSubject(activeId);
  const detail = detailQuery.data?.id === activeId ? detailQuery.data : null;
  const browseId = browse.length > 0 ? browse[browse.length - 1]! : null;
  const browseQuery = useMojiMoriSubject(browseId);
  const quizInfoViewId =
    phase === "quiz" && sheet === "info"
      ? quizInfoStack.length > 0
        ? quizInfoStack[quizInfoStack.length - 1]!
        : activeId
      : null;
  const quizInfoQuery = useMojiMoriSubject(quizInfoViewId);
  const quizInfoDetail =
    quizInfoQuery.data?.id === quizInfoViewId ? quizInfoQuery.data : null;
  const activeCard = order?.find((item) => item.id === activeId) ?? card;
  const slides = useMemo(
    () => (activeCard && phase === "teach" ? slidesFor(activeCard, detail) : []),
    [activeCard, detail, phase],
  );

  useEffect(() => {
    setBrowse([]);
    setQuizInfoStack([]);
  }, [card?.id]);

  useEffect(() => {
    setQuizInfoStack([]);
  }, [task?.id]);

  useEffect(() => {
    if (!browseId) return;
    document.querySelector(".mm-lesson__browse")?.scrollIntoView({ block: "start" });
  }, [browseId]);

  useEffect(() => {
    if (!card || phase !== "teach") return;
    const ready = detail?.id === card.id;
    if (!ready || land.current === "stay") return;
    const list = slidesFor(card, detail?.id === card.id ? detail : null);
    setSlide(land.current === "end" ? (list[list.length - 1] ?? "meaning") : (list[0] ?? "meaning"));
    land.current = "stay";
  }, [card, detail, phase]);

  useEffect(() => {
    if (phase === "quiz" && pending == null) inputRef.current?.focus();
  }, [phase, task?.id, task?.prompt, pending]);

  function play(url: string) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing === url && !audio.paused) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = url;
    void audio.play();
    setPlaying(url);
  }

  function playFirst() {
    const tracks = audioTracks(detail?.pronunciationAudios);
    const reading = activeCard ? primaryReading(activeCard) : "";
    const matched = tracks.filter((track) => track.pronunciation === reading);
    const pool = matched.length > 0 ? matched : tracks;
    const track = pickVoice(pool, prefs.data?.preferredVoice ?? "random");
    if (track) play(track.url);
  }

  useEffect(() => {
    if (!prefs.data?.lessonsAutoplay || phase !== "teach" || slide !== "reading") return;
    if (!detail || detail.objectType !== "vocabulary") return;
    const mark = `${detail.id}:lesson`;
    if (heard.current === mark) return;
    const tracks = audioTracks(detail.pronunciationAudios);
    const reading = activeCard ? primaryReading(activeCard) : "";
    const matched = tracks.filter((track) => track.pronunciation === reading);
    const track = pickVoice(matched.length > 0 ? matched : tracks, prefs.data.preferredVoice);
    if (!track || !audioRef.current) return;
    heard.current = mark;
    audioRef.current.src = track.url;
    void audioRef.current.play();
    setPlaying(track.url);
  }, [prefs.data, phase, slide, detail, activeCard]);

  function moveSlide(dir: -1 | 1) {
    if (!order || !card || phase !== "teach") return;
    const list = slides.length > 0 ? slides : (["meaning"] as SlideId[]);
    const at = Math.max(0, list.indexOf(slide));
    const nextAt = at + dir;
    if (nextAt >= 0 && nextAt < list.length) {
      land.current = "stay";
      setSlide(list[nextAt]!);
      return;
    }
    if (dir > 0) {
      if (index + 1 < order.length) {
        land.current = "start";
        setIndex(index + 1);
      } else startQuiz();
      return;
    }
    if (index > 0) {
      land.current = "end";
      setIndex(index - 1);
      return;
    }
    land.current = "stay";
    setSlide(list[list.length - 1] ?? "meaning");
  }

  function openItem(next: number) {
    land.current = "start";
    setIndex(next);
    setPhase("teach");
  }

  function skip() {
    if (!order || order.length < 2 || phase !== "teach") return;
    const current = order[index];
    if (!current) return;
    setOrder([...order.slice(0, index), ...order.slice(index + 1), current]);
    land.current = "start";
    setIndex(index >= order.length - 1 ? 0 : index);
  }

  function clearDrawing() {
    setWordMethod("kanji");
    setWordHint(0);
    setSpellingHint(false);
    setStrokeIndex(0);
    setDrawn(0);
    setWordBoard(false);
    setDrawTry(0);
  }

  function startQuiz() {
    if (!order?.length) return;
    const drawingLast = prefs.data?.drawingCardsLast === true;
    const next: Task[] = [];
    for (const item of order) {
      for (const prompt of item.prompts) {
        if (prompt === "word" && !drawingLast) continue;
        next.push({ id: item.id, prompt });
      }
    }
    answers.current = {};
    clearDrawing();
    const queued = placeDrawingLast(next, drawingLast);
    setQuizTotal(queued.length);
    setTasks(queued);
    setDraft("");
    setPending(null);
    setMissText("");
    setSheet("none");
    setInfoDenied(false);
    setPhase("quiz");
  }

  function advanceQuiz(leave: "ok" | "miss" | null = pending) {
    if (leaving.current) return;
    leaving.current = true;
    queueMicrotask(() => {
      leaving.current = false;
    });
    toast.dismissNow();
    const current = tasks[0];
    setPending(null);
    setDraft("");
    setMissText("");
    setMissTint(false);
    setShaking(false);
    setSheet("none");
    setInfoDenied(false);
    clearDrawing();
    if (!current) return;
    const drawingLast = prefs.data?.drawingCardsLast === true;
    setTasks((list) =>
      placeDrawingLast(
        leave === "miss" ? [...list.slice(1), current] : list.slice(1),
        drawingLast,
      ),
    );
  }

  function submitQuiz(word?: { answer: string; method: "meaning" | "kanji"; reveal?: boolean }) {
    if (pending) {
      advanceQuiz();
      return;
    }
    const current = tasks[0];
    const subject = order?.find((item) => item.id === current?.id);
    if (!current || !subject) return;
    const raw = (word?.answer ?? draft).trim();
    if (!raw) {
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      holdCaret(inputRef.current);
      return;
    }
    const answer = current.prompt === "reading" ? romajiToKanaInput(raw) : raw;
    if (current.prompt === "reading" && readingAnswerIncomplete(answer)) {
      setDraft(answer);
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      holdCaret(inputRef.current);
      return;
    }
    if (current.prompt === "reading") setDraft(answer);
    const graded = word?.reveal ? "\u00d7" : answer;
    const result = checkStudyCard(subject, current.prompt, graded, word?.method ?? "meaning");
    if (result.homophone) {
      toast(t("mojimori.study.homophone"));
      if (word?.method === "kanji") {
        setStrokeIndex(0);
        setDrawn(0);
        setWordBoard(false);
        setDrawTry((value) => value + 1);
      } else {
        setShaking(false);
        requestAnimationFrame(() => setShaking(true));
        holdCaret(inputRef.current);
      }
      return;
    }
    if (result.shake) {
      if (result.exception === "radicalMeaning") {
        toast(t("mojimori.study.wantKanjiMeaning"));
      } else if (result.exception === "kanjiReading") {
        toast(t("mojimori.study.wantVocabReading"));
      } else if (result.exception === "unusualSpelling") {
        toast(t("mojimori.study.unusualSpelling"));
      } else if (result.enteredType && result.wantedType) {
        const readingName = (kind: string) =>
          kind === "onyomi" || kind === "kunyomi" || kind === "nanori"
            ? t(`mojimori.${kind}`)
            : kind;
        toast(
          t("mojimori.study.readingType", {
            answer,
            entered: readingName(result.enteredType),
            wanted: readingName(result.wantedType),
          }),
        );
      } else {
        const wanted =
          result.wantedType === "meaning"
            ? t("mojimori.study.lookingMeaning")
            : result.wantedType === "reading"
              ? t("mojimori.study.lookingReading")
              : t("mojimori.study.shake", { type: result.wantedType ?? "" });
        toast(wanted);
      }
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      holdCaret(inputRef.current);
      return;
    }
    if (!result.correct && !word?.reveal) {
      if (missTint && missText === answer) {
        advanceQuiz("miss");
        return;
      }
      answers.current = {
        ...answers.current,
        [current.id]: {
          ...answers.current[current.id],
          [current.prompt]: { answer, correct: false },
        },
      };
      toast(
        current.prompt === "word"
          ? t("mojimori.study.helpWord")
          : current.prompt === "reading"
            ? t("mojimori.study.helpReading")
            : t("mojimori.study.helpMeaning"),
      );
      setMissText(answer);
      setDraft(answer);
      setMissTint(true);
      holdCaret(inputRef.current);
      return;
    }
    if (result.lenient) toast(t("mojimori.study.helpMeaning"));
    else if (current.prompt === "meaning" && result.multipleMeanings) toast(t("mojimori.study.multipleMeanings"));
    if (current.prompt === "reading" && result.multipleReadings) toast(t("mojimori.study.multipleReadings"));
    if (current.prompt !== "word") {
      const attempt = { answer, correct: true };
      const next = { ...answers.current[current.id], [current.prompt]: attempt };
      answers.current = { ...answers.current, [current.id]: next };
      if (subject.prompts.every((prompt) => prompt === "word" || Boolean(next[prompt]))) {
        studyFlush.queue({
          subjectId: current.id,
          meaning: next.meaning?.answer,
          reading: next.reading?.answer,
          expectedStage: 0,
        });
      }
    }
    setPending("ok");
  }

  function goHome(event: { preventDefault: () => void }) {
    event.preventDefault();
    void studyFlush.flush().then(
      () => setLocation("/mojimori"),
      () => toast(t("mojimori.study.saveFailed")),
    );
  }

  function finishLesson() {
    void studyFlush.flush().catch(() => toast(t("mojimori.study.saveFailed")));
    setLocation("/mojimori");
  }

  const actions = useRef({
    phase,
    pending,
    moveSlide,
    skip,
    startQuiz,
    playFirst,
    advanceQuiz,
  });
  actions.current = { phase, pending, moveSlide, skip, startQuiz, playFirst, advanceQuiz };

  useEffect(() => {
    if (phase !== "quiz" || tasks.length > 0 || !order?.length) return;
    void studyFlush.flush().catch(() => toast(t("mojimori.study.saveFailed")));
  }, [phase, tasks.length, order, studyFlush, t]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      const api = actions.current;
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setHotkeys((open) => !open);
        return;
      }
      if (api.phase === "quiz") {
        if (event.key === "Enter" && api.pending) {
          if (tag === "TEXTAREA") return;
          if (tag === "INPUT" && event.target !== inputRef.current) return;
          event.preventDefault();
          api.advanceQuiz();
        } else if (event.key.toLowerCase() === "j" && !typing) {
          event.preventDefault();
          api.playFirst();
        }
        return;
      }
      if (typing) return;
      const key = event.key.toLowerCase();
      if (event.key === "ArrowLeft" || key === "a" || key === "w") {
        event.preventDefault();
        api.moveSlide(-1);
      } else if (event.key === "ArrowRight" || key === "d" || key === "s") {
        event.preventDefault();
        api.moveSlide(1);
      } else if (key === "g") {
        event.preventDefault();
        api.skip();
      } else if (key === "q") {
        event.preventDefault();
        api.startQuiz();
      } else if (key === "j") {
        event.preventDefault();
        api.playFirst();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (order == null && lessons.data && (lessons.data.items.length > 0 || !lessons.isFetching)) {
    setOrder(lessons.data.items);
  }

  if (order == null) {
    return <MojiMoriLoading />;
  }
  if (order.length === 0) {
    return (
      <section className="glass-panel mx-auto max-w-xl p-6 text-sm text-[var(--color-muted)]">
        {t("mojimori.study.empty")}
      </section>
    );
  }

  const shown = phase === "quiz" && task ? order.find((item) => item.id === task.id) ?? null : card;
  if (phase === "quiz" && !task && order) {
    const records = lessonRecordsFromAnswers(answers.current);
    const stats = lessonQuizStats(order, answers.current);
    return (
      <div className="mm-quiz-page">
        <ReviewCompletePanel
          cards={order}
          records={records}
          asked={stats.asked}
          correct={stats.correct}
          percent={stats.percent}
          onHome={finishLesson}
          title={t("mojimori.study.lessonsDone")}
        />
      </div>
    );
  }
  if (!shown) return null;

  const remaining =
    phase === "quiz"
      ? order.filter((item) => tasks.some((row) => row.id === item.id))
      : order;
  const tally = {
    radical: remaining.filter((item) => item.objectType === "radical").length,
    kanji: remaining.filter((item) => item.objectType === "kanji").length,
    vocabulary: remaining.filter((item) => item.objectType === "vocabulary").length,
  };
  const meaning = primaryMeaning(shown);
  const wordKanji = shown.wordKanji ?? [];
  const drawing = phase === "quiz" && task?.prompt === "word";
  const showBoard =
    drawing && wordMethod === "kanji" && wordKanji.length > 0 && (wordBoard || pending == null);
  const showWordMeaning = drawing && wordMethod === "kanji" && wordHint > 0;
  const showWordSpelling = drawing && wordMethod === "meaning" && spellingHint;

  return (
    <div className="mm-quiz-page">
      <div className="mm-lesson" data-kind={shown.objectType}>
        <audio ref={audioRef} onEnded={() => setPlaying(null)} />
        <section className="mm-lesson__card mm-quiz">
      {phase === "quiz" ? (
        <div className="mm-quiz__meter" aria-hidden="true">
          <span
            style={{ width: quizTotal === 0 ? "0%" : `${((quizTotal - tasks.length) / quizTotal) * 100}%` }}
          />
        </div>
      ) : null}
      <header className="mm-quiz__stage mm-lesson__stage" data-kind={shown.objectType}>
        <div className="mm-lesson__bar">
          <Link href="/mojimori" className="mm-quiz__home" title={t("mojimori.study.returnHome")} onClick={goHome}>
            <House size={18} />
          </Link>
          <div className="mm-lesson__counts">
            <span title={t("mojimori.study.remainingRadical")}>
              R <Inbox size={14} /> {tally.radical}
            </span>
            <span title={t("mojimori.study.remainingKanji")}>
              K <Inbox size={14} /> {tally.kanji}
            </span>
            <span title={t("mojimori.study.remainingVocab")}>
              V <Inbox size={14} /> {tally.vocabulary}
            </span>
          </div>
        </div>
        <StrokeGlyphTrigger
          card={shown}
          className={`mm-lesson__glyph${drawing ? " is-word" : ""}`}
        >
          {drawing ? <span lang="ja">{shown.wordReading || "…"}</span> : <Glyph card={shown} />}
          {showWordMeaning && shown.wordMeaning ? (
            <p className="mm-quiz__word-meaning">{shown.wordMeaning}</p>
          ) : null}
          {showWordSpelling && shown.characters ? (
            <p className="mm-quiz__word-spelling" lang="ja">
              {shown.characters}
            </p>
          ) : null}
        </StrokeGlyphTrigger>
        {phase === "teach" && meaning ? <p className="mm-lesson__meaning">{meaning}</p> : null}
      </header>
      {phase === "quiz" && task ? (
        <div className="mm-quiz__ask-container">
          <p className="mm-quiz__ask" data-kind={shown.objectType}>
            <span>{kindLabel(shown.objectType, t)}</span>
            <span>
              {task.prompt === "meaning"
                ? t("mojimori.study.meaningWord")
                : task.prompt === "word"
                  ? t("mojimori.study.wordWord")
                  : t("mojimori.study.readingWord")}
            </span>
          </p>
        </div>
      ) : null}

      {phase === "teach" && browseId ? (
        <section className="mm-lesson__sheet mm-lesson__browse">
          <button
            type="button"
            className="moji-btn mm-quiz__back"
            onClick={() => setBrowse((stack) => stack.slice(0, -1))}
          >
            <ChevronLeft size={14} aria-hidden="true" />
            <span>{t("mojimori.study.detailBack")}</span>
          </button>
          {browseQuery.data ? (
            <ReviewInfo
              key={browseQuery.data.id}
              detail={browseQuery.data}
              prompt="meaning"
              playing={playing}
              onPlay={play}
              showHeadline
              onOpen={(subject) =>
                setBrowse((stack) =>
                  stack[stack.length - 1] === subject.id ? stack : [...stack, subject.id],
                )
              }
            />
          ) : (
            <MojiMoriLoading shape="lines" />
          )}
        </section>
      ) : phase === "teach" && card ? (
        <section className="mm-lesson__sheet">
          <div className="mm-lesson__tabs" role="tablist">
            {slides.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={slide === id}
                className="mm-lesson__tab"
                onClick={() => {
                  land.current = "stay";
                  setSlide(id);
                }}
              >
                {slideLabel(id, card.objectType, t)}
              </button>
            ))}
          </div>
          <div className="mm-lesson__slide">
            <button
              type="button"
              className="mm-lesson__arrow"
              aria-label={t("mojimori.study.prevSlide")}
              onClick={() => moveSlide(-1)}
            >
              <ChevronLeft size={28} />
            </button>
            <div className="mm-lesson__body" role="tabpanel">
              {slide === "composition" ? (
                <CompositionSlide
                  card={card}
                  detail={detail}
                  onOpen={(subject) => setBrowse([subject.id])}
                />
              ) : null}
              {slide === "meaning" ? <MeaningSlide card={card} detail={detail} /> : null}
              {slide === "reading" ? (
                <ReadingSlide card={card} detail={detail} playing={playing} onPlay={play} />
              ) : null}
              {slide === "context" ? <ContextSlide card={card} detail={detail} /> : null}
            </div>
            <button
              type="button"
              className="mm-lesson__arrow"
              aria-label={t("mojimori.study.nextSlide")}
              onClick={() => moveSlide(1)}
            >
              <ChevronRight size={28} />
            </button>
          </div>
          <ul className="mm-lesson__queue">
            {order.map((item, itemIndex) => (
              <li key={item.id}>
                <LevelSubjectCard
                  subject={studyCardToSummary(item)}
                  caption={false}
                  showBar={false}
                  className={itemIndex === index ? "is-current" : undefined}
                  onOpen={() => openItem(itemIndex)}
                />
              </li>
            ))}
            <li>
              <button type="button" className="moji-btn-primary mm-lesson__quiz" onClick={startQuiz}>
                {t("mojimori.study.quiz")}
                <ArrowRight size={16} />
              </button>
            </li>
          </ul>
        </section>
      ) : task && shown ? (
        <section className="mm-lesson__sheet">
          <form
            className="mm-quiz__form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitQuiz();
            }}
          >
            {drawing && pending == null ? (
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
                  if (!(target instanceof HTMLElement) || event.animationName !== "mm-press" || isHolding(target)) return;
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
                        if (wordBoard) return;
                        setWordBoard(true);
                        submitQuiz({
                          answer: shown.characters || wordKanji.join(""),
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
                    characters={shown.characters || wordKanji.join("")}
                    kanji={wordKanji}
                    advanceLabel={t("mojimori.study.next")}
                    onAdvance={() => advanceQuiz()}
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
                        key={`${shown.id}-done-${strokeIndex}`}
                        character={wordKanji[strokeIndex] ?? ""}
                      />
                    ) : (
                      <KanjiStrokeQuiz
                        key={`${shown.id}-${strokeIndex}-${drawTry}`}
                        character={wordKanji[strokeIndex] ?? ""}
                        unsupported={t("mojimori.study.wordUnsupported")}
                        onDone={() => {
                          const next = strokeIndex + 1;
                          setDrawn(next);
                          if (next >= wordKanji.length) {
                            setWordBoard(true);
                            submitQuiz({
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
              className={`mm-quiz__entry${shaking ? " is-shaking" : ""}${pending === "ok" ? " is-ok" : ""}${pending === "miss" || missTint ? " is-bad" : ""}`}
              onAnimationEnd={() => setShaking(false)}
            >
              {pending === "miss" ? (
                <p className="mm-quiz__wrong" lang={task.prompt === "reading" ? "ja" : undefined}>
                  {missText}
                </p>
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
                    if (task.prompt !== "reading") return;
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
                      setShaking(false);
                      requestAnimationFrame(() => setShaking(true));
                    }
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (task.prompt !== "reading") {
                      if (missTint && value !== missText) setMissTint(false);
                      setDraft(value);
                      return;
                    }
                    const next = romajiToKanaInput(value);
                    if (!readingInputAllows(next)) {
                      setShaking(false);
                      requestAnimationFrame(() => setShaking(true));
                      return;
                    }
                    if (missTint && next !== missText) setMissTint(false);
                    setDraft(next);
                  }}
                />
              )}
              <button type="submit" className="mm-quiz__go" aria-label={t("mojimori.study.check")}>
                <ChevronRight size={22} />
              </button>
            </div>
            )}
          </form>
          <div className="mm-quiz__tools">
            <span className="mm-quiz__tool-wrap">
              <button
                type="button"
                className={`mm-quiz__tool${sheet === "info" ? " is-on" : ""}${pending != null || missTint ? "" : " is-locked"}`}
                onClick={() => {
                  toast.dismissNow();
                  if (pending == null && !missTint) {
                    setInfoDenied(true);
                    window.setTimeout(() => setInfoDenied(false), 1600);
                    return;
                  }
                  setInfoDenied(false);
                  setSheet((open) => (open === "info" ? "none" : "info"));
                }}
              >
                <span>{t("mojimori.study.itemInfo")}</span>
                <Eye size={16} />
              </button>
              {infoDenied && pending == null ? (
                <em className="mm-quiz__tool-note">{t("mojimori.study.infoLocked")}</em>
              ) : null}
            </span>
            <button
              type="button"
              className={`mm-quiz__tool${sheet === "kana" ? " is-on" : ""}`}
              onClick={() => {
                toast.dismissNow();
                setSheet((open) => (open === "kana" ? "none" : "kana"));
              }}
            >
              <span>{t("mojimori.study.kanaChart")}</span>
              <b lang="ja">ひ</b>
            </button>
            <button
              type="button"
              className="mm-quiz__tool mm-quiz__tool--icon"
              disabled={task.prompt !== "reading" || audioTracks(detail?.pronunciationAudios).length === 0}
              title={t("mojimori.playAudio")}
              onClick={() => {
                toast.dismissNow();
                playFirst();
              }}
            >
              <Volume2 size={16} />
            </button>
          </div>
          {sheet === "info" ? (
            <div className="mm-quiz__sheet">
              {quizInfoStack.length > 0 ? (
                <button
                  type="button"
                  className="moji-btn mm-quiz__back"
                  onClick={() => setQuizInfoStack((stack) => stack.slice(0, -1))}
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  <span>{t("mojimori.study.detailBack")}</span>
                </button>
              ) : null}
              {quizInfoDetail ? (
                <ReviewInfo
                  key={quizInfoDetail.id}
                  detail={quizInfoDetail}
                  prompt={
                    quizInfoStack.length === 0
                      ? task.prompt === "word"
                        ? "meaning"
                        : task.prompt
                      : "meaning"
                  }
                  playing={playing}
                  onPlay={play}
                  showHeadline={quizInfoStack.length > 0}
                  onOpen={(subject) =>
                    setQuizInfoStack((stack) =>
                      stack[stack.length - 1] === subject.id
                        ? stack
                        : [...stack, subject.id],
                    )
                  }
                />
              ) : (
                <MojiMoriLoading shape="lines" />
              )}
            </div>
          ) : null}
          {sheet === "kana" ? (
            <div className="mm-quiz__sheet">
              <KanaPad
                tab={kanaTab}
                onTab={setKanaTab}
                onInsert={(kana) => {
                  if (pending === "ok" || showBoard) return;
                  setDraft((value) => {
                    const next = `${value}${kana}`;
                    return task.prompt === "reading" && !readingInputAllows(next) ? value : next;
                  });
                  inputRef.current?.focus({ preventScroll: true });
                }}
                onBackspace={() => {
                  if (pending === "ok" || showBoard) return;
                  setDraft((value) => [...value].slice(0, -1).join(""));
                  inputRef.current?.focus({ preventScroll: true });
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}
        </section>

        <div className="mm-lesson__footer">
        <div className={`mm-lesson__hotkeys${hotkeys ? " is-open" : ""}`}>
          <button
            type="button"
            className="mm-lesson__hotkey-btn"
            aria-expanded={hotkeys}
            onClick={() => setHotkeys((open) => !open)}
          >
            <Keyboard size={16} />
            {t("mojimori.study.hotkeys")}
          </button>
          {hotkeys ? (
            <div className="mm-lesson__hotkey-panel">
              <p>{t("mojimori.study.hotkeySlides")}</p>
              <Hotkey keys={["W", "A", "S", "D"]} label={t("mojimori.study.hotkeySlideNav")} />
              <Hotkey keys={["←", "→"]} label={t("mojimori.study.hotkeyPrevNext")} />
              <Hotkey keys={["G"]} label={t("mojimori.study.hotkeySkip")} />
              <Hotkey keys={["Q"]} label={t("mojimori.study.hotkeyQuiz")} />
              <Hotkey keys={["J"]} label={t("mojimori.study.hotkeyAudio")} />
              <Hotkey keys={["?"]} label={t("mojimori.study.hotkeyMenu")} />
              <p>{t("mojimori.study.hotkeyQuizSection")}</p>
              <Hotkey keys={["J"]} label={t("mojimori.study.hotkeyAudio")} />
              <Hotkey keys={["?"]} label={t("mojimori.study.hotkeyMenu")} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </div>
  );
}

function Hotkey({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="mm-lesson__hotkey-row">
      <span>
        {keys.map((key) => (
          <kbd key={key}>{key}</kbd>
        ))}
      </span>
      <small>{label}</small>
    </div>
  );
}

function slideLabel(
  id: SlideId,
  type: string,
  t: (key: string) => string,
): string {
  if (id === "composition") {
    return type === "kanji" ? t("mojimori.radicalCombination") : t("mojimori.kanjiComposition");
  }
  if (id === "meaning") return t("mojimori.meaning");
  if (id === "reading") return t("mojimori.study.readingTitle");
  return t("mojimori.context");
}

function kindLabel(type: string, t: (key: string) => string): string {
  if (type === "radical") return t("mojimori.study.quizRadical");
  if (type === "kanji") return t("mojimori.study.quizKanji");
  return t("mojimori.study.quizVocabulary");
}

function CompositionSlide({
  card,
  detail,
  onOpen,
}: {
  card: MojiMoriStudyCard;
  detail: MojiMoriSubjectDetail | null;
  onOpen: (subject: MojiMoriSubjectSummary) => void;
}) {
  const { t } = useTranslation();
  if (!detail) return <MojiMoriLoading shape="lines" />;
  const parts = detail.related.components;
  const count = parts.length;
  const intro =
    card.objectType === "vocabulary"
      ? count === 1
        ? t("mojimori.study.composedOne")
        : t("mojimori.study.composedMany", { count })
      : count === 1
        ? t("mojimori.study.radicalsOne")
        : t("mojimori.study.radicalsMany", { count });
  const similar = detail.related.visuallySimilar;
  const found = detail.related.amalgamations;
  return (
    <div className="mm-lesson__copy">
      {parts.length > 0 ? (
        <>
          <p>{intro}</p>
          <div className="flex flex-wrap items-center gap-3">
            {parts.map((subject, index) => (
              <span key={subject.id} className="contents">
                <LevelSubjectCard subject={subject} showBar={false} onOpen={onOpen} />
                {parts.length > 1 && index !== parts.length - 1 ? (
                  <div className="mm-compose__plus">
                    <span>
                      <Plus size={16} />
                    </span>
                  </div>
                ) : null}
              </span>
            ))}
          </div>
          {card.objectType === "vocabulary" ? (
            <>
              <p>{t("mojimori.study.relateMeanings")}</p>
              <p>{t("mojimori.study.guessReading")}</p>
            </>
          ) : (
            <p>{t("mojimori.study.radicalGuess")}</p>
          )}
        </>
      ) : null}
      {card.objectType === "kanji" && similar.length > 0 ? (
        <section className="mm-lesson__relations">
          <h2>{t("mojimori.visuallySimilar")}</h2>
          <div className="flex flex-wrap gap-3">
            {similar.map((subject) => (
              <LevelSubjectCard key={subject.id} subject={subject} caption showBar={false} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}
      {card.objectType === "kanji" && found.length > 0 ? (
        <section className="mm-lesson__relations">
          <h2>{t("mojimori.foundInVocabulary")}</h2>
          <div className="flex flex-wrap gap-3">
            {found.map((subject) => (
              <LevelSubjectCard key={subject.id} subject={subject} caption showBar={false} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MeaningSlide({
  card,
  detail,
}: {
  card: MojiMoriStudyCard;
  detail: MojiMoriSubjectDetail | null;
}) {
  const { t } = useTranslation();
  const others = (detail?.meanings ?? card.meanings ?? []).filter((item) => item.acceptedAnswer && !item.primary);
  const parts = detail?.partsOfSpeech ?? [];
  const story = detail?.meaningMnemonic || card.meaningMnemonic || "";
  const aside = others.length > 0 || parts.length > 0;
  return (
    <div className={aside ? "mm-lesson__split" : "mm-lesson__copy"}>
      {aside ? (
        <aside className="mm-lesson__aside">
          {others.length > 0 ? (
            <section>
              <h2>{t("mojimori.study.otherMeanings")}</h2>
              <p>{others.map((item) => item.meaning).join(", ")}</p>
            </section>
          ) : null}
          {parts.length > 0 ? (
            <section>
              <h2>{t("mojimori.wordType")}</h2>
              <p>{parts.map((part) => part.replaceAll("_", " ")).join(", ")}</p>
            </section>
          ) : null}
        </aside>
      ) : null}
      <div className="mm-lesson__copy">
        <h2>
          {card.objectType === "vocabulary"
            ? t("mojimori.study.meaningExplanation")
            : t("mojimori.study.mnemonic")}
        </h2>
        <MnemonicText text={story} />
        {detail ? <LessonNote detail={detail} field="meaning" /> : null}
      </div>
    </div>
  );
}

function ReadingSlide({
  card,
  detail,
  playing,
  onPlay,
}: {
  card: MojiMoriStudyCard;
  detail: MojiMoriSubjectDetail | null;
  playing: string | null;
  onPlay: (url: string) => void;
}) {
  const { t } = useTranslation();
  const readings = detail?.readings ?? card.readings ?? [];
  const story = detail?.readingMnemonic || card.readingMnemonic || "";
  const tracks = audioTracks(detail?.pronunciationAudios);
  return (
    <div className="mm-lesson__split">
      <aside className="mm-lesson__aside">
        <h2>{card.objectType === "vocabulary" ? t("mojimori.study.vocabReading") : t("mojimori.study.readingTitle")}</h2>
        {card.objectType === "kanji" ? (
          <KanjiReadingList readings={readings} />
        ) : (
          <VocabReadingList readings={readings} tracks={tracks} playing={playing} onPlay={onPlay} fallback={primaryReading(card)} />
        )}
      </aside>
      <div className="mm-lesson__copy">
        <h2>
          {card.objectType === "vocabulary"
            ? t("mojimori.study.readingExplanation")
            : t("mojimori.study.mnemonic")}
        </h2>
        <MnemonicText text={story} />
        {detail ? <LessonNote detail={detail} field="reading" /> : null}
      </div>
    </div>
  );
}

function VocabReadingList({
  readings,
  tracks,
  playing,
  onPlay,
  fallback,
}: {
  readings: { reading: string; acceptedAnswer: boolean }[];
  tracks: AudioTrack[];
  playing: string | null;
  onPlay: (url: string) => void;
  fallback: string;
}) {
  const accepted = readings.filter((item) => item.acceptedAnswer);
  const rows = accepted.length > 0 ? accepted : [{ reading: fallback, acceptedAnswer: true }];
  return (
    <div className="mm-vocab-readings">
      {rows.map((item) => {
        const matched = tracks.filter((track) => track.pronunciation === item.reading);
        const voices = matched.length > 0 || rows.length > 1 ? matched : tracks;
        return (
          <div key={item.reading} className="mm-vocab-reading">
            <p lang="ja">{item.reading}</p>
            {voices.length > 0 ? (
              <ul className="mm-quiz__voices">
                {voices.map((track) => (
                  <li key={track.url}>
                    <button type="button" onClick={() => onPlay(track.url)} aria-pressed={playing === track.url}>
                      <Volume2 size={16} />
                    </button>
                    <span>
                      <strong>{track.name}</strong>
                      {track.description ? <small>{track.description}</small> : null}
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

function KanjiReadingList({ readings }: { readings: MojiMoriStudyCard["readings"] }) {
  const { t } = useTranslation();
  const groups = kanjiReadingsByKind(readings ?? []);
  const rows = [
    [t("mojimori.onyomi"), groups.onyomi],
    [t("mojimori.kunyomi"), groups.kunyomi],
    [t("mojimori.nanori"), groups.nanori],
  ] as const;
  return (
    <div className="mm-vocab-readings">
      {rows.map(([title, items]) => (
        <div key={title} className={`mm-vocab-reading${items.some((item) => item.primary) ? " is-taught" : ""}`}>
          <p lang="ja">
            {items.length > 0 ? items.map((item) => item.reading).join(", ") : t("mojimori.study.noReading")}
          </p>
          <span>{title}</span>
        </div>
      ))}
    </div>
  );
}

function ContextSlide({
  card,
  detail,
}: {
  card: MojiMoriStudyCard;
  detail: MojiMoriSubjectDetail | null;
}) {
  const { t } = useTranslation();
  const sentences = detail?.contextSentences ?? card.contextSentences ?? [];
  return (
    <div className="mm-lesson__copy">
      <h2>{t("mojimori.study.contextSentences")}</h2>
      <div className="mm-quiz__sentences">
        {sentences.map((sentence, index) => (
          <p key={index}>
            <span lang="ja">{sentence.ja}</span>
            <small>{sentence.en}</small>
          </p>
        ))}
      </div>
    </div>
  );
}

function LessonNote({
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
      <h2>{t(field === "meaning" ? "mojimori.study.meaningNote" : "mojimori.study.readingNote")}</h2>
      <div className="mb-[0.45rem]"></div>
      {editing ? (
        <>
          <textarea className="moji-field" rows={3} value={value} onChange={(event) => setValue(event.target.value)} />
          <button
            type="button"
            className="moji-btn"
            disabled={save.isPending}
            onClick={() => {
              save.mutate(
                {
                  id: detail.id,
                  meaningNote: field === "meaning" ? value : meaningNote,
                  readingNote: field === "reading" ? value : readingNote,
                },
                { onSuccess: () => setEditing(false) },
              );
            }}
          >
            {t("mojimori.study.saveNotes")}
          </button>
        </>
      ) : current ? (
        <button type="button" className="mm-quiz__note-text" onClick={() => setEditing(true)}>
          {current}
        </button>
      ) : (
        <button type="button" className="moji-btn" onClick={() => setEditing(true)}>
          {t("mojimori.study.addNote")}
        </button>
      )}
    </div>
  );
}
