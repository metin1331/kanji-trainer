import {
  pickCharacterImage,
  type MojiMoriSubjectSummary,
} from "../../lib/mojiMori";

export function SubjectCharacter({
  subject,
  className = "text-[32px] leading-none font-medium",
  imageClassName = "h-8 w-8 object-contain",
}: {
  subject: Pick<
    MojiMoriSubjectSummary,
    "characters" | "characterImages" | "primaryMeaning"
  >;
  className?: string;
  imageClassName?: string;
}) {
  if (subject.characters) {
    return <span className={className}>{subject.characters}</span>;
  }
  const src = pickCharacterImage(subject.characterImages);
  if (src) {
    return (
      <img
        src={src}
        alt={subject.primaryMeaning}
        className={imageClassName}
      />
    );
  }
  return <span className={className}>?</span>;
}
