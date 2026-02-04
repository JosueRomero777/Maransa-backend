/*
  Warnings:

  - A unique constraint covering the columns `[tipoProducto,calibre,mercadoDestino,provincia,fechaPrediccion]` on the table `PrediccionesIA` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `calibre` to the `PrediccionesIA` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PrediccionesIA_tipoProducto_mercadoDestino_provincia_fechaP_key";

-- AlterTable
ALTER TABLE "PrediccionesIA" ADD COLUMN "calibre" TEXT NOT NULL DEFAULT 'U15';

-- UpdateData: Extraer calibre de tipoProducto si es posible, si no dejar U15
UPDATE "PrediccionesIA" SET "calibre" = "tipoProducto" WHERE "tipoProducto" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PrediccionesIA_tipoProducto_calibre_mercadoDestino_provinci_key" ON "PrediccionesIA"("tipoProducto", "calibre", "mercadoDestino", "provincia", "fechaPrediccion");
