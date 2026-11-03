ALTER TABLE moji_mori_subjects
  ADD COLUMN IF NOT EXISTS mnemonic_image_url text,
  ADD COLUMN IF NOT EXISTS mnemonic_image_alt text;
