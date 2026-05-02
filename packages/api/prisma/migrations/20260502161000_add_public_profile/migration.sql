-- AlterTable
ALTER TABLE "users" ADD COLUMN     "publicProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicShowRepos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicShowStreak" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
