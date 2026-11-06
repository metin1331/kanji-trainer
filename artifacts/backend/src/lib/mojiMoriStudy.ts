import {
  db,
  mojiMoriProgressTable,
  mojiMoriReviewsTable,
  mojiMoriSubjectsTable,
  mojiMoriUsersTable,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  applyWordGrade,
  assessWordAnswer,
  availableAfter,
  checkPrompt,
  compositionKanji,
  gradeAnswers,
  nextStageOnCorrect,
  nextStageOnWrong,
  normalizeReading,
  promptsFor,
  wordAnswerCorrect,
  type GradeResult,
  type WordPeer,
} from "./mojiMoriSrs";
import { COMPLETED_STAGE, UNLOCK_THRESHOLD } from "./mojiMoriUnlock";
import {
  ensureMojiMoriUser,
  maybeLevelUp,
  progressBySubjectId,
  progressView,
  refreshDependents,
  unlockContextFor,
} from "./mojiMoriProgress";

export type StudyKind = "lesson" | "review" | "extra";
export type ExtraMode = "recent-lessons" | "recent-mistakes" | "cooked";
export type ReviewOrder = "shuffled" | "apprentice" | "lower-stage" | "lower-level";

type SubjectRow = typeof mojiMoriSubjectsTable.$inferSelect;
const TYPE_RANK: Record<string, number> = { radical: 0, kanji: 1, vocabulary: 2 };

function startOfDay(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

const VOICE_PREFERENCES = [
  "female_only",
  "male_only",
  "female_preferred",
  "male_preferred",
  "random",
] as const;

type VoicePreference = (typeof VOICE_PREFERENCES)[number];

function voiceOf(value: string | null | undefined): VoicePreference {
  return VOICE_PREFERENCES.includes(value as VoicePreference) ? (value as VoicePreference) : "random";
}

function readInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Math.trunc(Number(value));
  }
  return null;
}

function readBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function studySettings(userId: number) {
  await ensureMojiMoriUser(userId);
  const [row] = await db
    .select({
      lessonBatchSize: mojiMoriUsersTable.lessonBatchSize,
      dailyLessonCap: mojiMoriUsersTable.dailyLessonCap,
      interleaveLessons: mojiMoriUsersTable.interleaveLessons,
      reviewOrder: mojiMoriUsersTable.reviewOrder,
      showSrsIndicator: mojiMoriUsersTable.showSrsIndicator,
      preferredVoice: mojiMoriUsersTable.preferredVoice,
      lessonsAutoplay: mojiMoriUsersTable.lessonsAutoplay,
      reviewsAutoplay: mojiMoriUsersTable.reviewsAutoplay,
      extraStudyAutoplay: mojiMoriUsersTable.extraStudyAutoplay,
      level: mojiMoriUsersTable.level,
    })
    .from(mojiMoriUsersTable)
    .where(eq(mojiMoriUsersTable.userId, userId))
    .limit(1);
  const [counted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mojiMoriSubjectsTable)
    .where(isNull(mojiMoriSubjectsTable.hiddenAt));
  const order = row?.reviewOrder;
  const reviewOrder: ReviewOrder =
    order === "apprentice" || order === "lower-stage" || order === "lower-level"
      ? order
      : "shuffled";
  return {
    level: row?.level ?? 1,
    lessonBatchSize: clamp(row?.lessonBatchSize ?? 5, 3, 10),
    dailyLessonCap: clamp(row?.dailyLessonCap ?? 10, 0, 100),
    interleaveLessons: row?.interleaveLessons ?? true,
    reviewOrder,
    showSrsIndicator: row?.showSrsIndicator ?? true,
    preferredVoice: voiceOf(row?.preferredVoice),
    lessonsAutoplay: row?.lessonsAutoplay ?? false,
    reviewsAutoplay: row?.reviewsAutoplay ?? false,
    extraStudyAutoplay: row?.extraStudyAutoplay ?? false,
    itemCount: Number(counted?.count ?? 0),
  };
}

export async function updateStudySettings(userId: number, patch: Record<string, unknown>) {
  await ensureMojiMoriUser(userId);
  const next: {
    lessonBatchSize?: number;
    dailyLessonCap?: number;
    interleaveLessons?: boolean;
    reviewOrder?: string;
    showSrsIndicator?: boolean;
    preferredVoice?: VoicePreference;
    lessonsAutoplay?: boolean;
    reviewsAutoplay?: boolean;
    extraStudyAutoplay?: boolean;
  } = {};
  const batch = readInt(patch.lessonBatchSize);
  const cap = readInt(patch.dailyLessonCap);
  const interleave = readBool(patch.interleaveLessons);
  const showSrs = readBool(patch.showSrsIndicator);
  const lessonsAutoplay = readBool(patch.lessonsAutoplay);
  const reviewsAutoplay = readBool(patch.reviewsAutoplay);
  const extraStudyAutoplay = readBool(patch.extraStudyAutoplay);
  if (batch != null) next.lessonBatchSize = clamp(batch, 3, 10);
  if (cap != null) next.dailyLessonCap = clamp(cap, 0, 100);
  if (interleave != null) next.interleaveLessons = interleave;
  if (showSrs != null) next.showSrsIndicator = showSrs;
  if (lessonsAutoplay != null) next.lessonsAutoplay = lessonsAutoplay;
  if (reviewsAutoplay != null) next.reviewsAutoplay = reviewsAutoplay;
  if (extraStudyAutoplay != null) next.extraStudyAutoplay = extraStudyAutoplay;
  if (
    patch.reviewOrder === "shuffled" ||
    patch.reviewOrder === "apprentice" ||
    patch.reviewOrder === "lower-stage" ||
    patch.reviewOrder === "lower-level"
  ) {
    next.reviewOrder = patch.reviewOrder;
  }
  const voice = voiceOf(typeof patch.preferredVoice === "string" ? patch.preferredVoice : undefined);
  if (typeof patch.preferredVoice === "string" && voice === patch.preferredVoice) {
    next.preferredVoice = voice;
  }
  if (Object.keys(next).length > 0) {
    await db.update(mojiMoriUsersTable).set(next).where(eq(mojiMoriUsersTable.userId, userId));
  }
  return studySettings(userId);
}

