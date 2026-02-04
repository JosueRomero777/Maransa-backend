/*
  Warnings:

  - You are about to drop the column `tallaEstimada` on the `orders` table. All the data in the column will be lost.
  - The `talla` column on the `price_estimations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `talla` column on the `price_history` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "orders" DROP COLUMN "tallaEstimada",
ADD COLUMN     "presentationTypeId" INTEGER,
ADD COLUMN     "shrimpSizeId" INTEGER;

-- AlterTable
ALTER TABLE "price_estimations" DROP COLUMN "talla",
ADD COLUMN     "talla" TEXT;

-- AlterTable
ALTER TABLE "price_history" DROP COLUMN "talla",
ADD COLUMN     "talla" TEXT;

-- DropEnum
DROP TYPE "TallaProducto";

-- CreateTable
CREATE TABLE "shrimp_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "scientific_name" TEXT NOT NULL,
    "production_percentage" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shrimp_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rendimiento" DOUBLE PRECISION NOT NULL,
    "life_span_days" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shrimp_sizes" (
    "id" SERIAL NOT NULL,
    "shrimp_type_id" INTEGER NOT NULL,
    "presentation_type_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "min_pieces_per_lb" INTEGER NOT NULL,
    "max_pieces_per_lb" INTEGER NOT NULL,
    "min_weight_grams" DOUBLE PRECISION NOT NULL,
    "max_weight_grams" DOUBLE PRECISION NOT NULL,
    "min_weight_oz" DOUBLE PRECISION NOT NULL,
    "max_weight_oz" DOUBLE PRECISION NOT NULL,
    "display_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shrimp_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presentation_types_code_key" ON "presentation_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shrimp_sizes_code_presentation_type_id_key" ON "shrimp_sizes"("code", "presentation_type_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_presentationTypeId_fkey" FOREIGN KEY ("presentationTypeId") REFERENCES "presentation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shrimpSizeId_fkey" FOREIGN KEY ("shrimpSizeId") REFERENCES "shrimp_sizes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_sizes" ADD CONSTRAINT "shrimp_sizes_shrimp_type_id_fkey" FOREIGN KEY ("shrimp_type_id") REFERENCES "shrimp_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shrimp_sizes" ADD CONSTRAINT "shrimp_sizes_presentation_type_id_fkey" FOREIGN KEY ("presentation_type_id") REFERENCES "presentation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
