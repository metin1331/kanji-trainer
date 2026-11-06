import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  House,
  Inbox,
  Keyboard,
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
import { SubjectCharacter } from "./SubjectCharacter";
import { visualMode } from "./SubjectTile";

type SlideId = "composition" | "meaning" | "reading" | "context";
type Phase = "teach" | "quiz";
type Prompt = "meaning" | "reading";
type Task = { id: number; prompt: Prompt };
type Saved = { meaning?: string; reading?: string };

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
  if (card.objectType !== "radical" && components > 0) slides.push("composition");
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
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<null | "ok" | "miss">(null);
  const [notice, setNotice] = useState("");
  const [missText, setMissText] = useState("");
  const [shaking, setShaking] = useState(false);
  const [hotkeys, setHotkeys] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const answers = useRef<Record<number, Saved>>({});
  const leaving = useRef(false);
  const land = useRef<"start" | "end" | "stay">("start");
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prefs = useMojiMoriStudySettings();
  const heard = useRef("");

  useEffect(() => {
    if (order != null || !lessons.data) return;
    if (lessons.data.items.length === 0 && lessons.isFetching) return;
    setOrder(lessons.data.items);
  }, [order, lessons.data, lessons.isFetching]);

  const card = order?.[index] ?? null;
  const task = phase === "quiz" ? tasks[0] ?? null : null;
  const activeId = phase === "quiz" ? task?.id ?? null : card?.id ?? null;
  const detailQuery = useMojiMoriSubject(activeId);
  const detail = detailQuery.data?.id === activeId ? detailQuery.data : null;
  const activeCard = order?.find((item) => item.id === activeId) ?? card;
  const slides = useMemo(
    () => (activeCard && phase === "teach" ? slidesFor(activeCard, detail) : []),
    [activeCard, detail, phase],
  );

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

  function startQuiz() {
    if (!order?.length) return;
    const next: Task[] = [];
    for (const item of order) {
      for (const prompt of item.prompts) {
        if (prompt === "word") continue;
        next.push({ id: item.id, prompt });
      }
    }
    answers.current = {};
    setTasks(next);
    setDraft("");
    setPending(null);
    setNotice("");
    setMissText("");
    setPhase("quiz");
  }

  function advanceQuiz() {
    if (leaving.current) return;
    leaving.current = true;
    queueMicrotask(() => {
      leaving.current = false;
    });
    const current = tasks[0];
    const leave = pending;
    setPending(null);
    setDraft("");
    setNotice("");
    setMissText("");
    setShaking(false);
    if (!current) return;
    setTasks((list) => (leave === "miss" ? [...list.slice(1), current] : list.slice(1)));
  }

  function submitQuiz() {
    if (pending) {
      advanceQuiz();
      return;
    }
    const current = tasks[0];
    const subject = order?.find((item) => item.id === current?.id);
    if (!current || !subject) return;
    const answer = current.prompt === "reading" ? romajiToKanaInput(draft) : draft.trim();
    if (current.prompt === "reading" && readingAnswerIncomplete(answer)) {
      setDraft(answer);
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      holdCaret(inputRef.current);
      return;
    }
    if (current.prompt === "reading") setDraft(answer);
    const result = checkStudyCard(subject, current.prompt, answer);
    if (result.shake) {
      if (result.exception === "kanjiReading") {
        toast(t("mojimori.study.wantVocabReading"));
        setNotice("");
      } else if (result.exception === "unusualSpelling") {
        toast(t("mojimori.study.unusualSpelling"));
        setNotice("");
      } else setNotice(t("mojimori.study.shake", { type: result.wantedType ?? "" }));
      setShaking(false);
      requestAnimationFrame(() => setShaking(true));
      holdCaret(inputRef.current);
      return;
    }
    if (!result.correct) {
      toast(current.prompt === "reading" ? t("mojimori.study.helpReading") : t("mojimori.study.helpMeaning"));
      setMissText(current.prompt === "meaning" ? primaryMeaning(subject) : primaryReading(subject));
      setPending("miss");
      return;
    }
    if (result.lenient) toast(t("mojimori.study.helpMeaning"));
    else if (current.prompt === "meaning" && result.multipleMeanings) toast(t("mojimori.study.multipleMeanings"));
    if (current.prompt === "reading" && result.multipleReadings) toast(t("mojimori.study.multipleReadings"));
    const next = { ...answers.current[current.id], [current.prompt]: answer };
    answers.current = { ...answers.current, [current.id]: next };
    if (subject.prompts.every((prompt) => prompt === "word" || Boolean(next[prompt]))) {
      studyFlush.queue({
        subjectId: current.id,
        meaning: next.meaning,
        reading: next.reading,
        expectedStage: 0,
      });
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
  if (phase === "quiz" && !shown) {
    return (
      <section className="glass-panel mm-lesson__done">
        <p>{t("mojimori.study.lessonsDone")}</p>
        <Link href="/mojimori" className="moji-btn-primary" onClick={goHome}>
          {t("mojimori.study.returnHome")}
        </Link>
      </section>
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

  return (
    <div className="mm-lesson" data-kind={shown.objectType}>
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />
      <div className="mm-lesson__card">
      <header className="mm-lesson__stage" data-kind={shown.objectType}>
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
        <div className="mm-lesson__glyph">
          <Glyph card={shown} />
        </div>
        {phase === "teach" && meaning ? <p className="mm-lesson__meaning">{meaning}</p> : null}
      </header>

      {phase === "teach" && card ? (
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
                <CompositionSlide card={card} detail={detail} />
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
                <button
                  type="button"
                  className={`mm-lesson__chip${itemIndex === index ? " is-current" : ""}`}
                  title={primaryReading(item) || primaryMeaning(item)}
                  onClick={() => openItem(itemIndex)}
                >
                  <QueueGlyph card={item} />
                </button>
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
            <p className="mm-quiz__ask" data-kind={shown.objectType}>
              <span>{kindLabel(shown.objectType, t)}</span>
              <span>
                {task.prompt === "meaning" ? t("mojimori.study.meaningWord") : t("mojimori.study.readingWord")}
              </span>
            </p>
            {notice ? <p className="mm-quiz__exception">{notice}</p> : null}
            <div
              className={`mm-quiz__entry${shaking ? " is-shaking" : ""}${pending === "ok" ? " is-ok" : ""}${pending === "miss" ? " is-bad" : ""}`}
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
                      setDraft(value);
                      return;
                    }
                    const next = romajiToKanaInput(value);
                    if (!readingInputAllows(next)) {
                      setShaking(false);
                      requestAnimationFrame(() => setShaking(true));
                      return;
                    }
                    setDraft(next);
                  }}
                />
              )}
              <button type="submit" className="mm-quiz__go" aria-label={t("mojimori.study.check")}>
                <ChevronRight size={22} />
              </button>
            </div>
          </form>
        </section>
      ) : null}
      </div>

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

