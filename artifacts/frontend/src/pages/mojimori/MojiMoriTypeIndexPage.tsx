import { useMemo, useState } from "react";
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
          <p className="text-sm text-[#888]">
            {t("mojimori.levelsRange", { start: band.start, end: band.end })}
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-9 w-56 rounded-md" />
        ) : (
          <select
            value={bandIndex}
            onChange={(e) => {
              const next = MOJI_MORI_LEVEL_BANDS[Number(e.target.value)];
              if (!next) return;
              navigate(`/mojimori/${mojiMoriTypePath(type)}?band=${next.key}`);
            }}
            className="rounded-md border border-[#ddd] bg-white px-3 py-2 text-sm"
            style={{ borderColor: color, color }}
          >
            {MOJI_MORI_LEVEL_BANDS.map((item, index) => (
              <option key={item.key} value={index}>
                {item.ja} {t(`mojimori.bands.${item.key}`)} ·{" "}
                {t("mojimori.levelsRange", { start: item.start, end: item.end })}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-14" />
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="h-8 w-8 rounded-md" />
            ))}
          </>
        ) : (
          <>
        <span className="text-sm text-[#888]">{t("mojimori.nav.levels")}</span>
        {Array.from({ length: 10 }, (_, i) => band.start + i).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() =>
              setLevelFilter((current) => (current === level ? null : level))
            }
            className={`min-w-8 rounded-md border px-2 py-1 text-sm ${
              levelFilter === level
                ? "text-[var(--color-ink)]"
                : "border-[var(--color-line)] bg-white text-[var(--color-muted)]"
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
        <p className="text-sm text-[#888]">{t("mojimori.empty")}</p>
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
                    <span className="text-sm font-normal text-[#999]">
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
                <div className="flex flex-wrap gap-3 p-4">
                  {subjects.map((subject) => (
                    <LevelSubjectCard key={subject.id} subject={subject} />
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
