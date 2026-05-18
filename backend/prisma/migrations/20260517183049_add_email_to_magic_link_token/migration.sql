/*
  Warnings:

  - Added the required column `email` to the `magic_link_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "magic_link_tokens" ADD COLUMN     "email" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;
