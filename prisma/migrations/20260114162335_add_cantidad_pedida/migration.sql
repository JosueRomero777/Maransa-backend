/*
  Warnings:

  - You are about to drop the column `horarioEstimadoLlegada` on the `custody` table. All the data in the column will be lost.
  - You are about to drop the column `horarioPesca` on the `custody` table. All the data in the column will be lost.
  - You are about to drop the column `horarioRealLlegada` on the `custody` table. All the data in the column will be lost.
  - You are about to drop the column `novedades` on the `custody` table. All the data in the column will be lost.
  - You are about to drop the column `ubicacionesRegistradas` on the `custody` table. All the data in the column will be lost.
  - You are about to drop the column `vehiculoAcompanado` on the `custody` table. All the data in the column will be lost.
  - The `personalAsignado` column on the `custody` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[logisticsId]` on the table `custody` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `logisticsId` to the `custody` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cantidadPedida` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoCustodia" AS ENUM ('PENDIENTE', 'ASIGNADO', 'EN_CUSTODIA', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "EstadoCosecha" AS ENUM ('PENDIENTE', 'DEFINIDO', 'APROBADO', 'RECHAZADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoPedido" ADD VALUE 'LABORATORIO_APROBADO';
ALTER TYPE "EstadoPedido" ADD VALUE 'LABORATORIO_RECHAZADO';
ALTER TYPE "EstadoPedido" ADD VALUE 'LABORATORIO_REEVALUACION';
ALTER TYPE "EstadoPedido" ADD VALUE 'DEFINIENDO_COSECHA';
ALTER TYPE "EstadoPedido" ADD VALUE 'COSECHA_DEFINIDA';
ALTER TYPE "EstadoPedido" ADD VALUE 'COSECHA_APROBADA';
ALTER TYPE "EstadoPedido" ADD VALUE 'COSECHA_RECHAZADA';
ALTER TYPE "EstadoPedido" ADD VALUE 'LOGISTICA_ASIGNADA';
ALTER TYPE "EstadoPedido" ADD VALUE 'EN_TRANSPORTE';
ALTER TYPE "EstadoPedido" ADD VALUE 'CUSTODIA_ASIGNADA';
ALTER TYPE "EstadoPedido" ADD VALUE 'CUSTODIA_COMPLETADA';
ALTER TYPE "EstadoPedido" ADD VALUE 'ENTREGADO';
ALTER TYPE "EstadoPedido" ADD VALUE 'CANCELADO';

-- AlterTable
ALTER TABLE "custody" DROP COLUMN "horarioEstimadoLlegada",
DROP COLUMN "horarioPesca",
DROP COLUMN "horarioRealLlegada",
DROP COLUMN "novedades",
DROP COLUMN "ubicacionesRegistradas",
DROP COLUMN "vehiculoAcompanado",
ADD COLUMN     "estado" "EstadoCustodia" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "evidenciasFinales" JSONB,
ADD COLUMN     "evidenciasIniciales" JSONB,
ADD COLUMN     "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fechaFinalizacion" TIMESTAMP(3),
ADD COLUMN     "fechaInicio" TIMESTAMP(3),
ADD COLUMN     "logisticsId" INTEGER NOT NULL,
ADD COLUMN     "observacionesFinales" TEXT,
ADD COLUMN     "rutaCustodia" TEXT,
ADD COLUMN     "vehiculoCustodia" TEXT,
DROP COLUMN "personalAsignado",
ADD COLUMN     "personalAsignado" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cantidadPedida" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fechaEntregaEstimada" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "harvest" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "assignedUserId" INTEGER,
    "estado" "EstadoCosecha" NOT NULL DEFAULT 'PENDIENTE',
    "fechaAsignacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaDefinicion" TIMESTAMP(3),
    "fechaAprobacion" TIMESTAMP(3),
    "fechaRechazo" TIMESTAMP(3),
    "cantidadEstimada" DOUBLE PRECISION,
    "fechaEstimada" TIMESTAMP(3),
    "cantidadFinal" DOUBLE PRECISION,
    "fechaDefinitiva" TIMESTAMP(3),
    "calidadEsperada" TEXT,
    "condicionesCosecha" TEXT,
    "temperaturaOptima" DOUBLE PRECISION,
    "tiempoMaximoTransporte" INTEGER,
    "requerimientosEspeciales" TEXT,
    "evidenciasIniciales" JSONB,
    "evidenciasDefinicion" JSONB,
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "harvest_orderId_key" ON "harvest"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "custody_logisticsId_key" ON "custody"("logisticsId");

-- AddForeignKey
ALTER TABLE "custody" ADD CONSTRAINT "custody_logisticsId_fkey" FOREIGN KEY ("logisticsId") REFERENCES "logistics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest" ADD CONSTRAINT "harvest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest" ADD CONSTRAINT "harvest_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
