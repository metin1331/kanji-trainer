const fs = require("fs");
const path = require("path");
const dns = require("dns");
const { createRequire } = require("module");

const root = path.resolve(__dirname, "../../..");
const download = path.join(root, "artifacts", "wanikani_download");

const env = fs.readFileSync(path.join(root, ".env"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^DATABASE_URL=(.*)$/);
  if (!match) continue;
  process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const useSsl =
  rawUrl.includes("supabase") ||
  rawUrl.includes("sslmode=require") ||
  rawUrl.includes("sslmode=verify");
const connectionString = rawUrl
  .replace(/([?&])sslmode=[^&]*/g, "")
  .replace(/\?&/, "?")
  .replace(/\?$/, "");

const { Client } = createRequire(path.join(root, "lib/db/package.json"))("pg");
const client = new Client({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  lookup: (hostname, _opts, cb) => {
    dns.lookup(hostname, { family: 4 }, cb);
  },
});

const HOUR = 60 * 60 * 1000;
const WK_DEFAULT = {
  1: 14400,
  2: 28800,
  3: 82800,
  4: 169200,
  5: 601200,
  6: 1206000,
  7: 2588400,
  8: 10364400,
};
const WK_FAST = {
  1: 7200,
  2: 14400,
  3: 28800,
  4: 82800,
  5: 601200,
  6: 1206000,
  7: 2588400,
  8: 10364400,
};
const MM_HOURS = {
  1: 2,
  2: 4,
  3: 11.5,
  4: 23.5,
  5: 84,
  6: 82,
  7: 168,
  8: 360,
};

function readJson(name) {
  const text = fs.readFileSync(path.join(download, name), "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function whole(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function noteWithSynonyms(note, synonyms) {
  const text = String(note ?? "").trim();
  const extra = (Array.isArray(synonyms) ? synonyms : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (text && extra) return `${text}\n${extra}`;
  return text || extra;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && value.data && !Array.isArray(value.data)) return [value];
  return value ? [value] : [];
}

function roundUpToHour(date) {
  const next = new Date(date);
  if (
    next.getMinutes() === 0 &&
    next.getSeconds() === 0 &&
    next.getMilliseconds() === 0
  ) {
    return next;
  }
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

function wkIntervalMs(stage, availableAt, updatedAt) {
  const options = [WK_DEFAULT[stage], WK_FAST[stage]].filter((value) => value > 0);
  const unique = [...new Set(options)];
  if (unique.length === 1) return unique[0] * 1000;
  const delta = availableAt && updatedAt ? availableAt.getTime() - updatedAt.getTime() : unique[0] * 1000;
  let best = unique[0];
  let bestDiff = Infinity;
  for (const seconds of unique) {
    const diff = Math.abs(delta - seconds * 1000);
    if (diff < bestDiff) {
      best = seconds;
      bestDiff = diff;
    }
  }
  return best * 1000;
}

function nextAvailable(stage, availableAt, updatedAt, now) {
  if (stage <= 0 || stage >= 13) return null;
  if (!availableAt || availableAt.getTime() <= now.getTime()) {
    return availableAt && availableAt.getTime() <= now.getTime() ? availableAt : now;
  }
  const wk = wkIntervalMs(stage, availableAt, updatedAt);
  const remaining = availableAt.getTime() - now.getTime();
  const fraction = Math.min(1, Math.max(0, remaining / wk));
  const wait = fraction * MM_HOURS[stage] * HOUR;
  return roundUpToHour(new Date(now.getTime() + wait));
}

async function main() {
  const assignments = asList(readJson("assignments.json"));
  const materials = asList(readJson("study_materials.json"));
  const profile = readJson("user.json");
  const level = Number(profile.data?.level ?? profile.level);
  if (!Number.isInteger(level) || level < 1 || level > 60) {
    throw new Error("Profile level is missing");
  }

  const notes = new Map();
  let synonymNotes = 0;
  for (const row of materials) {
    const data = row.data ?? row;
    const id = Number(data.subject_id);
    if (!id) continue;
    const meaning = noteWithSynonyms(data.meaning_note, data.meaning_synonyms);
    const reading = noteWithSynonyms(data.reading_note, data.reading_synonyms);
    if (meaning || reading) synonymNotes += 1;
    notes.set(id, { meaning, reading });
  }

  const stats = new Map();
  for (const row of asList(readJson("review_statistics.json"))) {
    const data = row.data ?? row;
    const id = Number(data.subject_id);
    if (!id || data.hidden) continue;
    stats.set(id, {
      meaningCorrect: whole(data.meaning_correct),
      meaningIncorrect: whole(data.meaning_incorrect),
      meaningCurrentStreak: whole(data.meaning_current_streak),
      meaningMaxStreak: whole(data.meaning_max_streak),
      readingCorrect: whole(data.reading_correct),
      readingIncorrect: whole(data.reading_incorrect),
      readingCurrentStreak: whole(data.reading_current_streak),
      readingMaxStreak: whole(data.reading_max_streak),
    });
  }

  const progressions = asList(readJson("level_progressions.json")).map((row) => row.data ?? row);
  const passedLevels = progressions.filter((row) => row.passed_at).map((row) => Number(row.level));
  const resets = asList(readJson("resets.json")).length;
  const reviewLog = asList(readJson("reviews.json")).length;

  await client.connect();
  const users = await client.query(
    `select m.user_id, u.role
     from moji_mori_users m
     join users u on u.id = m.user_id
     order by m.user_id`,
  );
  let userId;
  if (users.rows.length === 1) {
    userId = users.rows[0].user_id;
  } else {
    const admins = users.rows.filter((row) => row.role === "admin");
    if (admins.length !== 1) {
      throw new Error(`Refusing to guess the profile. Found ${users.rows.length} profiles`);
    }
    userId = admins[0].user_id;
  }
  const existingReviews = await client.query(
    "select count(*)::int as n from moji_mori_reviews where user_id = $1",
    [userId],
  );
  const subjectRows = await client.query("select id from moji_mori_subjects");
  const catalog = new Set(subjectRows.rows.map((row) => row.id));

  const now = new Date();
  const skipped = { type: {}, missing: 0, hidden: 0, badStage: 0 };
  const stageCounts = {};
  const rows = [];
  let pulledForward = 0;
  let pushedBack = 0;
  let alreadyDue = 0;
  let legendary = 0;

  for (const row of assignments) {
    const data = row.data ?? row;
    if (data.hidden) {
      skipped.hidden += 1;
      continue;
    }
    const type = String(data.subject_type ?? "");
    if (type !== "radical" && type !== "kanji" && type !== "vocabulary") {
      skipped.type[type || "unknown"] = (skipped.type[type || "unknown"] ?? 0) + 1;
      continue;
    }
    const subjectId = Number(data.subject_id);
    if (!catalog.has(subjectId)) {
      skipped.missing += 1;
      continue;
    }
    const sourceStage = Number(data.srs_stage);
    if (!Number.isInteger(sourceStage) || sourceStage < 0 || sourceStage > 9) {
      skipped.badStage += 1;
      continue;
    }
    const stage = sourceStage === 9 ? 13 : sourceStage;
    const availableAt = data.available_at ? new Date(data.available_at) : null;
    const updatedAt = row.data_updated_at ? new Date(row.data_updated_at) : null;
    const nextAt = stage === 13 ? null : nextAvailable(stage, availableAt, updatedAt, now);
    if (stage === 13) legendary += 1;
    else if (!availableAt || availableAt.getTime() <= now.getTime()) alreadyDue += 1;
    else if (nextAt && nextAt.getTime() < availableAt.getTime()) pulledForward += 1;
    else if (nextAt && nextAt.getTime() > availableAt.getTime()) pushedBack += 1;

    const note = notes.get(subjectId);
    const stat = stats.get(subjectId);
    const passedAt = data.passed_at ? new Date(data.passed_at) : stage >= 5 ? updatedAt : null;
    const burnedAt = stage === 13 ? (data.burned_at ? new Date(data.burned_at) : updatedAt ?? now) : null;
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    rows.push({
      subjectId,
      stage,
      unlockedAt: data.unlocked_at ? new Date(data.unlocked_at) : null,
      startedAt: data.started_at ? new Date(data.started_at) : null,
      passedAt,
      burnedAt,
      availableAt: nextAt,
      meaningNote: note?.meaning ?? "",
      readingNote: note?.reading ?? "",
      stat,
    });
  }

  await client.query("begin");
  await client.query("delete from moji_mori_progress where user_id = $1", [userId]);
  const chunk = 150;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const values = [];
    const params = [];
    slice.forEach((row, index) => {
      const base = index * 18;
      const stat = row.stat ?? {};
      values.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, 0, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18})`,
      );
      params.push(
        userId,
        row.subjectId,
        row.stage,
        row.unlockedAt,
        row.startedAt,
        row.passedAt,
        row.burnedAt,
        row.availableAt,
        stat.meaningCorrect ?? 0,
        stat.meaningIncorrect ?? 0,
        stat.meaningCurrentStreak ?? 0,
        stat.meaningMaxStreak ?? 0,
        stat.readingCorrect ?? 0,
        stat.readingIncorrect ?? 0,
        stat.readingCurrentStreak ?? 0,
        stat.readingMaxStreak ?? 0,
        row.meaningNote,
        row.readingNote,
      );
    });
    await client.query(
      `insert into moji_mori_progress (
        user_id, subject_id, srs_stage, unlocked_at, started_at, passed_at, burned_at, available_at, incorrect_count,
        meaning_correct, meaning_incorrect, meaning_current_streak, meaning_max_streak,
        reading_correct, reading_incorrect, reading_current_streak, reading_max_streak,
        meaning_note, reading_note
      ) values ${values.join(", ")}`,
      params,
    );
  }
  await client.query("update moji_mori_users set level = $2 where user_id = $1", [userId, level]);
  await client.query("commit");

  const check = await client.query(
    "select srs_stage, count(*)::int as n from moji_mori_progress where user_id = $1 group by srs_stage order by srs_stage",
    [userId],
  );
  console.log(
    JSON.stringify({
      userId,
      level,
      imported: rows.length,
      skipped,
      plannedStages: stageCounts,
      storedStages: check.rows,
      alreadyDue,
      pulledForward,
      pushedBack,
      legendary,
      passedLevels,
      resets,
      reviewLog,
      existingReviewRows: existingReviews.rows[0].n,
      notes: synonymNotes,
      stats: stats.size,
    }),
  );
  await client.end();
}

main().catch(async (error) => {
  try {
    await client.query("rollback");
  } catch {
    /* not in a transaction */
  }
  console.error(error.message);
  process.exit(1);
});
