import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriBookmarks } from "../../hooks/useMojiMori";
import { mojiMoriSubjectHref, type MojiMoriSubjectSummary } from "../../lib/mojiMori";
import { LevelSubjectCard } from "./SubjectTile";

const PREVIEW_LIMIT = 8;

function BookmarkModal({
  subjects,
  onClose,
}: {
  subjects: MojiMoriSubjectSummary[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => closeRef.current(), 240);
    return () => window.clearTimeout(timer);
  }, [closing]);

  function dismiss() {
    if (closing) return;
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!mobile || reduce) {
      onClose();
      return;
    }
    setClosing(true);
  }

  const host = document.querySelector(".moji-mori") ?? document.body;
  return createPortal(
    <div
      ref={backdropRef}
      className="mm-custom-backdrop"
      onClick={(event) => {
        if (event.target === backdropRef.current) dismiss();
      }}
    >
      <div
        className={`modal-sheet mm-custom-modal flex max-h-[90vh] flex-col${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("mojimori.study.bookmarksTitle")}
      >
        <button
          type="button"
          className="mm-custom-modal__handle"
          onClick={dismiss}
          aria-label={t("common.close")}
        />
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">
            {t("mojimori.study.bookmarksTitle")}
          </h2>
          <button type="button" className="mm-custom-modal__close" onClick={dismiss} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {subjects.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-muted)]">{t("mojimori.study.bookmarksEmpty")}</p>
          ) : (
          <div className="flex flex-wrap gap-2 p-4">
            {subjects.map((subject) => (
              <LevelSubjectCard
                key={subject.id}
                subject={subject}
                caption
                showBar={false}
                className="subject-tile"
                onOpen={() => {
                  dismiss();
                  navigate(mojiMoriSubjectHref(subject));
                }}
              />
            ))}
          </div>
          )}
        </div>
      </div>
    </div>,
    host,
  );
}

export function BookmarkPanel() {
  const { t } = useTranslation();
  const bookmarks = useMojiMoriBookmarks();
  const [open, setOpen] = useState(false);
  const subjects = bookmarks.data ?? [];
  const preview = subjects.slice(0, PREVIEW_LIMIT);
  const overflow = subjects.length > PREVIEW_LIMIT;

  return (
    <section className="glass-panel">
      <h2 className="px-5 pt-5 text-lg font-semibold sm:text-base">
        {t("mojimori.study.bookmarksTitle")}
      </h2>
      {bookmarks.isLoading ? (
        <p className="px-5 py-4 text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
      ) : bookmarks.isError ? (
        <p className="px-5 py-4 text-sm text-[var(--color-muted)]">{t("mojimori.study.bookmarksFailed")}</p>
      ) : subjects.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[var(--color-muted)]">{t("mojimori.study.bookmarksEmpty")}</p>
      ) : (
        <div className="flex flex-wrap gap-2 p-4">
          {preview.map((subject) => (
            <LevelSubjectCard
              key={subject.id}
              subject={subject}
              caption
              showBar={false}
              className="subject-tile"
            />
          ))}
        </div>
      )}
      {overflow ? (
        <button type="button" className="moji-btn mx-5 mb-5" onClick={() => setOpen(true)}>
          {t("mojimori.study.bookmarksShowAll")}
        </button>
      ) : null}
      {open ? <BookmarkModal subjects={subjects} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
