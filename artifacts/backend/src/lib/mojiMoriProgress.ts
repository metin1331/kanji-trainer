import {
  db,
  mojiMoriProgressTable,
  mojiMoriSubjectsTable,
  mojiMoriUsersTable,
  pool,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  evaluateUnlock,
  isAvailable,
  COMPLETED_STAGE,
  UNLOCK_THRESHOLD,
  type UnlockSubject,
} from "./mojiMoriUnlock";
import { availableAfter, kanjiNeededToPass } from "./mojiMoriSrs";

export type MojiMoriItemStatus =
  | "locked"
  | "lessons"
  | "review"
  | "guru"
  | "burned";

export type MojiMoriProgressView = {
  status: MojiMoriItemStatus;
  srsStage: number;
  passed: boolean;
  meaningNote: string;
  readingNote: string;
  unlockedAt: string | null;
  availableAt: string | null;
};

type SubjectRow = typeof mojiMoriSubjectsTable.$inferSelect;
type ProgressRow = typeof mojiMoriProgressTable.$inferSelect;

const GURU_STAGE = UNLOCK_THRESHOLD;
const BURNED_STAGE = COMPLETED_STAGE;

function asUnlockSubject(
  subject: Pick<SubjectRow, "id" | "objectType" | "level" | "componentSubjectIds">,
): UnlockSubject {
  return {
    id: subject.id,
    objectType: subject.objectType,
    level: subject.level,
    componentSubjectIds: subject.componentSubjectIds,
  };
}

let settingsColumns: Promise<void> | null = null;

function ensureSettingsColumns() {
  settingsColumns ??= pool
    .query(
      `ALTER TABLE moji_mori_users
        ADD COLUMN IF NOT EXISTS show_srs_indicator boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS preferred_voice text NOT NULL DEFAULT 'random',
        ADD COLUMN IF NOT EXISTS lessons_autoplay boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS reviews_autoplay boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS extra_study_autoplay boolean NOT NULL DEFAULT false`,
    )
    .then(() => undefined)
    .catch((err: unknown) => {
      settingsColumns = null;
      throw err;
    });
  return settingsColumns;
}

export async function ensureMojiMoriUser(userId: number): Promise<number> {
  await ensureSettingsColumns();
  await db
    .insert(mojiMoriUsersTable)
    .values({ userId, level: 1 })
    .onConflictDoNothing();
  const [row] = await db
    .select({ level: mojiMoriUsersTable.level })
    .from(mojiMoriUsersTable)
    .where(eq(mojiMoriUsersTable.userId, userId))
    .limit(1);
  return row?.level ?? 1;
}

export type UnlockContext = {
  userLevel: number;
  catalog: Map<number, UnlockSubject>;
  stageOf: (subjectId: number) => number;
};

export async function unlockContextFor(
  userId: number,
  subjects: Array<Pick<SubjectRow, "id" | "componentSubjectIds">>,
): Promise<UnlockContext & { progress: Map<number, ProgressRow> }> {
  const userLevel = await ensureMojiMoriUser(userId);
  const componentIds = [
    ...new Set(subjects.flatMap((subject) => subject.componentSubjectIds)),
  ];
  const catalogRows = componentIds.length
    ? await db
        .select({
          id: mojiMoriSubjectsTable.id,
          objectType: mojiMoriSubjectsTable.objectType,
          level: mojiMoriSubjectsTable.level,
          componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
        })
        .from(mojiMoriSubjectsTable)
        .where(inArray(mojiMoriSubjectsTable.id, componentIds))
    : [];
  const catalog = new Map(catalogRows.map((row) => [row.id, asUnlockSubject(row)]));
  const progress = await progressBySubjectId(userId, [
    ...new Set([...subjects.map((subject) => subject.id), ...componentIds]),
  ]);
  return {
    userLevel,
    catalog,
    progress,
    stageOf: (subjectId) => progress.get(subjectId)?.srsStage ?? 0,
  };
}

export function progressView(
  subject: Pick<SubjectRow, "id" | "objectType" | "level" | "componentSubjectIds">,
  userLevel: number,
  catalog: ReadonlyMap<number, UnlockSubject>,
  stageOf: (subjectId: number) => number,
  progress: ProgressRow | undefined,
): MojiMoriProgressView {
  const srsStage = progress?.srsStage ?? 0;
  const passed = srsStage >= GURU_STAGE;
  const burned = srsStage >= BURNED_STAGE;
  const started = progress?.startedAt != null || srsStage > 0;
  const previouslyUnlocked =
    progress?.unlockedAt != null || progress?.startedAt != null || srsStage > 0;
  const unlocked = isAvailable(
    asUnlockSubject(subject),
    userLevel,
    catalog,
    stageOf,
    previouslyUnlocked,
  );

  let status: MojiMoriItemStatus = "locked";
  if (burned) status = "burned";
  else if (passed) status = "guru";
  else if (started) status = "review";
  else if (unlocked) status = "lessons";

  return {
    status,
    srsStage,
    passed,
    meaningNote: progress?.meaningNote ?? "",
    readingNote: progress?.readingNote ?? "",
    unlockedAt: progress?.unlockedAt?.toISOString() ?? null,
    availableAt: progress?.availableAt?.toISOString() ?? null,
  };
}

