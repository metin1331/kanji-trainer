import { useEffect } from "react";
import { useLocation } from "wouter";
import Skeleton from "@/components/smoothui/skeleton";
import { startRouteProgress, stopRouteProgress } from "./navigationProgress";

type MojiMoriLoadingProps = {
  /** Small placeholder inside an already-visible panel. */
  shape?: "page" | "tiles" | "lines";
};

export function MojiMoriLoading({ shape = "page" }: MojiMoriLoadingProps) {
  useEffect(() => {
    if (shape !== "page") return;
    startRouteProgress();
    return () => stopRouteProgress();
  }, [shape]);

  if (shape === "tiles") return <TileSkeleton />;
  if (shape === "lines") return <LineSkeleton />;
  return <PageSkeleton />;
}

function PageSkeleton() {
  const [path] = useLocation();
  const body = skeletonFor(path);
  return (
    <div role="status" aria-label="Loading">
      {body}
    </div>
  );
}

function skeletonFor(path: string) {
  if (/^\/mojimori\/(radicals|kanji|vocabulary)\/[^/]+/.test(path)) return <SubjectSkeleton />;
  if (path === "/mojimori/levels") return <LevelsSkeleton />;
  if (
    path.startsWith("/mojimori/levels/") ||
    path === "/mojimori/radicals" ||
    path === "/mojimori/kanji" ||
    path === "/mojimori/vocabulary"
  ) {
    return <PanelSkeleton />;
  }
  if (path === "/mojimori/search") return <CardGridSkeleton />;
  if (path === "/mojimori/settings") return <SettingsSkeleton />;
  if (path === "/mojimori/lessons/picker") return <PickerSkeleton />;
  if (path === "/mojimori/lessons" || path === "/mojimori/reviews" || path === "/mojimori/extra") {
    return <StudySkeleton />;
  }
  return <DashboardSkeleton />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <StudyQueueSkeleton buttons={2} />
        <StudyQueueSkeleton buttons={1} />
      </section>
      <section className="glass-panel p-5">
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-[2.05rem] w-40" />
          <Skeleton className="h-[2.05rem] w-44" />
          <Skeleton className="h-[2.05rem] w-36" />
        </div>
      </section>
      <section className="glass-panel level-progress">
        <div className="forecast-head px-5 pt-5 pb-4">
          <Skeleton className="mx-auto h-4 w-28" />
          <Skeleton className="mx-auto mt-2 h-7 w-36" />
        </div>
        <div className="px-4 py-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="forecast-row">
              <Skeleton className="h-4 w-12" />
              <span className="forecast-track">
                <Skeleton className="h-[0.72rem] w-2/5" />
              </span>
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-3" />
            </div>
          ))}
        </div>
      </section>
      <section className="glass-panel level-progress review-stats">
        <div className="review-stats__grid">
          {Array.from({ length: 2 }, (_, index) => (
            <article key={index} className="review-stat">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
              <Skeleton className="mt-2 h-3.5 w-28" />
              <Skeleton className="mt-3 h-3.5 w-32" />
              <Skeleton className="mt-1 h-5 w-20" />
              <Skeleton className="mt-auto h-[2.05rem] w-24" />
            </article>
          ))}
        </div>
      </section>
      <section className="glass-panel p-5">
        <Skeleton className="mb-3 h-6 w-36" />
        <div className="moji-heat" aria-hidden="true">
          {Array.from({ length: 7 * 52 }, (_, index) => (
            <Skeleton key={index} className="h-[10px] w-[10px] rounded-[2px]" />
          ))}
        </div>
      </section>
      <section className="glass-panel p-5">
        <Skeleton className="mb-3 h-6 w-28" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1 h-4 w-3/5" />
          </div>
        ))}
      </section>
      <section className="glass-panel p-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-4 w-64" />
      </section>
      <div className="dash-split">
        <section className="glass-panel level-progress">
          <div className="level-progress__inner p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-8 w-28" />
            </div>
            <Skeleton className="mb-4 h-4 w-40" />
            <div className="grid gap-2 sm:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="mt-4 h-4 w-48" />
            <Skeleton className="study-progress__track mt-2 h-2 w-full" />
          </div>
        </section>
        <section className="glass-panel item-spread">
          <div className="item-spread__head">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="item-spread__rows">
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton key={index} className="h-8" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StudyQueueSkeleton({ buttons }: { buttons: number }) {
  return (
    <section className="glass-panel p-5">
      <Skeleton className="h-6 w-36" />
      <div className="pt-3" />
      <div className="moji-queue-count">
        <Skeleton className="h-[clamp(3.05rem,6.6vw,3.85rem)] w-[4.5rem]" />
        <div className="moji-queue-mix">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="mt-1 h-4 w-44" />
      <div className={buttons > 1 ? "moji-lessons-widget__actions" : "moji-reviews-widget__actions"}>
        {Array.from({ length: buttons }, (_, index) => (
          <Skeleton key={index} className="h-[2.05rem]" />
        ))}
      </div>
    </section>
  );
}

function LevelsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 3 }, (_, row) => (
        <div key={row} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-56 w-full rounded-[22px]" />
      ))}
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="flex w-24 flex-col items-center gap-2 px-2 py-3">
            <Skeleton className="h-12 w-12" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectSkeleton() {
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <div className="glass-panel space-y-6 p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />
      {Array.from({ length: 4 }, (_, index) => (
        <section key={index} className="glass-panel space-y-3 p-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </section>
      ))}
    </div>
  );
}

function PickerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-52" />
      <div className="glass-panel flex gap-2 p-4">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="glass-panel space-y-3 p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StudySkeleton() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-8">
      <Skeleton className="h-24 w-24" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

function TileSkeleton() {
  return (
    <div className="flex flex-wrap gap-3" role="status" aria-label="Loading">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-14" />
      ))}
    </div>
  );
}

function LineSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-12 w-12" />
        <Skeleton className="h-12 w-12" />
        <Skeleton className="h-12 w-12" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
