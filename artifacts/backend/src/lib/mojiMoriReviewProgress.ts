export type ReviewPrompt = "meaning" | "reading" | "word";

export type CheckpointTask = {
  subjectId: number;
  prompt: ReviewPrompt;
  expectedStage: number;
};

const PROMPTS = new Set<ReviewPrompt>(["meaning", "reading", "word"]);

export function isReviewPrompt(value: string): value is ReviewPrompt {
  return PROMPTS.has(value as ReviewPrompt);
}

/** Same prompt set the quiz card uses: word only when the vocabulary item has kanji to draw. */
export function requiredReviewPrompts(objectType: string, hasWordKanji: boolean): ReviewPrompt[] {
  if (objectType === "radical") return ["meaning"];
  if (objectType === "vocabulary" && hasWordKanji) return ["meaning", "reading", "word"];
  return ["meaning", "reading"];
}

export function completionDecision(options: {
  storedPrompts: readonly string[];
  required: readonly string[];
  stage: number;
  expectedStage: number;
}): "wait" | "grade" | "stale" {
  if (options.stage !== options.expectedStage) return "stale";
  const have = new Set(options.storedPrompts);
  if (options.required.every((prompt) => have.has(prompt))) return "grade";
  return "wait";
}

export function reconcileCheckpointTasks(
  tasks: readonly CheckpointTask[],
  options: {
    openKeys: ReadonlySet<string>;
    stageOf: (subjectId: number) => number | null;
    due: (subjectId: number) => boolean;
    hasOpenSubject: (subjectId: number) => boolean;
  },
): CheckpointTask[] {
  const seen = new Set<string>();
  const kept: CheckpointTask[] = [];
  for (const task of tasks) {
    const key = `${task.subjectId}:${task.prompt}`;
    if (seen.has(key) || options.openKeys.has(key)) continue;
    const stage = options.stageOf(task.subjectId);
    if (stage == null || stage !== task.expectedStage) continue;
    if (!options.due(task.subjectId) && !options.hasOpenSubject(task.subjectId)) continue;
    seen.add(key);
    kept.push(task);
  }
  return kept;
}

export function acceptOutcome(options: {
  receiptInserted: boolean;
  decision: "wait" | "grade" | "stale";
}): "duplicate" | "wait" | "grade" | "stale" {
  if (!options.receiptInserted) return "duplicate";
  return options.decision;
}

export function taskKey(subjectId: number, prompt: string) {
  return `${subjectId}:${prompt}`;
}
