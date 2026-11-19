CREATE TABLE IF NOT EXISTS moji_mori_review_undo (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES moji_mori_subjects(id) ON DELETE CASCADE,
  srs_stage integer NOT NULL,
  available_at timestamptz,
  incorrect_count integer NOT NULL,
  passed_at timestamptz,
  burned_at timestamptz,
  meaning_correct integer NOT NULL,
  meaning_incorrect integer NOT NULL,
  meaning_current_streak integer NOT NULL,
  meaning_max_streak integer NOT NULL,
  reading_correct integer NOT NULL,
  reading_incorrect integer NOT NULL,
  reading_current_streak integer NOT NULL,
  reading_max_streak integer NOT NULL,
  graded_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, subject_id)
);
