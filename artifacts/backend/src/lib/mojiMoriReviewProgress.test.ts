import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptOutcome,
  completionDecision,
  reconcileCheckpointTasks,
  requiredReviewPrompts,
} from "./mojiMoriReviewProgress.ts";

describe("requiredReviewPrompts", () => {
  it("uses the subject type", () => {
    assert.deepEqual(requiredReviewPrompts("radical", false), ["meaning"]);
    assert.deepEqual(requiredReviewPrompts("kanji", false), ["meaning", "reading"]);
    assert.deepEqual(requiredReviewPrompts("vocabulary", false), ["meaning", "reading"]);
    assert.deepEqual(requiredReviewPrompts("vocabulary", true), ["meaning", "reading", "word"]);
  });
});

describe("completionDecision", () => {
  const required = ["meaning", "reading", "word"];

  it("does not stage until drawing is stored", () => {
    assert.equal(
      completionDecision({
        storedPrompts: ["meaning", "reading"],
        required,
        stage: 2,
        expectedStage: 2,
      }),
      "wait",
    );
  });

  it("stages once when every required prompt is stored", () => {
    assert.equal(
      completionDecision({
        storedPrompts: ["meaning", "reading", "word"],
        required,
        stage: 2,
        expectedStage: 2,
      }),
      "grade",
    );
  });

  it("does not stage when the subject already moved", () => {
    assert.equal(
      completionDecision({
        storedPrompts: ["meaning", "reading", "word"],
        required,
        stage: 3,
        expectedStage: 2,
      }),
      "stale",
    );
  });

  it("does not stage a repeated idempotency key", () => {
    assert.equal(acceptOutcome({ receiptInserted: false, decision: "grade" }), "duplicate");
    assert.equal(acceptOutcome({ receiptInserted: true, decision: "wait" }), "wait");
    assert.equal(acceptOutcome({ receiptInserted: true, decision: "grade" }), "grade");
  });

  it("stages a radical from its meaning alone", () => {
    assert.equal(
      completionDecision({
        storedPrompts: ["meaning"],
        required: ["meaning"],
        stage: 1,
        expectedStage: 1,
      }),
      "grade",
    );
  });
});

describe("reconcileCheckpointTasks", () => {
  const tasks = [
    { subjectId: 1, prompt: "meaning" as const, expectedStage: 2 },
    { subjectId: 1, prompt: "reading" as const, expectedStage: 2 },
    { subjectId: 1, prompt: "word" as const, expectedStage: 2 },
  ];

  it("drops prompts that were already stored and keeps drawing", () => {
    const kept = reconcileCheckpointTasks(tasks, {
      openKeys: new Set(["1:meaning", "1:reading"]),
      stageOf: () => 2,
      due: () => true,
      hasOpenSubject: () => true,
    });
    assert.deepEqual(kept.map((task) => task.prompt), ["word"]);
  });

  it("drops a subject that is no longer due and has no open prompts", () => {
    const kept = reconcileCheckpointTasks(tasks, {
      openKeys: new Set(),
      stageOf: () => 2,
      due: () => false,
      hasOpenSubject: () => false,
    });
    assert.deepEqual(kept, []);
  });

  it("drops a subject whose stage no longer matches", () => {
    const kept = reconcileCheckpointTasks(tasks, {
      openKeys: new Set(),
      stageOf: () => 4,
      due: () => true,
      hasOpenSubject: () => false,
    });
    assert.deepEqual(kept, []);
  });
});
