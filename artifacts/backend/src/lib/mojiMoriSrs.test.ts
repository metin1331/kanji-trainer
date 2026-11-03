import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  availableAfter,
  checkPrompt,
  gradeAnswers,
  intervalMs,
  kanjiNeededToPass,
  nextStageOnWrong,
  roundUpToHour,
} from "./mojiMoriSrs.ts";

const HOUR = 60 * 60 * 1000;

describe("intervals", () => {
  it("uses one schedule for every level", () => {
    assert.equal(intervalMs(1, 1), 2 * HOUR);
    assert.equal(intervalMs(1, 3), 2 * HOUR);
    assert.equal(intervalMs(3, 1), 11.5 * HOUR);
    assert.equal(intervalMs(4, 1), 23.5 * HOUR);
    assert.equal(intervalMs(5, 1), 84 * HOUR);
    assert.equal(intervalMs(6, 1), 82 * HOUR);
    assert.equal(intervalMs(12, 1), 2880 * HOUR);
    assert.equal(intervalMs(13, 1), 0);
  });

  it("rounds availability up to the next hour", () => {
    const from = new Date(2026, 0, 2, 14, 10, 0, 0);
    const next = availableAfter(from, 1, 5);
    assert.equal(next?.getHours(), 17);
    assert.equal(next?.getMinutes(), 0);
    assert.equal(availableAfter(from, 13, 5), null);
  });

  it("leaves an exact hour in place", () => {
    const exact = new Date(2026, 0, 2, 14, 0, 0, 0);
    assert.equal(roundUpToHour(exact).getTime(), exact.getTime());
  });
});

describe("wrong answers", () => {
  it("drops one stage below Proficient and two at Proficient", () => {
    assert.deepEqual(nextStageOnWrong(3, 0), { stage: 2, incorrectCount: 1 });
    assert.deepEqual(nextStageOnWrong(6, 0), { stage: 4, incorrectCount: 1 });
  });

  it("does not fall below stage 1", () => {
    assert.equal(nextStageOnWrong(1, 4).stage, 1);
  });
});

describe("grading", () => {
  const meanings = [{ meaning: "Ground", acceptedAnswer: true }];
  const readings = [
    { reading: "こう", primary: true, acceptedAnswer: true, type: "onyomi" },
    { reading: "く", primary: false, acceptedAnswer: true, type: "kunyomi" },
  ];

  it("accepts the taught reading and shakes on the other type", () => {
    const ok = gradeAnswers("kanji", meanings, readings, "ground", "こう");
    assert.equal(ok.passed, true);
    const shake = gradeAnswers("kanji", meanings, readings, "ground", "く");
    assert.equal(shake.shake, true);
    assert.equal(shake.passed, false);
    assert.equal(shake.wantedType, "onyomi");
  });

  it("asks radicals for the name only", () => {
    const graded = gradeAnswers("radical", meanings, [], "Ground", undefined);
    assert.equal(graded.passed, true);
    assert.equal(graded.readingCorrect, null);
  });
});

describe("one prompt at a time", () => {
  const meanings = [
    { meaning: "Years Old", acceptedAnswer: true },
    { meaning: "Age", acceptedAnswer: true },
  ];
  const readings = [{ reading: "さい", primary: true, acceptedAnswer: true }];

  it("accepts one meaning and flags the other", () => {
    const checked = checkPrompt("vocabulary", meanings, readings, "meaning", "age");
    assert.equal(checked.correct, true);
    assert.equal(checked.shake, false);
    assert.equal(checked.multipleMeanings, true);
  });

  it("shakes when kana is entered for a meaning", () => {
    const checked = checkPrompt("vocabulary", meanings, readings, "meaning", "さい");
    assert.equal(checked.shake, true);
    assert.equal(checked.correct, false);
    assert.equal(checked.wantedType, "meaning");
  });

  it("shakes when latin is entered for a reading", () => {
    const checked = checkPrompt("vocabulary", meanings, readings, "reading", "years");
    assert.equal(checked.shake, true);
    assert.equal(checked.wantedType, "reading");
  });

  it("accepts the vocabulary reading", () => {
    const checked = checkPrompt("vocabulary", meanings, readings, "reading", "さい");
    assert.equal(checked.correct, true);
    assert.equal(checked.multipleReadings, false);
  });

  it("shakes when the kanji reading is entered for a vocabulary", () => {
    const sun = [{ meaning: "Sun", acceptedAnswer: true }];
    const vocab = [{ reading: "ひ", primary: true, acceptedAnswer: true }];
    const kanji = [{ reading: "ニチ", primary: true, acceptedAnswer: true, type: "onyomi" }];
    const shake = checkPrompt("vocabulary", sun, vocab, "reading", "にち", kanji);
    assert.equal(shake.shake, true);
    assert.equal(shake.correct, false);
    assert.equal(shake.exception, "kanjiReading");
    const ok = checkPrompt("vocabulary", sun, vocab, "reading", "ひ", kanji);
    assert.equal(ok.correct, true);
    assert.equal(ok.exception, null);
  });

  it("accepts a near whitelist meaning and warns that it was a bit off", () => {
    const meanings = [{ meaning: "Genius", acceptedAnswer: true }];
    const auxiliary = [
      { meaning: "Prodigy", type: "whitelist" },
      { meaning: "Talented", type: "whitelist" },
    ];
    const readings = [{ reading: "てんさい", primary: true, acceptedAnswer: true }];
    const near = checkPrompt("vocabulary", meanings, readings, "meaning", "Talent", [], auxiliary);
    assert.equal(near.correct, true);
    assert.equal(near.lenient, true);
    assert.equal(near.shake, false);
    const exact = checkPrompt("vocabulary", meanings, readings, "meaning", "talented", [], auxiliary);
    assert.equal(exact.correct, true);
    assert.equal(exact.lenient, false);
    const graded = gradeAnswers("vocabulary", meanings, readings, "Talent", "てんさい", auxiliary);
    assert.equal(graded.passed, true);
    const miss = checkPrompt("vocabulary", meanings, readings, "meaning", "banana", [], auxiliary);
    assert.equal(miss.correct, false);
    assert.equal(miss.lenient, false);
  });

  it("rejects a blacklisted meaning even when it is close to an accepted one", () => {
    const meanings = [{ meaning: "Genius", acceptedAnswer: true }];
    const auxiliary = [{ meaning: "Gene", type: "blacklist" }];
    const blocked = checkPrompt("vocabulary", meanings, [], "meaning", "gene", [], auxiliary);
    assert.equal(blocked.correct, false);
    const slip = checkPrompt("vocabulary", meanings, [], "meaning", "geni", [], auxiliary);
    assert.equal(slip.correct, false);
  });

  it("shakes when a rare long vowel is spelled the usual way", () => {
    const days = [{ meaning: "Ten Days", acceptedAnswer: true }];
    const reading = [{ reading: "とおか", primary: true, acceptedAnswer: true }];
    const unusual = checkPrompt("vocabulary", days, reading, "reading", "とうか");
    assert.equal(unusual.shake, true);
    assert.equal(unusual.correct, false);
    assert.equal(unusual.exception, "unusualSpelling");
    const exact = checkPrompt("vocabulary", days, reading, "reading", "とおか");
    assert.equal(exact.correct, true);
    assert.equal(exact.exception, null);
  });
});

describe("level threshold", () => {
  it("rounds 90 percent up", () => {
    assert.equal(kanjiNeededToPass(18), 17);
    assert.equal(kanjiNeededToPass(45), 41);
  });
});
