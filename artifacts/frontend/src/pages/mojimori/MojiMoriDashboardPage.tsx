import {
  useEffect,
  useState,
  type AnimationEvent,
  type PointerEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crown,
  Egg,
  Flame,
  Gem,
  Hexagon,
  Shield,
  Sparkles,
  Star,
} from "lucide-react";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  mojiMoriSubjectsQuery,
  useMojiMoriDashboard,
  useMojiMoriSubjects,
} from "../../hooks/useMojiMori";
import {
  MOJI_MORI_LEVEL_BANDS,
  MOJI_MORI_TYPE_COLORS,
  SRS_GROUPS,
  type MojiMoriDashboard,
  type MojiMoriLevelProgress,
  type MojiMoriObjectType,
} from "../../lib/mojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { beginPress, clearFinishedPress, isHolding } from "./pressBounce";
import { SeeAllGrid } from "./SubjectTile";
import { MojiMoriStudyWidgets } from "./MojiMoriStudyWidgets";

function homeButton(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;
  const button = target.closest<HTMLElement>(".moji-btn, .moji-btn-primary");
  if (
    !button ||
    button.classList.contains("is-disabled") ||
    button.hasAttribute("disabled")
  )
    return null;
  return button;
}

function pressHomeButton(event: PointerEvent<HTMLDivElement>) {
  if (event.button !== 0) return;
  const button = homeButton(event.target);
  if (!button) return;
  beginPress(button, event.pointerId);
}

function releaseHomeButton(event: AnimationEvent<HTMLDivElement>) {
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    event.animationName !== "mm-press" ||
    isHolding(target)
  )
    return;
  clearFinishedPress(target);
}

const SPREAD_ICONS = {
  novice: Egg,
  apprentice: CircleDot,
  proficient: Hexagon,
  adept: Sparkles,
  veteran: Shield,
  expert: Star,
  master: Crown,
  grandmaster: Gem,
  legendary: Flame,
} as const;

