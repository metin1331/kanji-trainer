import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Settings, Layers, BarChart2, Grip } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const menuItems = [
    { href: "/srs", label: t("nav.srs"), icon: Layers },
    { href: "/progress", label: t("nav.progress"), icon: BarChart2 },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ] as const;

  return (
    <div className="bg-app-surface border-app-border shrink-0 border-b px-5 pt-4 pb-5">
      <div className="mb-0.5 flex items-center justify-between gap-3">
        <p className="text-main-400 dark:text-main-500 text-[11px] font-semibold tracking-widest uppercase">
          {t("home.appSubtitle")}
        </p>
        <div className="-mt-1 -mr-2 flex items-center gap-4">
          <button
            onClick={() => navigate("/mojimori")}
            className="box-border inline-flex h-9 items-center justify-center rounded-xl px-2 text-sm font-semibold transition-transform hover:scale-105"
            style={{
              border: "3px solid transparent",
              background:
                "linear-gradient(var(--app-surface), var(--app-surface)) padding-box, linear-gradient(135deg, oklab(81.473% -0.129 0.00806), oklab(70.897% 0.0636 -0.14602), oklab(87.685% 0.01595 0.16358)) border-box",
            }}
            aria-label={t("a11y.mojimori")}
          >
            <span
              style={{
                backgroundImage:
                  "linear-gradient(135deg, oklab(81.473% -0.129 0.00806), oklab(70.897% 0.0636 -0.14602), oklab(87.685% 0.01595 0.16358))",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                display: "inline-block",
              }}
            >
              MojiMori
            </span>
          </button>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="text-app-text-muted hover:text-main-500 dark:hover:text-main-600 hover:bg-app-accent rounded-xl p-2 transition-colors"
              aria-label={t("a11y.menu")}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Grip size={20} strokeWidth={2} />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="bg-app-surface border-app-border absolute top-full right-0 z-50 mt-1.5 w-48 overflow-hidden rounded-xl border shadow-xl"
              >
                {menuItems.map(({ href, label, icon: Icon }) => (
                  <button
                    key={href}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(href);
                    }}
                    className="hover:bg-app-muted flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
                  >
                    <Icon
                      size={16}
                      strokeWidth={2}
                      className="text-app-text-muted shrink-0"
                    />
                    <span className="text-app-text-secondary">{label}</span>
                  </button>
                ))}
                <div className="h-1" />
              </div>
            ) : null}
          </div>
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
