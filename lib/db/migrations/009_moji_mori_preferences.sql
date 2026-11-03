ALTER TABLE moji_mori_users
  ADD COLUMN IF NOT EXISTS show_srs_indicator boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_voice text NOT NULL DEFAULT 'random',
  ADD COLUMN IF NOT EXISTS lessons_autoplay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviews_autoplay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_study_autoplay boolean NOT NULL DEFAULT false;
