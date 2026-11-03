export const SRS_STAGE_NAMES = [
  "Novice 1",
  "Novice 2",
  "Apprentice 1",
  "Apprentice 2",
  "Proficient 1",
  "Proficient 2",
  "Adept 1",
  "Adept 2",
  "Veteran",
  "Expert",
  "Master",
  "Grandmaster",
  "Legendary",
] as const;

/** Reaching Proficient 1 unlocks dependents and counts toward the next level. */
export const UNLOCK_THRESHOLD = 5;
/** Legendary has no further review. */
export const COMPLETED_STAGE = 13;

export type UnlockSubject = {
  id: number;
  objectType: string;
  level: number;
  componentSubjectIds: number[];
};

export function satisfiesUnlockRequirement(srsStage: number): boolean {
  return srsStage >= UNLOCK_THRESHOLD;
}

/**
 * A subject is eligible when its curriculum level is open and its typed
 * prerequisites are at Proficient 1 or higher. Missing catalog rows do not count
 * as satisfied. Level alone never skips a prerequisite.
 */
export function evaluateUnlock(
  subject: UnlockSubject,
  userLevel: number,
  catalog: ReadonlyMap<number, UnlockSubject>,
  stageOf: (subjectId: number) => number,
): boolean {
  if (subject.level > userLevel) return false;
  if (subject.objectType === "radical") return true;
  if (subject.objectType === "kanji") {
    return prerequisitesMet(subject, "radical", catalog, stageOf);
  }
  if (subject.objectType === "vocabulary") {
    return prerequisitesMet(subject, "kanji", catalog, stageOf);
  }
  return false;
}

function prerequisitesMet(
  subject: UnlockSubject,
  requiredType: string,
  catalog: ReadonlyMap<number, UnlockSubject>,
  stageOf: (subjectId: number) => number,
): boolean {
  for (const id of subject.componentSubjectIds) {
    const component = catalog.get(id);
    if (!component) return false;
    if (component.objectType !== requiredType) continue;
    if (!satisfiesUnlockRequirement(stageOf(id))) return false;
  }
  return true;
}

/** Previously unlocked items stay available after a prerequisite is demoted. */
export function isAvailable(
  subject: UnlockSubject,
  userLevel: number,
  catalog: ReadonlyMap<number, UnlockSubject>,
  stageOf: (subjectId: number) => number,
  previouslyUnlocked: boolean,
): boolean {
  return (
    previouslyUnlocked || evaluateUnlock(subject, userLevel, catalog, stageOf)
  );
}
