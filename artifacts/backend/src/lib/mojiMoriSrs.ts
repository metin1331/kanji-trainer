import { COMPLETED_STAGE, UNLOCK_THRESHOLD } from "./mojiMoriUnlock";

const HOUR = 60 * 60 * 1000;

export type ReadingLike = {
  reading: string;
  primary: boolean;
  acceptedAnswer: boolean;
  type?: string;
};

export type MeaningLike = {
  meaning: string;
  acceptedAnswer: boolean;
};

export type AuxiliaryLike = {
  meaning: string;
  type: string;
};

export type GradeResult = {
  meaningCorrect: boolean | null;
  readingCorrect: boolean | null;
  wordCorrect: boolean | null;
  shake: boolean;
  wantedType: string | null;
  passed: boolean;
};

export type PromptCheck = {
  correct: boolean;
  shake: boolean;
  wantedType: string | null;
  multipleMeanings: boolean;
  multipleReadings: boolean;
  lenient: boolean;
  exception: "kanjiReading" | "unusualSpelling" | "radicalMeaning" | null;
};

export function intervalMs(stage: number, _userLevel: number): number {
  switch (stage) {
    case 1:
      return 2 * HOUR;
    case 2:
      return 4 * HOUR;
    case 3:
      return 11.5 * HOUR;
    case 4:
      return 23.5 * HOUR;
    case 5:
      return 84 * HOUR;
    case 6:
      return 82 * HOUR;
    case 7:
      return 168 * HOUR;
    case 8:
      return 360 * HOUR;
    case 9:
      return 720 * HOUR;
    case 10:
      return 1440 * HOUR;
    case 11:
      return 2160 * HOUR;
    case 12:
      return 2880 * HOUR;
    default:
      return 0;
  }
}

export function roundUpToHour(date: Date): Date {
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

export function availableAfter(from: Date, stage: number, userLevel: number): Date | null {
  if (stage < 1 || stage >= COMPLETED_STAGE) return null;
  return roundUpToHour(new Date(from.getTime() + intervalMs(stage, userLevel)));
}

export function nextStageOnCorrect(stage: number): number {
  return Math.min(COMPLETED_STAGE, Math.max(1, stage) + 1);
}

export function nextStageOnWrong(stage: number, incorrectCount: number): {
  stage: number;
  incorrectCount: number;
} {
  const nextIncorrect = incorrectCount + 1;
  const penalty = stage >= UNLOCK_THRESHOLD ? 2 : 1;
  const drop = Math.ceil(nextIncorrect / 2) * penalty;
  return {
    stage: Math.max(1, stage - drop),
    incorrectCount: nextIncorrect,
  };
}

export function normalizeMeaning(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeReading(value: string): string {
  return value.trim().normalize("NFKC").replace(/\s+/g, "");
}

function readingKey(value: string): string {
  return normalizeReading(value)
    .replace(/[.\u30fb\u30fc-]/g, "")
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

const RARE_LONG_VOWELS: Array<[string, string]> = [
  ["おお", "おう"],
  ["こお", "こう"],
  ["そお", "そう"],
  ["とお", "とう"],
  ["のお", "のう"],
  ["ほお", "ほう"],
  ["もお", "もう"],
  ["よお", "よう"],
  ["ろお", "ろう"],
];

function usualLongVowel(value: string): string {
  let text = readingKey(value);
  for (const [rare, usual] of RARE_LONG_VOWELS) text = text.replaceAll(rare, usual);
  return text;
}

function hasRareLongVowel(value: string): boolean {
  const text = readingKey(value);
  return RARE_LONG_VOWELS.some(([rare]) => text.includes(rare));
}

export function promptsFor(objectType: string): Array<"meaning" | "reading"> {
  return objectType === "radical" ? ["meaning"] : ["meaning", "reading"];
}

function meaningTolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 7) return 2;
  return 2 + Math.floor(length / 7);
}

function editDistance(left: string, right: string): number {
  const cols = right.length + 1;
  const score = new Array<number>((left.length + 1) * cols);
  const at = (row: number, col: number) => row * cols + col;
  for (let row = 0; row <= left.length; row += 1) score[at(row, 0)] = row;
  for (let col = 0; col <= right.length; col += 1) score[at(0, col)] = col;
  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      const replace = score[at(row - 1, col - 1)] + (left[row - 1] === right[col - 1] ? 0 : 1);
      let best = Math.min(score[at(row - 1, col)] + 1, score[at(row, col - 1)] + 1, replace);
      if (
        row > 1 &&
        col > 1 &&
        left[row - 1] === right[col - 2] &&
        left[row - 2] === right[col - 1]
      ) {
        best = Math.min(best, score[at(row - 2, col - 2)] + 1);
      }
      score[at(row, col)] = best;
    }
  }
  return score[at(left.length, right.length)];
}

function closestMeaning(input: string, targets: string[]): number | null {
  if (/\d/.test(input)) return null;
  let best: number | null = null;
  for (const target of targets) {
    if (/\d/.test(target)) continue;
    const distance = editDistance(input, target);
    if (distance === 0 || distance > meaningTolerance(target.length)) continue;
    if (best === null || distance < best) best = distance;
  }
  return best;
}

