import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicingSeederService {
  constructor(private prisma: PrismaService) {}

  async seed() {
    console.log('🌱 Seeding invoice configuration...');

    // Verificar si ya existe configuración
    const existingConfig = await this.prisma.invoiceConfig.findFirst();

    if (existingConfig) {
      console.log('⚠️ Invoice configuration already exists, skipping...');
      return;
    }

    // Crear configuración por defecto
    await this.prisma.invoiceConfig.create({
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
        activo: true,
      },
    });

    console.log('✅ Invoice configuration seeded successfully');
  }
}
