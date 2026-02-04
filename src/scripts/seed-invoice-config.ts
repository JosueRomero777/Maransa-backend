import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedInvoiceConfig() {
  console.log('🔧 Creando configuración de facturación de prueba...');

  // Verificar si ya existe
  const existing = await prisma.invoiceConfig.findFirst();
  
  if (existing) {
    console.log('✅ Ya existe configuración de facturación');
    return;
  }

  // Crear configuración de prueba
  const config = await prisma.invoiceConfig.create({
    data: {
      ruc: '1234567890001',
      razonSocial: 'MARANSA CIA LTDA',
      nombreComercial: 'MARANSA',
      direccionMatriz: 'Av. Principal 123 y Secundaria, Guayaquil, Ecuador',
      direccionEstablecimiento: 'Av. Principal 123 y Secundaria, Guayaquil, Ecuador',
      contribuyenteEspecial: null,
      obligadoContabilidad: true,
      codigoEstablecimiento: '001',
      codigoPuntoEmision: '001',
      secuencialFactura: 1,
      secuencialNotaCredito: 1,
      secuencialNotaDebito: 1,
      secuencialRetencion: 1,
      ambienteSRI: 'PRUEBAS',
      tipoEmision: 'NORMAL',
      rutaCertificado: './certificates/dummy-cert.p12',
      claveCertificado: 'test123',
      fechaExpiracion: new Date('2030-12-31'),
      urlFirmaService: 'http://localhost:9000',
      activo: true,
    },
  });

  console.log('✅ Configuración de facturación creada:', config.id);
}

seedInvoiceConfig()
  .catch((e) => {
    console.error('❌ Error al crear configuración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
