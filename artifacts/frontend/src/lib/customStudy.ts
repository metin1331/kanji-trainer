import { MOJI_MORI_TYPES, type MojiMoriObjectType } from "./mojiMori";

export const CUSTOM_STUDY_MODES = ["meaning", "reading", "drawing"] as const;
export type CustomStudyMode = (typeof CUSTOM_STUDY_MODES)[number];

export const CUSTOM_STUDY_SORTS = [
  "review-oldest",
  "review-newest",
  "due-soonest",
  "due-latest",
  "random",
  "accuracy-lowest",
  "accuracy-highest",
  "unlocked-newest",
  "level-asc",
  "level-desc",
] as const;
export type CustomStudySort = (typeof CUSTOM_STUDY_SORTS)[number];

export const CUSTOM_STUDY_LIMITS = [10, 20, 50, 100, null] as const;

export type CustomStudyConfig = {
  types: MojiMoriObjectType[];
  modes: CustomStudyMode[];
  stages: number[];
  levelMin: number | null;
  levelMax: number | null;
  accuracyMin: number | null;
  accuracyMax: number | null;
  reviewMin: number | null;
  reviewMax: number | null;
  unlocked: boolean;
  neverReviewed: boolean;
  sort: CustomStudySort;
  weakOnly: boolean;
  weakThreshold: number;
  dueOnly: boolean;
  excludeRecent: boolean;
  limit: number | null;
};

const STORAGE_KEY = "moji-mori-custom-study";

export const DEFAULT_CUSTOM_STUDY: CustomStudyConfig = {
  types: [...MOJI_MORI_TYPES],
  modes: ["meaning", "reading"],
  stages: [],
  levelMin: null,
  levelMax: null,
  accuracyMin: null,
  accuracyMax: null,
  reviewMin: null,
  reviewMax: null,
  unlocked: true,
  neverReviewed: false,
  sort: "review-oldest",
  weakOnly: false,
  weakThreshold: 70,
  dueOnly: false,
  excludeRecent: false,
  limit: 10,
};

/** Ready-made configs for a later preset picker. Not shown in the modal yet. */
export const CUSTOM_STUDY_PRESETS: Record<string, CustomStudyConfig> = {
  kanjiWriting: { ...DEFAULT_CUSTOM_STUDY, types: ["kanji"], modes: ["drawing"], sort: "level-asc" },
  vocabularyReading: { ...DEFAULT_CUSTOM_STUDY, types: ["vocabulary"], modes: ["reading"], sort: "level-asc" },
  weakCards: { ...DEFAULT_CUSTOM_STUDY, weakOnly: true, weakThreshold: 70, sort: "accuracy-lowest" },
  dailyReview: { ...DEFAULT_CUSTOM_STUDY, dueOnly: true, sort: "due-soonest" },
  radicalPractice: { ...DEFAULT_CUSTOM_STUDY, types: ["radical"], modes: ["meaning"], sort: "level-asc" },
};

export function modesForTypes(types: readonly MojiMoriObjectType[]): CustomStudyMode[] {
  const modes: CustomStudyMode[] = [];
  if (types.length > 0) modes.push("meaning");
  if (types.some((type) => type === "kanji" || type === "vocabulary")) {
    modes.push("reading", "drawing");
  }
  return modes;
}

function asBound(value: unknown, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return null;
  return number;
}

export function sanitizeCustomStudy(value: unknown): CustomStudyConfig {
  const raw = value && typeof value === "object" ? (value as Partial<CustomStudyConfig>) : {};
  const types = Array.isArray(raw.types)
    ? raw.types.filter((item): item is MojiMoriObjectType =>
        (MOJI_MORI_TYPES as readonly string[]).includes(item),
      )
    : DEFAULT_CUSTOM_STUDY.types;
  const allowed = new Set(modesForTypes(types));
  const modes = (Array.isArray(raw.modes) ? raw.modes : DEFAULT_CUSTOM_STUDY.modes).filter(
    (item): item is CustomStudyMode => allowed.has(item as CustomStudyMode),
  );
  const sort = (CUSTOM_STUDY_SORTS as readonly string[]).includes(String(raw.sort))
    ? (raw.sort as CustomStudySort)
    : DEFAULT_CUSTOM_STUDY.sort;
  const limit =
    raw.limit == null
      ? null
      : CUSTOM_STUDY_LIMITS.includes(raw.limit as (typeof CUSTOM_STUDY_LIMITS)[number])
        ? raw.limit
        : DEFAULT_CUSTOM_STUDY.limit;
  return {
    types,
    modes,
    stages: Array.isArray(raw.stages)
      ? [...new Set(raw.stages.map(Number).filter((stage) => stage >= 1 && stage <= 13))]
      : [],
    levelMin: asBound(raw.levelMin, 1, 60),
    levelMax: asBound(raw.levelMax, 1, 60),
    accuracyMin: asBound(raw.accuracyMin, 0, 100),
    accuracyMax: asBound(raw.accuracyMax, 0, 100),
    reviewMin: asBound(raw.reviewMin, 0, 100000),
    reviewMax: asBound(raw.reviewMax, 0, 100000),
    unlocked: true,
    neverReviewed: raw.neverReviewed === true,
    sort,
    weakOnly: raw.weakOnly === true,
    weakThreshold: asBound(raw.weakThreshold, 1, 100) ?? 70,
    dueOnly: raw.dueOnly === true,
    excludeRecent: raw.excludeRecent === true,
    limit,
  };
}

export function readCustomStudyConfig(): CustomStudyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_STUDY;
    return sanitizeCustomStudy(JSON.parse(raw));
  } catch {
    return DEFAULT_CUSTOM_STUDY;
  }
}

export function writeCustomStudyConfig(config: CustomStudyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeCustomStudy(config)));
}
