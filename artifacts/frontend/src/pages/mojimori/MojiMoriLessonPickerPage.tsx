import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriLessonPicker, useMojiMoriSettings } from "../../hooks/useMojiMori";
import type { MojiMoriObjectType } from "../../lib/mojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";

const TYPES = ["radical", "kanji", "vocabulary"] as const satisfies readonly MojiMoriObjectType[];

export function MojiMoriLessonPickerPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const picker = useMojiMoriLessonPicker();
  const settings = useMojiMoriSettings();
  const [selected, setSelected] = useState<number[]>([]);
  const [batches, setBatches] = useState(1);
  const data = picker.data;
  const limit = data ? (data.dailyRemaining ?? data.queueIds.length) : 0;
  const room = data ? Math.min(limit, data.queueIds.length) : 0;
  const maxBatches = data && room > 0 ? Math.ceil(room / data.batchSize) : 0;
  const batchCount = Math.min(Math.max(batches, maxBatches > 0 ? 1 : 0), Math.max(maxBatches, 0));

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectAll() {
    if (!data) return;
    const nextIds = data.queueIds.slice(0, limit);
    setSelected((current) => {
      const same =
        nextIds.length === current.length &&
        nextIds.every((id, index) => current[index] === id);
      return same ? [] : nextIds;
    });
  }

  function start(ids: number[]) {
    if (!ids.length) return;
    navigate(`/mojimori/lessons?ids=${ids.join(",")}`);
  }

  function startSelected() {
    if (!data || limit <= 0) return;
    const allowed = new Set(data.queueIds);
    start(selected.filter((id) => allowed.has(id)).slice(0, limit));
  }

  const queued = selected.flatMap((id) => {
    const item = data?.items.find((row) => row.id === id);
    return item ? [item] : [];
  });

  function startBatches() {
    if (!data || batchCount <= 0) return;
    start(data.queueIds.slice(0, Math.min(room, batchCount * data.batchSize)));
  }

  return (
    <MojiMoriLayout>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("mojimori.study.pickerTitle")}</h1>
        <Link href="/mojimori" className="moji-btn">
          {t("mojimori.back")}
        </Link>
      </div>
      {picker.isLoading || !data ? (
        <MojiMoriLoading />
      ) : data.items.length === 0 ? (
        <section className="glass-panel p-6 text-sm text-[var(--color-muted)]">
          {t("mojimori.study.pickerEmpty")}
        </section>
      ) : (
        <>
          <div className="moji-picker-toolbar glass-panel mb-4 p-4">
            <button type="button" className="moji-btn" onClick={selectAll} disabled={limit <= 0}>
              {t("mojimori.study.selectAll")}
            </button>
            <button
              type="button"
              className="moji-btn"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              {t("mojimori.study.clearSelection")}
            </button>
            <label className="moji-picker-check">
              <input
                type="checkbox"
                checked={data.interleave}
                disabled={settings.isPending}
                onChange={(event) =>
                  settings.mutate({ interleaveLessons: event.target.checked })
                }
              />
              {t("mojimori.study.interleave")}
            </label>
            <label className="moji-picker-batches">
              {t("mojimori.study.batches")}
              <input
                type="number"
                min={maxBatches > 0 ? 1 : 0}
                max={Math.max(maxBatches, 0)}
                value={batchCount}
                disabled={maxBatches === 0}
                onChange={(event) => setBatches(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="moji-btn"
              disabled={batchCount <= 0}
              onClick={startBatches}
            >
              {t("mojimori.study.batchPlease")}
            </button>
          </div>
          {data.dailyRemaining != null ? (
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              {t("mojimori.study.capNote", { count: data.dailyRemaining })}
            </p>
          ) : null}
          <div className="space-y-5">
            {TYPES.map((type) => {
              const rows = data.items.filter((item) => item.objectType === type);
              if (rows.length === 0) return null;
              return (
                <section key={type}>
                  <h2 className="mb-2 text-sm font-semibold" style={{ color: `var(--color-${type})` }}>
                    {t(`mojimori.types.${type}`)} {rows.length}
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {rows.map((item) => {
                      const order = selected.indexOf(item.id);
                      const on = order >= 0;
                      const label = `${item.characters ?? item.meaning} ${item.meaning}`;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-type={type}
                          aria-pressed={on}
                          aria-label={label}
                          title={item.meaning}
                          className={`moji-status moji-picker-tile moji-status--${type} ${on ? "moji-status--done" : "moji-status--incomplete"}`}
                          onClick={() => toggle(item.id)}
                        >
                          {item.characters ? (
                            <span
                              className="moji-picker-tile__mark"
                              lang="ja"
                              style={{ ["--moji-chars" as string]: String([...item.characters].length) }}
                            >
                              {item.characters}
                            </span>
                          ) : item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="h-8 w-8 object-contain" />
                          ) : (
                            <span className="moji-picker-tile__mark">?</span>
                          )}
                          {order >= 0 ? (
                            <span className="moji-picker-tile__order">{order + 1}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          {queued.length > 0 ? (
        <section className="moji-picker-queue">
          <h2>{t("mojimori.study.queue")}</h2>
          <div className="moji-picker-queue__row">
            {queued.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="moji-picker-queue__item"
                data-type={item.objectType}
                onClick={() => toggle(item.id)}
              >
                <span>{index + 1}</span>
                {item.characters ? (
                  item.characters
                ) : item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-5 w-5 object-contain" />
                ) : (
                  "?"
                )}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="moji-picker-bar">
            <span>{t("mojimori.study.selectedCount", { count: selected.length })}</span>
            <button
              type="button"
              className="moji-btn-primary"
              disabled={selected.length === 0 || limit <= 0}
              onClick={startSelected}
            >
              {t("mojimori.study.startLessons")}
            </button>
          </div>
        </>
      )}
    </MojiMoriLayout>
  );
}
