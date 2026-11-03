import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriSubjects } from "../../hooks/useMojiMori";
import {
  MOJI_MORI_TYPE_COLORS,
  type MojiMoriObjectType,
  type MojiMoriSubjectSummary,
} from "../../lib/mojiMori";
import NotFound from "../not-found";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { LevelSubjectCard } from "./SubjectTile";

const TYPES: MojiMoriObjectType[] = ["radical", "kanji", "vocabulary"];

function LegendSwatch({
  status,
}: {
  status: "locked" | "incomplete" | "done";
}) {
  return (
    <span className="flex items-center gap-1">
      {TYPES.map((type) => (
        <span
          key={type}
          className={`status-swatch moji-status moji-status--${type} moji-status--${status}`}
        />
      ))}
    </span>
  );
}

export function MojiMoriLevelDetailPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/mojimori/levels/:n");
  const level = Number(params?.n);
  const [filter, setFilter] = useState<MojiMoriObjectType | "all">("all");
  const { data, isLoading } = useMojiMoriSubjects(
    { level },
    Number.isInteger(level) && level > 0,
  );

  const grouped = useMemo(() => {
    const buckets: Record<MojiMoriObjectType, MojiMoriSubjectSummary[]> = {
      radical: [],
      kanji: [],
      vocabulary: [],
    };
    for (const subject of data ?? []) {
      const type = subject.objectType as MojiMoriObjectType;
      if (buckets[type]) buckets[type].push(subject);
    }
    return buckets;
  }, [data]);

  if (!Number.isInteger(level) || level < 1) {
    return <NotFound />;
  }

  return (
    <MojiMoriLayout>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            {t("mojimori.levelHeading", { level })}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">{t("mojimori.levelSubtitle")}</p>
        </div>
        <div className="flex items-center gap-1 text-sm text-[#777] dark:text-(--color-muted) dark:hover:text-(--color-ink)">
          <button
            type="button"
            disabled={level <= 1}
            onClick={() => navigate(`/mojimori/levels/${level - 1}`)}
            className="cursor-pointer w-7 h-7 flex items-center justify-center rounded p-1 hover:bg-white disabled:opacity-30 dark:hover:bg-(--color-nav-bg)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            disabled={level >= 60}
            onClick={() => navigate(`/mojimori/levels/${level + 1}`)}
            className="cursor-pointer w-7 h-7 flex items-center justify-center rounded p-1 hover:bg-white disabled:opacity-30 dark:hover:bg-(--color-nav-bg)"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[#777]">
        <span className="flex items-center gap-2">
          <LegendSwatch status="locked" />
          {t("mojimori.locked")}
        </span>
        <span className="flex items-center gap-2">
          <LegendSwatch status="incomplete" />
          {t("mojimori.inLessons")}
        </span>
        <span className="flex items-center gap-2">
          <LegendSwatch status="incomplete" />
          {t("mojimori.inReviews")}
        </span>
        <span className="flex items-center gap-2">
          <LegendSwatch status="done" />
          {t("mojimori.burned")}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-[#888] dark:text-(--color-muted)">{t("mojimori.typeLabel")}</span>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-sm border bg-white px-3 py-1 cursor-pointer dark:bg-(--color-chip) dark:text-(--color-ink) ${
            filter === "all"
              ? "border-(--color-primary-red) bg-[var(--color-ice)] dark:border-(--color-primary-red) dark:bg-(--color-ice)"
              : "border-[var(--color-line)] dark:border-(--color-line)"
          }`}
        >
          {t("mojimori.allTypes")}
        </button>
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilter(type)}
            className="rounded-sm border bg-white px-3 py-1 cursor-pointer dark:bg-(--color-chip)"
            style={{
              borderColor: filter === type ? MOJI_MORI_TYPE_COLORS[type] : "var(--color-line)",
              color: MOJI_MORI_TYPE_COLORS[type],
            }}
          >
            {t(`mojimori.types.${type}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <MojiMoriLoading />
      ) : (
        <div className="space-y-6">
          {TYPES.filter((type) => filter === "all" || filter === type).map(
            (type) => {
              const items = grouped[type];
              const unlocked = items.filter(
                (item) => item.progress?.status !== "locked",
              ).length;
              const ratio = items.length ? unlocked / items.length : 0;
              return (
                <section
                  key={type}
                  className="glass-panel overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <h2 className="font-semibold" style={{ color: MOJI_MORI_TYPE_COLORS[type] }}>
                      {t(`mojimori.types.${type}`)}{" "}
                      <span className="text-sm font-normal text-[#999]">
                        {t("mojimori.unlockedCount", {
                          unlocked,
                          total: items.length,
                        })}
                      </span>
                    </h2>
                  </div>
                  <div className="h-1.5 bg-[var(--color-line)]">
                    <div
                      className="h-full"
                      style={{
                        width: `${ratio * 100}%`,
                        background: MOJI_MORI_TYPE_COLORS[type],
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 p-4">
                    {items.length ? (
                      items.map((subject) => (
                        <LevelSubjectCard key={subject.id} subject={subject} />
                      ))
                    ) : (
                      <p className="text-sm text-[#888]">{t("mojimori.empty")}</p>
                    )}
                  </div>
                </section>
              );
            },
          )}
        </div>
      )}
    </MojiMoriLayout>
  );
}
