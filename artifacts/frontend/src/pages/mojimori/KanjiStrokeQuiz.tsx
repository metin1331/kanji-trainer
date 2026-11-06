import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";

const STROKE_DATA = [
  "https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0.0.1/",
  "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/",
];

function loadKanji(
  character: string,
  onLoad: (data: { strokes: string[]; medians: number[][][] }) => void,
  onError: (err?: unknown) => void,
) {
  const encoded = encodeURIComponent(character);
  const read = (index: number) => {
    const base = STROKE_DATA[index];
    if (!base) {
      onError(new Error("missing"));
      return;
    }
    fetch(`${base}${encoded}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ strokes?: string[]; medians?: number[][][] }>;
      })
      .then((data) => {
        if (!data.strokes?.length || !data.medians?.length) throw new Error("empty");
        onLoad({ strokes: data.strokes, medians: data.medians });
      })
      .catch(() => read(index + 1));
  };
  read(0);
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
  const host = useRef<HTMLDivElement>(null);
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
    const size = Math.max(180, Math.round(el.clientWidth || 280));
    const dark = document.documentElement.classList.contains("dark");
    const ink = dark ? "#f4f7fb" : "#1c1917";

    function start(instance: HanziWriter) {
      if (cancelled || started) return;
      started = true;
      void instance.quiz({
        showHintAfterMisses: false,
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

    let instance: HanziWriter | null = null;
    instance = HanziWriter.create(el, character, {
      width: size,
      height: size,
      padding: 16,
      showOutline: false,
      showCharacter: false,
      showHintAfterMisses: false,
      highlightOnComplete: false,
      drawingWidth: 24,
      drawingColor: ink,
      strokeColor: ink,
      highlightColor: "#16a34a",
      charDataLoader: loadKanji,
      onLoadCharDataError() {
        if (!cancelled) setMissing(true);
      },
      onLoadCharDataSuccess() {
        queueMicrotask(() => {
          if (instance) start(instance);
        });
      },
    });
    writer = instance;
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
      <div ref={host} className="mm-word__surface" />
      {missing ? <p className="mm-word__missing">{unsupported}</p> : null}
    </div>
  );
}
