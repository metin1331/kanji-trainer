import type { ReactNode } from "react";
import { MOJI_MORI_TYPE_COLORS } from "../../lib/mojiMori";

const TAG_COLORS: Record<string, string> = {
  radical: MOJI_MORI_TYPE_COLORS.radical,
  kanji: MOJI_MORI_TYPE_COLORS.kanji,
  vocabulary: MOJI_MORI_TYPE_COLORS.vocabulary,
  reading: "var(--color-coral)",
};

function inlineParts(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /<(radical|kanji|vocabulary|reading|ja)>(.*?)<\/\1>/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const tag = match[1]!.toLowerCase();
    parts.push(
      tag === "ja" ? (
        <span key={key++} lang="ja">
          {match[2]}
        </span>
      ) : (
        <span key={key++} className="mm-mnemonic__tag" style={{ backgroundColor: TAG_COLORS[tag] ?? "#333" }}>
          {match[2]}
        </span>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MnemonicText({ text }: { text: string }) {
  if (!text) return null;
  const blocks = text
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <div className="mm-mnemonic">
      {blocks.map((block, index) => (
        <p key={index}>{inlineParts(block)}</p>
      ))}
    </div>
  );
}
