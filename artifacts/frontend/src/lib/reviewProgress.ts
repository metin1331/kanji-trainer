import { apiFetch } from "./apiOrigin";

export type ReviewPrompt = "meaning" | "reading" | "word";

export type ReviewOutboxItem = {
  idempotencyKey: string;
  subjectId: number;
  prompt: ReviewPrompt;
  answer: string;
  correct: boolean;
  expectedStage: number;
};

export type CheckpointTask = {
  subjectId: number;
  prompt: ReviewPrompt;
  expectedStage: number;
};

export type OpenPrompt = {
  subjectId: number;
  prompt: string;
  answer: string;
  correct: boolean;
};

const STORAGE_KEY = "moji-mori-review-outbox";

export function reviewTaskKey(subjectId: number, prompt: string) {
  return `${subjectId}:${prompt}`;
}

export function dedupeOutbox(items: readonly ReviewOutboxItem[]) {
  const seen = new Set<string>();
  const next: ReviewOutboxItem[] = [];
  for (const item of items) {
    if (seen.has(item.idempotencyKey)) continue;
    seen.add(item.idempotencyKey);
    next.push(item);
  }
  return next;
}

export function openRowsFromAnsweredRecords(
  items: Array<{ id: number; prompts: readonly string[] }>,
  records: Record<number, Partial<Record<ReviewPrompt, { answer: string; correct: boolean }>>>,
) {
  const rows: OpenPrompt[] = [];
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const [idText, record] of Object.entries(records)) {
    const subjectId = Number(idText);
    const item = byId.get(subjectId);
    if (!item || !record) continue;
    for (const prompt of item.prompts) {
      if (prompt !== "meaning" && prompt !== "reading" && prompt !== "word") continue;
      const attempt = record[prompt];
      if (!attempt) continue;
      rows.push({
        subjectId,
        prompt,
        answer: attempt.answer,
        correct: attempt.correct,
      });
    }
  }
  return rows;
}

export function mergeCheckpointTasks(
  partial: readonly CheckpointTask[],
  queue: readonly CheckpointTask[],
) {
  const keys = new Set<string>();
  const merged: CheckpointTask[] = [];
  for (const task of [...partial, ...queue]) {
    const key = reviewTaskKey(task.subjectId, task.prompt);
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(task);
  }
  return merged;
}

export function partialCheckpointTasks(
  items: Array<{ id: number; prompts: readonly string[]; srsStage?: number }>,
  openPrompts: Array<{ subjectId: number; prompt: string }>,
) {
  return buildPartialResumedTasks(items, openPrompts).map((task) => ({
    subjectId: task.subjectId,
    prompt: task.prompt,
    expectedStage: items.find((item) => item.id === task.subjectId)?.srsStage ?? 0,
  }));
}

export function buildPartialResumedTasks(
  items: Array<{ id: number; prompts: readonly string[] }>,
  openPrompts: Array<{ subjectId: number; prompt: string }>,
) {
  const openBySubject = new Map<number, Set<string>>();
  const subjectOrder: number[] = [];
  for (const row of openPrompts) {
    if (!openBySubject.has(row.subjectId)) subjectOrder.push(row.subjectId);
    const set = openBySubject.get(row.subjectId) ?? new Set<string>();
    set.add(row.prompt);
    openBySubject.set(row.subjectId, set);
  }
  const byCard = new Map(items.map((item) => [item.id, item]));
  const tasks: Array<{ subjectId: number; prompt: ReviewPrompt; resumed: true }> = [];
  for (const subjectId of subjectOrder) {
    const item = byCard.get(subjectId);
    const done = openBySubject.get(subjectId);
    if (!item || !done?.size) continue;
    for (const prompt of item.prompts) {
      if (done.has(prompt)) continue;
      if (prompt !== "meaning" && prompt !== "reading" && prompt !== "word") continue;
      tasks.push({ subjectId, prompt, resumed: true });
    }
  }
  return tasks;
}

