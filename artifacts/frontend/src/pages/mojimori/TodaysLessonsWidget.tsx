import { Link } from "wouter";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MojiMoriStudySnapshot } from "../../lib/mojiMori";

export function TodaysLessonsWidget({
  lessons,
}: {
  lessons: MojiMoriStudySnapshot["lessons"];
}) {
  const { t } = useTranslation();
  const today = lessons.dailyRemaining ?? lessons.available;
  const canStart = today > 0;
  const canPick = lessons.available > 0;

  return (
    <section className="glass-panel moji-lessons-widget p-5">
      <h2 className="text-base font-semibold">{t("mojimori.study.todaysLessons")}</h2>
      <p className="moji-lessons-widget__count">{today}</p>
      <p className="text-sm text-[var(--color-muted)]">
        {lessons.dailyRemaining == null
          ? t("mojimori.study.unlimited")
          : t("mojimori.study.dailyLeft", { count: lessons.dailyRemaining })}
      </p>
      {lessons.available !== today ? (
        <p className="text-sm text-[var(--color-muted)]">
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
