import { cn } from "@/lib/utils";
import { type ComponentProps, useCallback, useRef } from "react";

export type SkeletonProps = ComponentProps<"div"> & {
  /** Animate a subtle shimmer across the block */
  shimmer?: boolean;
};

/**
 * SmoothUI Skeleton — loading placeholder.
 * The sweep is a CSS animation so it keeps moving when reduced motion is preferred.
 */
export default function Skeleton({
  className,
  ref,
  shimmer = true,
  ...props
}: SkeletonProps) {
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <div
      aria-hidden
      className={cn("bg-foreground/10 relative overflow-hidden rounded-md", className)}
      data-slot="skeleton"
      ref={setRef}
      {...props}
    >
      {shimmer ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-[skeleton-shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
          data-slot="skeleton-shimmer"
        />
      ) : null}
    </div>
  );
}
