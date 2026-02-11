-- AlterTable
ALTER TABLE "custody" ADD COLUMN     "fechaCierreTracking" TIMESTAMP(3),
ADD COLUMN     "fechaInicioTracking" TIMESTAMP(3),
ADD COLUMN     "historialUbicaciones" JSONB,
ADD COLUMN     "sessionIdTracking" TEXT,
ADD COLUMN     "trackingActivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ubicacionActualLat" DOUBLE PRECISION,
ADD COLUMN     "ubicacionActualLng" DOUBLE PRECISION,
ADD COLUMN     "ultimaActualizacion" TIMESTAMP(3),
ADD COLUMN     "usuarioTrackingActivo" INTEGER;
