import { type RefObject, useEffect, useState } from "react";

/** Spring used by the SmoothUI toast enter and exit. */
export const SPRING_DEFAULT = {
  bounce: 0.1,
  duration: 0.25,
  type: "spring" as const,
};

/** Ease-in-out curve for moving elements — cubic-bezier(0.645, 0.045, 0.355, 1) */
export const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;

/** Shared preset for infinite animations such as the skeleton shimmer. */
export const LOOP_CLASS = "will-change-transform" as const;

/** Rest between repeats, in seconds. */
export const LOOP_REPEAT_DELAY = {
  progress: 0.2,
  pulse: 0.6,
  shimmer: 0.3,
  spin: 0,
} as const;

/** Wrap a transition so it repeats forever with the given rest between runs. */
export const loopTransition = <T extends object>(transition: T, repeatDelay = 0) => ({
  ...transition,
  repeat: Number.POSITIVE_INFINITY,
  repeatDelay,
  repeatType: "loop" as const,
});

/**
 * Whether a looping element is on screen. Starts true so the loop is never stuck off.
 */
export const useLoopInView = (
  ref: RefObject<HTMLElement | null>,
  { observeParent = false }: { observeParent?: boolean } = {},
): boolean => {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    const target = observeParent ? (element?.parentElement ?? element) : element;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const latest = entries.at(-1);
      if (latest) setInView(latest.isIntersecting);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [ref, observeParent]);

  return inView;
};
