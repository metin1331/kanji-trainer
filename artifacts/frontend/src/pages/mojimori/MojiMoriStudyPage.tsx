import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { MojiMoriLessonSession } from "./MojiMoriLessonSession";
import { MojiMoriReviewSession } from "./MojiMoriReviewSession";
import { clearReviewBoot } from "./reviewBoot";

export function MojiMoriLessonPage() {
  const ids = lessonIdsFromSearch(useSearch());
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [run, setRun] = useState(0);
  const [fresh, setFresh] = useState(false);
  return (
    <MojiMoriLayout showHeader={false}>
      <MojiMoriLessonSession
        key={run}
        ids={fresh ? undefined : ids}
        onContinue={() => {
          setFresh(true);
          if (ids?.length) setLocation("/mojimori/lessons");
          queryClient.removeQueries({ queryKey: ["mojimori", "lessons"] });
          setRun((value) => value + 1);
        }}
      />
    </MojiMoriLayout>
  );
}

export function MojiMoriReviewPage() {
  const queryClient = useQueryClient();
  const [run, setRun] = useState(0);
  return (
    <MojiMoriReviewSession
      key={run}
      onContinue={() => {
        clearReviewBoot();
        queryClient.removeQueries({ queryKey: ["mojimori", "reviews"] });
        setRun((value) => value + 1);
      }}
    />
  );
}

export function MojiMoriExtraPage() {
  const mode = new URLSearchParams(useSearch()).get("mode") ?? "recent-lessons";
  return <MojiMoriReviewSession key={mode} source="extra" extraMode={mode} />;
}

function lessonIdsFromSearch(search: string): number[] | undefined {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ids");
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.length > 0 ? ids.slice(0, 100) : undefined;
}
