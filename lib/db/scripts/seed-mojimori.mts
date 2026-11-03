import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "../../..");
const envFile = resolve(root, ".env");

if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const { db, pool, mojiMoriSubjectsTable, mojiMoriObjectTypes } = await import(
  "../src/index.ts"
);

const BATCH_SIZE = 200;
const full = resolve(root, "artifacts/wanikani_download/subjects.json");
const DEFAULT_FILE = existsSync(full)
  ? full
  : resolve(root, "artifacts/wanikani_download/test_data.json");

type SourceMeaning = {
  meaning?: unknown;
  primary?: unknown;
  accepted_answer?: unknown;
};

type SourceAuxMeaning = {
  meaning?: unknown;
  type?: unknown;
};

type SourceReading = {
  reading?: unknown;
  primary?: unknown;
  accepted_answer?: unknown;
  type?: unknown;
};

type SourceImage = {
  url?: unknown;
  content_type?: unknown;
  metadata?: unknown;
};

type SourceAudio = {
  url?: unknown;
  content_type?: unknown;
  metadata?: unknown;
};

type SourceSentence = {
  en?: unknown;
  ja?: unknown;
};

type SourceSubject = {
  id?: unknown;
  object?: unknown;
  data?: {
    level?: unknown;
    slug?: unknown;
    hidden_at?: unknown;
    characters?: unknown;
    meanings?: SourceMeaning[];
    auxiliary_meanings?: SourceAuxMeaning[];
    readings?: SourceReading[];
    parts_of_speech?: unknown[];
    component_subject_ids?: unknown[];
    amalgamation_subject_ids?: unknown[];
    visually_similar_subject_ids?: unknown[];
    meaning_mnemonic?: unknown;
    meaning_hint?: unknown;
    reading_mnemonic?: unknown;
    reading_hint?: unknown;
    context_sentences?: SourceSentence[];
    character_images?: SourceImage[];
    pronunciation_audios?: SourceAudio[];
    lesson_position?: unknown;
  };
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asIntArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asInt(item, NaN))
    .filter((item) => Number.isFinite(item));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseHiddenAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapSubject(raw: SourceSubject) {
  const id = asInt(raw.id, NaN);
  const objectType = asString(raw.object);
  const data = raw.data;
  if (
    !Number.isFinite(id) ||
    !data ||
    !(mojiMoriObjectTypes as readonly string[]).includes(objectType)
  ) {
    return null;
  }
  if (parseHiddenAt(data.hidden_at)) return null;

  const charactersRaw = data.characters;
  const characters =
    typeof charactersRaw === "string" && charactersRaw.length > 0
      ? charactersRaw
      : null;

  return {
    id,
    objectType,
    level: asInt(data.level, 1),
    slug: asString(data.slug),
    characters,
    hiddenAt: null,
    meanings: (data.meanings ?? []).map((item) => ({
      meaning: asString(item.meaning),
      primary: asBool(item.primary),
      acceptedAnswer: asBool(item.accepted_answer),
    })),
    auxiliaryMeanings: (data.auxiliary_meanings ?? []).map((item) => ({
      meaning: asString(item.meaning),
      type: asString(item.type),
    })),
    readings: (data.readings ?? []).map((item) => ({
      reading: asString(item.reading),
      primary: asBool(item.primary),
      acceptedAnswer: asBool(item.accepted_answer),
      ...(typeof item.type === "string" ? { type: item.type } : {}),
    })),
    partsOfSpeech: asStringArray(data.parts_of_speech),
    componentSubjectIds: asIntArray(data.component_subject_ids),
    amalgamationSubjectIds: asIntArray(data.amalgamation_subject_ids),
    visuallySimilarSubjectIds: asIntArray(data.visually_similar_subject_ids),
    meaningMnemonic: asString(data.meaning_mnemonic),
    meaningHint: asString(data.meaning_hint),
    readingMnemonic: asString(data.reading_mnemonic),
    readingHint: asString(data.reading_hint),
    contextSentences: (data.context_sentences ?? []).map((item) => ({
      en: asString(item.en),
      ja: asString(item.ja),
    })),
    characterImages: (data.character_images ?? [])
      .filter((item) => typeof item.url === "string" && item.url)
      .map((item) => ({
        url: asString(item.url),
        contentType: asString(item.content_type),
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : {},
      })),
    pronunciationAudios: (data.pronunciation_audios ?? [])
      .filter((item) => typeof item.url === "string" && item.url)
      .map((item) => ({
        url: asString(item.url),
        contentType: asString(item.content_type),
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : {},
      })),
    lessonPosition: asInt(data.lesson_position, 0),
    updatedAt: new Date(),
  };
}

async function main() {
  const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
  const filePath = fileArg
    ? resolve(root, fileArg.slice("--file=".length))
    : DEFAULT_FILE;

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array in ${filePath}`);
  }

  const rows = parsed
    .map((item) => mapSubject(item as SourceSubject))
    .filter((row): row is NonNullable<typeof row> => row != null);

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(mojiMoriSubjectsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: mojiMoriSubjectsTable.id,
        set: {
          objectType: sql`excluded.object_type`,
          level: sql`excluded.level`,
          slug: sql`excluded.slug`,
          characters: sql`excluded.characters`,
          hiddenAt: sql`excluded.hidden_at`,
          meanings: sql`excluded.meanings`,
          auxiliaryMeanings: sql`excluded.auxiliary_meanings`,
          readings: sql`excluded.readings`,
          partsOfSpeech: sql`excluded.parts_of_speech`,
          componentSubjectIds: sql`excluded.component_subject_ids`,
          amalgamationSubjectIds: sql`excluded.amalgamation_subject_ids`,
          visuallySimilarSubjectIds: sql`excluded.visually_similar_subject_ids`,
          meaningMnemonic: sql`excluded.meaning_mnemonic`,
          meaningHint: sql`excluded.meaning_hint`,
          readingMnemonic: sql`excluded.reading_mnemonic`,
          readingHint: sql`excluded.reading_hint`,
          contextSentences: sql`excluded.context_sentences`,
          characterImages: sql`excluded.character_images`,
          pronunciationAudios: sql`excluded.pronunciation_audios`,
          lessonPosition: sql`excluded.lesson_position`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    upserted += batch.length;
  }

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.objectType, (counts.get(row.objectType) ?? 0) + 1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: filePath,
        upserted,
        skipped: parsed.length - rows.length,
        counts: Object.fromEntries(counts),
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
