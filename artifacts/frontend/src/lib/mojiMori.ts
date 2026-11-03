export const MOJI_MORI_TYPES = ["radical", "kanji", "vocabulary"] as const;
export type MojiMoriObjectType = (typeof MOJI_MORI_TYPES)[number];

export type MojiMoriMeaning = {
  meaning: string;
  primary: boolean;
  acceptedAnswer: boolean;
};

export type MojiMoriAuxiliaryMeaning = {
  meaning: string;
  type: string;
};

export type MojiMoriReading = {
  reading: string;
  primary: boolean;
  acceptedAnswer: boolean;
  type?: string;
};

export type MojiMoriContextSentence = {
  en: string;
  ja: string;
};

export type MojiMoriCharacterImage = {
  url: string;
  contentType: string;
  metadata: Record<string, unknown>;
};

export type MojiMoriPronunciationAudio = {
  url: string;
  contentType: string;
  metadata: Record<string, unknown>;
};

export type MojiMoriItemStatus =
  | "locked"
  | "lessons"
  | "review"
  | "guru"
  | "burned";

export type MojiMoriAnswerTally = {
  correct: number;
  total: number;
  currentStreak: number;
  longestStreak: number;
};

export type MojiMoriProgress = {
  status: MojiMoriItemStatus;
  srsStage: number;
  passed: boolean;
  meaningNote?: string;
  readingNote?: string;
  unlockedAt?: string | null;
  availableAt?: string | null;
};

export type MojiMoriSubjectSummary = {
  id: number;
  objectType: MojiMoriObjectType | string;
  level: number;
  slug: string;
  characters: string | null;
  primaryMeaning: string;
  primaryReading: string;
  characterImages: MojiMoriCharacterImage[];
  lessonPosition: number;
  progress?: MojiMoriProgress;
};

export type MojiMoriSubjectDetail = MojiMoriSubjectSummary & {
  meanings: MojiMoriMeaning[];
  auxiliaryMeanings: MojiMoriAuxiliaryMeaning[];
  readings: MojiMoriReading[];
  partsOfSpeech: string[];
  componentSubjectIds: number[];
  amalgamationSubjectIds: number[];
  visuallySimilarSubjectIds: number[];
  meaningMnemonic: string;
  meaningHint: string;
  mnemonicImageUrl?: string | null;
  mnemonicImageAlt?: string | null;
  readingMnemonic: string;
  readingHint: string;
  contextSentences: MojiMoriContextSentence[];
  pronunciationAudios: MojiMoriPronunciationAudio[];
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
  related: {
    components: MojiMoriSubjectSummary[];
    amalgamations: MojiMoriSubjectSummary[];
    visuallySimilar: MojiMoriSubjectSummary[];
  };
  answerStats?: {
    meaning: MojiMoriAnswerTally;
    reading: MojiMoriAnswerTally;
  };
};

export type MojiMoriLevelCount = {
  level: number;
  radical: number;
  kanji: number;
  vocabulary: number;
};

