/*
  Warnings:

  - A unique constraint covering the columns `[tipoProducto,mercadoDestino,provincia,fechaPrediccion]` on the table `PrediccionesIA` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PrediccionesIA_tipoProducto_mercadoDestino_provincia_fechaP_key" ON "PrediccionesIA"("tipoProducto", "mercadoDestino", "provincia", "fechaPrediccion");
