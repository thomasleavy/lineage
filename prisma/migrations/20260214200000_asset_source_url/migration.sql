-- Add optional demo/stock image fields to assets
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "source_url" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "source_credit" TEXT;
