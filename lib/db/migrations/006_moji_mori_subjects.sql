-- Shared MojiMori catalog. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS moji_mori_subjects (
  id integer PRIMARY KEY,
  object_type text NOT NULL,
  level integer NOT NULL,
  slug text NOT NULL,
  characters text,
  hidden_at timestamptz,
  meanings jsonb NOT NULL DEFAULT '[]'::jsonb,
  auxiliary_meanings jsonb NOT NULL DEFAULT '[]'::jsonb,
  readings jsonb NOT NULL DEFAULT '[]'::jsonb,
  parts_of_speech text[] NOT NULL DEFAULT '{}',
  component_subject_ids integer[] NOT NULL DEFAULT '{}',
  amalgamation_subject_ids integer[] NOT NULL DEFAULT '{}',
  visually_similar_subject_ids integer[] NOT NULL DEFAULT '{}',
  meaning_mnemonic text NOT NULL DEFAULT '',
  meaning_hint text NOT NULL DEFAULT '',
  reading_mnemonic text NOT NULL DEFAULT '',
  reading_hint text NOT NULL DEFAULT '',
  context_sentences jsonb NOT NULL DEFAULT '[]'::jsonb,
  character_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  pronunciation_audios jsonb NOT NULL DEFAULT '[]'::jsonb,
  lesson_position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moji_mori_subjects_type_level_idx
  ON moji_mori_subjects (object_type, level);

CREATE INDEX IF NOT EXISTS moji_mori_subjects_characters_idx
  ON moji_mori_subjects (characters);
