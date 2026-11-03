CREATE TABLE IF NOT EXISTS moji_mori_users (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS moji_mori_progress (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES moji_mori_subjects(id) ON DELETE CASCADE,
  srs_stage integer NOT NULL DEFAULT 0,
  unlocked_at timestamptz,
  started_at timestamptz,
  passed_at timestamptz,
  burned_at timestamptz,
  available_at timestamptz,
  incorrect_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subject_id)
);
