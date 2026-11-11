import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReviewQueue, dedupeOutbox, type ReviewOutboxItem } from "./reviewProgress.ts";

describe("buildReviewQueue", () => {
  const restored = [
    { subjectId: 1, prompt: "word", resumed: true },
    { subjectId: 2, prompt: "meaning", resumed: true },
  ];
  const due = [
    { subjectId: 2, prompt: "meaning" },
    { subjectId: 3, prompt: "reading" },
    { subjectId: 1, prompt: "word" },
  ];

  it("keeps restored tasks first and shuffles only the remaining tail", () => {
    const queue = buildReviewQueue({
      restored,
      due,
      openKeys: new Set(["1:meaning", "1:reading"]),
      shuffle: (items) => [...items].reverse(),
    });
    assert.deepEqual(
      queue.map((task) => task.subjectId),
      [1, 2, 3],
    );
    assert.equal(queue[0]?.resumed, true);
    assert.equal("resumed" in (queue[2] ?? {}), false);
  });

  it("does not restore a prompt that is already stored", () => {
    const queue = buildReviewQueue({
      restored,
      due,
      openKeys: new Set(["1:word"]),
      shuffle: (items) => items,
    });
    assert.deepEqual(
      queue.map((task) => `${task.subjectId}:${task.prompt}`),
      ["2:meaning", "3:reading"],
    );
  });
});

describe("dedupeOutbox", () => {
  it("keeps the first copy of an idempotency key", () => {
    const first: ReviewOutboxItem = {
      idempotencyKey: "a",
      subjectId: 1,
      prompt: "meaning",
      answer: "one",
      correct: true,
      expectedStage: 2,
    };
    const second = { ...first, answer: "later" };
    assert.deepEqual(dedupeOutbox([first, second, { ...first, idempotencyKey: "b" }]), [
      first,
      { ...first, idempotencyKey: "b" },
    ]);
  });
});
