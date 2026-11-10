import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw } from "lucide-react";
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
              <FieldSelect
                value={String(data.lessonBatchSize)}
                onChange={(value) => save({ lessonBatchSize: Number(value) })}
                options={BATCHES.map((size) => ({ value: String(size), label: String(size) }))}
              />
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
            <DrawingLast
              value={data.drawingCardsLast}
              onChange={(drawingCardsLast) => save({ drawingCardsLast })}
            />
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
              <FieldSelect
                value={data.reviewOrder}
                onChange={(reviewOrder) => save({ reviewOrder })}
                options={[
                  { value: "shuffled", label: t("mojimori.study.orderShuffled") },
                  { value: "apprentice", label: t("mojimori.study.orderApprentice") },
                  { value: "lower-stage", label: t("mojimori.study.orderStage") },
                  { value: "lower-level", label: t("mojimori.study.orderLevel") },
                ]}
              />
            </Setting>
            <DrawingLast
              value={data.drawingCardsLast}
              onChange={(drawingCardsLast) => save({ drawingCardsLast })}
            />
          </section>

          <section className="glass-panel moji-settings__panel">
            <h2>{t("mojimori.settings.audio")}</h2>
            <Setting
              label={t("mojimori.settings.voice")}
              description={t("mojimori.settings.voiceHelp")}
            >
              <FieldSelect
                value={data.preferredVoice}
                onChange={(preferredVoice) => save({ preferredVoice })}
                options={[
                  { value: "female_only", label: t("mojimori.settings.voiceFemale") },
                  { value: "male_only", label: t("mojimori.settings.voiceMale") },
                  { value: "female_preferred", label: t("mojimori.settings.voiceFemaleFirst") },
                  { value: "male_preferred", label: t("mojimori.settings.voiceMaleFirst") },
                  { value: "random", label: t("mojimori.settings.voiceRandom") },
                ]}
              />
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

function DrawingLast({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Setting
      label={t("mojimori.settings.drawingLast")}
      description={t("mojimori.settings.drawingLastHelp")}
    >
      <FieldSelect
        value={value ? "true" : "false"}
        onChange={(next) => onChange(next === "true")}
        options={[
          { value: "false", label: t("mojimori.settings.no") },
          { value: "true", label: t("mojimori.settings.yes") },
        ]}
      />
    </Setting>
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
    <FieldSelect
      value={value ? "true" : "false"}
      onChange={(next) => onChange(next === "true")}
      options={[
        { value: "true", label: yes },
        { value: "false", label: no },
      ]}
    />
  );
}

function useDesktopMenu() {
  const [desktop, setDesktop] = useState(() =>
    window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
}

function FieldSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const desktop = useDesktopMenu();
  if (!desktop) {
    return (
      <select
        className="moji-user-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return <DesktopSelect value={value} onChange={onChange} options={options} />;
}

function DesktopSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={`moji-user-picker${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="moji-user-field moji-user-field--menu"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((shown) => !shown)}
      >
        <span>{current?.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="moji-user-menu" role="listbox">
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "is-on" : undefined}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
