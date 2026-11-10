import { Link } from "wouter";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MojiMoriStudySnapshot, MojiMoriTypeCounts } from "../../lib/mojiMori";

const TYPE_ORDER = ["radical", "kanji", "vocabulary"] as const;

export function TypeMix({ counts }: { counts?: MojiMoriTypeCounts }) {
  const { t } = useTranslation();
  const safe = counts ?? { radical: 0, kanji: 0, vocabulary: 0 };
  return (
    <ul className="moji-queue-mix">
      {TYPE_ORDER.map((type) => (
        <li key={type} data-type={type}>
          {safe[type]} {t(`mojimori.types.${type}`)}
        </li>
      ))}
    </ul>
  );
}

export function TodaysLessonsWidget({
  lessons,
}: {
  lessons: MojiMoriStudySnapshot["lessons"];
}) {
  const { t } = useTranslation();
  const today =
    lessons.dailyRemaining == null
      ? lessons.available
      : Math.min(lessons.available, lessons.dailyRemaining);
  const canStart = today > 0;
  const canPick = lessons.available > 0;

  return (
    <section className="glass-panel moji-lessons-widget p-5">
      <h2 className="text-lg sm:text-base font-semibold">{t("mojimori.study.todaysLessons")}</h2>
      <div className="pt-3"></div>
      <div className="moji-queue-count">
        <p className="moji-lessons-widget__count">{today}</p>
        <TypeMix counts={lessons.byType} />
      </div>
      <p className="pt-0.5 text-sm text-[var(--color-muted)]">
        {lessons.dailyRemaining == null
          ? t("mojimori.study.unlimited")
          : t("mojimori.study.dailyLeft", { count: lessons.dailyRemaining })}
      </p>
      {lessons.available !== today ? (
        <p className="pt-0.5 text-sm text-[var(--color-muted)]">
          {t("mojimori.study.unlockedPile", { count: lessons.available })}
        </p>
      ) : null}
      <div className="moji-lessons-widget__actions">
        {canStart ? (
          <Link href="/mojimori/lessons" className="moji-btn-primary">
            {t("mojimori.study.startLessons")}
          </Link>
        ) : (
          <span className="moji-btn-primary is-disabled" aria-disabled="true">
            {t("mojimori.study.startLessons")}
          </span>
        )}
        {canPick ? (
          <Link href="/mojimori/lessons/picker" className="moji-btn">
            {t("mojimori.study.advanced")}
          </Link>
        ) : (
          <span className="moji-btn is-disabled" aria-disabled="true">
            {t("mojimori.study.advanced")}
          </span>
        )}
      </div>
    </section>
  );
}
