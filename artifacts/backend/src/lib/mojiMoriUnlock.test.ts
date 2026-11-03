import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateUnlock,
  isAvailable,
  satisfiesUnlockRequirement,
  type UnlockSubject,
} from "./mojiMoriUnlock.ts";

const radical65: UnlockSubject = {
  id: 65,
  objectType: "radical",
  level: 2,
  componentSubjectIds: [],
};
const heart: UnlockSubject = {
  id: 508,
  objectType: "kanji",
  level: 3,
  componentSubjectIds: [65],
};
const radical182: UnlockSubject = {
  id: 182,
  objectType: "radical",
  level: 8,
  componentSubjectIds: [],
};
const radical228: UnlockSubject = {
  id: 228,
  objectType: "radical",
  level: 9,
  componentSubjectIds: [],
};
const distribute: UnlockSubject = {
  id: 742,
  objectType: "kanji",
  level: 10,
  componentSubjectIds: [182, 228],
};
const worry: UnlockSubject = {
  id: 3564,
  objectType: "vocabulary",
  level: 10,
  componentSubjectIds: [508, 742],
};

function catalogOf(subjects: UnlockSubject[]) {
  return new Map(subjects.map((subject) => [subject.id, subject]));
}

const fullCatalog = catalogOf([
  radical65,
  heart,
  radical182,
  radical228,
  distribute,
  worry,
]);

function stages(values: Record<number, number>) {
  return (id: number) => values[id] ?? 0;
}

describe("satisfiesUnlockRequirement", () => {
  it("uses Proficient 1 as the threshold", () => {
    assert.equal(satisfiesUnlockRequirement(4), false);
    assert.equal(satisfiesUnlockRequirement(5), true);
    assert.equal(satisfiesUnlockRequirement(9), true);
  });
});

describe("vocabulary 心配", () => {
  it("stays locked when one kanji is still below Proficient 1", () => {
    const eligible = evaluateUnlock(
      worry,
      10,
      fullCatalog,
      stages({ 508: 5, 742: 4 }),
    );
    assert.equal(eligible, false);
  });

  it("unlocks when both kanji are at Proficient 1 or higher", () => {
    assert.equal(
      evaluateUnlock(worry, 10, fullCatalog, stages({ 508: 7, 742: 5 })),
      true,
    );
    assert.equal(
      evaluateUnlock(worry, 10, fullCatalog, stages({ 508: 8, 742: 8 })),
      true,
    );
  });

  it("does not treat missing progress as satisfied", () => {
    assert.equal(
      evaluateUnlock(worry, 10, fullCatalog, stages({ 508: 8 })),
      false,
    );
  });

  it("does not treat a missing catalog subject as satisfied", () => {
    const partial = catalogOf([radical65, heart, worry]);
    assert.equal(
      evaluateUnlock(worry, 10, partial, stages({ 508: 8, 742: 8 })),
      false,
    );
  });

  it("does not unlock from level alone", () => {
    assert.equal(evaluateUnlock(worry, 10, fullCatalog, stages({})), false);
  });
});

describe("kanji 心", () => {
  it("requires the resolved radical, not a hardcoded type", () => {
    assert.equal(
      evaluateUnlock(heart, 3, fullCatalog, stages({ 65: 4 })),
      false,
    );
    assert.equal(
      evaluateUnlock(heart, 3, fullCatalog, stages({ 65: 5 })),
      true,
    );
  });

  it("ignores a component that resolves to a non-radical", () => {
    const notARadical: UnlockSubject = { ...radical65, objectType: "vocabulary" };
    const catalog = catalogOf([notARadical, heart]);
    assert.equal(evaluateUnlock(heart, 3, catalog, stages({ 65: 0 })), true);
  });

  it("blocks when the component id is absent from the catalog", () => {
    assert.equal(evaluateUnlock(heart, 3, catalogOf([heart]), stages({})), false);
  });
});

describe("kanji 配", () => {
  it("requires every resolved radical", () => {
    assert.equal(
      evaluateUnlock(distribute, 10, fullCatalog, stages({ 182: 5, 228: 4 })),
      false,
    );
    assert.equal(
      evaluateUnlock(distribute, 10, fullCatalog, stages({ 182: 5, 228: 6 })),
      true,
    );
  });

  it("does not assume component types from the ids", () => {
    const catalog = catalogOf([
      { ...radical182, objectType: "kanji" },
      radical228,
      distribute,
    ]);
    assert.equal(
      evaluateUnlock(distribute, 10, catalog, stages({ 228: 5 })),
      true,
    );
  });
});

describe("demotion", () => {
  it("keeps an unlocked vocabulary available after a kanji drops below Proficient 1", () => {
    const stageOf = stages({ 508: 4, 742: 5 });
    assert.equal(evaluateUnlock(worry, 10, fullCatalog, stageOf), false);
    assert.equal(isAvailable(worry, 10, fullCatalog, stageOf, true), true);
    assert.equal(isAvailable(worry, 10, fullCatalog, stageOf, false), false);
  });
});

describe("radicals", () => {
  it("follows the user level and does not wait for an SRS stage", () => {
    assert.equal(evaluateUnlock(radical65, 2, fullCatalog, stages({})), true);
    assert.equal(evaluateUnlock(radical65, 1, fullCatalog, stages({})), false);
  });
});
