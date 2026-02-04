-- AlterTable
ALTER TABLE "logistics" ADD COLUMN     "destinoLat" DOUBLE PRECISION,
ADD COLUMN     "destinoLng" DOUBLE PRECISION,
ADD COLUMN     "historialUbicaciones" JSONB,
ADD COLUMN     "origenLat" DOUBLE PRECISION,
ADD COLUMN     "origenLng" DOUBLE PRECISION,
ADD COLUMN     "trackingActivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ubicacionActualLat" DOUBLE PRECISION,
ADD COLUMN     "ubicacionActualLng" DOUBLE PRECISION,
ADD COLUMN     "ultimaActualizacion" TIMESTAMP(3);
