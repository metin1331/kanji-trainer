CREATE TABLE IF NOT EXISTS pinned_words (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  word_id integer NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, word_id)
);