export function matchMeaning(
  answer: string,
  meanings: MeaningLike[],
  auxiliary: AuxiliaryLike[] = [],
): { correct: boolean; lenient: boolean } {
  const input = normalizeMeaning(answer);
  if (!input) return { correct: false, lenient: false };
  const accepted = [
    ...meanings.filter((item) => item.acceptedAnswer).map((item) => normalizeMeaning(item.meaning)),
    ...auxiliary.filter((item) => item.type === "whitelist").map((item) => normalizeMeaning(item.meaning)),
  ].filter(Boolean);
  const blocked = auxiliary
    .filter((item) => item.type === "blacklist")
    .map((item) => normalizeMeaning(item.meaning))
    .filter(Boolean);
  if (accepted.includes(input)) return { correct: true, lenient: false };
  if (blocked.includes(input)) return { correct: false, lenient: false };
  const nearAccepted = closestMeaning(input, accepted);
  const nearBlocked = closestMeaning(input, blocked);
  if (nearAccepted !== null && (nearBlocked === null || nearAccepted < nearBlocked)) {
    return { correct: true, lenient: true };
  }
  return { correct: false, lenient: false };
}

const KANA = /[\u3040-\u30ff\u31f0-\u31ff]/;

function exactKanjiMeaning(answer: string, meanings: MeaningLike[]): boolean {
  const input = normalizeMeaning(answer);
  if (!input) return false;
  return meanings.some(
    (item) => item.acceptedAnswer && normalizeMeaning(item.meaning) === input,
  );
}

/** A radical name typed for a kanji, when that kanji does not teach the same meaning. */
export function isRadicalMeaningOnly(
  answer: string,
  meanings: MeaningLike[],
  componentMeanings: MeaningLike[],
): boolean {
  if (componentMeanings.length === 0) return false;
  if (exactKanjiMeaning(answer, meanings)) return false;
  return matchMeaning(answer, componentMeanings, []).correct;
}

export function checkPrompt(
  objectType: string,
  meanings: MeaningLike[],
  readings: ReadingLike[],
  prompt: "meaning" | "reading",
  answer: string,
  componentReadings: ReadingLike[] = [],
  auxiliaryMeanings: AuxiliaryLike[] = [],
  componentMeanings: MeaningLike[] = [],
): PromptCheck {
  const prompts = promptsFor(objectType);
  const acceptedMeanings = meanings.filter((item) => item.acceptedAnswer);
  const acceptedReadings = readings.filter((item) => item.acceptedAnswer);
  const flags = {
    multipleMeanings: acceptedMeanings.length > 1,
    multipleReadings: prompts.includes("reading") && acceptedReadings.length > 1,
    lenient: false,
    exception: null as PromptCheck["exception"],
  };
  if (!prompts.includes(prompt)) {
    return { ...flags, correct: false, shake: false, wantedType: null };
  }

  if (prompt === "meaning") {
    const text = answer.trim();
    if (
      objectType === "kanji" &&
      isRadicalMeaningOnly(text, meanings, componentMeanings)
    ) {
      return {
        ...flags,
        correct: false,
        shake: true,
        wantedType: null,
        lenient: false,
        exception: "radicalMeaning",
      };
    }
    const verdict = matchMeaning(text, meanings, auxiliaryMeanings);
    if (!verdict.correct && KANA.test(text)) {
      return { ...flags, correct: false, shake: true, wantedType: "meaning" };
    }
    return {
      ...flags,
      correct: verdict.correct,
      shake: false,
      wantedType: null,
      lenient: verdict.lenient,
    };
  }

  const input = normalizeReading(answer);
  const primary =
    readings.find((item) => item.primary) ??
    readings.find((item) => item.acceptedAnswer);
  const wantedType = primary?.type ?? null;
  if (/[a-zA-Z]/.test(input)) {
    return { ...flags, correct: false, shake: true, wantedType: "reading" };
  }
  const match = acceptedReadings.find(
    (item) => normalizeReading(item.reading) === input,
  );
  if (match && wantedType && match.type && match.type !== wantedType) {
    return { ...flags, correct: false, shake: true, wantedType };
  }
  const unusualSpelling =
    objectType === "vocabulary" &&
    match == null &&
    input.length > 0 &&
    acceptedReadings.some(
      (item) =>
        hasRareLongVowel(item.reading) &&
        usualLongVowel(item.reading) === usualLongVowel(answer) &&
        readingKey(item.reading) !== readingKey(answer),
    );
  if (unusualSpelling) {
    return { ...flags, correct: false, shake: true, wantedType: null, exception: "unusualSpelling" };
  }
  const keyed = readingKey(answer);
  const usedKanjiReading =
    objectType === "vocabulary" &&
    keyed.length > 0 &&
    match == null &&
    componentReadings.some((item) => readingKey(item.reading) === keyed);
  if (usedKanjiReading) {
    return { ...flags, correct: false, shake: true, wantedType: null, exception: "kanjiReading" };
  }
  return {
    ...flags,
    correct: match != null && input.length > 0,
    shake: false,
    wantedType,
  };
}

