CREATE INDEX IF NOT EXISTS moji_mori_reviews_user_kind_created_idx
  ON moji_mori_reviews (user_id, kind, created_at);
