const PREFIX = "kanji-trainer-pinned";

function storageKey(scope: string): string {
  return `${PREFIX}-${scope}`;
}

export function readPinnedIds(scope: string): number[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === "number");
  } catch {
    return [];
  }
}

export function clearPinnedIds(scope: string): void {
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    /* ignore */
  }
}

export function partitionPinnedWords<T extends { id: number }>(
  words: T[],
  pinnedIds: Set<number>,
): T[] {
  if (pinnedIds.size === 0) return words;
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const word of words) {
    if (pinnedIds.has(word.id)) pinned.push(word);
    else rest.push(word);
  }
  return [...pinned, ...rest];
}
