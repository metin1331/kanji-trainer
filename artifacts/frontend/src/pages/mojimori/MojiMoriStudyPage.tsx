import { useSearch } from "wouter";
import { MojiMoriLayout } from "./MojiMoriLayout";
import { MojiMoriLessonSession } from "./MojiMoriLessonSession";
import { MojiMoriReviewSession } from "./MojiMoriReviewSession";

export function MojiMoriLessonPage() {
  const ids = lessonIdsFromSearch(useSearch());
  return (
    <MojiMoriLayout showHeader={false}>
      <MojiMoriLessonSession ids={ids} />
    </MojiMoriLayout>
  );
}

export function MojiMoriReviewPage() {
  return <MojiMoriReviewSession />;
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
