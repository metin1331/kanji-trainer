import { useEffect, useRef, useState, useCallback } from "react";
import { X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "../i18n/I18nProvider";
import { LoadingSpinner } from "./LoadingSpinner";

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

function charToHex(char: string): string {
  return (char.codePointAt(0) ?? 0).toString(16).padStart(5, "0");
}

function getMainOKLCH() {
  const styles = getComputedStyle(document.documentElement);
  const main600 = styles.getPropertyValue("--main-600").trim();

  const match = main600.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/);

  if (!match) return null;

  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}

function getStrokeGradientColor(
  i: number,
  total: number,
  base: { l: number; c: number; h: number },
): string {
  const t = total <= 1 ? 0 : i / (total - 1);

  const l = Math.min(100, base.l + (1 - t) * 22);
  const c = Math.max(0, base.c * (0.85 + t * 0.2));

  return `oklch(${l.toFixed(2)}% ${c.toFixed(4)} ${base.h})`;
}

function strokeColor(i: number, total: number) {
  const base = getMainOKLCH();
  if (!base) return "black";

  return getStrokeGradientColor(i, total, base);
}

interface Props {
  kanji: string;
  onClose: () => void;
  variant?: "modal" | "sheet";
}

export function KanjiStrokeModal({ kanji, onClose, variant = "modal" }: Props) {
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

    // Style & reset stroke numbers
    const textEls = numGroup
      ? (Array.from(numGroup.querySelectorAll("text")) as SVGTextElement[])
      : [];

    if (numGroup) {
      numGroup.style.display = "";

      const texts = Array.from(numGroup.querySelectorAll("text"));
      const base = getMainOKLCH();
      if (!base) return;

      texts.forEach((t, i) => {
        const color = getStrokeGradientColor(i, texts.length, base);

        t.setAttribute("fill", color);

        t.style.fontSize = "9px";
        t.style.fontFamily = "helvetica";
        t.style.fontWeight = "bold";
        t.style.opacity = "0";
      });
    }

    // Reset stroke paths
    paths.forEach((path, i) => {
      const len = path.getTotalLength();
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", strokeColor(i, total));
      path.setAttribute("stroke-width", "4");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.style.transition = "none";
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
    });

    // Force reflow, then reveal (paths are now reset/hidden)
    svgRef.current.getBoundingClientRect();
    svgRef.current.style.opacity = "1";

    const DELAY = 320;
    const DURATION = 300;

    paths.forEach((path, i) => {
      // Animate stroke
      const ts = setTimeout(() => {
        path.style.transition = `stroke-dashoffset ${DURATION}ms ease`;
        path.style.strokeDashoffset = "0";
      }, i * DELAY);
      timersRef.current.push(ts);

      // Show number when stroke finishes drawing
      if (textEls[i]) {
        const tn = setTimeout(
          () => {
            textEls[i].style.transition = "opacity 0.15s ease";
            textEls[i].style.opacity = "1";
          },
          i * DELAY + DURATION,
        );
        timersRef.current.push(tn);
      }
    });
  }, []);

  // Fetch SVG when char changes
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
        // Strip <?xml?> declaration and <!DOCTYPE ...> block (incl. internal subset [...])
        // so the raw text content doesn't leak into the rendered HTML
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

  // Run animation after SVG mounts in DOM
  useEffect(() => {
    if (!svgContent) return;
    // Hide immediately to prevent flash of un-animated paths
    if (svgRef.current) svgRef.current.style.opacity = "0";
    const t = setTimeout(runAnimation, 60);
    return () => clearTimeout(t);
  }, [svgContent, runAnimation]);

  useEffect(() => () => clearTimers(), []);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  if (chars.length === 0) return null;

  return (
    <div
      ref={backdropRef}
      className={
        variant === "sheet"
          ? "fixed inset-0 z-50 flex items-end justify-center bg-black/30"
          : "modal-backdrop"
      }
      style={variant === "sheet" ? undefined : { alignItems: "center" }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-app-surface overflow-hidden shadow-2xl"
        style={
          variant === "sheet"
            ? {
                width: "100%",
                maxWidth: 420,
                borderRadius: "16px 16px 0 0",
                maxHeight: "70vh",
                overflowY: "auto",
              }
            : { width: 296, borderRadius: 16 }
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="text-app-text-muted text-[11px] font-semibold tracking-widest uppercase">
            {t("kanjiStroke.title")}
          </p>
          <div className="flex items-center gap-0.5">
            {svgContent && !loading && (
              <button
                onClick={runAnimation}
                className="hover:bg-app-muted text-app-text-muted rounded-lg p-1.5 transition-colors"
                title={t("a11y.replayAnimation")}
              >
                <RefreshCw size={13} />
              </button>
            )}
            <button
              onClick={onClose}
              className="hover:bg-app-muted text-app-text-muted rounded-lg p-1.5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Multi-char picker */}
        {chars.length > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 pb-2">
            <button
              onClick={() => setCharIndex((i) => Math.max(0, i - 1))}
              disabled={charIndex === 0}
              className="text-app-text-muted hover:text-app-text-secondary p-1 transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            {chars.map((c, i) => (
              <button
                key={i}
                onClick={() => setCharIndex(i)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold transition-all"
                style={
                  i === charIndex
                    ? {
                        background:
                          "linear-gradient(135deg, var(--main-400), var(--main-600))",
                        color: "white",
                      }
                    : { color: "#9ca3af" }
                }
              >
                {c}
              </button>
            ))}
            <button
              onClick={() =>
                setCharIndex((i) => Math.min(chars.length - 1, i + 1))
              }
              disabled={charIndex === chars.length - 1}
              className="text-app-text-muted hover:text-app-text-secondary p-1 transition-colors disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Single char big display */}
        {chars.length === 1 && (
          <div className="pb-1 text-center">
            <span className="text-app-text text-5xl font-bold">
              {currentChar}
            </span>
          </div>
        )}

        {/* SVG area */}
        <div
          className="mx-4 mb-4 flex items-center justify-center rounded-xl"
          style={{ height: 248, background: "#f9f9f9" }}
        >
          {loading && (
            <LoadingSpinner size={32} className="text-app-text-muted" />
          )}
          {error && (
            <div className="px-6 text-center">
              <p className="text-app-border-strong mb-2 text-3xl">
                {currentChar}
              </p>
              <p className="text-app-text-muted text-xs">
                {t("kanjiStroke.svgNotFound")}
              </p>
            </div>
          )}
          {svgContent && !loading && (
            <div
              ref={svgRef}
              style={{ width: 216, height: 216 }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
