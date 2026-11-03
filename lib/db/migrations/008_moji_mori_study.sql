ALTER TABLE moji_mori_users
  ADD COLUMN IF NOT EXISTS lesson_batch_size integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS daily_lesson_cap integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS interleave_lessons boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS review_order text NOT NULL DEFAULT 'shuffled';

ALTER TABLE moji_mori_progress
  ADD COLUMN IF NOT EXISTS meaning_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reading_note text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS moji_mori_reviews (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES moji_mori_subjects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  prompt text NOT NULL,
  correct boolean NOT NULL,
  from_stage integer NOT NULL DEFAULT 0,
  to_stage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moji_mori_reviews_user_created_idx
  ON moji_mori_reviews (user_id, created_at);
CREATE INDEX IF NOT EXISTS moji_mori_reviews_user_subject_idx
  ON moji_mori_reviews (user_id, subject_id);