async function lessonsDoneToday(userId: number): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(distinct ${mojiMoriReviewsTable.subjectId})::int`,
    })
    .from(mojiMoriReviewsTable)
    .where(
      and(
        eq(mojiMoriReviewsTable.userId, userId),
        eq(mojiMoriReviewsTable.kind, "lesson"),
        eq(mojiMoriReviewsTable.correct, true),
        gte(mojiMoriReviewsTable.createdAt, startOfDay()),
      ),
    );
  return Number(row?.count ?? 0);
}

async function lessonCandidates(userId: number, userLevel: number) {
  const subjects = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      objectType: mojiMoriSubjectsTable.objectType,
      level: mojiMoriSubjectsTable.level,
      componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
      lessonPosition: mojiMoriSubjectsTable.lessonPosition,
    })
    .from(mojiMoriSubjectsTable)
    .where(lte(mojiMoriSubjectsTable.level, userLevel));
  const context = await unlockContextFor(userId, subjects);
  return subjects
    .filter((subject) => {
      const view = progressView(
        subject,
        context.userLevel,
        context.catalog,
        context.stageOf,
        context.progress.get(subject.id),
      );
      return view.status === "lessons";
    })
    .sort(
      (a, b) =>
        a.level - b.level ||
        (TYPE_RANK[a.objectType] ?? 9) - (TYPE_RANK[b.objectType] ?? 9) ||
        a.lessonPosition - b.lessonPosition ||
        a.id - b.id,
    );
}

function interleave<T extends { objectType: string }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const list = buckets.get(item.objectType) ?? [];
    list.push(item);
    buckets.set(item.objectType, list);
  }
  const mixed: T[] = [];
  let pending = items.length;
  while (pending > 0) {
    for (const type of ["radical", "kanji", "vocabulary"]) {
      const next = buckets.get(type)?.shift();
      if (!next) continue;
      mixed.push(next);
      pending -= 1;
    }
  }
  return mixed;
}

function lessonCard(row: SubjectRow) {
  return {
    id: row.id,
    objectType: row.objectType,
    level: row.level,
    characters: row.characters,
    characterImages: row.characterImages,
    meanings: row.meanings,
    readings: row.readings,
    meaningMnemonic: row.meaningMnemonic,
    meaningHint: row.meaningHint,
    readingMnemonic: row.readingMnemonic,
    readingHint: row.readingHint,
    contextSentences: row.contextSentences,
    prompts: promptsFor(row.objectType),
    gradeKey: gradeKeyFor(row, [], [], []),
  };
}

type QuizSource = {
  id: number;
  objectType: string;
  level: number;
  characters: string | null;
  characterImages: SubjectRow["characterImages"];
  pronunciationAudios?: SubjectRow["pronunciationAudios"];
  srsStage: number;
  componentSubjectIds?: number[];
  meanings?: SubjectRow["meanings"];
  readings?: SubjectRow["readings"];
  auxiliaryMeanings?: SubjectRow["auxiliaryMeanings"];
  incorrectCount?: number;
};

function quizCard(row: QuizSource, wordKanji: string[]) {
  const prompts = promptsFor(row.objectType);
  const withWord = row.objectType === "vocabulary" && wordKanji.length > 0;
  return {
    id: row.id,
    objectType: row.objectType,
    level: row.level,
    characters: row.characters,
    characterImages: row.characterImages,
    pronunciationAudios: row.pronunciationAudios ?? [],
    srsStage: row.srsStage,
    prompts: withWord ? [...prompts, "word" as const] : prompts,
    wordKanji: withWord ? wordKanji : [],
    wordReading: withWord ? primaryReading(row.readings ?? []) : "",
    wordMeaning: withWord ? primaryMeaning(row.meanings ?? []) : "",
    gradeKey: gradeKeyFor(row, withWord ? wordKanji : [], [], []),
  };
}

function gradeKeyFor(
  row: {
    characters: string | null;
    meanings?: SubjectRow["meanings"];
    readings?: SubjectRow["readings"];
    auxiliaryMeanings?: SubjectRow["auxiliaryMeanings"];
    incorrectCount?: number;
  },
  wordKanji: string[],
  componentReadings: SubjectRow["readings"],
  peers: WordPeer[],
) {
  return {
    meanings: row.meanings ?? [],
    readings: row.readings ?? [],
    auxiliaryMeanings: row.auxiliaryMeanings ?? [],
    componentReadings,
    wordKanji,
    characters: row.characters,
    peers,
    incorrectCount: row.incorrectCount ?? 0,
  };
}

async function componentLookup(ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return new Map<number, { objectType: string; characters: string | null; readings: SubjectRow["readings"] }>();
  }
  const rows = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      objectType: mojiMoriSubjectsTable.objectType,
      characters: mojiMoriSubjectsTable.characters,
      readings: mojiMoriSubjectsTable.readings,
    })
    .from(mojiMoriSubjectsTable)
    .where(inArray(mojiMoriSubjectsTable.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

function componentKanjiReadings(
  ids: number[],
  lookup: Awaited<ReturnType<typeof componentLookup>>,
): SubjectRow["readings"] {
  const readings: SubjectRow["readings"] = [];
  for (const id of ids) {
    const part = lookup.get(id);
    if (part?.objectType === "kanji") readings.push(...part.readings);
  }
  return readings;
}

async function quizCards(rows: QuizSource[]) {
  const lookup = await componentLookup(rows.flatMap((row) => row.componentSubjectIds ?? []));
  const peers = await peersBySubject(
    rows.flatMap((row) =>
      row.objectType === "vocabulary" && row.readings
        ? [
            {
              id: row.id,
              characters: row.characters,
              meanings: row.meanings ?? [],
              auxiliaryMeanings: row.auxiliaryMeanings ?? [],
              readings: row.readings,
              componentSubjectIds: row.componentSubjectIds ?? [],
            },
          ]
        : [],
    ),
  );
  return rows.map((row) => {
    const ids = row.componentSubjectIds ?? [];
    const wordKanji = compositionKanji(ids, (id) => lookup.get(id));
    const card = quizCard(row, wordKanji);
    return {
      ...card,
      gradeKey: gradeKeyFor(row, card.wordKanji, componentKanjiReadings(ids, lookup), peers.get(row.id) ?? []),
    };
  });
}

export async function checkStudyAnswer(
  subjectId: number,
  prompt: "meaning" | "reading",
  answer: string,
) {
  const [subject] = await db
    .select()
    .from(mojiMoriSubjectsTable)
    .where(eq(mojiMoriSubjectsTable.id, subjectId))
    .limit(1);
  if (!subject) throw new Error("Not found");
  const componentReadings =
    subject.objectType === "vocabulary" && subject.componentSubjectIds.length > 0
      ? (
          await db
            .select({
              objectType: mojiMoriSubjectsTable.objectType,
              readings: mojiMoriSubjectsTable.readings,
            })
            .from(mojiMoriSubjectsTable)
            .where(inArray(mojiMoriSubjectsTable.id, subject.componentSubjectIds))
        )
          .filter((row) => row.objectType === "kanji")
          .flatMap((row) => row.readings)
      : [];
  return checkPrompt(
    subject.objectType,
    subject.meanings,
    subject.readings,
    prompt,
    answer,
    componentReadings,
    subject.auxiliaryMeanings,
  );
}

function acceptedReadingKeys(readings: SubjectRow["readings"]): string[] {
  return [
    ...new Set(
      readings
        .filter((item) => item.acceptedAnswer)
        .map((item) => normalizeReading(item.reading))
        .filter(Boolean),
    ),
  ];
}

type PeerSource = {
  id: number;
  characters: string | null;
  meanings: SubjectRow["meanings"];
  auxiliaryMeanings: SubjectRow["auxiliaryMeanings"];
  readings: SubjectRow["readings"];
  componentSubjectIds: number[];
};

async function peersBySubject(subjects: PeerSource[]): Promise<Map<number, WordPeer[]>> {
  const wanted = new Map<number, string[]>();
  const keys = new Set<string>();
  for (const subject of subjects) {
    const list = acceptedReadingKeys(subject.readings);
    wanted.set(subject.id, list);
    for (const key of list) keys.add(key);
  }
  const keyList = [...keys];
  const found = new Map<number, PeerSource>();
  for (let index = 0; index < keyList.length; index += 25) {
    const chunk = keyList.slice(index, index + 25);
    const filters = chunk.map(
      (key) =>
        sql`${mojiMoriSubjectsTable.readings}::text ilike ${"%" + key.replace(/[%_\\]/g, "") + "%"}`,
    );
    const rows = await db
      .select({
        id: mojiMoriSubjectsTable.id,
        characters: mojiMoriSubjectsTable.characters,
        meanings: mojiMoriSubjectsTable.meanings,
        auxiliaryMeanings: mojiMoriSubjectsTable.auxiliaryMeanings,
        readings: mojiMoriSubjectsTable.readings,
        componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
      })
      .from(mojiMoriSubjectsTable)
      .where(
        and(
          eq(mojiMoriSubjectsTable.objectType, "vocabulary"),
          filters.length === 1 ? filters[0]! : or(...filters),
        ),
      );
    for (const row of rows) found.set(row.id, row);
  }
  const lookup = await componentLookup([...found.values()].flatMap((row) => row.componentSubjectIds));
  const prepared = [...found.values()].map((row) => ({
    id: row.id,
    keys: acceptedReadingKeys(row.readings),
    peer: {
      meanings: row.meanings,
      auxiliary: row.auxiliaryMeanings,
      kanji: compositionKanji(row.componentSubjectIds, (id) => lookup.get(id)).join(""),
      characters: row.characters,
    } satisfies WordPeer,
  }));
  const result = new Map<number, WordPeer[]>();
  for (const subject of subjects) {
    const mine = new Set(wanted.get(subject.id) ?? []);
    result.set(
      subject.id,
      prepared.flatMap((row) =>
        row.id !== subject.id && row.keys.some((key) => mine.has(key)) ? [row.peer] : [],
      ),
    );
  }
  return result;
}

async function readingPeers(subject: SubjectRow): Promise<WordPeer[]> {
  const map = await peersBySubject([subject]);
  return map.get(subject.id) ?? [];
}

export async function checkWordAnswer(
  subjectId: number,
  method: "meaning" | "kanji",
  answer: string,
) {
  const [subject] = await db
    .select()
    .from(mojiMoriSubjectsTable)
    .where(eq(mojiMoriSubjectsTable.id, subjectId))
    .limit(1);
  if (!subject) throw new Error("Not found");
  const empty = {
    correct: false,
    homophone: false,
    shake: false,
    wantedType: null,
    multipleMeanings: false,
    multipleReadings: false,
    lenient: false,
    exception: null,
  };
  if (subject.objectType !== "vocabulary") return empty;
  const lookup = await componentLookup(subject.componentSubjectIds);
  const kanji = compositionKanji(subject.componentSubjectIds, (id) => lookup.get(id)).join("");
  if (!kanji) return empty;
  const verdict = assessWordAnswer({
    method,
    answer,
    meanings: subject.meanings,
    auxiliary: subject.auxiliaryMeanings,
    kanji,
    characters: subject.characters,
    peers: await readingPeers(subject),
  });
  return {
    ...empty,
    correct: verdict.correct,
    homophone: verdict.homophone && !verdict.correct,
    lenient: verdict.lenient,
  };
}

function primaryMeaning(meanings: SubjectRow["meanings"]): string {
  const row = meanings.find((item) => item.primary) ?? meanings[0];
  return row?.meaning ?? "";
}

function primaryReading(readings: SubjectRow["readings"]): string {
  const row = readings.find((item) => item.primary) ?? readings[0];
  return row?.reading ?? "";
}

function firstImage(images: SubjectRow["characterImages"]): string | null {
  return images.find((image) => image.url)?.url ?? null;
}

export async function lessonPicker(userId: number) {
  const settings = await studySettings(userId);
  const done = await lessonsDoneToday(userId);
  const remaining =
    settings.dailyLessonCap === 0
      ? null
      : Math.max(0, settings.dailyLessonCap - done);
  const candidates = await lessonCandidates(userId, settings.level);
  const ids = candidates.map((item) => item.id);
  const rows = ids.length
    ? await db
        .select({
          id: mojiMoriSubjectsTable.id,
          characters: mojiMoriSubjectsTable.characters,
          characterImages: mojiMoriSubjectsTable.characterImages,
          meanings: mojiMoriSubjectsTable.meanings,
        })
        .from(mojiMoriSubjectsTable)
        .where(inArray(mojiMoriSubjectsTable.id, ids))
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const queue = settings.interleaveLessons ? interleave(candidates) : candidates;
  return {
    available: candidates.length,
    dailyRemaining: remaining,
    batchSize: settings.lessonBatchSize,
    interleave: settings.interleaveLessons,
    queueIds: queue.map((item) => item.id),
    items: candidates.flatMap((item) => {
      const row = byId.get(item.id);
      if (!row) return [];
      return [
        {
          id: item.id,
          objectType: item.objectType,
          level: item.level,
          characters: row.characters,
          imageUrl: firstImage(row.characterImages),
          meaning: primaryMeaning(row.meanings),
        },
      ];
    }),
  };
}

export async function lessonQueue(userId: number, selectedIds?: number[]) {
  const settings = await studySettings(userId);
  const done = await lessonsDoneToday(userId);
  const remaining =
    settings.dailyLessonCap === 0
      ? Number.POSITIVE_INFINITY
      : Math.max(0, settings.dailyLessonCap - done);
  const candidates = await lessonCandidates(userId, settings.level);
  const ordered = settings.interleaveLessons ? interleave(candidates) : candidates;
  const candidateById = new Map(candidates.map((item) => [item.id, item]));
  const chosen = Boolean(selectedIds?.length);
  const pool = selectedIds?.length
    ? selectedIds.flatMap((id, index) => {
        if (selectedIds.indexOf(id) !== index) return [];
        const item = candidateById.get(id);
        return item ? [item] : [];
      })
    : ordered;
  const cap = Number.isFinite(remaining) ? remaining : pool.length;
  const size = chosen
    ? Math.min(cap, pool.length)
    : Math.min(settings.lessonBatchSize, cap, pool.length);
  const ids = pool.slice(0, Math.max(0, size)).map((item) => item.id);
  const rows = ids.length
    ? await db.select().from(mojiMoriSubjectsTable).where(inArray(mojiMoriSubjectsTable.id, ids))
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const chosenRows = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  const lookup = await componentLookup(chosenRows.flatMap((row) => row.componentSubjectIds));
  return {
    available: candidates.length,
    dailyRemaining: Number.isFinite(remaining) ? remaining : null,
    batchSize: settings.lessonBatchSize,
    items: chosenRows.map((row) => ({
      ...lessonCard(row),
      gradeKey: gradeKeyFor(
        row,
        [],
        componentKanjiReadings(row.componentSubjectIds, lookup),
        [],
      ),
    })),
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export async function reviewQueue(userId: number) {
  const settings = await studySettings(userId);
  const now = new Date();
  const rows = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      objectType: mojiMoriSubjectsTable.objectType,
      level: mojiMoriSubjectsTable.level,
      characters: mojiMoriSubjectsTable.characters,
      characterImages: mojiMoriSubjectsTable.characterImages,
      pronunciationAudios: mojiMoriSubjectsTable.pronunciationAudios,
      srsStage: mojiMoriProgressTable.srsStage,
      incorrectCount: mojiMoriProgressTable.incorrectCount,
      componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
      meanings: mojiMoriSubjectsTable.meanings,
      readings: mojiMoriSubjectsTable.readings,
      auxiliaryMeanings: mojiMoriSubjectsTable.auxiliaryMeanings,
    })
    .from(mojiMoriProgressTable)
    .innerJoin(
      mojiMoriSubjectsTable,
      eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id),
    )
    .where(
      and(
        eq(mojiMoriProgressTable.userId, userId),
        gte(mojiMoriProgressTable.srsStage, 1),
        lte(mojiMoriProgressTable.srsStage, COMPLETED_STAGE - 1),
        or(isNull(mojiMoriProgressTable.availableAt), lte(mojiMoriProgressTable.availableAt, now)),
      ),
    );
  const ordered =
    settings.reviewOrder === "lower-stage"
      ? [...rows].sort((a, b) => a.srsStage - b.srsStage || a.level - b.level)
      : settings.reviewOrder === "lower-level"
        ? [...rows].sort((a, b) => a.level - b.level || a.srsStage - b.srsStage)
        : settings.reviewOrder === "apprentice"
          ? [...rows].sort(
              (a, b) => Number(b.srsStage <= 4) - Number(a.srsStage <= 4) || a.srsStage - b.srsStage,
            )
          : shuffle(rows);
  return {
    due: rows.length,
    apprenticeDue: rows.filter((row) => row.srsStage <= 4).length,
    items: await quizCards(ordered),
  };
}

export async function extraQueue(userId: number, mode: ExtraMode) {
  if (mode === "recent-mistakes") {
    const mistakes = await recentMistakes(userId);
    const ids = mistakes.map((item) => item.subjectId);
    if (ids.length === 0) return { items: [] };
    const rows = await db.select().from(mojiMoriSubjectsTable).where(inArray(mojiMoriSubjectsTable.id, ids));
    const progress = await progressBySubjectId(userId, ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const sources = ids.flatMap((id) => {
      const row = byId.get(id);
      const saved = progress.get(id);
      return row
        ? [{ ...row, srsStage: saved?.srsStage ?? 0, incorrectCount: saved?.incorrectCount ?? 0 }]
        : [];
    });
    return { items: await quizCards(sources) };
  }
  const stageFilter =
    mode === "cooked"
      ? gte(mojiMoriProgressTable.srsStage, COMPLETED_STAGE)
      : and(gte(mojiMoriProgressTable.srsStage, 1), lte(mojiMoriProgressTable.srsStage, 4));
  const rows = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      objectType: mojiMoriSubjectsTable.objectType,
      level: mojiMoriSubjectsTable.level,
      characters: mojiMoriSubjectsTable.characters,
      characterImages: mojiMoriSubjectsTable.characterImages,
      pronunciationAudios: mojiMoriSubjectsTable.pronunciationAudios,
      srsStage: mojiMoriProgressTable.srsStage,
      incorrectCount: mojiMoriProgressTable.incorrectCount,
      componentSubjectIds: mojiMoriSubjectsTable.componentSubjectIds,
      meanings: mojiMoriSubjectsTable.meanings,
      readings: mojiMoriSubjectsTable.readings,
      auxiliaryMeanings: mojiMoriSubjectsTable.auxiliaryMeanings,
    })
    .from(mojiMoriProgressTable)
    .innerJoin(mojiMoriSubjectsTable, eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id))
    .where(and(eq(mojiMoriProgressTable.userId, userId), stageFilter))
    .orderBy(desc(mojiMoriProgressTable.startedAt));
  return { items: await quizCards(rows) };
}

async function writeAttempts(
  userId: number,
  subjectId: number,
  kind: StudyKind,
  objectType: string,
  graded: GradeResult,
  fromStage: number,
  toStage: number,
) {
  for (const prompt of promptsFor(objectType)) {
    const correct = prompt === "meaning" ? graded.meaningCorrect === true : graded.readingCorrect === true;
    await db.insert(mojiMoriReviewsTable).values({
      userId,
      subjectId,
      kind,
      prompt,
      correct,
      fromStage,
      toStage,
    });
    await bumpAnswerStat(userId, subjectId, prompt, correct);
  }
  if (graded.wordCorrect !== null) {
    await db.insert(mojiMoriReviewsTable).values({
      userId,
      subjectId,
      kind,
      prompt: "word",
      correct: graded.wordCorrect,
      fromStage,
      toStage,
    });
  }
}

async function bumpAnswerStat(
  userId: number,
  subjectId: number,
  prompt: "meaning" | "reading",
  correct: boolean,
) {
  const meaning = prompt === "meaning";
  const correctCol = meaning
    ? mojiMoriProgressTable.meaningCorrect
    : mojiMoriProgressTable.readingCorrect;
  const incorrectCol = meaning
    ? mojiMoriProgressTable.meaningIncorrect
    : mojiMoriProgressTable.readingIncorrect;
  const currentCol = meaning
    ? mojiMoriProgressTable.meaningCurrentStreak
    : mojiMoriProgressTable.readingCurrentStreak;
  const maxCol = meaning
    ? mojiMoriProgressTable.meaningMaxStreak
    : mojiMoriProgressTable.readingMaxStreak;
  await db
    .update(mojiMoriProgressTable)
    .set(
      correct
        ? {
            [meaning ? "meaningCorrect" : "readingCorrect"]: sql`${correctCol} + 1`,
            [meaning ? "meaningCurrentStreak" : "readingCurrentStreak"]: sql`${currentCol} + 1`,
            [meaning ? "meaningMaxStreak" : "readingMaxStreak"]: sql`greatest(${maxCol}, ${currentCol} + 1)`,
          }
        : {
            [meaning ? "meaningIncorrect" : "readingIncorrect"]: sql`${incorrectCol} + 1`,
            [meaning ? "meaningCurrentStreak" : "readingCurrentStreak"]: 0,
          },
    )
    .where(
      and(eq(mojiMoriProgressTable.userId, userId), eq(mojiMoriProgressTable.subjectId, subjectId)),
    );
}

export async function gradeStudyItem(
  userId: number,
  kind: StudyKind,
  subjectId: number,
  meaning: string | undefined,
  reading: string | undefined,
  word?: string,
  expectedStage?: number,
): Promise<GradeResult & { srsStage: number; level: number; leveledUp: boolean }> {
  const [subject] = await db
    .select()
    .from(mojiMoriSubjectsTable)
    .where(eq(mojiMoriSubjectsTable.id, subjectId))
    .limit(1);
  if (!subject) throw new Error("Not found");
  const row = (await progressBySubjectId(userId, [subjectId])).get(subjectId);
  const fromStage = row?.srsStage ?? 0;
  const levelBefore = await ensureMojiMoriUser(userId);
  const unchanged = {
    meaningCorrect: null,
    readingCorrect: null,
    wordCorrect: null,
    shake: false,
    wantedType: null,
    passed: false,
    srsStage: fromStage,
    level: levelBefore,
    leveledUp: false,
  };
  if (kind === "lesson" && fromStage >= 1) return unchanged;
  if (kind === "review" && expectedStage != null && fromStage !== expectedStage) return unchanged;
  const graded = gradeAnswers(
    subject.objectType,
    subject.meanings,
    subject.readings,
    meaning,
    reading,
    subject.auxiliaryMeanings,
  );

  if (graded.shake) {
    return { ...graded, srsStage: fromStage, level: levelBefore, leveledUp: false };
  }

  let wordCorrect: boolean | null = null;
  if (kind !== "lesson" && subject.objectType === "vocabulary") {
    const lookup = await componentLookup(subject.componentSubjectIds);
    const kanji = compositionKanji(subject.componentSubjectIds, (id) => lookup.get(id)).join("");
    if (kanji) {
      wordCorrect = wordAnswerCorrect(word, subject.meanings, subject.auxiliaryMeanings, kanji);
    }
  }
  const scored = applyWordGrade(graded, wordCorrect);

  if (kind === "extra") {
    await writeAttempts(userId, subjectId, "extra", subject.objectType, scored, fromStage, fromStage);
    return { ...scored, srsStage: fromStage, level: levelBefore, leveledUp: false };
  }

  if (kind === "lesson") {
    const allowed = await lessonCandidates(userId, levelBefore);
    if (!allowed.some((item) => item.id === subjectId)) throw new Error("Item is not in lessons");
    if (!scored.passed) {
      await writeAttempts(userId, subjectId, "lesson", subject.objectType, scored, 0, 0);
      return { ...scored, srsStage: 0, level: levelBefore, leveledUp: false };
    }
    const settings = await studySettings(userId);
    const done = await lessonsDoneToday(userId);
    if (settings.dailyLessonCap !== 0 && done >= settings.dailyLessonCap) {
      throw new Error("Daily lesson limit reached");
    }
    await applyStage(userId, subjectId, 1, 0, levelBefore, row?.unlockedAt ?? new Date());
    await writeAttempts(userId, subjectId, "lesson", subject.objectType, scored, 0, 1);
    const moved = await maybeLevelUp(userId);
    return { ...scored, srsStage: 1, level: moved.level, leveledUp: moved.leveledUp };
  }

  if (fromStage < 1 || fromStage >= COMPLETED_STAGE) throw new Error("Item is not in reviews");
  if (!scored.passed) {
    const dropped = nextStageOnWrong(fromStage, row?.incorrectCount ?? 0);
    await applyStage(userId, subjectId, dropped.stage, dropped.incorrectCount, levelBefore, row?.unlockedAt ?? new Date());
    await writeAttempts(userId, subjectId, "review", subject.objectType, scored, fromStage, dropped.stage);
    return { ...scored, srsStage: dropped.stage, level: levelBefore, leveledUp: false };
  }
  const next = nextStageOnCorrect(fromStage);
  await applyStage(userId, subjectId, next, 0, levelBefore, row?.unlockedAt ?? new Date());
  await writeAttempts(userId, subjectId, "review", subject.objectType, scored, fromStage, next);
  const moved = await maybeLevelUp(userId);
  return { ...scored, srsStage: next, level: moved.level, leveledUp: moved.leveledUp };
}

export async function gradeStudyBatch(
  userId: number,
  kind: StudyKind,
  items: Array<{
    subjectId: number;
    meaning?: string;
    reading?: string;
    word?: string;
    expectedStage?: number;
  }>,
) {
  const results: Array<GradeResult & { srsStage: number; level: number; leveledUp: boolean }> = [];
  let error: string | undefined;
  for (const item of items) {
    try {
      results.push(
        await gradeStudyItem(
          userId,
          kind,
          item.subjectId,
          item.meaning,
          item.reading,
          item.word,
          item.expectedStage,
        ),
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not save";
      break;
    }
  }
  return { results, error };
}

async function applyStage(
  userId: number,
  subjectId: number,
  srsStage: number,
  incorrectCount: number,
  userLevel: number,
  unlockedAt: Date,
) {
  const now = new Date();
  const passed = srsStage >= UNLOCK_THRESHOLD;
  const burned = srsStage >= COMPLETED_STAGE;
  const availableAt = availableAfter(now, srsStage, userLevel);
  await db
    .insert(mojiMoriProgressTable)
    .values({
      userId,
      subjectId,
      srsStage,
      unlockedAt,
      startedAt: now,
      passedAt: passed ? now : null,
      burnedAt: burned ? now : null,
      availableAt,
      incorrectCount,
    })
    .onConflictDoUpdate({
      target: [mojiMoriProgressTable.userId, mojiMoriProgressTable.subjectId],
      set: {
        srsStage,
        unlockedAt: sql`coalesce(${mojiMoriProgressTable.unlockedAt}, ${unlockedAt})`,
        startedAt: sql`coalesce(${mojiMoriProgressTable.startedAt}, ${now})`,
        passedAt: passed ? sql`coalesce(${mojiMoriProgressTable.passedAt}, ${now})` : null,
        burnedAt: burned ? sql`coalesce(${mojiMoriProgressTable.burnedAt}, ${now})` : null,
        availableAt,
        incorrectCount,
      },
    });
  await refreshDependents(userId, subjectId);
}

export async function saveSubjectNotes(
  userId: number,
  subjectId: number,
  meaningNote: string,
  readingNote: string,
) {
  await db
    .insert(mojiMoriProgressTable)
    .values({
      userId,
      subjectId,
      srsStage: 0,
      meaningNote,
      readingNote,
    })
    .onConflictDoUpdate({
      target: [mojiMoriProgressTable.userId, mojiMoriProgressTable.subjectId],
      set: { meaningNote, readingNote },
    });
}

export async function unburnSubject(userId: number, subjectId: number) {
  const row = (await progressBySubjectId(userId, [subjectId])).get(subjectId);
  if (!row || row.srsStage < COMPLETED_STAGE) throw new Error("Item is not legendary");
  const level = await ensureMojiMoriUser(userId);
  await applyStage(userId, subjectId, 1, 0, level, row.unlockedAt ?? new Date());
  return { srsStage: 1 };
}

type LogRow = { subjectId: number; kind: string; correct: boolean; createdAt: Date };

export async function studySnapshot(userId: number) {
  const settings = await studySettings(userId);
  const lessons = await lessonCandidates(userId, settings.level);
  const done = await lessonsDoneToday(userId);
  const reviews = await reviewQueue(userId);
  const now = new Date();
  const upcoming = await db
    .select({ availableAt: mojiMoriProgressTable.availableAt })
    .from(mojiMoriProgressTable)
    .where(
      and(
        eq(mojiMoriProgressTable.userId, userId),
        gte(mojiMoriProgressTable.srsStage, 1),
        lte(mojiMoriProgressTable.srsStage, COMPLETED_STAGE - 1),
        gte(mojiMoriProgressTable.availableAt, now),
        lte(mojiMoriProgressTable.availableAt, addDays(now, 5)),
      ),
    );
  const [recentLessons] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mojiMoriProgressTable)
    .where(
      and(
        eq(mojiMoriProgressTable.userId, userId),
        gte(mojiMoriProgressTable.srsStage, 1),
        lte(mojiMoriProgressTable.srsStage, 4),
      ),
    );
  const [cooked] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mojiMoriProgressTable)
    .where(and(eq(mojiMoriProgressTable.userId, userId), gte(mojiMoriProgressTable.srsStage, COMPLETED_STAGE)));
  const logs = await db
    .select({
      subjectId: mojiMoriReviewsTable.subjectId,
      kind: mojiMoriReviewsTable.kind,
      correct: mojiMoriReviewsTable.correct,
      createdAt: mojiMoriReviewsTable.createdAt,
    })
    .from(mojiMoriReviewsTable)
    .where(eq(mojiMoriReviewsTable.userId, userId))
    .orderBy(asc(mojiMoriReviewsTable.createdAt));
  const mistakes = await recentMistakes(userId);
  return {
    settings: {
      lessonBatchSize: settings.lessonBatchSize,
      dailyLessonCap: settings.dailyLessonCap,
      interleaveLessons: settings.interleaveLessons,
      reviewOrder: settings.reviewOrder,
    },
    lessons: {
      available: lessons.length,
      dailyRemaining:
        settings.dailyLessonCap === 0 ? null : Math.max(0, settings.dailyLessonCap - done),
      batchSize: settings.lessonBatchSize,
    },
    reviews: { due: reviews.due, apprenticeDue: reviews.apprenticeDue },
    forecast: buildForecast(
      upcoming.map((row) => row.availableAt).filter((at): at is Date => at != null),
      now,
    ),
    mistakes,
    extra: {
      recentLessons: Number(recentLessons?.count ?? 0),
      recentMistakes: mistakes.length,
      cooked: Number(cooked?.count ?? 0),
    },
    completed: periodStats(logs, now, false),
    accuracy: periodStats(logs, now, true),
    reviewDays: reviewDays(logs, now),
    heatmap: heatmapFrom(logs, now),
    lists: await itemLists(userId, logs),
    streak: streakFrom(logs, now),
  };
}

function buildForecast(times: Date[], now: Date) {
  const start = startOfDay(now);
  const days = Array.from({ length: 5 }, (_, index) => {
    const day = addDays(start, index);
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const at = new Date(day);
      at.setHours(hour, 0, 0, 0);
      return { at: at.toISOString(), count: 0 };
    });
    return { date: dateKey(day), count: 0, hours };
  });
  for (const time of times) {
    const day = days.find((item) => item.date === dateKey(time));
    if (!day) continue;
    const slot = day.hours.find((hour) => {
      const startAt = new Date(hour.at);
      const end = new Date(startAt);
      end.setHours(end.getHours() + 1);
      return time >= startAt && time < end;
    });
    if (slot) slot.count += 1;
    day.count += 1;
  }
  const next24End = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const next24 = times.filter((time) => time >= now && time < next24End).length;
  return { next24, days };
}

async function recentMistakes(userId: number) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      subjectId: mojiMoriReviewsTable.subjectId,
      correct: mojiMoriReviewsTable.correct,
      characters: mojiMoriSubjectsTable.characters,
      objectType: mojiMoriSubjectsTable.objectType,
      level: mojiMoriSubjectsTable.level,
      slug: mojiMoriSubjectsTable.slug,
      meanings: mojiMoriSubjectsTable.meanings,
      readings: mojiMoriSubjectsTable.readings,
      characterImages: mojiMoriSubjectsTable.characterImages,
      lessonPosition: mojiMoriSubjectsTable.lessonPosition,
      srsStage: mojiMoriProgressTable.srsStage,
    })
    .from(mojiMoriReviewsTable)
    .innerJoin(
      mojiMoriSubjectsTable,
      eq(mojiMoriReviewsTable.subjectId, mojiMoriSubjectsTable.id),
    )
    .leftJoin(
      mojiMoriProgressTable,
      and(
        eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id),
        eq(mojiMoriProgressTable.userId, userId),
      ),
    )
    .where(
      and(
        eq(mojiMoriReviewsTable.userId, userId),
        eq(mojiMoriReviewsTable.kind, "review"),
        gte(mojiMoriReviewsTable.createdAt, since),
      ),
    )
    .orderBy(asc(mojiMoriReviewsTable.createdAt));
  const bySubject = new Map<
    number,
    {
      subjectId: number;
      characters: string | null;
      objectType: string;
      count: number;
      level: number;
      slug: string;
      primaryMeaning: string;
      primaryReading: string;
      characterImages: SubjectRow["characterImages"];
      lessonPosition: number;
      srsStage: number;
    }
  >();
  for (const row of rows) {
    const current = bySubject.get(row.subjectId) ?? {
      subjectId: row.subjectId,
      characters: row.characters,
      objectType: row.objectType,
      count: 0,
      level: row.level,
      slug: row.slug,
      primaryMeaning: primaryMeaning(row.meanings),
      primaryReading: primaryReading(row.readings),
      characterImages: row.characterImages,
      lessonPosition: row.lessonPosition,
      srsStage: row.srsStage ?? 0,
    };
    current.count = row.correct ? 0 : current.count + 1;
    bySubject.set(row.subjectId, current);
  }
  return [...bySubject.values()].filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
}

function periodStats(logs: LogRow[], now: Date, accuracy: boolean) {
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const windows = [
    { key: "today", start: today, end: now, prevStart: addDays(today, -1), prevEnd: addDays(now, -1) },
    { key: "7d", start: addDays(now, -7), end: now, prevStart: addDays(now, -14), prevEnd: addDays(now, -7) },
    {
      key: "month",
      start: monthStart,
      end: now,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      prevEnd: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours(), now.getMinutes()),
    },
    { key: "28d", start: addDays(now, -28), end: now, prevStart: addDays(now, -56), prevEnd: addDays(now, -28) },
    {
      key: "year",
      start: yearStart,
      end: now,
      prevStart: new Date(now.getFullYear() - 1, 0, 1),
      prevEnd: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
    },
    { key: "365d", start: addDays(now, -365), end: now, prevStart: addDays(now, -730), prevEnd: addDays(now, -365) },
    { key: "all", start: null as Date | null, end: null as Date | null, prevStart: null, prevEnd: null },
  ];
  return windows.map((window) => ({
    key: window.key,
    current: measure(logs, window.start, window.end, accuracy),
    previous:
      window.key === "all" ? null : measure(logs, window.prevStart, window.prevEnd, accuracy),
  }));
}

function measure(logs: LogRow[], start: Date | null, end: Date | null, accuracy: boolean) {
  const rows = logs.filter((row) => {
    if (row.kind !== "review") return false;
    if (start && row.createdAt < start) return false;
    if (end && row.createdAt >= end) return false;
    return true;
  });
  if (!accuracy) return rows.length;
  if (rows.length === 0) return null;
  return Math.round((rows.filter((row) => row.correct).length / rows.length) * 1000) / 10;
}

function reviewDays(logs: LogRow[], now: Date) {
  const today = startOfDay(now);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthAgo = addDays(today, -29);
  const start = monthAgo < yearStart ? monthAgo : yearStart;
  const totals = new Map<string, { count: number; correct: number }>();
  for (const row of logs) {
    if (row.kind !== "review" || row.createdAt < start || row.createdAt > now) continue;
    const key = dateKey(row.createdAt);
    const bucket = totals.get(key) ?? { count: 0, correct: 0 };
    bucket.count += 1;
    if (row.correct) bucket.correct += 1;
    totals.set(key, bucket);
  }
  const days: { date: string; count: number; correct: number }[] = [];
  for (let cursor = new Date(start); cursor <= today; cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    const bucket = totals.get(key) ?? { count: 0, correct: 0 };
    days.push({ date: key, count: bucket.count, correct: bucket.correct });
  }
  return days;
}

function heatmapFrom(logs: LogRow[], now: Date) {
  const counts = new Map<string, number>();
  for (const row of logs) {
    if (row.kind !== "lesson" && row.kind !== "review") continue;
    const key = dateKey(row.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const start = addDays(startOfDay(now), -364);
  return Array.from({ length: 365 }, (_, index) => {
    const date = dateKey(addDays(start, index));
    return { date, count: counts.get(date) ?? 0 };
  });
}

function streakFrom(logs: LogRow[], now: Date) {
  const days = new Set<string>();
  for (const row of logs) {
    if (row.kind === "lesson" || row.kind === "review") days.add(dateKey(row.createdAt));
  }
  const today = startOfDay(now);
  let cursor = days.has(dateKey(today)) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(dateKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    const follows =
      previous != null && dateKey(addDays(new Date(`${previous}T00:00:00`), 1)) === day;
    run = follows ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best, daysStudied: days.size };
}

async function itemLists(userId: number, logs: LogRow[]) {
  const since = addDays(new Date(), -30);
  const cooked = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      characters: mojiMoriSubjectsTable.characters,
      objectType: mojiMoriSubjectsTable.objectType,
    })
    .from(mojiMoriProgressTable)
    .innerJoin(mojiMoriSubjectsTable, eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id))
    .where(
      and(
        eq(mojiMoriProgressTable.userId, userId),
        gte(mojiMoriProgressTable.srsStage, COMPLETED_STAGE),
        gte(mojiMoriProgressTable.burnedAt, since),
      ),
    )
    .orderBy(desc(mojiMoriProgressTable.burnedAt))
    .limit(10);
  const unlocked = await db
    .select({
      id: mojiMoriSubjectsTable.id,
      characters: mojiMoriSubjectsTable.characters,
      objectType: mojiMoriSubjectsTable.objectType,
    })
    .from(mojiMoriProgressTable)
    .innerJoin(mojiMoriSubjectsTable, eq(mojiMoriProgressTable.subjectId, mojiMoriSubjectsTable.id))
    .where(and(eq(mojiMoriProgressTable.userId, userId), gte(mojiMoriProgressTable.unlockedAt, since)))
    .orderBy(desc(mojiMoriProgressTable.unlockedAt))
    .limit(10);
  const tally = new Map<number, { correct: number; total: number }>();
  for (const row of logs) {
    if (row.kind !== "review") continue;
    const bucket = tally.get(row.subjectId) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (row.correct) bucket.correct += 1;
    tally.set(row.subjectId, bucket);
  }
  const criticalIds = [...tally.entries()]
    .filter(([, stats]) => stats.total >= 4 && stats.correct / stats.total < 0.75)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
    .slice(0, 10);
  const subjects = criticalIds.length
    ? await db
        .select({
          id: mojiMoriSubjectsTable.id,
          characters: mojiMoriSubjectsTable.characters,
          objectType: mojiMoriSubjectsTable.objectType,
        })
        .from(mojiMoriSubjectsTable)
        .where(inArray(mojiMoriSubjectsTable.id, criticalIds.map(([id]) => id)))
    : [];
  const byId = new Map(subjects.map((row) => [row.id, row]));
  return {
    cooked,
    unlocked,
    critical: criticalIds.flatMap(([id, stats]) => {
      const subject = byId.get(id);
      return subject
        ? [{ ...subject, percent: Math.round((stats.correct / stats.total) * 1000) / 10 }]
        : [];
    }),
  };
}

export async function subjectAnswerStats(userId: number, subjectId: number) {
  const [row] = await db
    .select({
      meaningCorrect: mojiMoriProgressTable.meaningCorrect,
      meaningIncorrect: mojiMoriProgressTable.meaningIncorrect,
      meaningCurrentStreak: mojiMoriProgressTable.meaningCurrentStreak,
      meaningMaxStreak: mojiMoriProgressTable.meaningMaxStreak,
      readingCorrect: mojiMoriProgressTable.readingCorrect,
      readingIncorrect: mojiMoriProgressTable.readingIncorrect,
      readingCurrentStreak: mojiMoriProgressTable.readingCurrentStreak,
      readingMaxStreak: mojiMoriProgressTable.readingMaxStreak,
    })
    .from(mojiMoriProgressTable)
    .where(
      and(eq(mojiMoriProgressTable.userId, userId), eq(mojiMoriProgressTable.subjectId, subjectId)),
    )
    .limit(1);
  const empty = { correct: 0, total: 0, currentStreak: 0, longestStreak: 0 };
  if (!row) return { meaning: empty, reading: empty };
  return {
    meaning: {
      correct: row.meaningCorrect,
      total: row.meaningCorrect + row.meaningIncorrect,
      currentStreak: row.meaningCurrentStreak,
      longestStreak: row.meaningMaxStreak,
    },
    reading: {
      correct: row.readingCorrect,
      total: row.readingCorrect + row.readingIncorrect,
      currentStreak: row.readingCurrentStreak,
      longestStreak: row.readingMaxStreak,
    },
  };
}
