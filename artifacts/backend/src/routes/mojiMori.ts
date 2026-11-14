import { Router } from "express";
import {
  db,
  mojiMoriSubjectsTable,
  mojiMoriObjectTypes,
  type MojiMoriObjectType,
  type MojiMoriMeaning,
  type MojiMoriReading,
} from "@workspace/db";
import { and, asc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { getUserId, requireAdmin } from "../middleware/auth";
import {
  getMojiMoriDashboard,
  setMojiMoriStage,
  unlockContextFor,
  progressView,
  type MojiMoriProgressView,
} from "../lib/mojiMoriProgress";
import { studySnapshot, lessonPicker, lessonQueue, reviewQueue, reviewCards, extraQueue, customQueue, parseCustomStudyConfig, gradeStudyItem, gradeStudyBatch, acceptReviewPrompt, readReviewResume, saveReviewCheckpoint, deleteReviewCheckpoint, dropCheckpointTask, checkStudyAnswer, checkWordAnswer, updateStudySettings, studySettings, saveSubjectNotes, unburnSubject, subjectAnswerStats, type ExtraMode, type StudyKind } from "../lib/mojiMoriStudy";
import { isReviewPrompt } from "../lib/mojiMoriReviewProgress";
import { COMPLETED_STAGE } from "../lib/mojiMoriUnlock";

const router = Router();
const MAX_LIST = 2000;
const MAX_SEARCH = 200;

function parseObjectType(value: unknown): MojiMoriObjectType | null {
  if (typeof value !== "string") return null;
  return (mojiMoriObjectTypes as readonly string[]).includes(value)
    ? (value as MojiMoriObjectType)
    : null;
}

function parsePositiveInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function pathKey(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function primaryMeaning(meanings: MojiMoriMeaning[]): string {
  return (
    meanings.find((item) => item.primary)?.meaning ??
    meanings[0]?.meaning ??
    ""
  );
}

function primaryReading(readings: MojiMoriReading[]): string {
  return (
    readings.find((item) => item.primary)?.reading ??
    readings[0]?.reading ??
    ""
  );
}

const summaryColumns = {
  id: mojiMoriSubjectsTable.id,
  objectType: mojiMoriSubjectsTable.objectType,
  level: mojiMoriSubjectsTable.level,
  slug: mojiMoriSubjectsTable.slug,
  characters: mojiMoriSubjectsTable.characters,
  meanings: mojiMoriSubjectsTable.meanings,
  readings: mojiMoriSubjectsTable.readings,
  characterImages: mojiMoriSubjectsTable.characterImages,
  lessonPosition: mojiMoriSubjectsTable.lessonPosition,
  componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
};

type SummaryRow = {
  id: number;
  objectType: string;
  level: number;
  slug: string;
  characters: string | null;
  meanings: (typeof mojiMoriSubjectsTable.$inferSelect)["meanings"];
  readings: (typeof mojiMoriSubjectsTable.$inferSelect)["readings"];
  characterImages: (typeof mojiMoriSubjectsTable.$inferSelect)["characterImages"];
  lessonPosition: number;
  componentSubjectIds: number[];
};

function summaryDto(row: SummaryRow, progress: MojiMoriProgressView) {
  return {
    id: row.id,
    objectType: row.objectType,
    level: row.level,
    slug: row.slug,
    characters: row.characters,
    primaryMeaning: primaryMeaning(row.meanings),
    primaryReading: primaryReading(row.readings),
    characterImages: row.characterImages,
    lessonPosition: row.lessonPosition,
    progress,
  };
}

async function summarize(userId: number, rows: SummaryRow[]) {
  const context = await unlockContextFor(userId, rows);
  return rows.map((row) =>
    summaryDto(
      row,
      progressView(
        row,
        context.userLevel,
        context.catalog,
        context.stageOf,
        context.progress.get(row.id),
      ),
    ),
  );
}

function detailDto(
  row: typeof mojiMoriSubjectsTable.$inferSelect,
  related: {
    components: ReturnType<typeof summaryDto>[];
    amalgamations: ReturnType<typeof summaryDto>[];
    visuallySimilar: ReturnType<typeof summaryDto>[];
  },
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hiddenAt: row.hiddenAt?.toISOString() ?? null,
    primaryMeaning: primaryMeaning(row.meanings),
    primaryReading: primaryReading(row.readings),
    mnemonicImageUrl: row.mnemonicImageUrl,
    mnemonicImageAlt: row.mnemonicImageAlt,
    related,
  };
}

async function loadSummaries(userId: number, ids: number[]) {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const rows = await db
    .select(summaryColumns)
    .from(mojiMoriSubjectsTable)
    .where(inArray(mojiMoriSubjectsTable.id, unique));
  const summaries = await summarize(userId, rows);
  const byId = new Map(summaries.map((row) => [row.id, row]));
  return unique.map((id) => byId.get(id)).filter((row) => row != null);
}

router.get("/mojimori/dashboard", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const [dashboard, study] = await Promise.all([
      getMojiMoriDashboard(userId),
      studySnapshot(userId),
    ]);
    res.json({ ...dashboard, study });
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/levels", async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        level: mojiMoriSubjectsTable.level,
        objectType: mojiMoriSubjectsTable.objectType,
        count: sql<number>`count(*)::int`,
      })
      .from(mojiMoriSubjectsTable)
      .groupBy(mojiMoriSubjectsTable.level, mojiMoriSubjectsTable.objectType)
      .orderBy(asc(mojiMoriSubjectsTable.level));

    const byLevel = new Map<
      number,
      { level: number; radical: number; kanji: number; vocabulary: number }
    >();
    for (let level = 1; level <= 60; level++) {
      byLevel.set(level, { level, radical: 0, kanji: 0, vocabulary: 0 });
    }
    for (const row of rows) {
      const bucket = byLevel.get(row.level);
      if (!bucket) continue;
      if (row.objectType === "radical") bucket.radical = Number(row.count);
      if (row.objectType === "kanji") bucket.kanji = Number(row.count);
      if (row.objectType === "vocabulary") bucket.vocabulary = Number(row.count);
    }
    res.json({ levels: [...byLevel.values()] });
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/subjects", async (req, res, next) => {
  try {
    const type = parseObjectType(req.query.type);
    const level = parsePositiveInt(req.query.level);
    const levelMin = parsePositiveInt(req.query.levelMin);
    const levelMax = parsePositiveInt(req.query.levelMax);
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    const filters = [];
    if (type) filters.push(eq(mojiMoriSubjectsTable.objectType, type));
    if (level) filters.push(eq(mojiMoriSubjectsTable.level, level));
    if (levelMin) filters.push(gte(mojiMoriSubjectsTable.level, levelMin));
    if (levelMax) filters.push(lte(mojiMoriSubjectsTable.level, levelMax));
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      filters.push(
        or(
          ilike(mojiMoriSubjectsTable.characters, pattern),
          ilike(mojiMoriSubjectsTable.slug, pattern),
          sql`${mojiMoriSubjectsTable.meanings}::text ilike ${pattern}`,
          sql`${mojiMoriSubjectsTable.readings}::text ilike ${pattern}`,
        ),
      );
    }

    const limit = q ? MAX_SEARCH : MAX_LIST;
    const rows = await db
      .select(summaryColumns)
      .from(mojiMoriSubjectsTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(
        asc(mojiMoriSubjectsTable.level),
        asc(mojiMoriSubjectsTable.objectType),
        asc(mojiMoriSubjectsTable.lessonPosition),
        asc(mojiMoriSubjectsTable.id),
      )
      .limit(limit);

    res.json({
      subjects: await summarize(getUserId(req), rows),
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/subjects/:key", async (req, res, next) => {
  try {
    const key = pathKey(req.params.key);
    const type = parseObjectType(req.query.type);
    const id = /^\d+$/.test(key) ? parsePositiveInt(key) : null;
    const [row] = id
      ? await db
          .select()
          .from(mojiMoriSubjectsTable)
          .where(eq(mojiMoriSubjectsTable.id, id))
          .limit(1)
      : type
        ? await db
            .select()
            .from(mojiMoriSubjectsTable)
            .where(
              and(
                eq(mojiMoriSubjectsTable.objectType, type),
                eq(mojiMoriSubjectsTable.characters, key),
              ),
            )
            .orderBy(
              asc(mojiMoriSubjectsTable.level),
              asc(mojiMoriSubjectsTable.lessonPosition),
              asc(mojiMoriSubjectsTable.id),
            )
            .limit(1)
        : [];
    if (!row || (type && row.objectType !== type)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const userId = getUserId(req);
    const relatedIds = [
      ...new Set([
        ...row.componentSubjectIds,
        ...row.amalgamationSubjectIds,
        ...row.visuallySimilarSubjectIds,
      ]),
    ];
    const relatedRows = relatedIds.length
      ? await db
          .select(summaryColumns)
          .from(mojiMoriSubjectsTable)
          .where(inArray(mojiMoriSubjectsTable.id, relatedIds))
      : [];
    const [summaries, answerStats] = await Promise.all([
      summarize(userId, [row, ...relatedRows]),
      subjectAnswerStats(userId, row.id),
    ]);
    const relatedById = new Map(summaries.map((item) => [item.id, item]));
    const pick = (ids: number[]) =>
      ids.flatMap((id) => {
        const item = relatedById.get(id);
        return item ? [item] : [];
      });
    const self = relatedById.get(row.id);
    const components = pick(row.componentSubjectIds);
    const amalgamations = pick(row.amalgamationSubjectIds);
    const visuallySimilar = pick(row.visuallySimilarSubjectIds);

    res.json({
      ...detailDto(row, { components, amalgamations, visuallySimilar }),
      progress: self?.progress,
      answerStats,
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/mojimori/subjects/:id",
  requireAdmin,
  async (req, res, next) => {
    try {
      const id = parsePositiveInt(req.params.id);
      const srsStage = parsePositiveInt(req.body?.srsStage);
      if (!id) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      if (!srsStage || srsStage > COMPLETED_STAGE) {
        res.status(400).json({ error: "SRS stage must be between 1 and 13" });
        return;
      }
      const [row] = await db
        .select()
        .from(mojiMoriSubjectsTable)
        .where(eq(mojiMoriSubjectsTable.id, id))
        .limit(1);
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const userId = getUserId(req);
      await setMojiMoriStage(userId, id, srsStage);
      const [summary] = await summarize(userId, [row]);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);

function parseIdList(value: unknown): number[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ids = value
    .split(",")
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0);
  return ids.slice(0, 100);
}

router.get("/mojimori/study/lessons/picker", async (req, res, next) => {
  try {
    res.json(await lessonPicker(getUserId(req)));
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/study/lessons", async (req, res, next) => {
  try {
    res.json(await lessonQueue(getUserId(req), parseIdList(req.query.ids)));
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/study/reviews", async (req, res, next) => {
  try {
    res.json(await reviewQueue(getUserId(req)));
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/study/reviews/cards", async (req, res, next) => {
  try {
    const ids = parseIdList(req.query.ids) ?? [];
    res.json(await reviewCards(getUserId(req), ids.slice(0, 8)));
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/study/extra", async (req, res, next) => {
  try {
    const mode = req.query.mode;
    if (mode !== "recent-lessons" && mode !== "recent-mistakes" && mode !== "cooked") {
      res.status(400).json({ error: "Invalid extra study mode" });
      return;
    }
    res.json(await extraQueue(getUserId(req), mode satisfies ExtraMode));
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/study/extra/custom", async (req, res, next) => {
  try {
    const config = parseCustomStudyConfig(req.body);
    if (!config) {
      res.status(400).json({ error: "Invalid custom study" });
      return;
    }
    res.json(await customQueue(getUserId(req), config));
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/study/check", async (req, res, next) => {
  try {
    const subjectId = parsePositiveInt(req.body?.subjectId);
    const prompt = req.body?.prompt;
    const answer = typeof req.body?.answer === "string" ? req.body.answer : "";
    if (!subjectId || (prompt !== "meaning" && prompt !== "reading" && prompt !== "word")) {
      res.status(400).json({ error: "Invalid check" });
      return;
    }
    if (prompt === "word") {
      const method = req.body?.method === "kanji" ? "kanji" : "meaning";
      res.json(await checkWordAnswer(subjectId, method, answer));
      return;
    }
    res.json(await checkStudyAnswer(subjectId, prompt, answer));
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/study/prompt", async (req, res, next) => {
  try {
    const subjectId = parsePositiveInt(req.body?.subjectId);
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    const answer = typeof req.body?.answer === "string" ? req.body.answer.slice(0, 500) : "";
    const idempotencyKey =
      typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey.trim().slice(0, 80) : "";
    const expectedStage = Number(req.body?.expectedStage);
    if (!subjectId || !isReviewPrompt(prompt) || !idempotencyKey || !Number.isInteger(expectedStage)) {
      res.status(400).json({ error: "Invalid review prompt" });
      return;
    }
    res.json(
      await acceptReviewPrompt(getUserId(req), {
        subjectId,
        prompt,
        answer,
        correct: req.body?.correct === true,
        idempotencyKey,
        expectedStage,
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/study/resume", async (req, res, next) => {
  try {
    res.json(await readReviewResume(getUserId(req)));
  } catch (err) {
    next(err);
  }
});

router.put("/mojimori/study/checkpoint", async (req, res, next) => {
  try {
    const raw = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
    if (!raw) {
      res.status(400).json({ error: "Invalid checkpoint" });
      return;
    }
    const tasks = raw.slice(0, 8000).flatMap((task: { subjectId?: unknown; prompt?: unknown; expectedStage?: unknown }) => {
      const subjectId = parsePositiveInt(task?.subjectId);
      const prompt = typeof task?.prompt === "string" ? task.prompt : "";
      const expectedStage = Number(task?.expectedStage);
      if (!subjectId || !isReviewPrompt(prompt) || !Number.isInteger(expectedStage)) return [];
      return [{ subjectId, prompt, expectedStage }];
    });
    res.json(await saveReviewCheckpoint(getUserId(req), tasks));
  } catch (err) {
    next(err);
  }
});

router.delete("/mojimori/study/checkpoint", async (req, res, next) => {
  try {
    res.json(await deleteReviewCheckpoint(getUserId(req)));
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/study/checkpoint/drop", async (req, res, next) => {
  try {
    const subjectId = parsePositiveInt(req.body?.subjectId);
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    if (!subjectId || !isReviewPrompt(prompt)) {
      res.status(400).json({ error: "Invalid checkpoint task" });
      return;
    }
    res.json({ tasks: await dropCheckpointTask(getUserId(req), subjectId, prompt) });
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/study/grade-batch", async (req, res, next) => {
  try {
    const kind = req.body?.kind;
    const raw = Array.isArray(req.body?.items) ? req.body.items : null;
    if ((kind !== "lesson" && kind !== "review" && kind !== "extra") || !raw || raw.length > 400) {
      res.status(400).json({ error: "Invalid study batch" });
      return;
    }
    const items = [];
    for (const item of raw) {
      const subjectId = parsePositiveInt(item?.subjectId);
      if (!subjectId) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      const expected = Number(item?.expectedStage);
      items.push({
        subjectId,
        meaning: typeof item?.meaning === "string" ? item.meaning : undefined,
        reading: typeof item?.reading === "string" ? item.reading : undefined,
        word: typeof item?.word === "string" ? item.word : undefined,
        expectedStage: Number.isInteger(expected) ? expected : undefined,
      });
    }
    res.json(await gradeStudyBatch(getUserId(req), kind satisfies StudyKind, items));
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/study/grade", async (req, res, next) => {
  try {
    const kind = req.body?.kind;
    const subjectId = parsePositiveInt(req.body?.subjectId);
    if (kind !== "lesson" && kind !== "review" && kind !== "extra") {
      res.status(400).json({ error: "Invalid study kind" });
      return;
    }
    if (!subjectId) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const meaning = typeof req.body?.meaning === "string" ? req.body.meaning : undefined;
    const reading = typeof req.body?.reading === "string" ? req.body.reading : undefined;
    const word = typeof req.body?.word === "string" ? req.body.word : undefined;
    const result = await gradeStudyItem(
      getUserId(req),
      kind satisfies StudyKind,
      subjectId,
      meaning,
      reading,
      word,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/mojimori/study/settings", async (req, res, next) => {
  try {
    res.json(await studySettings(getUserId(req)));
  } catch (err) {
    next(err);
  }
});

router.patch("/mojimori/study/settings", async (req, res, next) => {
  try {
    res.json(await updateStudySettings(getUserId(req), req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

router.patch("/mojimori/subjects/:id/notes", async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const meaningNote = typeof req.body?.meaningNote === "string" ? req.body.meaningNote : "";
    const readingNote = typeof req.body?.readingNote === "string" ? req.body.readingNote : "";
    await saveSubjectNotes(getUserId(req), id, meaningNote.slice(0, 2000), readingNote.slice(0, 2000));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/mojimori/subjects/:id/unburn", async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    res.json(await unburnSubject(getUserId(req), id));
  } catch (err) {
    next(err);
  }
});

export default router;
