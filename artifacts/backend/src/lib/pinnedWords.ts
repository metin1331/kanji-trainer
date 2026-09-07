import { db, pinnedWordsTable, wordsTable } from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ownerOnly } from "./userScope";

const SCOPE_MAX_LEN = 64;
const SCOPE_PATTERN = /^[\w/?=.-]+$/;

export function parsePinScope(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const scope = raw.trim();
  if (!scope || scope.length > SCOPE_MAX_LEN || !SCOPE_PATTERN.test(scope)) {
    return null;
  }
  return scope;
}

export function parseWordIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((value) => Number(value))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

async function ownedWordIds(
  userId: number,
  ids: number[],
): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: wordsTable.id })
    .from(wordsTable)
    .where(and(ownerOnly(userId, wordsTable.userId), inArray(wordsTable.id, ids)));
  return rows.map((row) => row.id);
}

export async function getPinnedWordIds(
  userId: number,
  scope: string,
): Promise<number[]> {
  const rows = await db
    .select({ wordId: pinnedWordsTable.wordId })
    .from(pinnedWordsTable)
    .where(
      and(
        eq(pinnedWordsTable.userId, userId),
        eq(pinnedWordsTable.scope, scope),
      ),
    )
    .orderBy(asc(pinnedWordsTable.createdAt), asc(pinnedWordsTable.wordId));
  return rows.map((row) => row.wordId);
}

export async function importPinnedWordIds(
  userId: number,
  scope: string,
  wordIds: number[],
): Promise<number[]> {
  const owned = await ownedWordIds(userId, wordIds);
  if (owned.length > 0) {
    await db
      .insert(pinnedWordsTable)
      .values(owned.map((wordId) => ({ userId, scope, wordId })))
      .onConflictDoNothing();
  }
  return getPinnedWordIds(userId, scope);
}

export async function togglePinnedWordIds(
  userId: number,
  scope: string,
  wordIds: number[],
): Promise<number[]> {
  const owned = await ownedWordIds(userId, wordIds);
  if (owned.length === 0) {
    return getPinnedWordIds(userId, scope);
  }

  const current = new Set(await getPinnedWordIds(userId, scope));
  const toAdd: number[] = [];
  const toRemove: number[] = [];
  for (const id of owned) {
    if (current.has(id)) toRemove.push(id);
    else toAdd.push(id);
  }

  if (toRemove.length > 0) {
    await db
      .delete(pinnedWordsTable)
      .where(
        and(
          eq(pinnedWordsTable.userId, userId),
          eq(pinnedWordsTable.scope, scope),
          inArray(pinnedWordsTable.wordId, toRemove),
        ),
      );
  }
  if (toAdd.length > 0) {
    await db
      .insert(pinnedWordsTable)
      .values(toAdd.map((wordId) => ({ userId, scope, wordId })))
      .onConflictDoNothing();
  }

  return getPinnedWordIds(userId, scope);
}
