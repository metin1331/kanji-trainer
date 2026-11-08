import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import HanziWriter from "hanzi-writer";
import { useTranslation } from "../../i18n/I18nProvider";

const STROKE_DATA = [
  "https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0.0.1/",
  "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/",
];

type StrokeJson = {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
};

const REPLAY = {
  strokeAnimationSpeed: 1,
  delayBetweenStrokes: 50,
};

function inkColor() {
  return document.documentElement.classList.contains("dark") ? "#f4f7fb" : "#1c1917";
}

function radicalInk() {
  return document.documentElement.classList.contains("dark") ? "#fb923c" : "#c2410c";
}

async function fetchStroke(base: string, character: string): Promise<StrokeJson | null> {
  try {
    const res = await fetch(`${base}${encodeURIComponent(character)}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as StrokeJson;
    if (!data.strokes?.length || !data.medians?.length) return null;
    return data;
  } catch {
    return null;
  }
}

function loadKanji(
  character: string,
  onLoad: (data: StrokeJson) => void,
  onError: (err?: unknown) => void,
) {
  void (async () => {
    const [jp, zh] = await Promise.all([
      fetchStroke(STROKE_DATA[0]!, character),
      fetchStroke(STROKE_DATA[1]!, character),
    ]);
    const data = jp ?? zh;
    if (!data) {
      onError(new Error("missing"));
      return;
    }
    if (!data.radStrokes?.length && zh?.radStrokes?.length && zh.strokes.length === data.strokes.length) {
      data.radStrokes = zh.radStrokes;
    }
    onLoad(data);
  })();
}

function mountWriter(
  svg: SVGSVGElement,
  character: string,
  options: {
    showCharacter: boolean;
    radicalColor: string | null;
    onLoad?: (data: StrokeJson) => void;
    onReady?: () => void;
    onError?: () => void;
  },
) {
  const size = Math.max(140, Math.round(svg.clientWidth || svg.getBoundingClientRect().width || 280));
  const writer = HanziWriter.create(svg, character, {
    width: size,
    height: size,
    padding: 16,
    showOutline: false,
    showCharacter: options.showCharacter,
    showHintAfterMisses: 3,
    highlightOnComplete: false,
    strokeAnimationSpeed: REPLAY.strokeAnimationSpeed,
    delayBetweenStrokes: REPLAY.delayBetweenStrokes,
    drawingWidth: 24,
    drawingColor: inkColor(),
    strokeColor: inkColor(),
    radicalColor: options.radicalColor,
    highlightColor: "#16a34a",
    charDataLoader: loadKanji,
    onLoadCharDataError() {
      options.onError?.();
    },
    onLoadCharDataSuccess(data) {
      options.onLoad?.(data);
      queueMicrotask(() => options.onReady?.());
    },
  });
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  return writer;
}

export type StrokePlayer = {
  play: () => Promise<void>;
};

export const DrawnKanji = forwardRef<
  StrokePlayer,
  { character: string; onStrokes?: (count: number) => void }
>(function DrawnKanji({ character, onStrokes }, ref) {
  const host = useRef<SVGSVGElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const onStrokesRef = useRef(onStrokes);
  onStrokesRef.current = onStrokes;

  useImperativeHandle(ref, () => ({
    async play() {
      const writer = writerRef.current;
      if (!writer) return;
      await writer.hideCharacter({ duration: 0 });
      await writer.animateCharacter();
    },
  }));

  useEffect(() => {
    const el = host.current;
    if (!el || !character) return;
    let cancelled = false;
    const writer = mountWriter(el, character, {
      showCharacter: true,
      radicalColor: radicalInk(),
      onLoad(data) {
        if (!cancelled) onStrokesRef.current?.(data.strokes.length);
      },
    });
    writerRef.current = writer;
    return () => {
      cancelled = true;
      writerRef.current = null;
      el.replaceChildren();
    };
  }, [character]);

  return <svg ref={host} className="mm-word__surface" />;
});

function ReplayButton({
  label,
  count,
  onReplay,
}: {
  label: string;
  count: string;
  onReplay: () => void;
}) {
  return (
    <div className="mm-word__meta">
      {count ? <span>{count}</span> : null}
      <button type="button" className="mm-word__replay" aria-label={label} onClick={onReplay}>
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

export function KanjiReview({ character }: { character: string }) {
  const { t } = useTranslation();
  const player = useRef<StrokePlayer>(null);
  const [strokes, setStrokes] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const report = useMemo(
    () => (count: number) => setStrokes(count),
    [],
  );

  async function replay() {
    if (playing) return;
    setPlaying(true);
    try {
      await player.current?.play();
    } finally {
      setPlaying(false);
    }
  }

  return (
    <div className="mm-word__pad">
      <DrawnKanji ref={player} character={character} onStrokes={report} />
      <ReplayButton
        label={t("mojimori.study.wordReplay")}
        count={strokes == null ? "" : t("mojimori.study.wordStrokes", { count: strokes })}
        onReplay={() => void replay()}
      />
    </div>
  );
}

export function wordParts(characters: string, kanji: string[]) {
  const pending = [...kanji];
  const parts: Array<{ kind: "kanji"; char: string } | { kind: "kana"; text: string }> = [];
  let kana = "";
  const flush = () => {
    if (!kana) return;
    parts.push({ kind: "kana", text: kana });
    kana = "";
  };
  for (const char of [...characters]) {
    if (pending[0] === char) {
      flush();
      parts.push({ kind: "kanji", char });
      pending.shift();
    } else {
      kana += char;
    }
  }
  flush();
  for (const char of pending) parts.push({ kind: "kanji", char });
  return parts.length > 0 ? parts : kanji.map((char) => ({ kind: "kanji" as const, char }));
}

export function WordReveal({
  characters,
  kanji,
  advanceLabel,
  onAdvance,
}: {
  characters: string;
  kanji: string[];
  advanceLabel: string;
  onAdvance: () => void;
}) {
  const { t } = useTranslation();
  const parts = useMemo(() => wordParts(characters, kanji), [characters, kanji]);
  const players = useRef<Array<StrokePlayer | null>>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [playing, setPlaying] = useState(false);
  let kanjiIndex = 0;

  async function replay() {
    if (playing) return;
    setPlaying(true);
    try {
      for (const player of players.current) {
        if (player) await player.play();
      }
    } finally {
      setPlaying(false);
    }
  }

  const tally = kanji
    .map((char, index) => (counts[index] ? `${char}: ${counts[index]}` : ""))
    .filter(Boolean)
    .join("   ");

  return (
    <div className="mm-word__board">
      <div className="mm-word__spell" lang="ja">
        {parts.map((part, index) => {
          if (part.kind === "kana") {
            return (
              <span key={`kana-${index}`} className="mm-word__kana">
                {part.text}
              </span>
            );
          }
          const slot = kanjiIndex;
          kanjiIndex += 1;
          return (
            <span key={`kanji-${index}`} className="mm-word__cell">
              <DrawnKanji
                ref={(node) => {
                  players.current[slot] = node;
                }}
                character={part.char}
                onStrokes={(count) =>
                  setCounts((prev) => (prev[slot] === count ? prev : { ...prev, [slot]: count }))
                }
              />
            </span>
          );
        })}
      </div>
      <ReplayButton
        label={t("mojimori.study.wordReplay")}
        count={tally}
        onReplay={() => void replay()}
      />
      <button type="button" className="mm-word__next" aria-label={advanceLabel} onClick={onAdvance}>
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

export function KanjiStrokeQuiz({
  character,
  unsupported,
  onDone,
}: {
  character: string;
  unsupported: string;
  onDone: () => void;
}) {
  const host = useRef<SVGSVGElement>(null);
  const done = useRef(onDone);
  const [missing, setMissing] = useState(false);
  const [shaking, setShaking] = useState(false);
  done.current = onDone;

  useEffect(() => {
    const el = host.current;
    if (!el || !character) return;
    let writer: HanziWriter | null = null;
    let cancelled = false;
    let started = false;
    setMissing(false);

    function start(instance: HanziWriter) {
      if (cancelled || started) return;
      started = true;
      void instance.quiz({
        showHintAfterMisses: 3,
        markStrokeCorrectAfterMisses: false,
        highlightOnComplete: false,
        onMistake() {
          if (cancelled) return;
          setShaking(false);
          requestAnimationFrame(() => {
            if (!cancelled) setShaking(true);
          });
        },
        onComplete() {
          if (!cancelled) done.current();
        },
      });
    }

    writer = mountWriter(el, character, {
      showCharacter: false,
      radicalColor: null,
      onError() {
        if (!cancelled) setMissing(true);
      },
      onReady() {
        if (writer) start(writer);
      },
    });
    return () => {
      cancelled = true;
      writer?.cancelQuiz();
      el.replaceChildren();
    };
  }, [character]);

  return (
    <div
      className={`mm-word__pad${shaking ? " is-shaking" : ""}`}
      onAnimationEnd={() => setShaking(false)}
    >
      <svg ref={host} className="mm-word__surface" />
      {missing ? <p className="mm-word__missing">{unsupported}</p> : null}
    </div>
  );
}
