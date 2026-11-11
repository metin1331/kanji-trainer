export type LapsePrompt = "meaning" | "reading" | "word";

export type LapseTask = {
  subjectId: number;
  prompt: LapsePrompt;
};

export function lapseKey(task: LapseTask) {
  return `${task.subjectId}:${task.prompt}`;
}

/** Record one missed prompt from the original review. Lapses attempts and repeats are ignored. */
export function rememberLapse(
  seen: Set<string>,
  items: LapseTask[],
  task: LapseTask,
  inLapses: boolean,
) {
  if (inLapses) return false;
  const key = lapseKey(task);
  if (seen.has(key)) return false;
  seen.add(key);
  items.push({ subjectId: task.subjectId, prompt: task.prompt });
  return true;
}

export function shuffleLapses<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const left = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = left;
  }
  return copy;
}

/**
 * The queue after the current task leaves.
 * A finalized miss stays in the normal review via `parked`.
 * Lapses starts only when that review queue is empty and at least one prompt was missed.
 */
export function nextReviewQueue<T>(options: {
  tasks: readonly T[];
  requeueMiss: boolean;
  inLapses: boolean;
  parked: readonly T[];
  lapses: readonly T[];
}): { tasks: T[]; enterLapses: boolean } {
  const next =
    options.requeueMiss && !options.inLapses ? [...options.parked] : options.tasks.slice(1);
  if (next.length > 0 || options.inLapses || options.lapses.length === 0) {
    return { tasks: next, enterLapses: false };
  }
  return { tasks: [...options.lapses], enterLapses: true };
}
