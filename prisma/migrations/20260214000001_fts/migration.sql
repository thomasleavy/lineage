-- Full-text search: garments.notes
ALTER TABLE "garments" ADD COLUMN IF NOT EXISTS "notes_fts" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(notes, ''))) STORED;
CREATE INDEX IF NOT EXISTS "garments_notes_fts_idx" ON "garments" USING GIN ("notes_fts");

-- Full-text search: garment_versions.change_detail
ALTER TABLE "garment_versions" ADD COLUMN IF NOT EXISTS "change_detail_fts" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(change_detail, ''))) STORED;
CREATE INDEX IF NOT EXISTS "garment_versions_change_detail_fts_idx" ON "garment_versions" USING GIN ("change_detail_fts");
