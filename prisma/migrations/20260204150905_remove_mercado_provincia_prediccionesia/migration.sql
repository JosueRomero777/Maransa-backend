/*
  Warnings:

  - You are about to drop the column `mercadoDestino` on the `PrediccionesIA` table. All the data in the column will be lost.
  - You are about to drop the column `provincia` on the `PrediccionesIA` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tipoProducto,calibre,fechaPrediccion]` on the table `PrediccionesIA` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PrediccionesIA_tipoProducto_calibre_mercadoDestino_provinci_key";

-- AlterTable
ALTER TABLE "PrediccionesIA" DROP COLUMN "mercadoDestino",
DROP COLUMN "provincia",
ALTER COLUMN "calibre" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "PrediccionesIA_tipoProducto_calibre_fechaPrediccion_key" ON "PrediccionesIA"("tipoProducto", "calibre", "fechaPrediccion");
