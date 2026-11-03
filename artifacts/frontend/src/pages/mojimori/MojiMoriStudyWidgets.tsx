import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MojiMoriStudySnapshot, MojiMoriSubjectSummary } from "../../lib/mojiMori";
import { TodaysLessonsWidget } from "./TodaysLessonsWidget";
import { LevelSubjectCard } from "./SubjectTile";

function heatLevel(count: number) {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

export function MojiMoriStudyWidgets({ study }: { study: MojiMoriStudySnapshot }) {
  const { t } = useTranslation();
  const [lockedDate, setLockedDate] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <TodaysLessonsWidget lessons={study.lessons} />
        <div className="glass-panel p-5">
          <h2 className="text-lg sm:text-base font-semibold">{t("mojimori.study.reviewsTitle")}</h2>
          <p className="mt-2 text-3xl font-semibold">{study.reviews.due}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {t("mojimori.study.apprenticeDue", { count: study.reviews.apprenticeDue })}
          </p>
          <Link href="/mojimori/reviews" className="moji-btn-primary mt-3">
            {t("mojimori.study.startReviews")}
          </Link>
        </div>
      </section>

      <ForecastPanel forecast={study.forecast} />

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-lg sm:text-base font-semibold">{t("mojimori.study.extraTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/mojimori/extra?mode=recent-lessons" className="moji-btn">
            {t("mojimori.study.recentLessons", { count: study.extra.recentLessons })}
          </Link>
          <Link href="/mojimori/extra?mode=recent-mistakes" className="moji-btn">
            {t("mojimori.study.recentMistakes", { count: study.extra.recentMistakes })}
          </Link>
          <Link href="/mojimori/extra?mode=cooked" className="moji-btn">
            {t("mojimori.study.cookedItems", { count: study.extra.cooked })}
          </Link>
        </div>
        {study.mistakes.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">{t("mojimori.study.mistakes")}</h3>
            <div className="mistake-row">
              {study.mistakes.map((item) => (
                <LevelSubjectCard key={item.subjectId} subject={mistakeCard(item)} caption={false} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <StatList title={t("mojimori.study.completed")} rows={study.completed} suffix="" />
        <StatList title={t("mojimori.study.accuracy")} rows={study.accuracy} suffix="%" />
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-lg sm:text-base font-semibold">{t("mojimori.study.heatmap")}</h2>
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
        <h2 className="mb-3 text-lg sm:text-base font-semibold">{t("mojimori.study.lists")}</h2>
        <ListColumn title={t("mojimori.study.cooked30")} items={study.lists.cooked} />
        <ListColumn title={t("mojimori.study.unlocked30")} items={study.lists.unlocked} />
        <ListColumn
          title={t("mojimori.study.critical")}
          items={study.lists.critical.map((item) => ({
            ...item,
            characters: `${item.characters ?? item.id} ${item.percent}%`,
          }))}
        />
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-lg sm:text-base font-semibold">{t("mojimori.study.streak")}</h2>
        <p className="mt-2 text-sm">
          {t("mojimori.study.streakNow", {
            current: study.streak.current,
            best: study.streak.best,
            days: study.streak.daysStudied,
          })}
        </p>
      </section>
    </div>
  );
}

function localeTag(locale: string) {
  return locale === "tr" ? "tr-TR" : "en-US";
}

function dayLabel(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString(localeTag(locale), {
    weekday: "short",
  });
}

function hourLabel(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(localeTag(locale), { hour: "numeric" });
}

function mistakeCard(item: MojiMoriStudySnapshot["mistakes"][number]): MojiMoriSubjectSummary {
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
      status: stage >= 13 ? "burned" : stage >= 5 ? "guru" : stage > 0 ? "review" : "locked",
      srsStage: stage,
      passed: stage >= 5,
    },
  };
}

function ForecastPanel({ forecast }: { forecast: MojiMoriStudySnapshot["forecast"] }) {
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
                className={`forecast-bar${day.count === 0 ? " is-empty" : ""}`}
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
              <span className="forecast-plus">(+{selected.count})</span> {selected.cumulative}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {hours.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">{t("mojimori.study.none")}</p>
            ) : (
              hours.map((hour) => (
                <div key={hour.at} className="forecast-row">
                  <span className="forecast-day">{hourLabel(hour.at, locale)}</span>
                  <span className="forecast-track">
                    <span
                      className="forecast-bar"
                      style={{ width: `${Math.max(6, (hour.count / hourPeak) * 100)}%` }}
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

function StatList({
  title,
  rows,
  suffix,
}: {
  title: string;
  rows: { key: string; current: number | null; previous: number | null }[];
  suffix: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="glass-panel p-5">
      <h2 className="mb-2 text-lg sm:text-base font-semibold">{title}</h2>
      <ul className="space-y-1 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="flex justify-between gap-3">
            <span>{t(`mojimori.study.period.${row.key}`)}</span>
            <span>
              {row.current ?? "–"}
              {row.current != null ? suffix : ""}
              {row.previous != null ? ` (${row.previous}${suffix})` : ""}
            </span>
          </li>
        ))}
      </ul>
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
