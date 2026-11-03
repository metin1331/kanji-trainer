import { useLocation } from "wouter";
import { Settings, Layers, BarChart2, Languages } from "lucide-react";
import { SearchBar } from "../../components/SearchBar";
import { DailyGoalCard } from "../../components/DailyGoalCard";
import { MiniHeatmapStrip } from "../../components/progress/MiniHeatmapStrip";
import { useTranslation } from "../../i18n/I18nProvider";
import type { ActivityByDate } from "../../hooks/useStudyActivity";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  isSearching: boolean;
  activityByDate: ActivityByDate;
  activityLoading: boolean;
  wordCount: number;
  wordCountLoading?: boolean;
}

export function HomeHeader({
  query,
  onQueryChange,
  isSearching,
  activityByDate,
  activityLoading,
  wordCount,
  wordCountLoading = false,
}: Props) {
  const { t, formatToday } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <div className="bg-app-surface border-app-border shrink-0 border-b px-5 pt-4 pb-5">
      <div className="mb-0.5 flex items-center justify-between gap-3">
        <p className="text-main-400 dark:text-main-500 text-[11px] font-semibold tracking-widest uppercase">
          {t("home.appSubtitle")}
        </p>
        <div className="-mt-1 -mr-2 flex items-center gap-0.5">
          <button
            onClick={() => navigate("/mojimori")}
            className="rounded-xl p-2 text-white shadow-sm transition-transform hover:scale-105"
            style={{
              background:
                "linear-gradient(135deg, #00aaff 0%, #ff00aa 50%, #a000f0 100%)",
            }}
            aria-label={t("a11y.mojimori")}
          >
            <Languages size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => navigate("/srs")}
            className="text-app-text-muted hover:text-main-500 dark:hover:text-main-600 hover:bg-app-accent rounded-xl p-2 transition-colors"
            aria-label={t("a11y.srs")}
          >
            <Layers size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => navigate("/progress")}
            className="text-app-text-muted hover:text-main-500 dark:hover:text-main-600 hover:bg-app-accent rounded-xl p-2 transition-colors"
            aria-label={t("a11y.progress")}
          >
            <BarChart2 size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="text-app-text-muted hover:text-main-500 dark:hover:text-main-600 hover:bg-app-accent rounded-xl p-2 transition-colors"
            aria-label={t("a11y.settings")}
          >
            <Settings size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
      <h1 className="text-app-text mb-3 text-xl font-bold">{formatToday()}</h1>
      <SearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={t("home.searchPlaceholder")}
        wordCount={wordCount}
        wordCountLoading={wordCountLoading}
        onWordCountClick={() => navigate("/words?all=1")}
      />
      {!isSearching && (
        <>
          <DailyGoalCard />
          <div className="mt-3">
            <MiniHeatmapStrip
              isMainPage={true}
              activityByDate={activityByDate}
              isActivityLoading={activityLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
