import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { useTranslation } from "../../i18n/I18nProvider";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { MojiMoriObjectType, MojiMoriStudyCard } from "../../lib/mojiMori";

function getKanjiChars(str: string): string[] {
  return [...str].filter((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0x20000 && cp <= 0x2a6df)
    );
  });
}

/** One entry per distinct kanji, stable order (picker only when length > 1). */
function orderedKanjiChars(str: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of getKanjiChars(str)) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export function strokeKanjiSource(card: MojiMoriStudyCard): string | null {
  return strokeSourceFromText(card.characters, card.wordKanji);
}

export function strokeSourceFromText(
  characters: string | null | undefined,
  wordKanji?: string[] | null,
): string | null {
  if (characters) {
    const ordered = orderedKanjiChars(characters);
    if (ordered.length > 0) return ordered.join("");
  }
  if (wordKanji?.length) {
    const ordered = orderedKanjiChars(wordKanji.join(""));
    if (ordered.length > 0) return ordered.join("");
  }
  return null;
}

function charToHex(char: string): string {
  return (char.codePointAt(0) ?? 0).toString(16).padStart(5, "0");
}

function rgbParts(cssColor: string): [number, number, number] | null {
  const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function themeHost(): Element {
  return (
    document.querySelector(".moji-mori.mm-stroke-modal__backdrop") ??
    document.querySelector(".moji-mori") ??
    document.documentElement
  );
}

function resolveCssRgb(variable: string): [number, number, number] | null {
  const host = themeHost();
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  host.appendChild(probe);
  const parts = rgbParts(getComputedStyle(probe).color);
  host.removeChild(probe);
  return parts;
}

function oklabToOklch(L: number, a: number, b: number) {
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function srgbToOklch(r: number, g: number, b: number) {
  const channel = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const lr = channel(r);
  const lg = channel(g);
  const lb = channel(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return oklabToOklch(L * 100, A, B);
}

function resolveTypeOklch(kind: MojiMoriObjectType): { l: number; c: number; h: number } | null {
  const host = themeHost();
  const raw = getComputedStyle(host as HTMLElement)
    .getPropertyValue(`--color-${kind}`)
    .trim();
  const oklchMatch = raw.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/i);
  if (oklchMatch) {
    return { l: +oklchMatch[1], c: +oklchMatch[2], h: +oklchMatch[3] };
  }
  const oklabMatch = raw.match(/oklab\(\s*([\d.]+)%\s+([\d.eE+-]+)\s+([\d.eE+-]+)/i);
  if (oklabMatch) {
    return oklabToOklch(+oklabMatch[1], +oklabMatch[2], +oklabMatch[3]);
  }
  const rgb = resolveCssRgb(`--color-${kind}`);
  return rgb ? srgbToOklch(...rgb) : null;
}

function getStrokeGradientColor(
  i: number,
  total: number,
  base: { l: number; c: number; h: number },
): string {
  if (total <= 1) {
    return `oklch(${base.l.toFixed(2)}% ${base.c.toFixed(4)} ${base.h.toFixed(2)})`;
  }
  const mid = (total - 1) / 2;
  const span = Math.max(1, mid);
  const dist = (i - mid) / span;
  const lighten = 5.5;
  const chromaBump = 0.035;
  const l = Math.min(100, Math.max(0, base.l - dist * lighten));
  const c = Math.max(0, base.c * (1 + Math.abs(dist) * chromaBump));
  return `oklch(${l.toFixed(2)}% ${c.toFixed(4)} ${base.h.toFixed(2)})`;
}

function strokeColor(i: number, total: number, kind: MojiMoriObjectType) {
  const base = resolveTypeOklch(kind);
  if (!base) {
    const rgb = resolveCssRgb(`--color-${kind}`);
    return rgb ? `rgb(${rgb.join(", ")})` : "#333";
  }
  return getStrokeGradientColor(i, total, base);
}

export function MojiStrokeModal({
  kanji,
  objectType,
  onClose,
}: {
  kanji: string;
  objectType: MojiMoriObjectType;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const chars = orderedKanjiChars(kanji);
  const [charIndex, setCharIndex] = useState(0);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const currentChar = chars[charIndex] ?? "";

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const runAnimation = useCallback(() => {
    if (!svgRef.current) return;
    clearTimers();

    const svgEl = svgRef.current.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      if (!svgEl.getAttribute("viewBox")) {
        svgEl.setAttribute("viewBox", "0 0 109 109");
      }
      svgEl.style.background = "transparent";
    }

    const strokeGroup = svgRef.current.querySelector('[id*="StrokePaths"]');
    const numGroup = svgRef.current.querySelector(
      '[id*="StrokeNumbers"]',
    ) as SVGGElement | null;

    if (!strokeGroup) return;

    const paths = Array.from(
      strokeGroup.querySelectorAll("path"),
    ) as SVGPathElement[];
    const total = paths.length;

    const textEls = numGroup
      ? (Array.from(numGroup.querySelectorAll("text")) as SVGTextElement[])
      : [];

    if (numGroup) {
      numGroup.style.display = "";
      const texts = Array.from(numGroup.querySelectorAll("text"));
      texts.forEach((node, i) => {
        const color = strokeColor(i, texts.length, objectType);
        node.setAttribute("fill", color);
        node.style.fontSize = "9px";
        node.style.fontFamily = "helvetica";
        node.style.fontWeight = "bold";
        node.style.opacity = "0";
      });
    }

    paths.forEach((path, i) => {
      const len = path.getTotalLength();
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", strokeColor(i, total, objectType));
      path.setAttribute("stroke-width", "4");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.style.transition = "none";
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
    });

    svgRef.current.getBoundingClientRect();
    svgRef.current.style.opacity = "1";

    const DELAY = 320;
    const DURATION = 300;

    paths.forEach((path, i) => {
      const ts = setTimeout(() => {
        path.style.transition = `stroke-dashoffset ${DURATION}ms ease`;
        path.style.strokeDashoffset = "0";
      }, i * DELAY);
      timersRef.current.push(ts);

      if (textEls[i]) {
        const tn = setTimeout(
          () => {
            textEls[i]!.style.transition = "opacity 0.15s ease";
            textEls[i]!.style.opacity = "1";
          },
          i * DELAY + DURATION,
        );
        timersRef.current.push(tn);
      }
    });
  }, [objectType]);

  useEffect(() => {
    if (!currentChar) return;
    setLoading(true);
    setError(false);
    setSvgContent(null);

    const hex = charToHex(currentChar);
    const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.text();
      })
      .then((text) => {
        const cleaned = text
          .replace(/<\?xml[\s\S]*?\?>/i, "")
          .replace(/<!DOCTYPE[\s\S]*?(?:\[[\s\S]*?\])?\s*>/i, "")
          .trim();
        setSvgContent(cleaned);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return clearTimers;
  }, [currentChar]);

  useEffect(() => {
    if (!svgContent) return;
    if (svgRef.current) svgRef.current.style.opacity = "0";
    const timer = setTimeout(runAnimation, 60);
    return () => clearTimeout(timer);
  }, [svgContent, runAnimation]);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === backdropRef.current) onClose();
  }

  if (chars.length === 0) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="moji-mori mm-stroke-modal__backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="mm-stroke-modal__panel"
        data-type={objectType}
        role="dialog"
        aria-modal="true"
        aria-label={t("kanjiStroke.title")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mm-stroke-modal__head">
          <p className="mm-stroke-modal__label">{t("kanjiStroke.title")}</p>
          <div className="mm-stroke-modal__tools">
            {svgContent && !loading ? (
              <button
                type="button"
                onClick={runAnimation}
                className="mm-stroke-modal__icon-btn"
                title={t("a11y.replayAnimation")}
              >
                <RefreshCw size={15} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="mm-stroke-modal__icon-btn"
              aria-label={t("common.close")}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {chars.length > 1 ? (
          <div className="mm-stroke-modal__picker">
            <button
              type="button"
              onClick={() => setCharIndex((i) => Math.max(0, i - 1))}
              disabled={charIndex === 0}
              className="mm-stroke-modal__nav"
            >
              <ChevronLeft size={16} />
            </button>
            {chars.map((c, i) => (
              <button
                key={`${c}-${i}`}
                type="button"
                onClick={() => setCharIndex(i)}
                className={`mm-stroke-modal__pick${i === charIndex ? " is-on" : ""}`}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCharIndex((i) => Math.min(chars.length - 1, i + 1))}
              disabled={charIndex === chars.length - 1}
              className="mm-stroke-modal__nav"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="mm-stroke-modal__hero" lang="ja">
            {currentChar}
          </div>
        )}

        <div className="mm-stroke-modal__stage">
          {loading ? (
            <LoadingSpinner size={32} className="text-[var(--color-muted)]" />
          ) : null}
          {error ? (
            <div className="mm-stroke-modal__missing">
              <p className="mm-stroke-modal__hero" lang="ja">
                {currentChar}
              </p>
              <p className="mm-stroke-modal__hint">{t("kanjiStroke.svgNotFound")}</p>
            </div>
          ) : null}
          {svgContent && !loading ? (
            <div
              ref={svgRef}
              className="mm-stroke-modal__svg"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function StrokeGlyphTrigger({
  card,
  className,
  children,
}: {
  card: MojiMoriStudyCard;
  className?: string;
  children: ReactNode;
}) {
  return (
    <StrokeSubjectTrigger
      characters={card.characters}
      wordKanji={card.wordKanji}
      objectType={card.objectType}
      className={className}
    >
      {children}
    </StrokeSubjectTrigger>
  );
}

export function StrokeSubjectTrigger({
  characters,
  wordKanji,
  objectType,
  className,
  children,
}: {
  characters: string | null | undefined;
  wordKanji?: string[] | null;
  objectType: MojiMoriObjectType;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const source = strokeSourceFromText(characters, wordKanji);
  if (!source) {
    if (!className) return <>{children}</>;
    return (
      <button type="button" className={`mm-stroke-glyph-trigger ${className}`} disabled>
        {children}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`mm-stroke-glyph-trigger${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open ? (
        <MojiStrokeModal
          kanji={source}
          objectType={objectType}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