export function buildReviewQueue<T extends { subjectId: number; prompt: string }>(options: {
  restored: readonly T[];
  due: readonly T[];
  openKeys: ReadonlySet<string>;
  shuffle: (items: T[]) => T[];
}) {
  const restored: T[] = [];
  const restoredKeys = new Set<string>();
  for (const task of options.restored) {
    const key = reviewTaskKey(task.subjectId, task.prompt);
    if (options.openKeys.has(key) || restoredKeys.has(key)) continue;
    restoredKeys.add(key);
    restored.push(task);
  }
  const tail = options.due.filter((task) => {
    const key = reviewTaskKey(task.subjectId, task.prompt);
    return !options.openKeys.has(key) && !restoredKeys.has(key);
  });
  return [...restored, ...options.shuffle(tail)];
}

function readOutbox(): ReviewOutboxItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ReviewOutboxItem[];
    return Array.isArray(parsed) ? dedupeOutbox(parsed) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: ReviewOutboxItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupeOutbox(items)));
}

export function pendingReviewPrompts() {
  return readOutbox();
}

export function enqueueReviewPrompt(item: ReviewOutboxItem) {
  const items = readOutbox();
  if (items.some((stored) => stored.idempotencyKey === item.idempotencyKey)) return;
  items.push(item);
  writeOutbox(items);
  void flushReviewOutbox().catch(() => undefined);
}

let chain: Promise<void> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(item: ReviewOutboxItem) => void>();

export function onReviewPromptPersisted(listener: (item: ReviewOutboxItem) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

class PermanentPromptError extends Error {}

async function postPrompt(item: ReviewOutboxItem) {
  const response = await apiFetch("/api/mojimori/study/prompt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(item),
  });
  if (response.ok) return;
  if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
    throw new PermanentPromptError("Review prompt was rejected");
  }
  throw new Error("Could not save review prompt");
}

function scheduleRetry() {
  if (retryTimer != null) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (readOutbox().length > 0) void flushReviewOutbox().catch(() => undefined);
  }, 2000);
}

export function flushReviewOutbox() {
  const run = chain.then(async () => {
    const pending = readOutbox();
    const succeeded = new Set<string>();
    let failed = false;
    for (const item of pending) {
      try {
        await postPrompt(item);
        succeeded.add(item.idempotencyKey);
        listeners.forEach((listener) => {
          try {
            listener(item);
          } catch {
            // A listener cannot drop a prompt that the server already accepted.
          }
        });
      } catch (err) {
        if (err instanceof PermanentPromptError) succeeded.add(item.idempotencyKey);
        else failed = true;
      }
    }
    writeOutbox(readOutbox().filter((item) => !succeeded.has(item.idempotencyKey)));
    if (failed) {
      scheduleRetry();
      throw new Error("Could not save review prompt");
    }
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    void flushReviewOutbox().catch(() => undefined);
  });
}

export async function readReviewResume() {
  const response = await apiFetch("/api/mojimori/study/resume");
  if (!response.ok) throw new Error("Could not load saved progress");
  return (await response.json()) as {
    checkpoint: { tasks: CheckpointTask[] } | null;
    openPrompts: OpenPrompt[];
  };
}

export async function saveReviewCheckpoint(tasks: CheckpointTask[]) {
  const response = await apiFetch("/api/mojimori/study/checkpoint", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tasks }),
  });
  if (!response.ok) throw new Error("Could not save progress");
  return (await response.json()) as { tasks: CheckpointTask[] };
}

export async function deleteReviewCheckpoint() {
  const response = await apiFetch("/api/mojimori/study/checkpoint", { method: "DELETE" });
  if (!response.ok) throw new Error("Could not cancel saved progress");
  return (await response.json()) as { tasks: CheckpointTask[] };
}

export async function dropReviewCheckpointTask(subjectId: number, prompt: ReviewPrompt) {
  const response = await apiFetch("/api/mojimori/study/checkpoint/drop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subjectId, prompt }),
  });
  if (!response.ok) throw new Error("Could not update saved progress");
  return (await response.json()) as { tasks: CheckpointTask[] };
}
