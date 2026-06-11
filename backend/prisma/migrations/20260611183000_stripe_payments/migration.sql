/*
  Warnings:

  - The values [wise] on the enum `PaymentMethod` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `wiseTransferId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `wiseEmail` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('manual', 'stripe');
ALTER TABLE "public"."Payment" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'manual';
COMMIT;

-- DropIndex
DROP INDEX "Payment_wiseTransferId_idx";

-- DropIndex
DROP INDEX "User_wiseEmail_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "wiseTransferId",
ADD COLUMN     "stripeTransferId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "wiseEmail",
ADD COLUMN     "stripeAccountId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_stripeTransferId_idx" ON "Payment"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
