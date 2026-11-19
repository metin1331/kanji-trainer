import * as wanakana from "wanakana";

type Searchable = {
  id: number;
  slug: string;
  characters: string | null;
  meanings: { meaning: string }[];
  readings: { reading: string }[];
};

function fold(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

/** Hiragana when the whole query is romaji. A leftover Latin letter means it is not a reading. */
export function romajiReading(query: string): string | null {
  const folded = fold(query);
  if (!/[a-z]/.test(folded)) return null;
  const hira = wanakana.toHiragana(folded);
  if (!hira || /[a-z]/i.test(hira)) return null;
  return hira;
}

/** Strings that should match with a direct search: the query, plus kana when it is romaji. */
export function searchNeedles(query: string): string[] {
  const folded = fold(query);
  const needles = new Set<string>();
  if (folded) needles.add(folded);
  const hira = romajiReading(folded);
  if (hira) {
    needles.add(hira);
    needles.add(wanakana.toKatakana(hira));
  }
  return [...needles];
}

function maxDistance(probe: string) {
  const kana = /^[\u3040-\u30ff]+$/.test(probe);
  if (kana) return probe.length >= 3 ? (probe.length >= 6 ? 2 : 1) : 0;
  if (probe.length < 4) return 0;
  return probe.length >= 8 ? 2 : 1;
}

function editDistance(left: string, right: string, max: number) {
  if (Math.abs(left.length - right.length) > max) return max + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMin = row;
    for (let col = 1; col <= right.length; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      const value = Math.min(
        previous[col]! + 1,
        current[col - 1]! + 1,
        previous[col - 1]! + cost,
      );
      current[col] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[right.length] ?? max + 1;
}

function probesFor(query: string, exactCount: number) {
  const folded = fold(query);
  const probes: string[] = [];
  if (exactCount < 8 && /[a-z]/.test(folded)) {
    const words = folded.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
    probes.push(...words);
    const compact = words.join("");
    if (words.length > 1 && compact.length >= 4) probes.push(compact);
  }
  const hira = romajiReading(folded);
  if (hira && exactCount === 0 && hira.length >= 3) probes.push(hira);
  return [...new Set(probes)].filter((probe) => maxDistance(probe) > 0);
}

function isSubsequence(needle: string, haystack: string) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function tokensOf(row: Searchable) {
  const tokens: string[] = [];
  for (const item of row.meanings) {
    const folded = fold(item.meaning);
    tokens.push(...folded.split(/[^a-z0-9]+/).filter(Boolean));
    const compact = folded.replace(/[^a-z0-9]/g, "");
    if (compact) tokens.push(compact);
  }
  for (const item of row.readings) {
    const hira = wanakana.toHiragana(item.reading);
    if (hira) tokens.push(hira);
  }
  tokens.push(...fold(row.slug).split(/[^a-z0-9]+/).filter(Boolean));
  if (row.characters) tokens.push(row.characters);
  return tokens;
}

export function hasCloseSearch(query: string, exactCount: number) {
  return probesFor(query, exactCount).length > 0;
}

/** Subjects whose meaning or reading is a small edit away from the query. */
export function fuzzySearchRank<T extends Searchable>(
  rows: T[],
  query: string,
  skip: Set<number>,
  exactCount: number,
) {
  const probes = probesFor(query, exactCount);
  if (probes.length === 0) return [];
  const hits: { row: T; dist: number; dropped: boolean }[] = [];
  for (const row of rows) {
    if (skip.has(row.id)) continue;
    let best = Number.POSITIVE_INFINITY;
    let dropped = false;
    const tokens = tokensOf(row);
    for (const probe of probes) {
      const max = maxDistance(probe);
      for (const token of tokens) {
        const dist = editDistance(probe, token, max);
        if (dist > best) continue;
        const shorter = probe.length <= token.length ? probe : token;
        const longer = probe.length <= token.length ? token : probe;
        const missing = dist === 0 || isSubsequence(shorter, longer);
        if (dist < best || (missing && !dropped)) {
          best = dist;
          dropped = missing;
        }
      }
    }
    const limit = Math.max(...probes.map(maxDistance));
    if (best <= limit) hits.push({ row, dist: best, dropped });
  }
  hits.sort(
    (a, b) =>
      a.dist - b.dist ||
      Number(b.dropped) - Number(a.dropped) ||
      a.row.id - b.row.id,
  );
  return hits.slice(0, 40).map((hit) => hit.row);
}
