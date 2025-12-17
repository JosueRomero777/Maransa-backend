/*
  Warnings:

  - Added the required column `type` to the `Provider` table without a default value. This is not possible if the table is not empty.
  - Made the column `location` on table `Provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `capacity` on table `Provider` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contact_whatsapp` on table `Provider` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('PEQUENA_CAMARONERA', 'MEDIANA_CAMARONERA', 'GRAN_CAMARONERA');

-- Update existing NULL values with default values before making columns required
UPDATE "Provider" SET "location" = 'No especificado' WHERE "location" IS NULL;
UPDATE "Provider" SET "capacity" = 1000 WHERE "capacity" IS NULL;
UPDATE "Provider" SET "contact_whatsapp" = '+51 000000000' WHERE "contact_whatsapp" IS NULL;

-- AlterTable - Drop old type column and add new enum type with default value
ALTER TABLE "Provider" DROP COLUMN "type";
ALTER TABLE "Provider" ADD COLUMN "type" "TipoProveedor" NOT NULL DEFAULT 'PEQUENA_CAMARONERA';

-- Make other columns required (they now have values)
ALTER TABLE "Provider" ALTER COLUMN "location" SET NOT NULL;
ALTER TABLE "Provider" ALTER COLUMN "capacity" SET NOT NULL;
ALTER TABLE "Provider" ALTER COLUMN "contact_whatsapp" SET NOT NULL;