function QueueGlyph({ card }: { card: MojiMoriStudyCard }) {
  const subject = {
    characters: card.characters,
    characterImages: card.characterImages,
    primaryMeaning: primaryMeaning(card),
  };
  return (
    <span className={`study-character moji-status moji-status--${card.objectType} moji-status--incomplete`}>
      <span className="study-character__characters">
        <SubjectCharacter subject={subject} className="leading-none" imageClassName="h-5 w-5 object-contain" />
      </span>
    </span>
  );
}

function CompositionSlide({
  card,
  detail,
}: {
  card: MojiMoriStudyCard;
  detail: MojiMoriSubjectDetail | null;
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
  return (
    <div className="mm-lesson__copy">
      <p>{intro}</p>
      <div className="mm-lesson__parts">
        {parts.map((subject) => (
          <PartTile key={subject.id} subject={subject} />
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
    </div>
  );
}

function PartTile({ subject }: { subject: MojiMoriSubjectSummary }) {
  const mode = visualMode(subject.progress?.status ?? "locked", subject.progress?.srsStage ?? 0);
  return (
    <div className="mm-lesson__part" title={subject.primaryReading}>
      <span className={`study-character moji-status moji-status--${subject.objectType} moji-status--${mode}`}>
        <span className="study-character__characters">
          <SubjectCharacter subject={subject} className="text-[1.7rem] leading-none" imageClassName="h-8 w-8 object-contain" />
        </span>
      </span>
      <small>{subject.primaryMeaning}</small>
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
    <div className="mm-readings">
      {rows.map(([title, items]) => (
        <div key={title} className={`mm-reading${items.some((item) => item.primary) ? " is-taught" : ""}`}>
          <span>{title}</span>
          <strong lang="ja">
            {items.length > 0 ? items.map((item) => item.reading).join(", ") : t("mojimori.study.noReading")}
          </strong>
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
