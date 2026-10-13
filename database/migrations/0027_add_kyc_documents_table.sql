CREATE TABLE IF NOT EXISTS `kyc_documents` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `filename` TEXT NOT NULL,
  `user_id` TEXT NOT NULL,
  `side` TEXT,
  `mime_type` TEXT NOT NULL,
  `file_size` INTEGER NOT NULL,
  `chunk_index` INTEGER NOT NULL DEFAULT 0,
  `total_chunks` INTEGER NOT NULL DEFAULT 1,
  `data` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_kyc_documents_filename` ON `kyc_documents` (`filename`, `chunk_index`);
