import * as wanakana from "wanakana";
import type { HiddenScript } from "../types";
import { ROMAJI_COMPLETIONS } from "./romajiCompletions";

const VALID_ROMAJI = new Set<string>();
for (const word of ROMAJI_COMPLETIONS) {
  for (let i = 1; i <= word.length; i++) VALID_ROMAJI.add(word.slice(0, i));
}

/** True when every Latin run can still become kana. */
export function readingInputAllows(value: string): boolean {
  const runs = value.match(/[A-Za-z]+/g);
  if (!runs) return true;
  return runs.every((run) => VALID_ROMAJI.has(run.toLowerCase()));
}

/** Reading answers have to be kana. A leftover Latin letter is not an answer. */
export function readingAnswerIncomplete(value: string): boolean {
  return /[A-Za-z]/.test(romajiToKanaInput(value.trim()));
}

/** Block a Latin key that would leave a fragment that cannot become kana. */
export function blocksReadingLatin(
  value: string,
  key: string,
  start: number,
  end: number,
): boolean {
  if (key.length !== 1 || !/[A-Za-z]/.test(key)) return false;
  const next = value.slice(0, start) + key + value.slice(end);
  return !readingInputAllows(romajiToKanaInput(next));
}

/** Replace contiguous Latin runs with kana (fixes mixed し+ppai cases). */
export function romajiToKanaInput(
  raw: string,
  script: HiddenScript = "kanji",
): string {
  if (!raw) return raw;

  const kanaScript: "hiragana" | "katakana" =
    script === "katakana" ? "katakana" : "hiragana";

  return raw.replace(/[a-zA-Z]+/g, (latin) => {
    if (kanaScript === "katakana") {
      return wanakana.toKatakana(latin, { IMEMode: true });
    }
    return wanakana.toHiragana(latin, { IMEMode: true });
  });
}

export function kanaVariants(
  text: string,
  script?: HiddenScript,
): string[] {
  const n = text.trim().normalize("NFC");
  if (!n) return [];
  const out = new Set<string>([n]);

  if (/[a-zA-Z]/.test(n)) {
    if (script === "katakana") {
      out.add(romajiToKanaInput(n, "katakana").normalize("NFC"));
    } else if (script === "hiragana") {
      out.add(romajiToKanaInput(n, "hiragana").normalize("NFC"));
    } else {
      out.add(romajiToKanaInput(n, "hiragana").normalize("NFC"));
      out.add(romajiToKanaInput(n, "katakana").normalize("NFC"));
    }
  }
  return [...out];
}

export function effectiveHiddenScript(
  script?: HiddenScript,
  classes?: { hiragana?: boolean; katakana?: boolean },
): HiddenScript {
  if (classes?.katakana) return "katakana";
  if (classes?.hiragana) return "hiragana";
  return script ?? "kanji";
}
