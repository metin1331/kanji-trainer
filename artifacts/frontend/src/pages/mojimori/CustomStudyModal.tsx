import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { useTranslation } from "../../i18n/I18nProvider";
import { SRS_STAGES, type MojiMoriObjectType } from "../../lib/mojiMori";
import {
  CUSTOM_STUDY_LIMITS,
  CUSTOM_STUDY_SORTS,
  modesForTypes,
  readCustomStudyConfig,
  writeCustomStudyConfig,
  type CustomStudyConfig,
  type CustomStudyMode,
} from "../../lib/customStudy";

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

function boundText(value: number | null): string {
  return value == null ? "" : String(value);
}

function readBound(value: string, min: number, max: number): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isInteger(number)) return null;
  return Math.min(max, Math.max(min, number));
}

export function CustomStudyModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [closing, setClosing] = useState(false);
  const [config, setConfig] = useState<CustomStudyConfig>(() => readCustomStudyConfig());
  const allowedModes = modesForTypes(config.types);
  const canStart = config.types.length > 0 && config.modes.length > 0;

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

  function update(next: CustomStudyConfig) {
    const allowed = new Set(modesForTypes(next.types));
    const cleaned = { ...next, modes: next.modes.filter((mode) => allowed.has(mode)), unlocked: true };
    setConfig(cleaned);
    writeCustomStudyConfig(cleaned);
  }

  function start() {
    if (!canStart) return;
    writeCustomStudyConfig(config);
    onClose();
    navigate("/mojimori/extra?mode=custom");
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
      >
        <button
          type="button"
          className="mm-custom-modal__handle"
          onClick={dismiss}
          aria-label={t("common.close")}
        />
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">{t("mojimori.study.customTitle")}</h2>
          <button type="button" className="mm-custom-modal__close" onClick={dismiss} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
          <section>
            <h3>{t("mojimori.study.customTypes")}</h3>
            <div className="mm-custom-modal__chips">
              {(["radical", "kanji", "vocabulary"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`glass-chip mm-custom-chip${config.types.includes(type) ? " is-active" : ""}`}
                  aria-pressed={config.types.includes(type)}
                  onClick={() => update({ ...config, types: toggleItem(config.types, type as MojiMoriObjectType) })}
                >
                  {t(`mojimori.types.${type}`)}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>{t("mojimori.study.customModes")}</h3>
            <div className="mm-custom-modal__chips">
              {(["meaning", "reading", "drawing"] as const).map((mode) => {
                const enabled = allowedModes.includes(mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`glass-chip mm-custom-chip${config.modes.includes(mode) ? " is-active" : ""}`}
                    aria-pressed={config.modes.includes(mode)}
                    disabled={!enabled}
                    onClick={() => update({ ...config, modes: toggleItem(config.modes, mode as CustomStudyMode) })}
                  >
                    {t(`mojimori.study.customMode.${mode}`)}
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <h3>{t("mojimori.study.customStages")}</h3>
            <div className="mm-custom-modal__chips">
              {SRS_STAGES.map(({ stage, key }) => (
                <button
                  key={stage}
                  type="button"
                  className={`glass-chip mm-custom-chip${config.stages.includes(stage) ? " is-active" : ""}`}
                  aria-pressed={config.stages.includes(stage)}
                  onClick={() => update({ ...config, stages: toggleItem(config.stages, stage) })}
                >
                  {t(`mojimori.stages.${key}`)}
                </button>
              ))}
            </div>
          </section>
          <section className="mm-custom-modal__grid">
            <label>
              <span>{t("mojimori.study.customLevelMin")}</span>
              <input
                className="moji-field"
                inputMode="numeric"
                value={boundText(config.levelMin)}
                onChange={(event) => update({ ...config, levelMin: readBound(event.target.value, 1, 60) })}
              />
            </label>
            <label>
              <span>{t("mojimori.study.customLevelMax")}</span>
              <input
                className="moji-field"
                inputMode="numeric"
                value={boundText(config.levelMax)}
                onChange={(event) => update({ ...config, levelMax: readBound(event.target.value, 1, 60) })}
              />
            </label>
            <label>
              <span>{t("mojimori.study.customAccuracyMin")}</span>
              <input
                className="moji-field"
                inputMode="numeric"
                value={boundText(config.accuracyMin)}
                onChange={(event) => update({ ...config, accuracyMin: readBound(event.target.value, 0, 100) })}
              />
            </label>
            <label>
              <span>{t("mojimori.study.customAccuracyMax")}</span>
              <input
                className="moji-field"
                inputMode="numeric"
                value={boundText(config.accuracyMax)}
                onChange={(event) => update({ ...config, accuracyMax: readBound(event.target.value, 0, 100) })}
              />
            </label>
            <label>
              <span>{t("mojimori.study.customReviewMin")}</span>
              <input
                className="moji-field"
                inputMode="numeric"
                value={boundText(config.reviewMin)}
                onChange={(event) => update({ ...config, reviewMin: readBound(event.target.value, 0, 100000) })}
              />
            </label>
            <label>
              <span>{t("mojimori.study.customReviewMax")}</span>
              <input
                className="moji-field"
                inputMode="numeric"
                value={boundText(config.reviewMax)}
                onChange={(event) => update({ ...config, reviewMax: readBound(event.target.value, 0, 100000) })}
              />
            </label>
          </section>
          <section>
            <h3>{t("mojimori.study.customAvailability")}</h3>
            <div className="mm-custom-modal__chips">
              <button type="button" className="glass-chip mm-custom-chip is-active" aria-pressed="true" disabled>
                {t("mojimori.study.customUnlocked")}
              </button>
              <button
                type="button"
                className="glass-chip mm-custom-chip"
                disabled
                title={t("mojimori.study.customLockedHint")}
              >
                {t("mojimori.study.customLocked")}
              </button>
              <button
                type="button"
                className={`glass-chip mm-custom-chip${config.neverReviewed ? " is-active" : ""}`}
                aria-pressed={config.neverReviewed}
                onClick={() => update({ ...config, neverReviewed: !config.neverReviewed })}
              >
                {t("mojimori.study.customNeverReviewed")}
              </button>
            </div>
            <p className="mm-custom-modal__note">{t("mojimori.study.customLockedHint")}</p>
          </section>
          <section>
            <h3>{t("mojimori.study.customOptions")}</h3>
            <div className="mm-custom-modal__chips">
              <button
                type="button"
                className={`glass-chip mm-custom-chip${config.weakOnly ? " is-active" : ""}`}
                aria-pressed={config.weakOnly}
                onClick={() => update({ ...config, weakOnly: !config.weakOnly })}
              >
                {t("mojimori.study.customWeak")}
              </button>
              <button
                type="button"
                className={`glass-chip mm-custom-chip${config.dueOnly ? " is-active" : ""}`}
                aria-pressed={config.dueOnly}
                onClick={() => update({ ...config, dueOnly: !config.dueOnly })}
              >
                {t("mojimori.study.customDue")}
              </button>
              <button
                type="button"
                className={`glass-chip mm-custom-chip${config.excludeRecent ? " is-active" : ""}`}
                aria-pressed={config.excludeRecent}
                onClick={() => update({ ...config, excludeRecent: !config.excludeRecent })}
              >
                {t("mojimori.study.customExcludeRecent")}
              </button>
            </div>
            {config.weakOnly ? (
              <label className="mt-3 block">
                <span>{t("mojimori.study.customWeakThreshold")}</span>
                <input
                  className="moji-field"
                  inputMode="numeric"
                  value={String(config.weakThreshold)}
                  onChange={(event) =>
                    update({ ...config, weakThreshold: readBound(event.target.value, 1, 100) ?? 70 })
                  }
                />
              </label>
            ) : null}
          </section>
          <section>
            <h3>{t("mojimori.study.customSort")}</h3>
            <select
              className="moji-field"
              value={config.sort}
              onChange={(event) => update({ ...config, sort: event.target.value as CustomStudyConfig["sort"] })}
            >
              {CUSTOM_STUDY_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`mojimori.study.customSorts.${sort}`)}
                </option>
              ))}
            </select>
          </section>
          <section>
            <h3>{t("mojimori.study.customSize")}</h3>
            <div className="mm-custom-modal__chips">
              {CUSTOM_STUDY_LIMITS.map((limit) => (
                <button
                  key={limit ?? "all"}
                  type="button"
                  className={`glass-chip mm-custom-chip${config.limit === limit ? " is-active" : ""}`}
                  aria-pressed={config.limit === limit}
                  onClick={() => update({ ...config, limit })}
                >
                  {limit == null ? t("mojimori.study.customAll") : String(limit)}
                </button>
              ))}
            </div>
          </section>
        </div>
        <button type="button" className="moji-btn-primary mt-4 w-full shrink-0" disabled={!canStart} onClick={start}>
          {t("mojimori.study.customStart")}
        </button>
      </div>
    </div>,
    host,
  );
}
