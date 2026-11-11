CREATE TABLE IF NOT EXISTS moji_mori_prompt_receipts (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  subject_id integer NOT NULL REFERENCES moji_mori_subjects(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  answer text NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS moji_mori_open_prompts (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id integer NOT NULL REFERENCES moji_mori_subjects(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  answer text NOT NULL,
  correct boolean NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_id, prompt)
);

CREATE TABLE IF NOT EXISTS moji_mori_review_checkpoints (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tasks jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
