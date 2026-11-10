import {
  applyWordGrade,
  assessWordAnswer,
  checkPrompt,
  gradeAnswers,
  nextStageOnCorrect,
  nextStageOnWrong,
  wordAnswerCorrect,
  type PromptCheck,
} from "@moji-grade";
import type { MojiMoriStudyCard } from "./mojiMori";
import type { StudyGrade } from "../hooks/useMojiMori";

export type LocalCheck = PromptCheck & { homophone: boolean };

const blank: LocalCheck = {
  correct: false,
  shake: false,
  wantedType: null,
  multipleMeanings: false,
  multipleReadings: false,
  lenient: false,
  exception: null,
  homophone: false,
};

export function checkStudyCard(
  card: MojiMoriStudyCard,
  prompt: "meaning" | "reading" | "word",
  answer: string,
  method: "meaning" | "kanji" = "meaning",
): LocalCheck {
  const key = card.gradeKey;
  if (!key) return blank;
  if (prompt === "word") {
    const kanji = key.wordKanji.join("");
    if (!kanji) return blank;
    const verdict = assessWordAnswer({
      method,
      answer,
      meanings: key.meanings,
      auxiliary: key.auxiliaryMeanings,
      kanji,
      characters: key.characters,
      peers: key.peers,
    });
    return {
      ...blank,
      correct: verdict.correct,
      homophone: verdict.homophone && !verdict.correct,
      lenient: verdict.lenient,
    };
  }
  return {
    ...checkPrompt(
      card.objectType,
      key.meanings,
      key.readings,
      prompt,
      answer,
      key.componentReadings,
      key.auxiliaryMeanings,
      key.componentMeanings ?? [],
    ),
    homophone: false,
  };
}

export function predictReviewGrade(
  card: MojiMoriStudyCard,
  answers: { meaning?: string; reading?: string; word?: string },
): StudyGrade | null {
  const key = card.gradeKey;
  if (!key) return null;
  const graded = gradeAnswers(
    card.objectType,
    key.meanings,
    key.readings,
    answers.meaning,
    answers.reading,
    key.auxiliaryMeanings,
    key.componentMeanings ?? [],
  );
  const wordNeeded = card.prompts.includes("word");
  const scored = applyWordGrade(
    graded,
    wordNeeded
      ? wordAnswerCorrect(answers.word, key.meanings, key.auxiliaryMeanings, key.wordKanji.join(""))
      : null,
  );
  if (scored.shake) return null;
  const from = Math.max(1, card.srsStage ?? 1);
  const stage = scored.passed
    ? nextStageOnCorrect(from)
    : nextStageOnWrong(from, key.incorrectCount).stage;
  return {
    meaningCorrect: scored.meaningCorrect,
    readingCorrect: scored.readingCorrect,
    shake: scored.shake,
    wantedType: scored.wantedType,
    passed: scored.passed,
    srsStage: stage,
    level: card.level,
    leveledUp: false,
  };
}
