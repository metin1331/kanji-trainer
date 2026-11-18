CREATE TABLE IF NOT EXISTS moji_mori_bookmarks (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES moji_mori_subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS moji_mori_bookmarks_user_created_idx
  ON moji_mori_bookmarks (user_id, created_at);
