import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  installMojiMoriNavigation,
  markRouteProgressFull,
  progressSnapshot,
  subscribeProgress,
} from "./navigationProgress";

function RouteProgressTrack({
  className,
  snap,
  reduceMotion,
}: {
  className?: string;
  snap: ReturnType<typeof progressSnapshot>;
  reduceMotion: boolean | null;
}) {
  return (
    <div
      className={className}
      role="progressbar"
      aria-label="Loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(snap.value)}
    >
      <motion.div
        className="bg-brand h-full w-full"
        initial={false}
        animate={{ transform: `translateX(${snap.value - 100}%)` }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 220, damping: 32, mass: 0.7 }
        }
        onAnimationComplete={() => {
          if (snap.value >= 100) markRouteProgressFull();
        }}
      />
    </div>
  );
}

/** Shown at the top of quiz complete panels while navigating away. */
export function CompleteRouteProgress() {
  const reduceMotion = useReducedMotion();
  const [snap, setSnap] = useState(progressSnapshot);
  useEffect(() => subscribeProgress(setSnap), []);
  if (!snap.visible) return null;
  return (
    <RouteProgressTrack
      snap={snap}
      reduceMotion={reduceMotion}
      className="review-complete__route pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden"
    />
  );
}

export function MojiRouteBar() {
  const client = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [snap, setSnap] = useState(progressSnapshot);

  useEffect(() => {
    installMojiMoriNavigation(client);
  }, [client]);

  useEffect(() => subscribeProgress(setSnap), []);

  if (!snap.visible) return null;

  return (
    <RouteProgressTrack
      snap={snap}
      reduceMotion={reduceMotion}
      className="moji-route-bar pointer-events-none fixed inset-x-0 top-[3.20rem] min-[960px]:top-0 z-[400] h-1 overflow-hidden"
    />
  );
}
