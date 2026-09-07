import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "kanji-trainer-pinned";

function storageKey(scope: string): string {
  return `${PREFIX}-${scope}`;
}

export async function readPinnedIds(scope: string): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === "number");
  } catch {
    return [];
  }
}

export async function clearPinnedIds(scope: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(scope));
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