export type MojiMoriTypeCounts = {
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

export type MojiMoriDashboard = {
  level: number;
  spread: {
    novice: MojiMoriTypeCounts;
    apprentice: MojiMoriTypeCounts;
    proficient: MojiMoriTypeCounts;
    adept: MojiMoriTypeCounts;
    veteran: MojiMoriTypeCounts;
    expert: MojiMoriTypeCounts;
    master: MojiMoriTypeCounts;
    grandmaster: MojiMoriTypeCounts;
    legendary: MojiMoriTypeCounts;
  };
  levelProgress: MojiMoriLevelProgress;
  levelStats?: MojiMoriLevelProgress[];
  study?: MojiMoriStudySnapshot;
};

export type MojiMoriLevelProgress = {
  level: number;
  radical: { guru: number; total: number };
  kanji: { guru: number; total: number };
  vocabulary: { guru: number; total: number };
  kanjiNeeded: number;
  kanjiRemaining: number;
};

export type MojiMoriStudyCard = {
  id: number;
  objectType: string;
  level: number;
  characters: string | null;
  characterImages: MojiMoriCharacterImage[];
  srsStage?: number;
  pronunciationAudios?: MojiMoriPronunciationAudio[];
  prompts: Array<"meaning" | "reading">;
  meanings?: MojiMoriMeaning[];
  readings?: MojiMoriReading[];
  meaningMnemonic?: string;
  meaningHint?: string;
  readingMnemonic?: string;
  readingHint?: string;
  contextSentences?: MojiMoriContextSentence[];
};

export type MojiMoriLessonPick = {
  id: number;
  objectType: MojiMoriObjectType;
  level: number;
  characters: string | null;
  imageUrl: string | null;
  meaning: string;
};

export type MojiMoriLessonPicker = {
  available: number;
  dailyRemaining: number | null;
  batchSize: number;
  interleave: boolean;
  queueIds: number[];
  items: MojiMoriLessonPick[];
};

export type MojiMoriStudySnapshot = {
  settings: {
    lessonBatchSize: number;
    dailyLessonCap: number;
    interleaveLessons: boolean;
    reviewOrder: string;
  };
  lessons: { available: number; dailyRemaining: number | null; batchSize: number };
  reviews: { due: number; apprenticeDue: number };
  forecast: {
    next24: number;
    days: { date: string; count: number; hours: { at: string; count: number }[] }[];
  };
  mistakes: {
    subjectId: number;
    characters: string | null;
    objectType: string;
    count: number;
    level: number;
    slug: string;
    primaryMeaning: string;
    primaryReading: string;
    characterImages: MojiMoriCharacterImage[];
    lessonPosition: number;
    srsStage: number;
  }[];
  extra: { recentLessons: number; recentMistakes: number; cooked: number };
  completed: { key: string; current: number | null; previous: number | null }[];
  accuracy: { key: string; current: number | null; previous: number | null }[];
  reviewDays?: { date: string; count: number; correct: number }[];
  heatmap: { date: string; count: number }[];
  lists: {
    cooked: { id: number; characters: string | null; objectType: string }[];
    unlocked: { id: number; characters: string | null; objectType: string }[];
    critical: { id: number; characters: string | null; objectType: string; percent: number }[];
  };
  streak: { current: number; best: number; daysStudied: number };
};

export const SRS_GROUPS = [
  "novice",
  "apprentice",
  "proficient",
  "adept",
  "veteran",
  "expert",
  "master",
  "grandmaster",
  "legendary",
] as const;

export const SRS_COMPLETED_STAGE = 13;

export const GURU_BAR_STEPS = 5;

export const MOJI_MORI_TYPE_COLORS: Record<string, string> = {
  radical: "var(--color-radical)",
  kanji: "var(--color-kanji)",
  vocabulary: "var(--color-vocabulary)",
};

export const SRS_STAGES = [
  { stage: 1, key: "novice1" },
  { stage: 2, key: "novice2" },
  { stage: 3, key: "apprentice1" },
  { stage: 4, key: "apprentice2" },
  { stage: 5, key: "proficient1" },
  { stage: 6, key: "proficient2" },
  { stage: 7, key: "adept1" },
  { stage: 8, key: "adept2" },
  { stage: 9, key: "veteran" },
  { stage: 10, key: "expert" },
  { stage: 11, key: "master" },
  { stage: 12, key: "grandmaster" },
  { stage: 13, key: "legendary" },
] as const;

export const MOJI_MORI_LEVEL_BANDS = [
  { key: "pleasant", ja: "快", start: 1, end: 10 },
  { key: "painful", ja: "苦", start: 11, end: 20 },
  { key: "death", ja: "死", start: 21, end: 30 },
  { key: "hell", ja: "地獄", start: 31, end: 40 },
  { key: "paradise", ja: "天国", start: 41, end: 50 },
  { key: "reality", ja: "現実", start: 51, end: 60 },
] as const;

export function isMojiMoriType(value: string): value is MojiMoriObjectType {
  return (MOJI_MORI_TYPES as readonly string[]).includes(value);
}

export function mojiMoriTypePath(type: string): string {
  if (type === "radical") return "radicals";
  if (type === "kanji") return "kanji";
  return "vocabulary";
}

export function mojiMoriSubjectHref(subject: {
  id: number;
  objectType: string;
  characters?: string | null;
}): string {
  const key = subject.characters
    ? encodeURIComponent(subject.characters)
    : String(subject.id);
  return `/mojimori/${mojiMoriTypePath(subject.objectType)}/${key}`;
}

export function pickCharacterImage(
  images: MojiMoriCharacterImage[] | undefined,
): string | null {
  if (!images?.length) return null;
  const png256 = images.find(
    (img) =>
      img.contentType === "image/png" &&
      String(img.metadata?.style_name ?? img.metadata?.styleName ?? "") ===
        "256px",
  );
  if (png256) return png256.url;
  const png = images.find((img) => img.contentType === "image/png");
  if (png) return png.url;
  return images[0]?.url ?? null;
}

export function pickPronunciationAudio(
  audios: MojiMoriPronunciationAudio[] | undefined,
): string | null {
  if (!audios?.length) return null;
  const mpeg = audios.find((audio) => audio.contentType === "audio/mpeg");
  return mpeg?.url ?? audios[0]?.url ?? null;
}

export function kanjiReadingsByKind(readings: MojiMoriReading[]) {
  const onyomi = readings.filter((item) => item.type === "onyomi");
  const kunyomi = readings.filter((item) => item.type === "kunyomi");
  const nanori = readings.filter((item) => item.type === "nanori");
  return { onyomi, kunyomi, nanori };
}