export function gradeAnswers(
  objectType: string,
  meanings: MeaningLike[],
  readings: ReadingLike[],
  meaning: string | undefined,
  reading: string | undefined,
  auxiliaryMeanings: AuxiliaryLike[] = [],
  componentMeanings: MeaningLike[] = [],
): GradeResult {
  const prompts = promptsFor(objectType);
  let meaningCorrect = prompts.includes("meaning")
    ? matchMeaning(meaning ?? "", meanings, auxiliaryMeanings).correct
    : null;
  if (
    meaningCorrect &&
    objectType === "kanji" &&
    isRadicalMeaningOnly(meaning ?? "", meanings, componentMeanings)
  ) {
    meaningCorrect = false;
  }

  let readingCorrect: boolean | null = null;
  let shake = false;
  let wantedType: string | null = null;
  if (prompts.includes("reading")) {
    const input = normalizeReading(reading ?? "");
    const primary = readings.find((item) => item.primary) ?? readings.find((item) => item.acceptedAnswer);
    wantedType = primary?.type ?? null;
    const match = readings.find(
      (item) => item.acceptedAnswer && normalizeReading(item.reading) === input,
    );
    if (match && wantedType && match.type && match.type !== wantedType) {
      shake = true;
      readingCorrect = false;
    } else {
      readingCorrect = match != null && input.length > 0;
    }
  }

  const passed =
    !shake &&
    (meaningCorrect !== false) &&
    (readingCorrect !== false) &&
    (meaningCorrect === true || readingCorrect === true);

  return { meaningCorrect, readingCorrect, wordCorrect: null, shake, wantedType, passed };
}

export type WordComponent = {
  objectType: string;
  characters: string | null;
};

export function compositionKanji(
  componentSubjectIds: number[],
  lookup: (id: number) => WordComponent | undefined,
): string[] {
  const kanji: string[] = [];
  for (const id of componentSubjectIds) {
    const part = lookup(id);
    if (part?.objectType === "kanji" && part.characters) kanji.push(part.characters);
  }
  return kanji;
}

export type WordPeer = {
  meanings: MeaningLike[];
  auxiliary: AuxiliaryLike[];
  kanji: string;
  characters: string | null;
};

function exactAcceptedMeaning(
  answer: string,
  meanings: MeaningLike[],
  auxiliary: AuxiliaryLike[],
): boolean {
  const input = normalizeMeaning(answer);
  if (!input) return false;
  const accepted = [
    ...meanings.filter((item) => item.acceptedAnswer).map((item) => normalizeMeaning(item.meaning)),
    ...auxiliary
      .filter((item) => item.type === "whitelist")
      .map((item) => normalizeMeaning(item.meaning)),
  ];
  return accepted.includes(input);
}

export function assessWordAnswer(input: {
  method: "meaning" | "kanji";
  answer: string;
  meanings: MeaningLike[];
  auxiliary: AuxiliaryLike[];
  kanji: string;
  characters: string | null;
  peers: WordPeer[];
}): { correct: boolean; homophone: boolean; lenient: boolean } {
  if (input.method === "kanji") {
    const drawn = input.answer.replace(/\s+/g, "");
    if (!drawn) return { correct: false, homophone: false, lenient: false };
    if (drawn === input.kanji) return { correct: true, homophone: false, lenient: false };
    const homophone = input.peers.some((peer) => {
      const spelling = peer.kanji.replace(/\s+/g, "");
      return spelling.length > 0 && spelling === drawn && spelling !== input.kanji;
    });
    return { correct: false, homophone, lenient: false };
  }

  const verdict = matchMeaning(input.answer, input.meanings, input.auxiliary);
  if (verdict.correct) return { correct: true, homophone: false, lenient: verdict.lenient };
  const homophone = input.peers.some((peer) => {
    const sameSpelling =
      (peer.characters ?? "") === (input.characters ?? "") && peer.kanji === input.kanji;
    if (sameSpelling) return false;
    return exactAcceptedMeaning(input.answer, peer.meanings, peer.auxiliary);
  });
  return { correct: false, homophone, lenient: false };
}

export function wordAnswerCorrect(
  answer: string | undefined,
  meanings: MeaningLike[],
  auxiliary: AuxiliaryLike[],
  kanji: string,
): boolean {
  const text = (answer ?? "").trim();
  if (!text || !kanji) return false;
  if (text.replace(/\s+/g, "") === kanji) return true;
  return matchMeaning(text, meanings, auxiliary).correct;
}

export function applyWordGrade(graded: GradeResult, wordCorrect: boolean | null): GradeResult {
  return {
    ...graded,
    wordCorrect,
    passed: graded.passed && wordCorrect !== false,
  };
}

export function kanjiNeededToPass(kanjiCount: number): number {
  return Math.ceil(kanjiCount * 0.9);
}
