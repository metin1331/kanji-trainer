import { useLocation } from "wouter";
import { MojiMoriLoading } from "./MojiMoriLoading";
import { useTranslation } from "../../i18n/I18nProvider";
import { useMojiMoriLevels } from "../../hooks/useMojiMori";
import { MOJI_MORI_LEVEL_BANDS } from "../../lib/mojiMori";
import { MojiMoriLayout } from "./MojiMoriLayout";

export function MojiMoriLevelsPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data, isLoading } = useMojiMoriLevels();

  return (
    <MojiMoriLayout>
      <h1 className="mb-5 text-2xl font-bold">{t("mojimori.levelsTitle")}</h1>
      {isLoading ? (
        <MojiMoriLoading />
      ) : (
        <div className="space-y-6">
          {MOJI_MORI_LEVEL_BANDS.map((band) => (
            <section key={band.key}>
              <h2 className="mb-2 text-xs font-semibold tracking-[0.14em] text-[var(--color-muted)] uppercase">
                {band.ja} {t(`mojimori.bands.${band.key}`)}
              </h2>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, i) => band.start + i).map(
                  (level) => {
                    const counts = data?.find((row) => row.level === level);
                    const hasItems = Boolean(
                      counts &&
                        counts.radical + counts.kanji + counts.vocabulary > 0,
                    );
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => navigate(`/mojimori/levels/${level}`)}
                        className={`rounded-md border px-2 py-3 text-sm font-medium ${
                          hasItems
                            ? "border-[var(--color-line)] bg-[var(--color-menu-bg)] text-[var(--color-ink)] hover:border-[var(--color-azure)]"
                            : "border-[var(--color-line)] bg-[var(--color-ice)] text-[var(--color-muted)]"
                        }`}
                      >
                        {String(level).padStart(2, "0")}
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </MojiMoriLayout>
  );
}
