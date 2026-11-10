export function placeDrawingLast<T extends { prompt: string }>(
  tasks: T[],
  enabled: boolean,
): T[] {
  if (!enabled) return tasks;
  const rest: T[] = [];
  const drawing: T[] = [];
  for (const task of tasks) {
    if (task.prompt === "word") drawing.push(task);
    else rest.push(task);
  }
  return rest.length === 0 || drawing.length === 0 ? tasks : [...rest, ...drawing];
}
