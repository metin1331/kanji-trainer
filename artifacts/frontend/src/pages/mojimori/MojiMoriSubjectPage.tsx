import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useLocation } from "wouter";
import { CollapsiblePanel, CollapsibleRoot } from "@/components/smoothui/collapsible";
import Textarea from "@/components/smoothui/textarea";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useAuth } from "../../auth/AuthProvider";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  useMojiMoriSubjectByKey,
  useMojiMoriSubjects,
  useMojiMoriNotes,
  useSetMojiMoriStage,
  useUnburnMojiMori,
} from "../../hooks/useMojiMori";
import {
  SRS_COMPLETED_STAGE,
  SRS_STAGES,
  kanjiReadingsByKind,
  mojiMoriSubjectHref,
  type MojiMoriObjectType,
  type MojiMoriReading,
  type MojiMoriSubjectDetail,
  type MojiMoriSubjectSummary,
} from "../../lib/mojiMori";
import NotFound from "../not-found";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { MnemonicText } from "./MnemonicText";
import { LevelSubjectCard, StudyItem, SubjectTileGrid, visualMode } from "./SubjectTile";

const NOTE_LIMIT = 500;

function sectionHash() {
  return window.location.hash.replace(/^#/, "");
}

function safePathKey(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function statusRank(subject: MojiMoriSubjectSummary) {
  const mode = visualMode(subject.progress?.status ?? "locked", subject.progress?.srsStage ?? 0);
  return mode === "done" ? 0 : 1;
}

function foundOrder(subjects: MojiMoriSubjectSummary[]) {
  return [...subjects].sort((left, right) => {
    const byStatus = statusRank(left) - statusRank(right);
    if (byStatus !== 0) return byStatus;
    if (left.level !== right.level) return left.level - right.level;
    const byMeaning = left.primaryMeaning.localeCompare(right.primaryMeaning, "en", {
      sensitivity: "base",
    });
    if (byMeaning !== 0) return byMeaning;
    return left.id - right.id;
  });
}

function StageScroller({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
      setOverflow(more);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, children]);
  return (
    <div className="srs-stages__scroller" ref={scrollerRef}>
      {children}
      {overflow ? <span className="srs-stages__fade" aria-hidden /> : null}
    </div>
  );
}

function SubjectCards({ subjects }: { subjects: MojiMoriSubjectSummary[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {subjects.map((subject) => (
        <LevelSubjectCard key={subject.id} subject={subject} />
      ))}
    </div>
  );
}

function ReadingList({ readings }: { readings: MojiMoriReading[] }) {
  if (!readings.length) return <span className="text-[#999]">—</span>;
  const primary = readings.some((item) => item.primary);
  return (
    <p lang="ja" className={`subject-reading${primary ? " is-primary" : ""}`}>
      {readings.map((item) => item.reading).join(" | ")}
    </p>
  );
}

export function MojiMoriSubjectPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const pathMatch = location.match(
    /^\/mojimori\/(radicals|kanji|vocabulary)\/([^/?#]+)/,
  );
  const typeParam = pathMatch?.[1] ?? "";
  const objectType: MojiMoriObjectType | null =
    typeParam === "radicals"
      ? "radical"
      : typeParam === "kanji"
        ? "kanji"
        : typeParam === "vocabulary"
          ? "vocabulary"
          : null;
  const key = safePathKey(pathMatch?.[2]);
  const { data, isLoading, isError } = useMojiMoriSubjectByKey(objectType, key);
  const siblingsQuery = useMojiMoriSubjects(
    {
      type: data?.objectType,
      level: data?.level,
    },
    Boolean(data),
  );
  const setStage = useSetMojiMoriStage();
  const [activeSection, setActiveSection] = useState(sectionHash);
  const [stagesOpen, setStagesOpen] = useState(false);

  useEffect(() => {
    function sync() {
      const id = sectionHash();
      setActiveSection(id);
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  useEffect(() => {
    if (!data?.characters || !objectType) return;
    if (key === data.characters) return;
    navigate(mojiMoriSubjectHref(data), { replace: true });
  }, [data, objectType, key, navigate]);

  useEffect(() => {
    if (!data) return;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [data?.id]);

  const siblings = useMemo(() => {
    return (siblingsQuery.data ?? []).slice().sort((a, b) => {
      if (a.lessonPosition !== b.lessonPosition) {
        return a.lessonPosition - b.lessonPosition;
      }
      return a.id - b.id;
    });
  }, [siblingsQuery.data]);

  const index = siblings.findIndex((item) => item.id === data?.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  if (!objectType || !key) {
    return <NotFound />;
  }

  if (isLoading) {
    return (
      <MojiMoriLayout>
        <MojiMoriLoading />
      </MojiMoriLayout>
    );
  }

  if (isError || !data || data.objectType !== objectType) {
    return <NotFound />;
  }

  const { onyomi, kunyomi, nanori } = kanjiReadingsByKind(data.readings);
  const isAdmin = user?.role === "admin";
  const subjectId = data.id;
  const cooked = (data.progress?.srsStage ?? 0) >= SRS_COMPLETED_STAGE;
  const similar = [...data.related.visuallySimilar].sort(
    (left, right) => statusRank(left) - statusRank(right),
  );
  const found = foundOrder(data.related.amalgamations);
  const jumps =
    data.objectType === "kanji"
      ? [
          ...(data.related.components.length > 0
            ? [{ id: "radicals", label: t("mojimori.radicalCombination") }]
            : []),
          { id: "meaning", label: t("mojimori.meaning") },
          { id: "reading", label: t("mojimori.readings") },
          ...(data.related.visuallySimilar.length > 0
            ? [{ id: "similar", label: t("mojimori.visuallySimilar") }]
            : []),
          { id: "amalgamations", label: t("mojimori.foundInVocabulary") },
          { id: "progress", label: t("mojimori.progress") },
        ]
      : data.objectType === "vocabulary"
        ? [
            { id: "meaning", label: t("mojimori.meaning") },
            { id: "reading", label: t("mojimori.reading") },
            { id: "context", label: t("mojimori.context") },
            { id: "components", label: t("mojimori.kanjiComposition") },
            { id: "progress", label: t("mojimori.progress") },
          ]
        : [];

  function openSection(id: string) {
    const next = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.pushState(null, "", next);
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  return (
    <MojiMoriLayout>
      <div className="mb-4 flex items-center justify-between text-base text-[#777]">
        <div>
          {t("mojimori.levelHeading", { level: data.level })} ·{" "}
          {t(`mojimori.types.${data.objectType}`)}
        </div>
        <div className="flex items-center gap-6">
          {prev ? (
            <button
              type="button"
              onClick={() => navigate(mojiMoriSubjectHref(prev))}
              className="flex items-center gap-1 hover:text-[#333] cursor-pointer"
            >
              <ChevronLeft size={20} />
              {prev.characters || prev.primaryMeaning}
            </button>
          ) : null}
          {next ? (
            <button
              type="button"
              onClick={() => navigate(mojiMoriSubjectHref(next))}
              className="flex items-center gap-1 hover:text-[#333] cursor-pointer"
            >
              {next.characters || next.primaryMeaning}
              <ChevronRight size={20} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="subject-hero">
          <StudyItem subject={data} />
          <div className="subject-hero__copy">
            <h1 className="subject-hero__title">{data.primaryMeaning}</h1>
          </div>
        </div>

        {jumps.length > 0 || isAdmin ? (
          <div className="subject-tools">
            {isAdmin ? (
              <CollapsibleRoot
                axis="x"
                className={`srs-stages${stagesOpen ? " is-open" : ""}`}
                open={stagesOpen}
                onOpenChange={setStagesOpen}
                onClick={() => {
                  if (!stagesOpen) setStagesOpen(true);
                }}
              >
                <button
                  type="button"
                  className="srs-stages__hit"
                  aria-expanded={stagesOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setStagesOpen((open) => !open);
                  }}
                >
                  {t("mojimori.stageMenu")}
                </button>
                <StageScroller open={stagesOpen}>
                  <CollapsiblePanel axis="x">
                    <span className="srs-stages__rule" aria-hidden />
                    {SRS_STAGES.map(({ stage, key }) => (
                      <button
                        key={stage}
                        type="button"
                        disabled={setStage.isPending}
                        onClick={() => void setStage.mutateAsync({ id: subjectId, srsStage: stage })}
                        className={`srs-badge${
                          data.progress?.srsStage === stage ? " is-active" : ""
                        }`}
                      >
                        {t(`mojimori.stages.${key}`)}
                      </button>
                    ))}
                  </CollapsiblePanel>
                </StageScroller>
                <button
                  type="button"
                  className="srs-stages__hit srs-stages__hit--icon"
                  aria-expanded={stagesOpen}
                  aria-label={t("mojimori.stageMenu")}
                  onClick={(event) => {
                    event.stopPropagation();
                    setStagesOpen((open) => !open);
                  }}
                >
                  <ChevronRight size={14} aria-hidden />
                </button>
              </CollapsibleRoot>
            ) : null}
            {jumps.length > 0 ? (
              <ul className="subject-jump">
                {jumps.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={activeSection === item.id ? "" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        openSection(item.id);
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {setStage.isError ? (
              <span className="text-sm text-[#b4233a]">{setStage.error.message}</span>
            ) : null}
          </div>
        ) : null}

        {data.objectType === "kanji" && data.related.components.length > 0 ? (
          <Section id="radicals" title={t("mojimori.radicalCombination")}>
            <SubjectCards subjects={data.related.components} />
          </Section>
        ) : null}

        <Section
          id="meaning"
          title={data.objectType === "radical" ? t("mojimori.name") : t("mojimori.meaning")}
        >
          {data.auxiliaryMeanings.length > 0 || data.partsOfSpeech.length > 0 ? (
            <div className="subject-facts">
              {data.auxiliaryMeanings.length > 0 ? (
                <div>
                  <div className="subject-facts__label">{t("mojimori.alsoAccepted")}</div>
                  <div className="subject-facts__values">
                    {data.auxiliaryMeanings.map((item) => (
                      <span key={item.meaning} className="subject-facts__chip">
                        {item.meaning}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {data.partsOfSpeech.length > 0 ? (
                <div>
                  <div className="subject-facts__label">{t("mojimori.wordType")}</div>
                  <div className="subject-facts__values">
                    {data.partsOfSpeech.map((part) => (
                      <span key={part} className="subject-facts__chip">
                        {part.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <MnemonicText text={data.meaningMnemonic} />
          {data.objectType === "radical" && data.mnemonicImageUrl ? (
            <img
              className="moji-mnemonic-image"
              src={data.mnemonicImageUrl}
              alt={data.mnemonicImageAlt || ""}
            />
          ) : null}
          <HintBox text={data.meaningHint} />
          <SubjectNote detail={data} field="meaning" />
          {data.objectType === "radical" && cooked ? <UnburnButton id={subjectId} /> : null}
        </Section>

        {data.objectType !== "radical" ? (
          <Section
            id="reading"
            title={data.objectType === "kanji" ? t("mojimori.readings") : t("mojimori.reading")}
          >
            {data.objectType === "kanji" ? (
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-[#888] uppercase mb-1.5">
                    {t("mojimori.onyomi")}
                  </div>
                  <ReadingList readings={onyomi} />
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-wide text-[#888] uppercase mb-1.5">
                    {t("mojimori.kunyomi")}
                  </div>
                  <ReadingList readings={kunyomi} />
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-wide text-[#888] uppercase mb-1.5">
                    {t("mojimori.nanori")}
                  </div>
                  <ReadingList readings={nanori} />
                </div>
              </div>
            ) : (
              <p lang="ja" className="subject-reading is-primary mb-3 text-lg">
                {data.primaryReading}
              </p>
            )}
            <MnemonicText text={data.readingMnemonic} />
            <HintBox text={data.readingHint} />
            <SubjectNote detail={data} field="reading" />
          </Section>
        ) : null}

        {data.objectType === "vocabulary" ? (
          <Section id="context" title={t("mojimori.context")}>
            <div className="space-y-4">
              {data.contextSentences.map((sentence, index) => (
                <div key={index}>
                  <p className="text-[15px]">{sentence.ja}</p>
                  <p className="text-sm text-[#777] dark:text-[#b4b4b4]">{sentence.en}</p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {data.objectType === "vocabulary" ? (
          <Section id="components" title={t("mojimori.kanjiComposition")}>
            <SubjectTileGrid subjects={data.related.components} compact />
          </Section>
        ) : null}

        {data.objectType === "kanji" && similar.length > 0 ? (
          <Section id="similar" title={t("mojimori.visuallySimilar")}>
            <SubjectCards subjects={similar} />
          </Section>
        ) : null}

        {data.objectType === "kanji" ? (
          <Section id="amalgamations" title={t("mojimori.foundInVocabulary")}>
            <SubjectCards subjects={found} />
          </Section>
        ) : null}

        {data.objectType === "radical" && data.related.amalgamations.length > 0 ? (
          <Section id="kanji" title={t("mojimori.foundInKanji")}>
            <SubjectCards subjects={data.related.amalgamations} />
          </Section>
        ) : null}

        {data.objectType !== "kanji" && similar.length > 0 ? (
          <Section id="similar" title={t("mojimori.visuallySimilar")}>
            <SubjectCards subjects={similar} />
          </Section>
        ) : null}

        <Section id="progress" title={t("mojimori.progress")}>
          <ProgressDetail detail={data} />
          {data.objectType !== "radical" && cooked ? <UnburnButton id={subjectId} /> : null}
        </Section>
      </div>
    </MojiMoriLayout>
  );
}

function HintBox({ text }: { text: string }) {
  const { t } = useTranslation();
  if (!text) return null;
  return (
    <div className="subject-hint mt-3 rounded-md border border-[var(--color-line)] bg-[var(--color-ice)] p-3 text-sm text-[var(--color-ink)]">
      <div className="subject-hint__title">
        <Info size={14} />
        {t("mojimori.hints")}
      </div>
      <MnemonicText text={text} />
    </div>
  );
}

function formatStamp(iso: string | null | undefined, locale: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  return date.toLocaleDateString(tag, { year: "numeric", month: "long", day: "numeric" });
}

function formatNextReview(
  iso: string | null | undefined,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!iso) return "—";
  const date = new Date(iso);
  const ms = date.getTime() - Date.now();
  if (Number.isNaN(date.getTime())) return "—";
  if (ms <= 0) return t("mojimori.availableNow");

  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const unit = (count: number, one: string, many: string) =>
    t(count === 1 ? one : many, { count });

  if (ms < hour) {
    return unit(Math.max(1, Math.round(ms / 60000)), "mojimori.reviewMinute", "mojimori.reviewMinutes");
  }
  if (ms < day) {
    const hours = Math.round(ms / hour);
    if (hours >= 24) return unit(1, "mojimori.reviewDay", "mojimori.reviewDays");
    return unit(hours, "mojimori.reviewHour", "mojimori.reviewHours");
  }

  const days = Math.max(1, Math.round(ms / day));
  if (days < 7) return unit(days, "mojimori.reviewDay", "mojimori.reviewDays");

  const when =
    days <= 30
      ? unit(Math.max(1, Math.floor(days / 7)), "mojimori.reviewWeek", "mojimori.reviewWeeks")
      : longWait(new Date(), date, unit);
  return t("mojimori.reviewWithDate", { when, date: formatStamp(iso, locale) });
}

function longWait(
  from: Date,
  to: Date,
  unit: (count: number, one: string, many: string) => string,
) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  months = Math.max(1, months);
  if (months < 12) return unit(months, "mojimori.reviewMonth", "mojimori.reviewMonths");
  return unit(Math.floor(months / 12), "mojimori.reviewYear", "mojimori.reviewYears");
}

function AnswerChart({
  title,
  correct,
  total,
  currentStreak,
  longestStreak,
}: {
  title: string;
  correct: number;
  total: number;
  currentStreak?: number;
  longestStreak?: number;
}) {
  const { t } = useTranslation();
  const percent = total === 0 ? 0 : Math.round((100 * correct) / total);
  const showStreaks = currentStreak != null && longestStreak != null;
  return (
    <div className="subject-progress__chart">
      <div className="subject-progress__chart-title">{title}</div>
      <div className={`subject-progress__streaks${showStreaks ? "" : " is-empty"}`}>
        {showStreaks ? (
          <>
            <span>
              <small>{t("mojimori.currentStreak")}</small>
              <b>{currentStreak}</b>
            </span>
            <span>
              <small>{t("mojimori.longestStreak")}</small>
              <b>{longestStreak}</b>
            </span>
          </>
        ) : null}
      </div>
      <div className="subject-progress__track">
        <div className="subject-progress__bar" style={{ width: `${percent}%` }}>
          {percent > 0 ? <span>{percent}%</span> : null}
        </div>
      </div>
      <div className="subject-progress__axis">
        <span>0</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

function ProgressDetail({ detail }: { detail: MojiMoriSubjectDetail }) {
  const { t, locale } = useTranslation();
  const meaning = detail.answerStats?.meaning ?? {
    correct: 0,
    total: 0,
    currentStreak: 0,
    longestStreak: 0,
  };
  const reading = detail.answerStats?.reading ?? {
    correct: 0,
    total: 0,
    currentStreak: 0,
    longestStreak: 0,
  };
  const stage = detail.progress?.srsStage ?? 0;
  const status = detail.progress?.status ?? "locked";
  const stageRow = SRS_STAGES.find((item) => item.stage === stage);
  const stageLabel =
    stage >= 1 && stageRow
      ? t(`mojimori.stages.${stageRow.key}`)
      : status === "lessons"
        ? t("mojimori.inLessons")
        : status === "review"
          ? t("mojimori.inReviews")
          : t("mojimori.locked");
  const availableAt = detail.progress?.availableAt;
  const nextReview =
    stage < 1 || stage >= SRS_COMPLETED_STAGE ? "—" : formatNextReview(availableAt, locale, t);

  return (
    <div className="subject-progress">
      <div className="subject-progress__stage">{stageLabel}</div>
      <div className="subject-progress__charts">
        <AnswerChart
          title={t("mojimori.combinedCorrect")}
          correct={meaning.correct + reading.correct}
          total={meaning.total + reading.total}
        />
        <AnswerChart
          title={t("mojimori.meaningCorrect")}
          correct={meaning.correct}
          total={meaning.total}
          currentStreak={meaning.currentStreak}
          longestStreak={meaning.longestStreak}
        />
        {detail.objectType !== "radical" ? (
          <AnswerChart
            title={t("mojimori.readingCorrect")}
            correct={reading.correct}
            total={reading.total}
            currentStreak={reading.currentStreak}
            longestStreak={reading.longestStreak}
          />
        ) : null}
      </div>
      <div className="subject-progress__meta">
        <div>
          <div className="subject-progress__meta-title">{t("mojimori.nextReview")}</div>
          <div>{nextReview}</div>
        </div>
        <div>
          <div className="subject-progress__meta-title">{t("mojimori.unlockedDate")}</div>
          <div>{formatStamp(detail.progress?.unlockedAt, locale)}</div>
        </div>
      </div>
    </div>
  );
}

function UnburnButton({ id }: { id: number }) {
  const { t } = useTranslation();
  const unburn = useUnburnMojiMori();
  return (
    <button type="button" className="moji-btn mt-3" onClick={() => unburn.mutate(id)}>
      {t("mojimori.study.unburn")}
    </button>
  );
}

function SubjectNote({
  detail,
  field,
}: {
  detail: MojiMoriSubjectDetail;
  field: "meaning" | "reading";
}) {
  const { t } = useTranslation();
  const save = useMojiMoriNotes();
  const meaningNote = detail.progress?.meaningNote ?? "";
  const readingNote = detail.progress?.readingNote ?? "";
  const current = field === "meaning" ? meaningNote : readingNote;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);

  function close() {
    setValue(current);
    setEditing(false);
  }

  return (
    <div className="subject-note">
      <h3>{t("mojimori.study.notes")}</h3>
      {editing ? (
        <>
          <Textarea
            rows={4}
            maxLength={NOTE_LIMIT}
            value={value}
            aria-label={t(field === "meaning" ? "mojimori.study.meaningNote" : "mojimori.study.readingNote")}
            onValueChange={(next) => setValue(next.slice(0, NOTE_LIMIT))}
          />
          <div className="subject-note__bar">
            <span className="subject-note__count">
              {value.length}/{NOTE_LIMIT}
            </span>
            <button
              type="button"
              className="moji-btn"
              disabled={save.isPending}
              onClick={() => {
                save.mutate(
                  {
                    id: detail.id,
                    meaningNote: field === "meaning" ? value : meaningNote,
                    readingNote: field === "reading" ? value : readingNote,
                  },
                  { onSuccess: () => setEditing(false) },
                );
              }}
            >
              {t("mojimori.study.save")}
            </button>
            <button type="button" className="moji-btn" onClick={close}>
              {t("common.cancel")}
            </button>
          </div>
        </>
      ) : current ? (
        <button type="button" className="subject-note__text" onClick={() => setEditing(true)}>
          {current}
        </button>
      ) : (
        <button type="button" className="moji-btn" onClick={() => setEditing(true)}>
          {t("mojimori.study.addNote")}
        </button>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="subject-section py-5">
      <div className="subject-section__head">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
