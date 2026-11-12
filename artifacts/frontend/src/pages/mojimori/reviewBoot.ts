import type { QueryClient } from "@tanstack/react-query";
import {
  mojiMoriReviewCardsQuery,
  mojiMoriReviewResumeQuery,
  mojiMoriReviewsQuery,
  mojiMoriSettingsQuery,
} from "../../hooks/useMojiMori";
import type { MojiMoriStudyCard } from "../../lib/mojiMori";
import {
  buildPartialResumedTasks,
  buildReviewQueue,
  openRowsFromAnsweredRecords,
  pendingReviewPrompts,
  reviewTaskKey,
  type OpenPrompt,
  type ReviewPrompt,
} from "../../lib/reviewProgress";
import { placeDrawingLast } from "./quizOrder";

type Attempt = { answer: string; correct: boolean };
type ItemRecord = {
  meaning?: Attempt;
  reading?: Attempt;
  word?: Attempt;
};

export type ReviewBootTask = {
  subjectId: number;
  prompt: ReviewPrompt;
  retry: boolean;
  resumed?: boolean;
};

type ReviewBoot = {
  items: MojiMoriStudyCard[];
  queue: ReviewBootTask[];
  records: Record<number, ItemRecord>;
};

let boot: ReviewBoot | null = null;
let dropTimer: ReturnType<typeof setTimeout> | null = null;

export function currentReviewBoot(): ReviewBoot | null {
  return boot;
}

export function retainReviewBoot() {
  if (dropTimer != null) {
    window.clearTimeout(dropTimer);
    dropTimer = null;
  }
}

export function releaseReviewBoot() {
  if (dropTimer != null) window.clearTimeout(dropTimer);
  dropTimer = window.setTimeout(() => {
    boot = null;
    dropTimer = null;
  }, 50);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const left = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = left;
  }
  return copy;
}

export function planReviewStart(
  items: MojiMoriStudyCard[],
  resume: {
    checkpoint: { tasks: Array<{ subjectId: number; prompt: string; expectedStage: number }> } | null;
    openPrompts: OpenPrompt[];
  },
  drawingLast: boolean,
) {
  const tasks = items.flatMap((item) =>
    item.prompts.map((prompt) => ({
      subjectId: item.id,
      prompt,
      retry: false,
    })),
  );
  const byCard = new Map(items.map((item) => [item.id, item]));
  const openKeys = new Set<string>();
  for (const item of resume.openPrompts)
    openKeys.add(reviewTaskKey(item.subjectId, item.prompt));
  for (const item of pendingReviewPrompts())
    openKeys.add(reviewTaskKey(item.subjectId, item.prompt));
  const restoredFromCheckpoint = (resume.checkpoint?.tasks ?? []).flatMap((task) => {
    if (task.prompt !== "meaning" && task.prompt !== "reading" && task.prompt !== "word")
      return [];
    const item = byCard.get(task.subjectId);
    if (!item?.prompts.includes(task.prompt)) return [];
    return [
      {
        subjectId: task.subjectId,
        prompt: task.prompt,
        retry: false,
        resumed: true as const,
      },
    ];
  });
  const records: Record<number, ItemRecord> = {};
  const remember = (
    subjectId: number,
    prompt: string,
    answer: string,
    correct: boolean,
  ) => {
    if (prompt !== "meaning" && prompt !== "reading" && prompt !== "word") return;
    const item = byCard.get(subjectId);
    if (!item?.prompts.includes(prompt)) return;
    const record = records[subjectId] ?? {};
    if (record[prompt]) return;
    record[prompt] = { answer, correct };
    records[subjectId] = record;
  };
  for (const item of resume.openPrompts)
    remember(item.subjectId, item.prompt, item.answer, item.correct);
  for (const item of pendingReviewPrompts())
    remember(item.subjectId, item.prompt, item.answer, item.correct);
  const openRows = [
    ...resume.openPrompts,
    ...pendingReviewPrompts().map((item) => ({
      subjectId: item.subjectId,
      prompt: item.prompt,
      answer: item.answer,
      correct: item.correct,
    })),
    ...openRowsFromAnsweredRecords(items, records),
  ];
  const restoredFromAutosave = buildPartialResumedTasks(items, openRows);
  const restoredKeys = new Set<string>();
  const restored: ReviewBootTask[] = [];
  const pushRestored = (task: ReviewBootTask) => {
    const key = reviewTaskKey(task.subjectId, task.prompt);
    if (openKeys.has(key) || restoredKeys.has(key)) return;
    restoredKeys.add(key);
    restored.push(task);
  };
  for (const task of restoredFromAutosave) pushRestored(task);
  for (const task of restoredFromCheckpoint) pushRestored(task);
  const queue = buildReviewQueue({
    restored,
    due: tasks,
    openKeys,
    shuffle: (rows) => placeDrawingLast(shuffle(rows), drawingLast),
  });
  return { queue, records };
}

/** Loads the review outline, resume, and the first two cards before navigation. */
export async function warmReviewQuiz(client: QueryClient) {
  const [reviews, settings, resume] = await Promise.all([
    client.fetchQuery(mojiMoriReviewsQuery()),
    client.fetchQuery(mojiMoriSettingsQuery()),
    client.fetchQuery(mojiMoriReviewResumeQuery()),
  ]);
  const planned = planReviewStart(
    reviews.items,
    resume,
    settings.drawingCardsLast === true,
  );
  const ids: number[] = [];
  for (const task of planned.queue) {
    if (!ids.includes(task.subjectId)) ids.push(task.subjectId);
    if (ids.length >= 2) break;
  }
  let items = reviews.items;
  if (ids.length > 0) {
    const loaded = await client.fetchQuery(mojiMoriReviewCardsQuery(ids));
    const byId = new Map(loaded.items.map((item) => [item.id, item]));
    items = reviews.items.map((item) => byId.get(item.id) ?? item);
  }
  boot = { items, queue: planned.queue, records: planned.records };
}
