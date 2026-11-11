import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nextReviewQueue,
  rememberLapse,
  shuffleLapses,
  type LapseTask,
} from "./lapsesQueue.ts";

const word = (subjectId: number, prompt: LapseTask["prompt"]): LapseTask => ({
  subjectId,
  prompt,
});

describe("rememberLapse", () => {
  it("keeps only the missed prompt on a card", () => {
    const seen = new Set<string>();
    const items: LapseTask[] = [];
    assert.equal(rememberLapse(seen, items, word(7, "word"), false), true);
    assert.deepEqual(items, [word(7, "word")]);
  });

  it("does not record a prompt twice", () => {
    const seen = new Set<string>();
    const items: LapseTask[] = [];
    rememberLapse(seen, items, word(7, "word"), false);
    assert.equal(rememberLapse(seen, items, word(7, "word"), false), false);
    assert.equal(items.length, 1);
  });

  it("ignores answers given during lapses", () => {
    const seen = new Set<string>();
    const items: LapseTask[] = [];
    assert.equal(rememberLapse(seen, items, word(7, "meaning"), true), false);
    assert.deepEqual(items, []);
  });
});

describe("nextReviewQueue", () => {
  const tasks = [word(1, "meaning"), word(1, "reading"), word(2, "word")];

  it("continues the review when questions remain", () => {
    const result = nextReviewQueue({
      tasks,
      requeueMiss: false,
      inLapses: false,
      parked: [],
      lapses: [word(9, "meaning")],
    });
    assert.equal(result.enterLapses, false);
    assert.deepEqual(result.tasks, tasks.slice(1));
  });

  it("requeues a normal miss instead of starting lapses", () => {
    const parked = [word(1, "reading"), word(2, "word"), word(1, "meaning")];
    const result = nextReviewQueue({
      tasks,
      requeueMiss: true,
      inLapses: false,
      parked,
      lapses: [word(1, "meaning")],
    });
    assert.equal(result.enterLapses, false);
    assert.deepEqual(result.tasks, parked);
  });

  it("starts shuffled lapses after the last review question", () => {
    const lapses = [word(4, "reading"), word(8, "word")];
    const result = nextReviewQueue({
      tasks: [word(3, "meaning")],
      requeueMiss: false,
      inLapses: false,
      parked: [],
      lapses,
    });
    assert.equal(result.enterLapses, true);
    assert.deepEqual(result.tasks, lapses);
  });

  it("finishes immediately when nothing was missed", () => {
    const result = nextReviewQueue({
      tasks: [word(3, "meaning")],
      requeueMiss: false,
      inLapses: false,
      parked: [],
      lapses: [],
    });
    assert.equal(result.enterLapses, false);
    assert.deepEqual(result.tasks, []);
  });

  it("does not enqueue another lapses round", () => {
    const result = nextReviewQueue({
      tasks: [word(4, "reading")],
      requeueMiss: true,
      inLapses: true,
      parked: [word(4, "reading")],
      lapses: [word(4, "reading")],
    });
    assert.equal(result.enterLapses, false);
    assert.deepEqual(result.tasks, []);
  });
});

describe("shuffleLapses", () => {
  it("reorders with the supplied random source", () => {
    const items = [word(1, "meaning"), word(2, "reading"), word(3, "word")];
    const values = [0.9, 0];
    const shuffled = shuffleLapses(items, () => values.shift() ?? 0);
    assert.deepEqual(shuffled.map((item) => item.subjectId), [2, 1, 3]);
    assert.deepEqual(items.map((item) => item.subjectId), [1, 2, 3]);
  });
});
