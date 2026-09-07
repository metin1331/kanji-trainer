import { Router } from "express";
import {
  db,
  wordsTable,
  wordRelationsTable,
  srsCardsTable,
  studyActivityTable,
  categoriesTable,
  categoryWordsTable,
  pinnedWordsTable,
} from "@workspace/db";
import { eq, inArray, asc } from "drizzle-orm";
import { getUserId } from "../middleware/auth";
import { ownerOnly } from "../lib/userScope";

const router = Router();

router.get("/backup", async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const words = await db
      .select()
      .from(wordsTable)
      .where(ownerOnly(userId, wordsTable.userId))
      .orderBy(asc(wordsTable.id));

    const wordIds = words.map((w) => w.id);

    const categories = await db
      .select()
      .from(categoriesTable)
      .where(ownerOnly(userId, categoriesTable.userId))
      .orderBy(asc(categoriesTable.id));

    const categoryIds = categories.map((c) => c.id);

    const [
      relations,
      srsCards,
      studyActivity,
      categoryWords,
      pinnedWords,
    ] = await Promise.all([
      wordIds.length > 0
        ? db
            .select()
            .from(wordRelationsTable)
            .where(inArray(wordRelationsTable.wordId, wordIds))
        : Promise.resolve([]),
      wordIds.length > 0
        ? db
            .select()
            .from(srsCardsTable)
            .where(inArray(srsCardsTable.wordId, wordIds))
            .orderBy(asc(srsCardsTable.id))
        : Promise.resolve([]),
      db
        .select()
        .from(studyActivityTable)
        .where(eq(studyActivityTable.userId, userId))
        .orderBy(asc(studyActivityTable.date)),
      categoryIds.length > 0
        ? db
            .select()
            .from(categoryWordsTable)
            .where(inArray(categoryWordsTable.categoryId, categoryIds))
        : Promise.resolve([]),
      db
        .select()
        .from(pinnedWordsTable)
        .where(eq(pinnedWordsTable.userId, userId))
        .orderBy(asc(pinnedWordsTable.scope), asc(pinnedWordsTable.wordId)),
    ]);

    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      words: words.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
      relations,
      srsCards: srsCards.map((c) => ({
        ...c,
        due: c.due.toISOString(),
        lastReview: c.lastReview?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      studyActivity,
      categories,
      categoryWords,
      pinnedWords: pinnedWords.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
