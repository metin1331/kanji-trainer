import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import {
  useMojiMoriSettings,
  useMojiMoriStudySettings,
  type MojiMoriSettings,
} from "../../hooks/useMojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";

const BATCHES = [3, 4, 5, 6, 7, 8, 9, 10];

export function MojiMoriSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsQuery = useMojiMoriStudySettings();
  const settings = useMojiMoriSettings();
  const data = settingsQuery.data;
  const [sync, setSync] = useState<"idle" | "loading" | "done">("idle");

  function save(patch: Partial<MojiMoriSettings>) {
    settings.mutate(patch);
  }

  async function synchronize() {
    setSync("loading");
    await queryClient.invalidateQueries({ queryKey: ["mojimori"] });
    setSync("done");
    window.setTimeout(() => setSync("idle"), 1600);
  }

  return (
    <MojiMoriLayout>
      <h1 className="mb-4 text-2xl font-bold">{t("mojimori.nav.settings")}</h1>
      {!data ? (
        <MojiMoriLoading />
      ) : (
        <div className="moji-settings">
          <section className="glass-panel moji-settings__panel">
            <h2>{t("mojimori.settings.lessons")}</h2>
            <Setting
              label={t("mojimori.settings.batch")}
              description={t("mojimori.settings.batchHelp")}
            >
              <select
                className="moji-user-field"
                value={data.lessonBatchSize}
                onChange={(event) => save({ lessonBatchSize: Number(event.target.value) })}
              >
                {BATCHES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </Setting>
            <Setting
              label={t("mojimori.settings.cap")}
              description={t("mojimori.settings.capHelp")}
            >
              <CapField value={data.dailyLessonCap} onSave={(dailyLessonCap) => save({ dailyLessonCap })} />
            </Setting>
            <Setting
              label={t("mojimori.settings.interleave")}
              description={t("mojimori.settings.interleaveHelp")}
            >
              <YesNo
                value={data.interleaveLessons}
                yes={t("mojimori.settings.yes")}
                no={t("mojimori.settings.no")}
                onChange={(interleaveLessons) => save({ interleaveLessons })}
              />
            </Setting>
          </section>

          <section className="glass-panel moji-settings__panel">
            <h2>{t("mojimori.settings.reviews")}</h2>
            <Setting
              label={t("mojimori.settings.srs")}
              description={t("mojimori.settings.srsHelp")}
            >
              <YesNo
                value={data.showSrsIndicator}
                yes={t("mojimori.settings.yes")}
                no={t("mojimori.settings.no")}
                onChange={(showSrsIndicator) => save({ showSrsIndicator })}
              />
            </Setting>
            <Setting
              label={t("mojimori.settings.order")}
              description={
                <>
                  <p>{t("mojimori.settings.orderHelp")}</p>
                  <ul>
                    <li>{t("mojimori.settings.orderShuffledHelp")}</li>
                    <li>{t("mojimori.settings.orderApprenticeHelp")}</li>
                    <li>{t("mojimori.settings.orderStageHelp")}</li>
                    <li>{t("mojimori.settings.orderLevelHelp")}</li>
                  </ul>
                </>
              }
            >
              <select
                className="moji-user-field"
                value={data.reviewOrder}
                onChange={(event) => save({ reviewOrder: event.target.value })}
              >
                <option value="shuffled">{t("mojimori.study.orderShuffled")}</option>
                <option value="apprentice">{t("mojimori.study.orderApprentice")}</option>
                <option value="lower-stage">{t("mojimori.study.orderStage")}</option>
                <option value="lower-level">{t("mojimori.study.orderLevel")}</option>
              </select>
            </Setting>
          </section>

          <section className="glass-panel moji-settings__panel">
            <h2>{t("mojimori.settings.audio")}</h2>
            <Setting
              label={t("mojimori.settings.voice")}
              description={t("mojimori.settings.voiceHelp")}
            >
              <select
                className="moji-user-field"
                value={data.preferredVoice}
                onChange={(event) => save({ preferredVoice: event.target.value })}
              >
                <option value="female_only">{t("mojimori.settings.voiceFemale")}</option>
                <option value="male_only">{t("mojimori.settings.voiceMale")}</option>
                <option value="female_preferred">{t("mojimori.settings.voiceFemaleFirst")}</option>
                <option value="male_preferred">{t("mojimori.settings.voiceMaleFirst")}</option>
                <option value="random">{t("mojimori.settings.voiceRandom")}</option>
              </select>
            </Setting>
            <Setting
              label={t("mojimori.settings.lessonAudio")}
              description={t("mojimori.settings.lessonAudioHelp")}
            >
              <YesNo
                value={data.lessonsAutoplay}
                yes={t("mojimori.settings.yes")}
                no={t("mojimori.settings.no")}
                onChange={(lessonsAutoplay) => save({ lessonsAutoplay })}
              />
            </Setting>
            <Setting
              label={t("mojimori.settings.reviewAudio")}
              description={t("mojimori.settings.reviewAudioHelp")}
            >
              <YesNo
                value={data.reviewsAutoplay}
                yes={t("mojimori.settings.yes")}
                no={t("mojimori.settings.no")}
                onChange={(reviewsAutoplay) => save({ reviewsAutoplay })}
              />
            </Setting>
            <Setting
              label={t("mojimori.settings.extraAudio")}
              description={t("mojimori.settings.extraAudioHelp")}
            >
              <YesNo
                value={data.extraStudyAutoplay}
                yes={t("mojimori.settings.yes")}
                no={t("mojimori.settings.no")}
                onChange={(extraStudyAutoplay) => save({ extraStudyAutoplay })}
              />
            </Setting>
          </section>

          <section className="glass-panel moji-settings__panel">
            <h2>{t("mojimori.settings.local")}</h2>
            <p className="moji-settings__lead">{t("mojimori.settings.localHelp")}</p>
            <p className="moji-settings__count">
              {t("mojimori.settings.itemCount")} <strong>{data.itemCount}</strong>
            </p>
            {sync === "loading" ? (
              <p className="moji-settings__sync">{t("mojimori.settings.syncing")}</p>
            ) : sync === "done" ? (
              <p className="moji-settings__sync">{t("mojimori.settings.synced")}</p>
            ) : (
              <button type="button" className="moji-btn" onClick={() => void synchronize()}>
                <RefreshCw size={15} />
                {t("mojimori.settings.sync")}
              </button>
            )}
          </section>
        </div>
      )}
    </MojiMoriLayout>
  );
}

function Setting({
  label,
  description,
  children,
}: {
  label: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="moji-setting">
      <div>
        <p className="moji-setting__label">{label}</p>
        <div className="moji-setting__help">{description}</div>
      </div>
      <div className="moji-setting__control">{children}</div>
    </div>
  );
}

function YesNo({
  value,
  yes,
  no,
  onChange,
}: {
  value: boolean;
  yes: string;
  no: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <select
      className="moji-user-field"
      value={value ? "true" : "false"}
      onChange={(event) => onChange(event.target.value === "true")}
    >
      <option value="true">{yes}</option>
      <option value="false">{no}</option>
    </select>
  );
}

function CapField({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  function commit(raw: string) {
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = Math.min(100, Math.max(0, Math.trunc(parsed)));
    setDraft(String(next));
    if (next !== value) onSave(next);
  }

  return (
    <input
      className="moji-user-field moji-user-field--cap"
      type="number"
      min={0}
      max={100}
      inputMode="numeric"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (timer.current != null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit(next), 350);
      }}
      onBlur={(event) => {
        focused.current = false;
        if (timer.current != null) window.clearTimeout(timer.current);
        commit(event.target.value);
      }}
    />
  );
}
