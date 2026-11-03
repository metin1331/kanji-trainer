import type { MojiMoriPronunciationAudio } from "../../lib/mojiMori";

export type AudioTrack = {
  name: string;
  description: string;
  url: string;
  pronunciation: string;
  gender: string;
};

export function audioTracks(audios: MojiMoriPronunciationAudio[] | undefined): AudioTrack[] {
  const groups = new Map<string, AudioTrack>();
  for (const audio of audios ?? []) {
    const name = String(audio.metadata.voice_actor_name ?? audio.metadata.voiceActorName ?? "");
    const voice = String(audio.metadata.voice_description ?? audio.metadata.voiceDescription ?? "");
    const gender = String(audio.metadata.gender ?? "");
    const description = [voice, gender].filter(Boolean).join(", ");
    const pronunciation = String(audio.metadata.pronunciation ?? "");
    const key = `${pronunciation}:${name || audio.url}`;
    const current = groups.get(key);
    if (!current || audio.contentType === "audio/mpeg") {
      groups.set(key, {
        name: name || "Audio",
        description,
        url: audio.url,
        pronunciation,
        gender,
      });
    }
  }
  return [...groups.values()];
}

export function pickVoice(tracks: AudioTrack[], preference: string): AudioTrack | undefined {
  const female = tracks.filter((track) => track.gender === "female");
  const male = tracks.filter((track) => track.gender === "male");
  let pool = tracks;
  if (preference === "female_only") pool = female;
  else if (preference === "male_only") pool = male;
  else if (preference === "female_preferred") pool = female.length > 0 ? female : tracks;
  else if (preference === "male_preferred") pool = male.length > 0 ? male : tracks;
  if (pool.length === 0) return undefined;
  if (preference === "random") return pool[Math.floor(Math.random() * pool.length)]!;
  return pool[0];
}
