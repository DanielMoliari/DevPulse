-- AlterTable
ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "pushedAt" TIMESTAMP(3);
