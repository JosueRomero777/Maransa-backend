/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Provider` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('VANNAMEI', 'LANGOSTINO', 'OTRO');

-- CreateEnum
CREATE TYPE "TallaProducto" AS ENUM ('U10', 'U12', 'U15', 'U20', 'U30', 'U40', 'U50', 'U60', 'U70', 'U80', 'U100');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('CREADO', 'EN_ANALISIS', 'APROBADO', 'RECHAZADO', 'EN_REEVALUACION', 'DESCARTADO', 'EN_COSECHA', 'EN_TRANSITO', 'EN_CUSTODIA', 'RECIBIDO', 'FACTURADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EstadoLaboratorio" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'EN_REEVALUACION');

-- CreateEnum
CREATE TYPE "EstadoLogistica" AS ENUM ('PENDIENTE', 'ASIGNADO', 'EN_RUTA', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('BORRADOR', 'EMITIDA', 'AUTORIZADA_SRI', 'PAGADA', 'ANULADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'RETENCION');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'COMPRAS', 'LABORATORIO', 'LOGISTICA', 'CUSTODIA', 'EMPACADORA', 'GERENCIA');

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "condicionesComerciales" TEXT,
ADD COLUMN     "confiabilidadPromedio" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "puntualidadPromedio" DOUBLE PRECISION DEFAULT 0.0;

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "RolUsuario" NOT NULL,
    "password" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packagers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_whatsapp" TEXT,
    "ruc" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packagers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "packagerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "tipoProducto" "TipoProducto" NOT NULL,
    "tallaEstimada" "TallaProducto",
    "cantidadEstimada" DOUBLE PRECISION NOT NULL,
    "cantidadFinal" DOUBLE PRECISION,
    "fechaTentativaCosecha" TIMESTAMP(3),
    "fechaDefinitivaCosecha" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaActualizacion" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'CREADO',
    "precioEstimadoCompra" DOUBLE PRECISION,
    "precioRealCompra" DOUBLE PRECISION,
    "precioEstimadoVenta" DOUBLE PRECISION,
    "precioRealVenta" DOUBLE PRECISION,
    "condicionesIniciales" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratory_analysis" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "analistaId" INTEGER NOT NULL,
    "estado" "EstadoLaboratorio" NOT NULL DEFAULT 'PENDIENTE',
    "fechaAnalisis" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaReevaluacion" TIMESTAMP(3),
    "resultadoGeneral" TEXT,
    "parametrosQuimicos" JSONB,
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "archivosAdjuntos" TEXT[],
    "olor" TEXT,
    "sabor" TEXT,
    "textura" TEXT,
    "apariencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboratory_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "assignedUserId" INTEGER,
    "estado" "EstadoLogistica" NOT NULL DEFAULT 'PENDIENTE',
    "fechaAsignacion" TIMESTAMP(3),
    "fechaInicio" TIMESTAMP(3),
    "fechaFinalizacion" TIMESTAMP(3),
    "vehiculoAsignado" TEXT,
    "choferAsignado" TEXT,
    "recursosUtilizados" JSONB,
    "ubicacionOrigen" TEXT,
    "ubicacionDestino" TEXT,
    "rutaPlanificada" TEXT,
    "evidenciasCarga" TEXT[],
    "evidenciasTransporte" TEXT[],
    "observaciones" TEXT,
    "incidentes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "assignedUserId" INTEGER,
    "horarioPesca" TIMESTAMP(3),
    "horarioEstimadoLlegada" TIMESTAMP(3),
    "horarioRealLlegada" TIMESTAMP(3),
    "personalAsignado" TEXT,
    "vehiculoAcompanado" TEXT,
    "incidentes" JSONB,
    "novedades" TEXT,
    "ubicacionesRegistradas" JSONB,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "fechaLlegada" TIMESTAMP(3) NOT NULL,
    "horaLlegada" TEXT NOT NULL,
    "pesoRecibido" DOUBLE PRECISION,
    "calidadValidada" BOOLEAN NOT NULL DEFAULT false,
    "loteAceptado" BOOLEAN NOT NULL DEFAULT false,
    "motivoRechazo" TEXT,
    "tallasFinales" JSONB,
    "clasificacionFinal" TEXT,
    "precioFinalVenta" DOUBLE PRECISION,
    "condicionesVenta" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "codigo" TEXT,
    "orderId" INTEGER NOT NULL,
    "packagerId" INTEGER NOT NULL,
    "tipoComprobante" "TipoComprobante" NOT NULL,
    "numeroAutorizacion" TEXT,
    "claveAcceso" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "descuentos" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'BORRADOR',
    "fechaPago" TIMESTAMP(3),
    "montoPagado" DOUBLE PRECISION DEFAULT 0,
    "saldoPendiente" DOUBLE PRECISION,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "referencia" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER,
    "packagerId" INTEGER,
    "tipoProducto" "TipoProducto" NOT NULL,
    "talla" "TallaProducto",
    "precioCompra" DOUBLE PRECISION,
    "precioVenta" DOUBLE PRECISION,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temporada" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "asunto" TEXT,
    "mensaje" TEXT NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio" TIMESTAMP(3),
    "fechaLectura" TIMESTAMP(3),
    "respuesta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "userId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "datosAnteriores" JSONB,
    "datosNuevos" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "packagers_name_key" ON "packagers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "packagers_ruc_key" ON "packagers"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "orders_codigo_key" ON "orders"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "laboratory_analysis_orderId_key" ON "laboratory_analysis"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_orderId_key" ON "logistics"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "custody_orderId_key" ON "custody"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "reception_orderId_key" ON "reception"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_numero_key" ON "invoices"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_clave_key" ON "system_config"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_packagerId_fkey" FOREIGN KEY ("packagerId") REFERENCES "packagers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratory_analysis" ADD CONSTRAINT "laboratory_analysis_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratory_analysis" ADD CONSTRAINT "laboratory_analysis_analistaId_fkey" FOREIGN KEY ("analistaId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics" ADD CONSTRAINT "logistics_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics" ADD CONSTRAINT "logistics_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody" ADD CONSTRAINT "custody_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody" ADD CONSTRAINT "custody_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception" ADD CONSTRAINT "reception_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_packagerId_fkey" FOREIGN KEY ("packagerId") REFERENCES "packagers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_packagerId_fkey" FOREIGN KEY ("packagerId") REFERENCES "packagers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
