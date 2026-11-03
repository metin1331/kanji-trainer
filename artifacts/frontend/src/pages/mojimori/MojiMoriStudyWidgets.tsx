import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MojiMoriStudySnapshot } from "../../lib/mojiMori";
import { mojiMoriSubjectHref } from "../../lib/mojiMori";
import { TodaysLessonsWidget } from "./TodaysLessonsWidget";

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
  const forecastTotal = study.forecast.hours.reduce((sum, hour) => sum + hour.count, 0);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <TodaysLessonsWidget lessons={study.lessons} />
        <div className="glass-panel p-5">
          <h2 className="text-base font-semibold">{t("mojimori.study.reviewsTitle")}</h2>
          <p className="mt-2 text-3xl font-semibold">{study.reviews.due}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {t("mojimori.study.apprenticeDue", { count: study.reviews.apprenticeDue })}
          </p>
          <Link href="/mojimori/reviews" className="moji-btn-primary mt-3">
            {t("mojimori.study.startReviews")}
          </Link>
        </div>
      </section>

      <section className="glass-panel p-5">
        <h2 className="text-base font-semibold">{t("mojimori.study.forecast")}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {t("mojimori.study.forecastDay", { count: forecastTotal })}
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {study.forecast.days.map((day) => (
            <div key={day.date} className="rounded-lg bg-white/70 px-2 py-2 text-center text-sm">
              <div className="text-[var(--color-muted)]">{day.date.slice(5)}</div>
              <div className="font-semibold">{day.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("mojimori.study.mistakes")}</h2>
          <Link href="/mojimori/extra?mode=recent-mistakes" className="moji-btn">
            {t("mojimori.study.extraTitle")}
          </Link>
        </div>
        {study.mistakes.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t("mojimori.study.none")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {study.mistakes.map((item) => (
              <li key={item.subjectId} className="flex justify-between">
                <Link
                  href={mojiMoriSubjectHref({
                    id: item.subjectId,
                    objectType: item.objectType,
                    characters: item.characters,
                  })}
                >
                  {item.characters ?? item.subjectId}
                </Link>
                <span>{item.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-base font-semibold">{t("mojimori.study.extraTitle")}</h2>
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
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <StatList title={t("mojimori.study.completed")} rows={study.completed} suffix="" />
        <StatList title={t("mojimori.study.accuracy")} rows={study.accuracy} suffix="%" />
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-3 text-base font-semibold">{t("mojimori.study.heatmap")}</h2>
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
        <h2 className="mb-3 text-base font-semibold">{t("mojimori.study.lists")}</h2>
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
        <h2 className="text-base font-semibold">{t("mojimori.study.streak")}</h2>
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
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
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
