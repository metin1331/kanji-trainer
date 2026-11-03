import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  installMojiMoriNavigation,
  progressSnapshot,
  subscribeProgress,
} from "./navigationProgress";

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
    <div
      className="pointer-events-none fixed inset-x-0 top-[3.20rem] min-[960px]:top-0 z-[400] h-1 overflow-hidden"
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
      />
    </div>
  );
}
