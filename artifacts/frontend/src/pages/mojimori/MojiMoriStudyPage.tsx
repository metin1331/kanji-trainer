import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { romajiToKanaInput } from "../../lib/japaneseInput";
import type { MojiMoriStudyCard } from "../../lib/mojiMori";
import { useGradeMojiMori, useMojiMoriExtra, useMojiMoriStudySettings } from "../../hooks/useMojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { MojiMoriLessonSession } from "./MojiMoriLessonSession";
import { MojiMoriReviewSession } from "./MojiMoriReviewSession";
import { audioTracks, pickVoice } from "./mojiVoice";

function Character({ item }: { item: MojiMoriStudyCard }) {
  const image = item.characterImages[0]?.url;
  if (item.characters) {
    return <span className="text-6xl leading-none">{item.characters}</span>;
  }
  if (image) return <img src={image} alt="" className="h-16 w-16 object-contain" />;
  return <span className="text-2xl text-[var(--color-muted)]">?</span>;
}

export function MojiMoriLessonPage() {
  const ids = lessonIdsFromSearch(useSearch());
  return (
    <MojiMoriLayout showHeader={false}>
      <MojiMoriLessonSession ids={ids} />
    </MojiMoriLayout>
  );
}

export function MojiMoriReviewPage() {
  return <MojiMoriReviewSession />;
}

export function MojiMoriExtraPage() {
  const mode = new URLSearchParams(useSearch()).get("mode") ?? "recent-lessons";
  return <StudySession mode={mode} />;
}

function lessonIdsFromSearch(search: string): number[] | undefined {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ids");
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length > 0 ? ids.slice(0, 100) : undefined;
}

function StudySession({ mode = "recent-lessons" }: { mode?: string }) {
  const { t } = useTranslation();
  const extra = useMojiMoriExtra(mode);
  const items = extra.data?.items ?? [];
  const [index, setIndex] = useState(0);
  const [meaning, setMeaning] = useState("");
  const [reading, setReading] = useState("");
  const [notice, setNotice] = useState("");
  const grade = useGradeMojiMori();
  const prefs = useMojiMoriStudySettings();
  const audioRef = useRef<HTMLAudioElement>(null);
  const heard = useRef(0);
  const item = items[index];

  useEffect(() => {
    if (!prefs.data?.extraStudyAutoplay || !item || item.objectType !== "vocabulary") return;
    if (heard.current === item.id) return;
    const track = pickVoice(audioTracks(item.pronunciationAudios), prefs.data.preferredVoice);
    if (!track || !audioRef.current) return;
    heard.current = item.id;
    audioRef.current.src = track.url;
    void audioRef.current.play();
  }, [prefs.data, item]);

  function resetInputs() {
    setMeaning("");
    setReading("");
    setNotice("");
  }

  async function submit() {
    if (!item) return;
    const result = await grade.mutateAsync({
      kind: "extra",
      subjectId: item.id,
      meaning: item.prompts.includes("meaning") ? meaning : undefined,
      reading: item.prompts.includes("reading") ? romajiToKanaInput(reading) : undefined,
    });
    if (result.shake) {
      setNotice(t("mojimori.study.shake", { type: result.wantedType ?? "" }));
      setReading("");
      return;
    }
    if (!result.passed) {
      setNotice(t("mojimori.study.incorrect"));
      return;
    }
    resetInputs();
    if (index + 1 < items.length) setIndex(index + 1);
    else setIndex(items.length);
  }

  return (
    <MojiMoriLayout>
      <audio ref={audioRef} className="hidden" />
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("mojimori.study.extraTitle")}</h1>
          <Link href="/mojimori" className="moji-btn">
            {t("mojimori.back")}
          </Link>
        </div>
        {extra.isLoading ? (
          <MojiMoriLoading />
        ) : !item ? (
          <section className="glass-panel p-6 text-sm text-[var(--color-muted)]">
            {t("mojimori.study.empty")}
          </section>
        ) : (
          <form
            className="glass-panel space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className={`flex justify-center ${notice ? "moji-shake" : ""}`}>
              <Character item={item} />
            </div>
            {item.prompts.includes("meaning") ? (
              <label className="block text-sm">
                {t("mojimori.meaning")}
                <input
                  className="moji-field mt-1 w-full"
                  value={meaning}
                  onChange={(event) => setMeaning(event.target.value)}
                  autoCapitalize="off"
                />
              </label>
            ) : null}
            {item.prompts.includes("reading") ? (
              <label className="block text-sm">
                {t("mojimori.readings")}
                <input
                  className="moji-field mt-1 w-full"
                  value={reading}
                  onChange={(event) => setReading(event.target.value)}
                  autoCapitalize="off"
                />
              </label>
            ) : null}
            {notice ? <p className="text-sm text-[#b4233a]">{notice}</p> : null}
            <button type="submit" className="moji-btn-primary" disabled={grade.isPending}>
              {t("mojimori.study.check")}
            </button>
          </form>
        )}
      </div>
    </MojiMoriLayout>
  );
}
