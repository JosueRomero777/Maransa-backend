/*
  Warnings:

  - You are about to drop the column `codigo` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `descuentos` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `fechaPago` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `montoPagado` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `numero` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `saldoPendiente` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `subtotal` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `metodoPago` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `referencia` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[numeroFactura]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[claveAcceso]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[numeroPago]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `numeroFactura` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalSinImpuestos` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `formaPago` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numeroPago` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `packagerId` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_orderId_fkey";

-- DropIndex
DROP INDEX "invoices_numero_key";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "codigo",
DROP COLUMN "descuentos",
DROP COLUMN "fechaPago",
DROP COLUMN "montoPagado",
DROP COLUMN "numero",
DROP COLUMN "saldoPendiente",
DROP COLUMN "subtotal",
ADD COLUMN     "formaPago" TEXT,
ADD COLUMN     "ice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "motivoAnulacion" TEXT,
ADD COLUMN     "numeroFactura" TEXT NOT NULL,
ADD COLUMN     "plazoCredito" INTEGER,
ADD COLUMN     "subtotal0" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal12" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalSinImpuestos" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "xmlAutorizado" TEXT,
ADD COLUMN     "xmlFirmado" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "tipoComprobante" SET DEFAULT 'FACTURA',
ALTER COLUMN "iva" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "metodoPago",
DROP COLUMN "referencia",
ADD COLUMN     "banco" TEXT,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'RECIBIDO',
ADD COLUMN     "formaPago" TEXT NOT NULL,
ADD COLUMN     "numeroComprobante" TEXT,
ADD COLUMN     "numeroCuenta" TEXT,
ADD COLUMN     "numeroPago" TEXT NOT NULL,
ADD COLUMN     "packagerId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "fechaPago" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "invoice_details" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "codigoPrincipal" TEXT NOT NULL,
    "codigoAuxiliar" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioTotalSinImpuesto" DOUBLE PRECISION NOT NULL,
    "codigoImpuesto" TEXT NOT NULL,
    "codigoPorcentaje" TEXT NOT NULL,
    "tarifa" DOUBLE PRECISION NOT NULL,
    "baseImponible" DOUBLE PRECISION NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_payments" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "numeroLiquidacion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formaPago" TEXT NOT NULL,
    "banco" TEXT,
    "numeroCuenta" TEXT,
    "numeroComprobante" TEXT,
    "concepto" TEXT NOT NULL,
    "cantidadLibras" DOUBLE PRECISION,
    "precioLibra" DOUBLE PRECISION,
    "estado" TEXT NOT NULL DEFAULT 'PAGADO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_config" (
    "id" SERIAL NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "direccionMatriz" TEXT NOT NULL,
    "codigoEstablecimiento" TEXT NOT NULL DEFAULT '001',
    "codigoPuntoEmision" TEXT NOT NULL DEFAULT '001',
    "secuencialFactura" INTEGER NOT NULL DEFAULT 1,
    "secuencialNotaCredito" INTEGER NOT NULL DEFAULT 1,
    "secuencialNotaDebito" INTEGER NOT NULL DEFAULT 1,
    "secuencialRetencion" INTEGER NOT NULL DEFAULT 1,
    "ambienteSRI" TEXT NOT NULL DEFAULT 'PRUEBAS',
    "tipoEmision" TEXT NOT NULL DEFAULT 'NORMAL',
    "rutaCertificado" TEXT,
    "claveCertificado" TEXT,
    "fechaExpiracion" TIMESTAMP(3),
    "urlRecepcion" TEXT,
    "urlAutorizacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_payments_numeroLiquidacion_key" ON "provider_payments"("numeroLiquidacion");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_config_ruc_key" ON "invoice_config"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_numeroFactura_key" ON "invoices"("numeroFactura");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_claveAcceso_key" ON "invoices"("claveAcceso");

-- CreateIndex
CREATE UNIQUE INDEX "payments_numeroPago_key" ON "payments"("numeroPago");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_packagerId_fkey" FOREIGN KEY ("packagerId") REFERENCES "packagers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payments" ADD CONSTRAINT "provider_payments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payments" ADD CONSTRAINT "provider_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
