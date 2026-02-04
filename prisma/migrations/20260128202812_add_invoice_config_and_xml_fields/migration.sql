/*
  Warnings:

  - You are about to drop the column `urlAutorizacion` on the `invoice_config` table. All the data in the column will be lost.
  - You are about to drop the column `urlRecepcion` on the `invoice_config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invoice_config" DROP COLUMN "urlAutorizacion",
DROP COLUMN "urlRecepcion",
ADD COLUMN     "contribuyenteEspecial" TEXT,
ADD COLUMN     "direccionEstablecimiento" TEXT,
ADD COLUMN     "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "urlFirmaService" TEXT NOT NULL DEFAULT 'http://localhost:9000';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "rutaPdfRide" TEXT,
ADD COLUMN     "rutaXmlAutorizado" TEXT,
ADD COLUMN     "rutaXmlFirmado" TEXT,
ADD COLUMN     "rutaXmlGenerado" TEXT,
ADD COLUMN     "secuencialFactura" INTEGER,
ADD COLUMN     "subtotal15" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "xmlGenerado" TEXT;
