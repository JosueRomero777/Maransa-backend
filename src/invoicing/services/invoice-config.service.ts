import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceConfigDto, UpdateInvoiceConfigDto } from '../dto/invoice-config.dto';

@Injectable()
export class InvoiceConfigService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateInvoiceConfigDto) {
    // Verificar si ya existe configuración para este RUC
    const existing = await this.prisma.invoiceConfig.findUnique({
      where: { ruc: createDto.ruc },
    });

    if (existing) {
      throw new ConflictException('Ya existe una configuración para este RUC');
    }

    return this.prisma.invoiceConfig.create({
      data: {
        ...createDto,
        urlFirmaService: createDto.urlFirmaService || 'http://localhost:9000',
      },
    });
  }

  async findAll() {
    return this.prisma.invoiceConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const config = await this.prisma.invoiceConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    return config;
  }

  async findActive() {
    const config = await this.prisma.invoiceConfig.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      throw new NotFoundException('No hay configuración activa de facturación');
    }

    return config;
  }

  async update(id: number, updateDto: UpdateInvoiceConfigDto) {
    await this.findOne(id); // Verificar existencia

    return this.prisma.invoiceConfig.update({
      where: { id },
      data: updateDto,
    });
  }

  async setActive(id: number) {
    await this.findOne(id); // Verificar existencia

    // Desactivar todas las demás
    await this.prisma.invoiceConfig.updateMany({
      data: { activo: false },
    });

    // Activar la seleccionada
    return this.prisma.invoiceConfig.update({
      where: { id },
      data: { activo: true },
    });
  }

  async getNextSecuencial(tipo: 'factura' | 'notaCredito' | 'notaDebito' | 'retencion' = 'factura') {
    const config = await this.findActive();

    const fieldMap = {
      factura: 'secuencialFactura',
      notaCredito: 'secuencialNotaCredito',
      notaDebito: 'secuencialNotaDebito',
      retencion: 'secuencialRetencion',
    };

    const field = fieldMap[tipo];
    const currentValue = config[field];

    // Incrementar el secuencial
    await this.prisma.invoiceConfig.update({
      where: { id: config.id },
      data: { [field]: currentValue + 1 },
    });

    return currentValue;
  }

  async delete(id: number) {
    await this.findOne(id); // Verificar existencia

    return this.prisma.invoiceConfig.delete({
      where: { id },
    });
  }
}
