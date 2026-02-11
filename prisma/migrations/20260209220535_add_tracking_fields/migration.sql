/*
  Warnings:

  - The values [EMPACADORA] on the enum `RolUsuario` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RolUsuario_new" AS ENUM ('ADMIN', 'COMPRAS', 'LABORATORIO', 'LOGISTICA', 'CUSTODIA', 'FACTURACION', 'GERENCIA');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "RolUsuario_new" USING ("role"::text::"RolUsuario_new");
ALTER TYPE "RolUsuario" RENAME TO "RolUsuario_old";
ALTER TYPE "RolUsuario_new" RENAME TO "RolUsuario";
DROP TYPE "RolUsuario_old";
COMMIT;

-- AlterTable
ALTER TABLE "logistics" ADD COLUMN     "fechaCierreTracking" TIMESTAMP(3),
ADD COLUMN     "fechaInicioTracking" TIMESTAMP(3),
ADD COLUMN     "sessionIdTracking" TEXT,
ADD COLUMN     "usuarioTrackingActivo" INTEGER;
