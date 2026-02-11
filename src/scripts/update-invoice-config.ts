import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();

async function updateInvoiceConfig() {
  console.log('🔧 Actualizando configuración de facturación...');

  try {
    // Buscar configuración activa
    const config = await prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    if (!config) {
      console.log('❌ No hay configuración activa. Creando nueva...');
      
      await prisma.invoiceConfig.create({
        data: {
          ruc: '0999999999001',
          razonSocial: 'MARANSA S.A.',
          nombreComercial: 'MARANSA',
          direccionMatriz: 'Av. Principal y Secundaria, Ciudad, Ecuador',
          codigoEstablecimiento: '001',
          codigoPuntoEmision: '001',
          secuencialFactura: 1,
          secuencialNotaCredito: 1,
          secuencialNotaDebito: 1,
          secuencialRetencion: 1,
          ambienteSRI: 'PRUEBAS',
          tipoEmision: 'NORMAL',
          rutaCertificado: path.join(process.cwd(), 'certificates', 'firma.p12'),
          claveCertificado: 'ADRI4189',
          urlFirmaService: 'http://localhost:8001',
          activo: true,
        },
      });
      
      console.log('✅ Configuración creada exitosamente');
    } else {
      // Actualizar configuración existente
      await prisma.invoiceConfig.update({
        where: { id: config.id },
        data: {
          rutaCertificado: path.join(process.cwd(), 'certificates', 'firma.p12'),
          claveCertificado: 'ADRI4189',
          urlFirmaService: 'http://localhost:8001',
        },
      });
      
      console.log('✅ Configuración actualizada exitosamente');
      console.log(`   - Certificado: ${path.join(process.cwd(), 'certificates', 'firma.p12')}`);
      console.log(`   - URL Firma Service: http://localhost:8001`);
    }

    // Mostrar configuración actual
    const updatedConfig = await prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    console.log('\n📋 Configuración actual:');
    console.log(`   RUC: ${updatedConfig?.ruc}`);
    console.log(`   Razón Social: ${updatedConfig?.razonSocial}`);
    console.log(`   Ambiente: ${updatedConfig?.ambienteSRI}`);
    console.log(`   Certificado: ${updatedConfig?.rutaCertificado}`);
    console.log(`   URL Firma: ${updatedConfig?.urlFirmaService}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateInvoiceConfig();
