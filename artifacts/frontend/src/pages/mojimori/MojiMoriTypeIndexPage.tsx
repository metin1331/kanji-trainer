import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useSearch } from "wouter";
import Skeleton from "@/components/smoothui/skeleton";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriSubjects } from "../../hooks/useMojiMori";
import {
  MOJI_MORI_LEVEL_BANDS,
  MOJI_MORI_TYPE_COLORS,
  isMojiMoriType,
  mojiMoriTypePath,
  type MojiMoriObjectType,
} from "../../lib/mojiMori";
import NotFound from "../not-found";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { LevelSubjectCard } from "./SubjectTile";

function bandLabel(
  item: (typeof MOJI_MORI_LEVEL_BANDS)[number],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return `${item.ja} ${t(`mojimori.bands.${item.key}`)} · ${t("mojimori.levelsRange", {
    start: item.start,
    end: item.end,
  })}`;
}

function BandMenu({
  bandIndex,
  color,
  onPick,
}: {
  bandIndex: number;
  color: string;
  onPick: (key: string) => void;
}) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(bandIndex);
  const current = MOJI_MORI_LEVEL_BANDS[bandIndex] ?? MOJI_MORI_LEVEL_BANDS[0]!;

  useEffect(() => {
    if (!open) return;
    setHighlight(bandIndex);
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, bandIndex]);

  function choose(index: number) {
    const next = MOJI_MORI_LEVEL_BANDS[index];
    if (!next) return;
    setOpen(false);
    onPick(next.key);
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setHighlight(bandIndex);
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => (index + 1) % MOJI_MORI_LEVEL_BANDS.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => (index - 1 + MOJI_MORI_LEVEL_BANDS.length) % MOJI_MORI_LEVEL_BANDS.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(highlight);
    }
  }

  return (
    <div ref={rootRef} className={`mm-band-select${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="mm-band-select__control"
        style={{ borderColor: color, color }}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKey}
      >
        <span>{bandLabel(current, t)}</span>
        <span className="mm-band-select__arrow" aria-hidden="true" />
      </button>
      {open ? (
        <ul className="mm-band-select__drop" role="listbox">
          {MOJI_MORI_LEVEL_BANDS.map((item, index) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="option"
                aria-selected={index === bandIndex}
                className={`mm-band-select__option${index === bandIndex ? " is-selected" : ""}${
                  index === highlight ? " is-highlighted" : ""
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(index)}
              >
                {bandLabel(item, t)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function typeFromPath(path: string): MojiMoriObjectType | null {
  if (path.endsWith("/radicals")) return "radical";
  if (path.endsWith("/kanji")) return "kanji";
  if (path.endsWith("/vocabulary")) return "vocabulary";
  return null;
}

export function MojiMoriTypeIndexPage() {
  const { t } = useTranslation();
  const [path, navigate] = useLocation();
  const bandKey = new URLSearchParams(useSearch()).get("band");
  const type = typeFromPath(path);
  const bandIndex = Math.max(
    0,
    MOJI_MORI_LEVEL_BANDS.findIndex((item) => item.key === bandKey),
  );
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [filterKey, setFilterKey] = useState(`${type}:${bandIndex}`);
  if (filterKey !== `${type}:${bandIndex}`) {
    setFilterKey(`${type}:${bandIndex}`);
    setLevelFilter(null);
  }
  const band = MOJI_MORI_LEVEL_BANDS[bandIndex]!;
  const { data, isLoading } = useMojiMoriSubjects(
    {
      type: type ?? undefined,
      levelMin: band.start,
      levelMax: band.end,
    },
    type != null,
  );

  const grouped = useMemo(() => {
    const map = new Map<number, NonNullable<typeof data>>();
    for (const subject of data ?? []) {
      const list = map.get(subject.level) ?? [];
      list.push(subject);
      map.set(subject.level, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  if (!type || !isMojiMoriType(type)) {
    return <NotFound />;
  }

  const color = MOJI_MORI_TYPE_COLORS[type];
  const visible = grouped.filter(
    ([level]) => levelFilter == null || level === levelFilter,
  );

  return (
    <MojiMoriLayout>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color }}>
            {t(`mojimori.types.${type}`)}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            {t("mojimori.levelsRange", { start: band.start, end: band.end })}
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-9 w-56 rounded-md" />
        ) : (
          <>
            <select
              value={bandIndex}
              onChange={(e) => {
                const next = MOJI_MORI_LEVEL_BANDS[Number(e.target.value)];
                if (!next) return;
                navigate(`/mojimori/${mojiMoriTypePath(type)}?band=${next.key}`);
              }}
              className="mm-band-select__native cursor-pointer rounded-md border-2 border-[#ddd] bg-[var(--color-surface)] px-3 py-2 text-sm"
              style={{ borderColor: color, color }}
            >
              {MOJI_MORI_LEVEL_BANDS.map((item, index) => (
                <option key={item.key} value={index}>
                  {bandLabel(item, t)}
                </option>
              ))}
            </select>
            <BandMenu
              bandIndex={bandIndex}
              color={color}
              onPick={(key) => navigate(`/mojimori/${mojiMoriTypePath(type)}?band=${key}`)}
            />
          </>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1">
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-14" />
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-8 rounded-md" />
            ))}
          </>
        ) : (
          <>
        <span className="mr-2 text-sm text-[var(--color-muted)]">{t("mojimori.nav.levels")}</span>
        {Array.from({ length: 10 }, (_, i) => band.start + i).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() =>
              setLevelFilter((current) => (current === level ? null : level))
            }
            className={`min-w-8 rounded-sm border px-2 py-1 text-sm cursor-pointer ${
              levelFilter === level
                ? "text-[var(--color-white)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
            }`}
            style={
              levelFilter === level
                ? { background: color, borderColor: color }
                : undefined
            }
          >
            {level}
          </button>
        ))}
          </>
        )}
      </div>

      {isLoading ? (
        <MojiMoriLoading />
      ) : visible.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{t("mojimori.empty")}</p>
      ) : (
        <div className="space-y-6">
          {visible.map(([level, subjects]) => {
            const unlocked = subjects.filter(
              (item) => item.progress?.status !== "locked",
            ).length;
            const ratio = subjects.length ? unlocked / subjects.length : 0;
            return (
              <section key={level} className="glass-panel overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <h2 className="font-semibold" style={{ color }}>
                    {t("mojimori.levelHeading", { level })}{" "}
                    <span className="text-sm font-normal text-[var(--color-muted)]">
                      {t("mojimori.unlockedCount", {
                        unlocked,
                        total: subjects.length,
                      })}
                    </span>
                  </h2>
                </div>
                <div className="h-1.5 bg-[var(--color-line)]">
                  <div
                    className="h-full"
                    style={{ width: `${ratio * 100}%`, background: color }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  {subjects.map((subject) => (
                    <LevelSubjectCard
                      key={subject.id}
                      subject={subject}
                      caption
                      showBar={false}
                      className="subject-tile"
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </MojiMoriLayout>
  );
}