export async function progressBySubjectId(
  userId: number,
  subjectIds: number[],
): Promise<Map<number, ProgressRow>> {
  if (subjectIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(mojiMoriProgressTable)
    .where(
      and(
        eq(mojiMoriProgressTable.userId, userId),
        inArray(mojiMoriProgressTable.subjectId, subjectIds),
      ),
    );
  return new Map(rows.map((row) => [row.subjectId, row]));
}

type TypeCounts = {
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

function emptyCounts(): TypeCounts {
  return { radical: 0, kanji: 0, vocabulary: 0, total: 0 };
}

function addCount(bucket: TypeCounts, objectType: string, amount: number) {
  if (objectType === "radical") bucket.radical += amount;
  else if (objectType === "kanji") bucket.kanji += amount;
  else if (objectType === "vocabulary") bucket.vocabulary += amount;
  bucket.total += amount;
}

function srsGroup(
  stage: number,
):
  | "novice"
  | "apprentice"
  | "proficient"
  | "adept"
  | "veteran"
  | "expert"
  | "master"
  | "grandmaster"
  | "legendary"
  | null {
  if (stage === 1 || stage === 2) return "novice";
  if (stage === 3 || stage === 4) return "apprentice";
  if (stage === 5 || stage === 6) return "proficient";
  if (stage === 7 || stage === 8) return "adept";
  if (stage === 9) return "veteran";
  if (stage === 10) return "expert";
  if (stage === 11) return "master";
  if (stage === 12) return "grandmaster";
  if (stage >= COMPLETED_STAGE) return "legendary";
  return null;
}

export async function setMojiMoriStage(
  userId: number,
  subjectId: number,
  srsStage: number,
) {
  const now = new Date();
  const level = await ensureMojiMoriUser(userId);
  const passed = srsStage >= GURU_STAGE;
  const burned = srsStage >= BURNED_STAGE;
  const availableAt = availableAfter(now, srsStage, level);
  await db
    .insert(mojiMoriProgressTable)
    .values({
      userId,
      subjectId,
      srsStage,
      unlockedAt: now,
      startedAt: now,
      passedAt: passed ? now : null,
      burnedAt: burned ? now : null,
      availableAt,
      incorrectCount: 0,
    })
    .onConflictDoUpdate({
      target: [mojiMoriProgressTable.userId, mojiMoriProgressTable.subjectId],
      set: {
        srsStage,
        unlockedAt: sql`coalesce(${mojiMoriProgressTable.unlockedAt}, ${now})`,
        startedAt: sql`coalesce(${mojiMoriProgressTable.startedAt}, ${now})`,
        passedAt: passed
          ? sql`coalesce(${mojiMoriProgressTable.passedAt}, ${now})`
          : null,
        burnedAt: burned
          ? sql`coalesce(${mojiMoriProgressTable.burnedAt}, ${now})`
          : null,
        availableAt,
        incorrectCount: 0,
      },
    });
  await refreshDependents(userId, subjectId);
  await maybeLevelUp(userId);
}

export async function maybeLevelUp(userId: number): Promise<{
  level: number;
  leveledUp: boolean;
}> {
  let level = await ensureMojiMoriUser(userId);
  const start = level;
  while (level < 60) {
    const kanji = await db
      .select({ id: mojiMoriSubjectsTable.id })
      .from(mojiMoriSubjectsTable)
      .where(
        and(
          eq(mojiMoriSubjectsTable.level, level),
          eq(mojiMoriSubjectsTable.objectType, "kanji"),
        ),
      );
    if (kanji.length === 0) break;
    const progress = await progressBySubjectId(
      userId,
      kanji.map((row) => row.id),
    );
    const passed = kanji.filter(
      (row) => (progress.get(row.id)?.srsStage ?? 0) >= UNLOCK_THRESHOLD,
    ).length;
    if (passed < kanjiNeededToPass(kanji.length)) break;
    level += 1;
    await db
      .update(mojiMoriUsersTable)
      .set({ level })
      .where(eq(mojiMoriUsersTable.userId, userId));
  }
  return { level, leveledUp: level > start };
}

export async function refreshDependents(userId: number, subjectId: number) {
  const [source] = await db
    .select({
      amalgamationSubjectIds: mojiMoriSubjectsTable.amalgamationSubjectIds,
    })
    .from(mojiMoriSubjectsTable)
    .where(eq(mojiMoriSubjectsTable.id, subjectId))
    .limit(1);

  const byComponent = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      objectType: mojiMoriSubjectsTable.objectType,
      level: mojiMoriSubjectsTable.level,
      componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
    })
    .from(mojiMoriSubjectsTable)
    .where(
      sql`${subjectId} = ANY(${mojiMoriSubjectsTable.componentSubjectIds})`,
    );

  const known = new Map(byComponent.map((row) => [row.id, row]));
  const extraIds = (source?.amalgamationSubjectIds ?? []).filter(
    (id) => !known.has(id),
  );
  const extras = extraIds.length
    ? await db
        .select({
          id: mojiMoriSubjectsTable.id,
          objectType: mojiMoriSubjectsTable.objectType,
          level: mojiMoriSubjectsTable.level,
          componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
        })
        .from(mojiMoriSubjectsTable)
        .where(inArray(mojiMoriSubjectsTable.id, extraIds))
    : [];
  const dependents = [...byComponent, ...extras];
  if (dependents.length === 0) return;

  const context = await unlockContextFor(userId, dependents);
  const now = new Date();
  const toUnlock = dependents.filter((subject) => {
    const row = context.progress.get(subject.id);
    if (row?.unlockedAt != null || row?.startedAt != null) return false;
    return evaluateUnlock(
      asUnlockSubject(subject),
      context.userLevel,
      context.catalog,
      context.stageOf,
    );
  });
  if (toUnlock.length === 0) return;

  await db
    .insert(mojiMoriProgressTable)
    .values(
      toUnlock.map((subject) => ({
        userId,
        subjectId: subject.id,
        srsStage: 0,
        unlockedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [mojiMoriProgressTable.userId, mojiMoriProgressTable.subjectId],
      set: {
        unlockedAt: sql`coalesce(${mojiMoriProgressTable.unlockedAt}, excluded.unlocked_at)`,
      },
    });
}

/** Content level (1–60) is separate from the SRS ladder. */
export async function getMojiMoriDashboard(userId: number) {
  const level = await ensureMojiMoriUser(userId);
  const spread = {
    novice: emptyCounts(),
    apprentice: emptyCounts(),
    proficient: emptyCounts(),
    adept: emptyCounts(),
    veteran: emptyCounts(),
    expert: emptyCounts(),
    master: emptyCounts(),
    grandmaster: emptyCounts(),
    legendary: emptyCounts(),
  };

  const stageRows = await db
    .select({
      objectType: mojiMoriSubjectsTable.objectType,
      srsStage: mojiMoriProgressTable.srsStage,
      count: sql<number>`count(*)::int`,
    })
    .from(mojiMoriProgressTable)
    .innerJoin(
      mojiMoriSubjectsTable,
      eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id),
    )
    .where(eq(mojiMoriProgressTable.userId, userId))
    .groupBy(mojiMoriSubjectsTable.objectType, mojiMoriProgressTable.srsStage);

  for (const row of stageRows) {
    const group = srsGroup(row.srsStage);
    if (!group) continue;
    addCount(spread[group], row.objectType, Number(row.count));
  }

  const grouped = await db
    .select({
      level: mojiMoriSubjectsTable.level,
      objectType: mojiMoriSubjectsTable.objectType,
      total: sql<number>`count(*)::int`,
      guru: sql<number>`count(*) filter (where coalesce(${mojiMoriProgressTable.srsStage}, 0) >= ${GURU_STAGE})::int`,
    })
    .from(mojiMoriSubjectsTable)
    .leftJoin(
      mojiMoriProgressTable,
      and(
        eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id),
        eq(mojiMoriProgressTable.userId, userId),
      ),
    )
    .groupBy(mojiMoriSubjectsTable.level, mojiMoriSubjectsTable.objectType);

  const levelStats = buildLevelStats(grouped);
  const levelProgress =
    levelStats.find((item) => item.level === level) ?? emptyLevelProgress(level);
  return { level, spread, levelProgress, levelStats };
}

const LEVEL_COUNT = 60;

function emptyLevelProgress(level: number) {
  return {
    level,
    radical: { guru: 0, total: 0 },
    kanji: { guru: 0, total: 0 },
    vocabulary: { guru: 0, total: 0 },
    kanjiNeeded: 0,
    kanjiRemaining: 0,
  };
}

function buildLevelStats(
  rows: { level: number; objectType: string; total: number; guru: number }[],
) {
  const levels = Array.from({ length: LEVEL_COUNT }, (_, index) =>
    emptyLevelProgress(index + 1),
  );
  for (const row of rows) {
    const slot = levels[row.level - 1];
    if (!slot) continue;
    const type = row.objectType;
    if (type === "radical" || type === "kanji" || type === "vocabulary") {
      slot[type] = { guru: Number(row.guru), total: Number(row.total) };
    }
  }
  for (const slot of levels) {
    slot.kanjiNeeded = Math.ceil(slot.kanji.total * 0.9);
    slot.kanjiRemaining = Math.max(0, slot.kanjiNeeded - slot.kanji.guru);
  }
  return levels;
}
