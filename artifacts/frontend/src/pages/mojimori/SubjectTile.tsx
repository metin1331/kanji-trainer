import { useLocation } from "wouter";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  GURU_BAR_STEPS,
  mojiMoriSubjectHref,
  type MojiMoriSubjectSummary,
} from "../../lib/mojiMori";
import { SubjectCharacter } from "./SubjectCharacter";

type VisualMode = "locked" | "incomplete" | "done";

function TileCaption({ subject }: { subject: MojiMoriSubjectSummary }) {
  const reading =
    subject.objectType === "radical" ? "" : subject.primaryReading;
  if (!reading && !subject.primaryMeaning) return null;
  return (
    <>
      {reading ? (
        <span className="moji-tile__reading" lang="ja">
          {reading}
        </span>
      ) : null}
      {subject.primaryMeaning ? (
        <span className="moji-tile__meaning">{subject.primaryMeaning}</span>
      ) : null}
    </>
  );
}

export function visualMode(status: string, srsStage: number): VisualMode {
  if (status === "guru" || status === "burned" || srsStage >= 5) return "done";
  if (status === "lessons" || status === "review" || srsStage > 0) return "incomplete";
  return "locked";
}

export function StudyItem({
  subject,
  showTrack = false,
}: {
  subject: MojiMoriSubjectSummary;
  showTrack?: boolean;
}) {
  const { t } = useTranslation();
  const status = subject.progress?.status ?? "locked";
  const srsStage = subject.progress?.srsStage ?? 0;
  const mode = visualMode(status, srsStage);
  const filled = mode === "done" ? GURU_BAR_STEPS : Math.min(GURU_BAR_STEPS, srsStage);

  return (
    <span className="study-progress">
      <span
        className={`study-character moji-status moji-status--${subject.objectType} moji-status--${mode}`}
      >
        <span className="study-character__content">
          <span className="study-character__characters">
            <span className="study-character__characters-text" lang="ja">
              <SubjectCharacter
                subject={subject}
                className="leading-none"
                imageClassName="h-7 w-7 object-contain"
              />
            </span>
          </span>
        </span>
      </span>
      {showTrack ? (
        <span className="study-progress__track">
          {mode === "locked" || srsStage === 0 ? (
            <span className="study-progress__status">
              {mode === "locked" ? t("mojimori.locked") : t("mojimori.lessons")}
            </span>
          ) : (
            Array.from({ length: GURU_BAR_STEPS }, (_, index) => (
              <span
                key={index}
                className={`study-progress__step${
                  index < filled ? " study-progress__step--completed" : ""
                }`}
              />
            ))
          )}
        </span>
      ) : null}
    </span>
  );
}

export function ProgressSquare({
  subject,
  showBar = false,
}: {
  subject: MojiMoriSubjectSummary;
  size?: "sm" | "md";
  showBar?: boolean;
}) {
  return <StudyItem subject={subject} showTrack={showBar} />;
}

export function SubjectTile({
  subject,
  compact = false,
  onOpen,
}: {
  subject: MojiMoriSubjectSummary;
  compact?: boolean;
  onOpen?: (subject: MojiMoriSubjectSummary) => void;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      type="button"
      onClick={() => (onOpen ? onOpen(subject) : navigate(mojiMoriSubjectHref(subject)))}
      className="flex flex-col items-center gap-1 rounded-md px-1 py-1 text-center"
    >
      <ProgressSquare subject={subject} size={compact ? "sm" : "md"} />
    </button>
  );
}

export function ComposeSubjectGrid({
  subjects,
  onOpen,
  reading = true,
}: {
  subjects: MojiMoriSubjectSummary[];
  onOpen?: (subject: MojiMoriSubjectSummary) => void;
  reading?: boolean;
}) {
  return (
    <div className="mm-compose">
      {subjects.map((subject) => (
        <ComposeSubjectItem
          key={subject.id}
          subject={subject}
          onOpen={onOpen}
          reading={reading}
        />
      ))}
    </div>
  );
}

export function ComposeSubjectItem({
  subject,
  onOpen,
  reading = true,
}: {
  subject: MojiMoriSubjectSummary;
  onOpen?: (subject: MojiMoriSubjectSummary) => void;
  /** When false, only the meaning line is shown (e.g. radical rows in kanji composition). */
  reading?: boolean;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      type="button"
      className="mm-compose__item"
      onClick={() => (onOpen ? onOpen(subject) : navigate(mojiMoriSubjectHref(subject)))}
    >
      <span className="mm-compose__glyph" aria-hidden="true">
        <ProgressSquare subject={subject} size="sm" />
      </span>
      <span className="mm-compose__meta">
        {reading && subject.primaryReading ? (
          <b lang="ja">{subject.primaryReading}</b>
        ) : null}
        <small>{subject.primaryMeaning}</small>
      </span>
    </button>
  );
}

export function LevelSubjectCard({
  subject,
  caption = false,
  showBar = true,
  className,
  onOpen,
}: {
  subject: MojiMoriSubjectSummary;
  caption?: boolean;
  showBar?: boolean;
  className?: string;
  onOpen?: (subject: MojiMoriSubjectSummary) => void;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      type="button"
      onClick={() => (onOpen ? onOpen(subject) : navigate(mojiMoriSubjectHref(subject)))}
      className={`flex w-max max-w-full flex-col items-center ${
        className ? ` ${className}` : ""
      }`}
    >
      <ProgressSquare subject={subject} size="sm" showBar={showBar} />
      {caption ? (
        <span className="mt-2 flex flex-col items-center gap-0.5">
          <TileCaption subject={subject} />
        </span>
      ) : null}
    </button>
  );
}

function progressSheetRank(subject: MojiMoriSubjectSummary) {
  const status = subject.progress?.status ?? "locked";
  if (status === "lessons") return 1;
  if (status === "locked") return 2;
  return 0;
}

export function SeeAllGrid({
  subjects,
  grouped = false,
}: {
  subjects: MojiMoriSubjectSummary[];
  grouped?: boolean;
}) {
  const [, navigate] = useLocation();
  const ordered = grouped
    ? subjects
        .map((subject, index) => ({
          subject,
          index,
          rank: progressSheetRank(subject),
        }))
        .sort((left, right) => left.rank - right.rank || left.index - right.index)
        .map((item) => item.subject)
    : subjects;
  return grouped ? (
    <div className="level-sheet__grid">
      {ordered.map((subject) => (
        <LevelSubjectCard key={subject.id} subject={subject} />
      ))}
    </div>
  ) : (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1">
      {ordered.map((subject) => (
        <button
          key={subject.id}
          type="button"
          onClick={() => navigate(mojiMoriSubjectHref(subject))}
          className="flex shrink-0"
        >
          <ProgressSquare subject={subject} showBar />
        </button>
      ))}
    </div>
  );
}

export function SubjectTileGrid({
  subjects,
  compact = false,
  onOpen,
}: {
  subjects: MojiMoriSubjectSummary[];
  compact?: boolean;
  onOpen?: (subject: MojiMoriSubjectSummary) => void;
}) {
  if (subjects.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-0.5 gap-y-1">
      {subjects.map((subject) => (
        <SubjectTile
          key={subject.id}
          subject={subject}
          compact={compact}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
