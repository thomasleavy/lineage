-- Add updated_at to looks (backfill existing rows with created_at)
ALTER TABLE "looks" ADD COLUMN "updated_at" TIMESTAMP(3);
UPDATE "looks" SET "updated_at" = "created_at";
ALTER TABLE "looks" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "looks" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
