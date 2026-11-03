import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, SquareChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  useMojiMoriDashboard,
  useMojiMoriSubjects,
} from "../../hooks/useMojiMori";
import {
  MOJI_MORI_TYPE_COLORS,
  SRS_GROUPS,
  type MojiMoriObjectType,
  type MojiMoriTypeCounts,
} from "../../lib/mojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { SeeAllGrid } from "./SubjectTile";
import { MojiMoriStudyWidgets } from "./MojiMoriStudyWidgets";

function TypePills({ counts }: { counts: MojiMoriTypeCounts }) {
  const items = [
    ["radical", counts.radical],
    ["kanji", counts.kanji],
    ["vocabulary", counts.vocabulary],
  ] as const;
  return (
    <span className="mt-2 flex gap-1">
      {items.map(([type, count]) => (
        <span
          key={type}
          className="min-w-7 rounded px-1.5 py-0.5 text-center text-xs font-semibold text-[var(--color-ink)]"
          style={{ background: MOJI_MORI_TYPE_COLORS[type] }}
        >
          {count}
        </span>
      ))}
    </span>
  );
}

export function MojiMoriDashboardPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data, isLoading } = useMojiMoriDashboard();
  const [sheet, setSheet] = useState<MojiMoriObjectType | null>(null);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const sheetQuery = useMojiMoriSubjects(
    { level: data?.levelProgress.level, type: sheet ?? "radical" },
    Boolean(sheet && data),
  );

  useEffect(() => {
    if (!sheet || phase !== "closed") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [sheet, phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => {
      setSheet(null);
      setPhase("closed");
    }, 440);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function openSheet(type: MojiMoriObjectType) {
    if (sheet === type && phase === "open") {
      setPhase("closing");
      return;
    }
    setSheet(type);
    if (phase !== "closed") setPhase("open");
  }

  function closeSheet() {
    if (!sheet || phase === "closing") return;
    setPhase("closing");
  }

  return (
    <MojiMoriLayout>
      {isLoading || !data ? (
        <MojiMoriLoading />
      ) : (
        <div className="space-y-5">
          {data.study ? <MojiMoriStudyWidgets study={data.study} /> : null}
          <section className="glass-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">
                {t("mojimori.itemSpread")}
              </h2>
              <span className="flex gap-3 text-xs font-bold">
                <span style={{ color: MOJI_MORI_TYPE_COLORS.radical }}>
                  {t("mojimori.types.radical")}
                </span>
                <span style={{ color: MOJI_MORI_TYPE_COLORS.kanji }}>
                  {t("mojimori.types.kanji")}
                </span>
                <span style={{ color: MOJI_MORI_TYPE_COLORS.vocabulary }}>
                  {t("mojimori.types.vocabulary")}
                </span>
              </span>
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {SRS_GROUPS.map((group) => (
                <div
                  key={group}
                  className="rounded-lg border border-[var(--color-line)] bg-white/70 px-3 py-2"
                >
                  <div className="text-sm font-medium text-[var(--color-muted)]">
                    {t(`mojimori.srs.${group}`)}
                  </div>
                  <div className="text-right text-sm font-semibold">
                    {data.spread[group].total}
                  </div>
                  <TypePills counts={data.spread[group]} />
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel level-progress">
            <div className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">
                {t("mojimori.levelProgress")}
              </h2>
              <button
                type="button"
                onClick={() =>
                  navigate(`/mojimori/levels/${data.levelProgress.level}`)
                }
                className="moji-btn"
              >
                {t("mojimori.levelChip", { level: data.levelProgress.level })}
                <ChevronRight size={14} />
              </button>
            </div>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              {t("mojimori.guruInLevel")}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["radical", "radicals"],
                  ["kanji", "kanji"],
                  ["vocabulary", "vocabulary"],
                ] as const
              ).map(([type]) => {
                const row = data.levelProgress[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => openSheet(type)}
                    data-type={type}
                    className="level-type-card p-3 text-left hover:cursor-pointer"
                  >
                    <div className="mb-2 flex items-center gap-2 font-light">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded border text-[14px] leading-none font-thin text-white"
                        style={{
                          background: `var(--color-${type})`,
                          borderColor: `var(--color-${type}-dark)`,
                        }}
                      >
                        {type === "radical" ? "大" : type === "kanji" ? "字" : "言"}
                      </span>
                      {t(`mojimori.types.${type}`)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {row.guru}/{row.total}
                      </span>
                      <span className="font-medium text-[var(--color-muted)]">
                        {/* {t("mojimori.seeAll")} */}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden -mx-3 bg-[var(--color-line)]">
                      <div
                        className="h-full"
                        style={{
                          width: row.total
                            ? `${(row.guru / row.total) * 100}%`
                            : "0%",
                          background: MOJI_MORI_TYPE_COLORS[type],
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-sm">
              {data.levelProgress.kanjiRemaining > 0
                ? t("mojimori.kanjiToLevelUp", {
                    count: data.levelProgress.kanjiRemaining,
                  })
                : t("mojimori.levelReady")}
            </p>
            <div className="study-progress__track mt-2">
              {Array.from(
                { length: Math.max(data.levelProgress.kanjiNeeded, 1) },
                (_, index) => (
                  <span
                    key={index}
                    className={`study-progress__step${
                      index < data.levelProgress.kanji.guru
                        ? " study-progress__step--completed"
                        : ""
                    }`}
                  />
                ),
              )}
            </div>

            </div>
            {sheet ? (
              <div className={`level-sheet p-5 ${phase === "open" ? "is-open" : ""}`}>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="moji-btn"
                  >
                    <ChevronLeft size={14} />
                    {t("mojimori.back")}
                  </button>
                  <span
                    className="font-semibold"
                    style={{ color: MOJI_MORI_TYPE_COLORS[sheet] }}
                  >
                    {t(`mojimori.types.${sheet}`)}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {sheetQuery.isLoading ? (
                    <MojiMoriLoading shape="tiles" />
                  ) : (
                    <SeeAllGrid subjects={sheetQuery.data ?? []} />
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </MojiMoriLayout>
  );
}
