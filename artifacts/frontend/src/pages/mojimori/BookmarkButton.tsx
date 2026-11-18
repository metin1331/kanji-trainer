import { Bookmark } from "lucide-react";
import { toast } from "@/components/smoothui/toast";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  useMojiMoriBookmarks,
  useToggleMojiMoriBookmark,
} from "../../hooks/useMojiMori";
import type {
  MojiMoriStudyCard,
  MojiMoriSubjectSummary,
} from "../../lib/mojiMori";

export function studyCardPreview(
  card: MojiMoriStudyCard,
): MojiMoriSubjectSummary {
  const stage = card.srsStage ?? 0;
  const meaning =
    card.meanings?.find((item) => item.primary)?.meaning ??
    card.meanings?.[0]?.meaning ??
    card.wordMeaning ??
    "";
  const reading =
    card.wordReading ??
    card.readings?.find((item) => item.primary)?.reading ??
    card.readings?.[0]?.reading ??
    "";
  return {
    id: card.id,
    objectType: card.objectType,
    level: card.level,
    slug: "",
    characters: card.characters,
    primaryMeaning: meaning,
    primaryReading: reading,
    characterImages: card.characterImages,
    lessonPosition: 0,
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

function BookmarkOff() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 19v1a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5" />
      <path d="m2 2 20 20" />
      <path d="M8.656 3H17a2 2 0 0 1 2 2v8.344" />
    </svg>
  );
}

export function BookmarkButton({
  subjectId,
  preview,
  className,
}: {
  subjectId: number;
  preview?: MojiMoriSubjectSummary;
  className?: string;
}) {
  const { t } = useTranslation();
  const bookmarks = useMojiMoriBookmarks();
  const toggle = useToggleMojiMoriBookmark();
  const listed = bookmarks.data?.some((item) => item.id === subjectId) ?? false;
  const pending = toggle.isPending && toggle.variables?.id === subjectId;
  const bookmarked = pending ? Boolean(toggle.variables?.bookmarked) : listed;
  const label = bookmarked
    ? t("mojimori.study.bookmarkRemove")
    : t("mojimori.study.bookmarkAdd");

  return (
    <button
      type="button"
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={bookmarked}
      disabled={bookmarks.isLoading || pending}
      onClick={() => {
        toggle.mutate(
          { id: subjectId, bookmarked: !bookmarked, preview },
          { onError: () => toast(t("mojimori.study.bookmarksFailed")) },
        );
      }}
    >
      {bookmarked ? <BookmarkOff /> : <Bookmark size={18} />}
    </button>
  );
}