function ItemSpread({ spread }: { spread: MojiMoriDashboard["spread"] }) {
  const { t } = useTranslation();
  const types = ["radical", "kanji", "vocabulary"] as const;
  return (
    <section className="glass-panel item-spread">
      <div className="item-spread__head">
        <h2 className="text-lg font-semibold tracking-tight sm:text-base">
          {t("mojimori.itemSpread")}
        </h2>
        <div className="item-spread__legend">
          {types.map((type) => (
            <span key={type}>
              <i style={{ background: `var(--color-${type})` }} />
              {t(`mojimori.types.${type}`)}
            </span>
          ))}
        </div>
      </div>
      <div className="item-spread__rows">
        {SRS_GROUPS.map((group) => {
          const Icon = SPREAD_ICONS[group];
          const row = spread[group];
          return (
            <div key={group} className="item-spread__row">
              <span className="item-spread__name">
                <Icon size={15} />
                <span>{t(`mojimori.srs.${group}`)}</span>
              </span>
              <span className="item-spread__counts">
                {types.map((type) => (
                  <span
                    key={type}
                    className="item-spread__pill"
                    style={{ background: `var(--color-${type})` }}
                  >
                    {row[type]}
                  </span>
                ))}
              </span>
              <span className="item-spread__total">{row.total}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LevelBody({
  progress,
  onOpen,
}: {
  progress: MojiMoriLevelProgress;
  onOpen: (type: MojiMoriObjectType) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
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
          const row = progress[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onOpen(type)}
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
              </div>
              <div className="-mx-3 mt-2 h-1.5 overflow-hidden bg-[var(--color-line)]">
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
        {progress.kanjiRemaining > 0
          ? t("mojimori.kanjiToLevelUp", { count: progress.kanjiRemaining })
          : t("mojimori.levelReady")}
      </p>
      <div className="study-progress__track mt-2">
        {Array.from(
          { length: Math.max(progress.kanjiNeeded, 1) },
          (_, index) => (
            <span
              key={index}
              className={`study-progress__step${
                index < progress.kanji.guru
                  ? "study-progress__step--completed"
                  : ""
              }`}
            />
          ),
        )}
      </div>
    </>
  );
}

const MAX_LEVEL =
  MOJI_MORI_LEVEL_BANDS[MOJI_MORI_LEVEL_BANDS.length - 1]?.end ?? 60;

function levelPercent(row: MojiMoriLevelProgress) {
  const total = row.radical.total + row.kanji.total + row.vocabulary.total;
  const done = row.radical.guru + row.kanji.guru + row.vocabulary.guru;
  if (!total) return 0;
  return (done / total) * 100;
}

export function MojiMoriDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useMojiMoriDashboard();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<MojiMoriObjectType | null>(null);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [viewLevel, setViewLevel] = useState<number | null>(null);
  const [levelMenu, setLevelMenu] = useState(false);
  const activeLevel = viewLevel ?? data?.level ?? data?.levelProgress.level;
  const sheetQuery = useMojiMoriSubjects(
    { level: activeLevel, type: sheet ?? "radical" },
    Boolean(sheet && data && activeLevel),
  );

  useEffect(() => {
    if (!activeLevel) return;
    for (const type of ["radical", "kanji", "vocabulary"] as const) {
      void queryClient.prefetchQuery(
        mojiMoriSubjectsQuery({ level: activeLevel, type }),
      );
    }
  }, [activeLevel, queryClient]);

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
        <div
          className="moji-home space-y-5"
          onPointerDown={pressHomeButton}
          onAnimationEnd={releaseHomeButton}
        >
          {data.study ? <MojiMoriStudyWidgets study={data.study} /> : null}
          <div className="dash-split">
            <section className="glass-panel level-progress">
              <div className="level-progress__inner p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight sm:text-base">
                    {t("mojimori.levelProgress")}
                  </h2>
                  <div className="level-switch flex items-stretch gap-1">
                    <button
                      type="button"
                      className="moji-btn"
                      disabled={!activeLevel || activeLevel <= 1}
                      aria-label={t("mojimori.levelPrev")}
                      onPointerUp={(event) => event.currentTarget.blur()}
                      onClick={() => {
                        if (!activeLevel || activeLevel <= 1) return;
                        setViewLevel(activeLevel - 1);
                        setLevelMenu(false);
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="moji-btn"
                      aria-expanded={levelMenu}
                      onPointerUp={(event) => event.currentTarget.blur()}
                      onClick={() => setLevelMenu((open) => !open)}
                    >
                      {t("mojimori.levelChip", {
                        level: activeLevel ?? data.levelProgress.level,
                      })}
                    </button>
                    <button
                      type="button"
                      className="moji-btn"
                      disabled={!activeLevel || activeLevel >= MAX_LEVEL}
                      aria-label={t("mojimori.levelNext")}
                      onPointerUp={(event) => event.currentTarget.blur()}
                      onClick={() => {
                        if (!activeLevel || activeLevel >= MAX_LEVEL) return;
                        setViewLevel(activeLevel + 1);
                        setLevelMenu(false);
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="level-progress__body">
                  <div
                    inert={levelMenu || undefined}
                    className={levelMenu ? "invisible" : undefined}
                  >
                    <LevelBody
                      progress={
                        data.levelStats?.find(
                          (item) => item.level === activeLevel,
                        ) ?? data.levelProgress
                      }
                      onOpen={openSheet}
                    />
                  </div>
                  {levelMenu ? (
                    <div className="moji-level-menu moji-level-menu--widget">
                      {MOJI_MORI_LEVEL_BANDS.map((band) => (
                        <div key={band.key} className="moji-level-nums">
                          {Array.from(
                            { length: band.end - band.start + 1 },
                            (_, index) => band.start + index,
                          ).map((level) => {
                            const row =
                              data.levelStats?.find(
                                (item) => item.level === level,
                              ) ??
                              (level === data.levelProgress.level
                                ? data.levelProgress
                                : null);
                            const percent = row ? levelPercent(row) : 0;
                            return (
                              <button
                                key={level}
                                type="button"
                                className={`moji-level-num is-pick ${
                                  activeLevel === level ? "is-current" : ""
                                }`}
                                onClick={() => {
                                  setViewLevel(level);
                                  setLevelMenu(false);
                                }}
                              >
                                {String(level).padStart(2, "0")}
                                <span
                                  className="level-pick-bar"
                                  aria-hidden="true"
                                >
                                  <span style={{ width: `${percent}%` }} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {sheet ? (
                <div
                  className={`level-sheet p-5 ${phase === "open" ? "is-open" : ""}`}
                >
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
                      <SeeAllGrid subjects={sheetQuery.data ?? []} grouped />
                    )}
                  </div>
                </div>
              ) : null}
            </section>
            <ItemSpread spread={data.spread} />
          </div>
        </div>
      )}
    </MojiMoriLayout>
  );
}
