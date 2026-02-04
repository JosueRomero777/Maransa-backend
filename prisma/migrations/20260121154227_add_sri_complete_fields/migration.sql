-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoFactura" ADD VALUE 'PARCIALMENTE_PAGADA';
ALTER TYPE "EstadoFactura" ADD VALUE 'RECHAZADA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoComprobante" ADD VALUE 'FACTURA_EXPORTACION';
ALTER TYPE "TipoComprobante" ADD VALUE 'COMPROBANTE_EMISION_INCOMPLETA';
ALTER TYPE "TipoComprobante" ADD VALUE 'FACTURA_AUTORIZACION_ESPECIAL';

-- AlterTable
ALTER TABLE "invoice_details" ADD COLUMN     "unidadMedida" TEXT NOT NULL DEFAULT '3';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "direccionComprador" TEXT,
ADD COLUMN     "emailComprador" TEXT,
ADD COLUMN     "identificacionComprador" TEXT,
ADD COLUMN     "irbpnr" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "razonSocialComprador" TEXT,
ADD COLUMN     "rebiius" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal14" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal20" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal5" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tipoIdentificacionComprador" TEXT;
