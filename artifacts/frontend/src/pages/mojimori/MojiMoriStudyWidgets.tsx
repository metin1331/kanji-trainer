import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTranslation } from "../../i18n/I18nProvider";
import type {
  MojiMoriStudySnapshot,
  MojiMoriSubjectSummary,
} from "../../lib/mojiMori";
import { TodaysLessonsWidget, TypeMix } from "./TodaysLessonsWidget";
import { LevelSubjectCard } from "./SubjectTile";
import { CustomStudyModal } from "./CustomStudyModal";

function heatLevel(count: number) {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

export function MojiMoriStudyWidgets({
  study,
}: {
  study: MojiMoriStudySnapshot;
}) {
  const { t } = useTranslation();
  const [lockedDate, setLockedDate] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <>
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <TodaysLessonsWidget lessons={study.lessons} />
        <div className="glass-panel moji-reviews-widget p-5">
          <h2 className="text-lg font-semibold sm:text-base">
            {t("mojimori.study.reviewsTitle")}
          </h2>
          <div className="pt-3"></div>
          <div className="moji-queue-count">
            <p className="moji-reviews-widget__count">{study.reviews.due}</p>
            <TypeMix counts={study.reviews.byType} />
          </div>
          <p className="pt-0.5 text-sm text-[var(--color-muted)]">
            {t("mojimori.study.apprenticeDue", {
              count: study.reviews.apprenticeDue,
            })}
          </p>
          <div className="moji-reviews-widget__actions">
            <Link href="/mojimori/reviews" className="moji-btn-primary">
              {t("mojimori.study.startReviews")}
            </Link>
            <button type="button" className="hidden! moji-btn">
              Review ordering
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-lg font-semibold sm:text-base">
          {t("mojimori.study.extraTitle")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/mojimori/extra?mode=recent-lessons" className="moji-btn">
            {t("mojimori.study.recentLessons", {
              count: study.extra.recentLessons,
            })}
          </Link>
          <Link
            href="/mojimori/extra?mode=recent-mistakes"
            className="moji-btn"
          >
            {t("mojimori.study.recentMistakes", {
              count: study.extra.recentMistakes,
            })}
          </Link>
          <Link href="/mojimori/extra?mode=cooked" className="moji-btn">
            {t("mojimori.study.cookedItems", { count: study.extra.cooked })}
          </Link>
          <button type="button" className="moji-btn" onClick={() => setCustomOpen(true)}>
            {t("mojimori.study.customTitle")}
          </button>
        </div>
        {study.mistakes.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">
              {t("mojimori.study.mistakes")}
            </h3>
            <div className="mistake-row">
              {study.mistakes.map((item) => (
                <LevelSubjectCard
                  key={item.subjectId}
                  subject={mistakeCard(item)}
                  caption={false}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ForecastPanel forecast={study.forecast} />

      <ReviewStats study={study} />

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-lg font-semibold sm:text-base">
          {t("mojimori.study.heatmap")}
        </h2>
        <div className="overflow-x-auto">
          <div className="moji-heat">
            {study.heatmap.map((cell) => (
              <i
                key={cell.date}
                data-level={heatLevel(cell.count)}
                title={`${cell.date}: ${cell.count}`}
                onClick={() => setLockedDate(cell.date)}
              />
            ))}
          </div>
        </div>
        {lockedDate ? <p className="mt-2 text-sm">{lockedDate}</p> : null}
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-lg font-semibold sm:text-base">
          {t("mojimori.study.lists")}
        </h2>
        <ListColumn
          title={t("mojimori.study.cooked30")}
          items={study.lists.cooked}
        />
        <ListColumn
          title={t("mojimori.study.unlocked30")}
          items={study.lists.unlocked}
        />
        <ListColumn
          title={t("mojimori.study.critical")}
          items={study.lists.critical.map((item) => ({
            ...item,
            characters: `${item.characters ?? item.id} ${item.percent}%`,
          }))}
        />
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-lg font-semibold sm:text-base">
          {t("mojimori.study.streak")}
        </h2>
        <p className="mt-2 text-sm">
          {t("mojimori.study.streakNow", {
            current: study.streak.current,
            best: study.streak.best,
            days: study.streak.daysStudied,
          })}
        </p>
      </section>
    </div>
    {customOpen ? <CustomStudyModal onClose={() => setCustomOpen(false)} /> : null}
    </>
  );
}

function localeTag(locale: string) {
  return locale === "tr" ? "tr-TR" : "en-US";
}

function dayLabel(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    localeTag(locale),
    {
      weekday: "short",
    },
  );
}

function hourLabel(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(localeTag(locale), {
    hour: "numeric",
  });
}

function mistakeCard(
  item: MojiMoriStudySnapshot["mistakes"][number],
): MojiMoriSubjectSummary {
  const stage = item.srsStage;
  return {
    id: item.subjectId,
    objectType: item.objectType,
    level: item.level,
    slug: item.slug,
    characters: item.characters,
    primaryMeaning: item.primaryMeaning,
    primaryReading: item.primaryReading,
    characterImages: item.characterImages,
    lessonPosition: item.lessonPosition,
    progress: {
      status:
        stage >= 13
          ? "burned"
          : stage >= 5
            ? "guru"
            : stage > 0
              ? "review"
              : "locked",
      srsStage: stage,
      passed: stage >= 5,
    },
  };
}

function ForecastPanel({
  forecast,
}: {
  forecast: MojiMoriStudySnapshot["forecast"];
}) {
  const { t, locale } = useTranslation();
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");

  let running = 0;
  const days = (forecast.days ?? []).map((day) => {
    running += day.count;
    return { ...day, hours: day.hours ?? [], cumulative: running };
  });
  const peak = Math.max(1, ...days.map((day) => day.count));
  const selected = days.find((day) => day.date === dayKey) ?? null;

  useEffect(() => {
    if (!dayKey || phase !== "closed") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [dayKey, phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => {
      setDayKey(null);
      setPhase("closed");
    }, 440);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function openDay(date: string) {
    if (dayKey === date && phase === "open") {
      setPhase("closing");
      return;
    }
    setDayKey(date);
    if (phase !== "closed") setPhase("open");
  }

  function closeDay() {
    if (!dayKey || phase === "closing") return;
    setPhase("closing");
  }

  let hourRunning = selected ? selected.cumulative - selected.count : 0;
  const hours =
    selected?.hours
      .filter((hour) => hour.count > 0)
      .map((hour) => {
        hourRunning += hour.count;
        return { ...hour, cumulative: hourRunning };
      }) ?? [];
  const hourPeak = Math.max(1, ...hours.map((hour) => hour.count));

  return (
    <section className="glass-panel level-progress">
      <div className="forecast-head px-5 pt-5 pb-4">
        <p className="forecast-next">{t("mojimori.study.forecastNext")}</p>
        <p className="forecast-items">
          {t("mojimori.study.forecastItems", { count: forecast.next24 ?? 0 })}
        </p>
      </div>
      <div className="px-4 py-2">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className="forecast-row"
            onClick={() => openDay(day.date)}
          >
            <span className="forecast-day">{dayLabel(day.date, locale)}</span>
            <span className="forecast-track">
              <span
                className={`forecast-bar${day.count === 0 ? "is-empty" : ""}`}
                style={
                  day.count === 0
                    ? undefined
                    : { width: `${Math.max(6, (day.count / peak) * 100)}%` }
                }
              />
            </span>
            <span className="forecast-plus">(+{day.count})</span>
            <span className="forecast-sum">{day.cumulative}</span>
            <ChevronRight size={16} className="forecast-chevron" />
          </button>
        ))}
      </div>
      {selected ? (
        <div className={`level-sheet p-5 ${phase === "open" ? "is-open" : ""}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <button type="button" onClick={closeDay} className="moji-btn">
              <ChevronLeft size={14} />
              {dayLabel(selected.date, locale)}
            </button>
            <span className="font-semibold">
              <span className="forecast-plus">(+{selected.count})</span>{" "}
              {selected.cumulative}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {hours.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                {t("mojimori.study.none")}
              </p>
            ) : (
              hours.map((hour) => (
                <div key={hour.at} className="forecast-row">
                  <span className="forecast-day">
                    {hourLabel(hour.at, locale)}
                  </span>
                  <span className="forecast-track">
                    <span
                      className="forecast-bar"
                      style={{
                        width: `${Math.max(6, (hour.count / hourPeak) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="forecast-plus">(+{hour.count})</span>
                  <span className="forecast-sum">{hour.cumulative}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function statOf(
  rows: { key: string; current: number | null; previous: number | null }[],
  key: string,
) {
  return (
    rows.find((row) => row.key === key) ?? {
      key,
      current: null,
      previous: null,
    }
  );
}

function percentText(value: number | null) {
  if (value == null) return "–";
  return `${value.toFixed(2)}%`;
}

type ChartRange = "7d" | "month" | "year";
type ChartMetric = "count" | "percent";

function parseDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function chartRows(
  days: { date: string; count: number; correct: number }[],
  range: ChartRange,
  locale: string,
  metric: ChartMetric,
) {
  const tag = localeTag(locale);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const length = range === "7d" ? 7 : 30;
  const points =
    range === "year"
      ? Array.from({ length: 12 }, (_, month) => {
          const matched = days.filter((day) => {
            const date = parseDay(day.date);
            return (
              date.getFullYear() === today.getFullYear() &&
              date.getMonth() === month
            );
          });
          const count = matched.reduce((sum, day) => sum + day.count, 0);
          const correct = matched.reduce((sum, day) => sum + day.correct, 0);
          return {
            label: new Date(today.getFullYear(), month, 1).toLocaleDateString(
              tag,
              { month: "short" },
            ),
            count,
            correct,
          };
        })
      : Array.from({ length }, (_, index) => {
          const date = new Date(today);
          date.setDate(today.getDate() - (length - 1 - index));
          const row = byDate.get(dayKey(date));
          return {
            label:
              range === "7d"
                ? date.toLocaleDateString(tag, { weekday: "short" })
                : String(date.getDate()),
            count: row?.count ?? 0,
            correct: row?.correct ?? 0,
          };
        });
  return points.map((point) => ({
    label: point.label,
    value:
      metric === "count"
        ? point.count
        : point.count === 0
          ? 0
          : Math.round((point.correct / point.count) * 1000) / 10,
  }));
}

function ReviewStats({ study }: { study: MojiMoriStudySnapshot }) {
  const { t, locale } = useTranslation();
  const [metric, setMetric] = useState<ChartMetric | null>(null);
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [range, setRange] = useState<ChartRange>("7d");
  const week = statOf(study.accuracy, "7d");
  const today = statOf(study.completed, "today");
  const rows = useMemo(
    () => chartRows(study.reviewDays ?? [], range, locale, metric ?? "count"),
    [study.reviewDays, range, locale, metric],
  );
  const chartConfig = {
    value: {
      label: t(
        metric === "percent"
          ? "mojimori.study.accuracy"
          : "mojimori.study.completed",
      ),
      color: "var(--color-azure)",
    },
  } satisfies ChartConfig;

  useEffect(() => {
    if (!metric || phase !== "closed") return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(first);
      if (second) cancelAnimationFrame(second);
    };
  }, [metric, phase]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => {
      setMetric(null);
      setPhase("closed");
    }, 440);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function open(next: ChartMetric) {
    setRange("7d");
    if (metric === next && phase === "open") {
      setPhase("closing");
      return;
    }
    setMetric(next);
    if (phase !== "closed") setPhase("open");
  }

  function close() {
    if (!metric || phase === "closing") return;
    setPhase("closing");
  }

  return (
    <section className="glass-panel level-progress review-stats">
      <div className="review-stats__grid">
        <article className="review-stat">
          <h2>{t("mojimori.study.accuracy")}</h2>
          <p className="review-stat__value">{percentText(week.current)}</p>
          <p className="review-stat__label">{t("mojimori.study.past7Days")}</p>
          <p className="review-stat__compare">
            {t("mojimori.study.previousPeriod")}
          </p>
          <p className="review-stat__previous">{percentText(week.previous)}</p>
          <button
            type="button"
            className="moji-btn"
            onClick={() => open("percent")}
          >
            {t("mojimori.study.details")}
          </button>
        </article>
        <article className="review-stat">
          <h2>{t("mojimori.study.completed")}</h2>
          <p className="review-stat__value">{today.current ?? "–"}</p>
          <p className="review-stat__label">
            {t("mojimori.study.period.today")}
          </p>
          <p className="review-stat__compare">
            {t("mojimori.study.yesterday")}
          </p>
          <p className="review-stat__previous">
            {t("mojimori.study.reviewsCount", { count: today.previous ?? 0 })}
          </p>
          <button
            type="button"
            className="moji-btn"
            onClick={() => open("count")}
          >
            {t("mojimori.study.details")}
          </button>
        </article>
      </div>
      {metric ? (
        <div className={`level-sheet p-5 ${phase === "open" ? "is-open" : ""}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={close} className="moji-btn">
              <ChevronLeft size={14} />
              {t("mojimori.back")}
            </button>
            <div className="review-range">
              {(["7d", "month", "year"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`moji-btn${range === key ? "is-on" : ""}`}
                  aria-pressed={range === key}
                  onClick={() => setRange(key)}
                >
                  {t(`mojimori.study.period.${key}`)}
                </button>
              ))}
            </div>
          </div>
          <ChartContainer
            config={chartConfig}
            className="review-chart aspect-auto"
          >
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={range === "month" ? 4 : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                domain={metric === "percent" ? [0, 100] : [0, "auto"]}
                allowDecimals={metric === "percent"}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="font-medium">
                        {metric === "percent" ? `${value}%` : value}
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      ) : null}
    </section>
  );
}

function ListColumn({
  title,
  items,
}: {
  title: string;
  items: { id: number; characters: string | null; objectType: string }[];
}) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-sm text-[var(--color-muted)]">
        {items.length === 0
          ? "–"
          : items.map((item) => item.characters ?? item.id).join("  ")}
      </p>
    </div>
  );
}
