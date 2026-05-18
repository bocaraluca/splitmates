-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogActionType" ADD VALUE 'DASHBOARD_GET_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'EVENTS_STREAM_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GENERATOR_START_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GENERATOR_STATUS_GET_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GENERATOR_STOP_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GROUP_EXPENSES_GET_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GROUP_EXPENSES_DETAIL_GET_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GROUP_PAYMENTS_GET_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'GROUP_STATS_GET_UNAUTHORIZED';
ALTER TYPE "LogActionType" ADD VALUE 'AUTH_FORGOT_PASSWORD';
ALTER TYPE "LogActionType" ADD VALUE 'AUTH_FORGOT_PASSWORD_FAILED';
ALTER TYPE "LogActionType" ADD VALUE 'AUTH_RESET_PASSWORD';
ALTER TYPE "LogActionType" ADD VALUE 'AUTH_RESET_PASSWORD_FAILED';
ALTER TYPE "LogActionType" ADD VALUE 'AUTH_RESET_PASSWORD_INVALID_TOKEN';

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
