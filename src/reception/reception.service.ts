import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoPedido } from '@prisma/client';
import { InvoicingService } from '../invoicing/invoicing.service';
import { 
  CreateReceptionDto, 
  UpdateReceptionDto, 
  ReceptionFilterDto, 
  ReceptionResponse 
} from './dto/reception.dto';

@Injectable()
export class ReceptionService {
  private readonly logger = new Logger(ReceptionService.name);

  constructor(
    private prisma: PrismaService,
    private invoicingService: InvoicingService,
  ) {}

  private async validateArrivalDateAgainstLogisticsCompletion(orderId: number, fechaLlegada: string | Date): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        logistica: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const fechaFinalizacionLogistica = order.logistica?.fechaFinalizacion;

    if (!fechaFinalizacionLogistica) {
      return;
    }

    const fechaLlegadaNormalizada = this.normalizeToUTCMidnight(fechaLlegada);
    const fechaFinalizacionNormalizada = this.normalizeToUTCMidnight(fechaFinalizacionLogistica);

    if (fechaLlegadaNormalizada < fechaFinalizacionNormalizada) {
      throw new BadRequestException(
        'La fecha de llegada no puede ser anterior a la fecha de finalización de logística',
      );
    }
  }

  /**
   * Normaliza una fecha a medianoche UTC
   * Si es string en formato YYYY-MM-DD, la convierte a UTC
   * Si es Date, extrae solo la parte de fecha en UTC
   */
  private normalizeToUTCMidnight(fecha: string | Date): Date {
    if (typeof fecha === 'string') {
      // Si es string en formato YYYY-MM-DD, parsearlo como UTC
      if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(fecha + 'T00:00:00.000Z');
      }
      return new Date(fecha);
    }
    
    // Si es Date, extraer solo la fecha en UTC
    const date = new Date(fecha);
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    ));
  }

  private formatToUTCDateString(fecha: Date): string {
    return fecha.toISOString().split('T')[0];
  }

  async create(createReceptionDto: CreateReceptionDto, userId: number): Promise<ReceptionResponse> {
    try {
      // Verificar que la orden existe
      const order = await this.prisma.order.findUnique({
        where: { id: createReceptionDto.orderId },
        include: {
          provider: true,
          logistica: true,
          packager: true,
        }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Verificar si ya existe una recepción para esta orden
      const existingReception = await this.prisma.reception.findFirst({
        where: { orderId: createReceptionDto.orderId }
      });

      if (existingReception) {
        throw new BadRequestException('Reception already exists for this order');
      }

      await this.validateArrivalDateAgainstLogisticsCompletion(
        createReceptionDto.orderId,
        createReceptionDto.fechaLlegada,
      );

      let packagerId = order.packagerId;

      if (!packagerId && createReceptionDto.packagerId) {
        const packager = await this.prisma.packager.findUnique({
          where: { id: createReceptionDto.packagerId },
          select: { id: true },
        });

        if (!packager) {
          throw new BadRequestException('La empacadora seleccionada no existe');
        }

        await this.prisma.order.update({
          where: { id: order.id },
          data: { packagerId: createReceptionDto.packagerId },
        });

        packagerId = createReceptionDto.packagerId;
      }

      if (!packagerId) {
        throw new BadRequestException('La orden no tiene empacadora asignada. Selecciona una empacadora antes de crear la recepción');
      }

      const reception = await this.prisma.$transaction(async (tx) => {
        const createdReception = await tx.reception.create({
          data: {
            orderId: createReceptionDto.orderId,
            fechaLlegada: this.normalizeToUTCMidnight(createReceptionDto.fechaLlegada),
            horaLlegada: createReceptionDto.horaLlegada,
            pesoRecibido: createReceptionDto.pesoRecibido,
            calidadValidada: createReceptionDto.calidadValidada || false,
            loteAceptado: createReceptionDto.loteAceptado || false,
            motivoRechazo: createReceptionDto.motivoRechazo,
            clasificacionFinal: createReceptionDto.clasificacionFinal,
            precioFinalVenta: createReceptionDto.precioFinalVenta,
            condicionesVenta: createReceptionDto.condicionesVenta,
            observaciones: createReceptionDto.observaciones
          },
          include: {
            order: {
              include: {
                provider: true
              }
            }
          }
        });

        const nonUpdatableStatuses = new Set<EstadoPedido>([
          EstadoPedido.RECIBIDO,
          EstadoPedido.FACTURADO,
          EstadoPedido.FINALIZADO,
          EstadoPedido.CANCELADO,
          EstadoPedido.DESCARTADO,
        ]);

        if (!nonUpdatableStatuses.has(order.estado as EstadoPedido)) {
          await tx.order.update({
            where: { id: order.id },
            data: { estado: EstadoPedido.RECIBIDO },
          });

          await tx.eventLog.create({
            data: {
              orderId: order.id,
              userId,
              accion: 'cambio_estado',
              descripcion: `Estado cambiado de ${order.estado} a ${EstadoPedido.RECIBIDO} por registro de recepción`,
            },
          });
        }

        return createdReception;
      });

      try {
        const autoInvoiceResult = await this.invoicingService.createInvoiceFromReception(createReceptionDto.orderId);
        if (autoInvoiceResult?.created) {
          this.logger.log(`🧾 Factura automática generada para la orden ${order.codigo}`);
        } else {
          this.logger.log(`ℹ️ Factura automática omitida para orden ${order.codigo}: ${autoInvoiceResult?.reason || 'sin detalle'}`);
        }
      } catch (invoiceError: any) {
        this.logger.error(`❌ No se pudo generar factura automática para orden ${order.codigo}: ${invoiceError?.message || invoiceError}`);
      }

      return this.formatReceptionResponse(reception);
    } catch (error) {
      throw error;
    }
  }

  async findAll(filters: ReceptionFilterDto): Promise<{
    data: ReceptionResponse[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      orderId,
      clasificacionFinal,
      calidadValidada,
      loteAceptado,
      fechaLlegadaDesde,
      fechaLlegadaHasta,
      search,
      page = 1,
      limit = 10
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {
      AND: []
    };

    // Filtros específicos
    if (orderId) {
      where.AND.push({ orderId });
    }

    if (clasificacionFinal) {
      where.AND.push({ clasificacionFinal });
    }

    if (calidadValidada !== undefined) {
      where.AND.push({ calidadValidada });
    }

    if (loteAceptado !== undefined) {
      where.AND.push({ loteAceptado });
    }

    // Filtro de fechas
    if (fechaLlegadaDesde || fechaLlegadaHasta) {
      const dateFilter: any = {};
      if (fechaLlegadaDesde) {
        dateFilter.gte = new Date(fechaLlegadaDesde);
      }
      if (fechaLlegadaHasta) {
        dateFilter.lte = new Date(fechaLlegadaHasta);
      }
      where.AND.push({ fechaLlegada: dateFilter });
    }

    // Búsqueda por texto
    if (search) {
      where.AND.push({
        OR: [
          { observaciones: { contains: search, mode: 'insensitive' } },
          { clasificacionFinal: { contains: search, mode: 'insensitive' } },
          { order: { is: { codigo: { contains: search, mode: 'insensitive' } } } },
          { order: { is: { provider: { is: { name: { contains: search, mode: 'insensitive' } } } } } },
          { order: { is: { packager: { is: { name: { contains: search, mode: 'insensitive' } } } } } }
        ]
      });
    }

    const [receptions, total] = await Promise.all([
      this.prisma.reception.findMany({
        where: where.AND.length > 0 ? where : {},
        skip,
        take: limit,
        include: {
          order: {
            include: {
              provider: true
            }
          }
        },
        orderBy: { fechaLlegada: 'desc' }
      }),
      this.prisma.reception.count({
        where: where.AND.length > 0 ? where : {}
      })
    ]);

    const formattedReceptions = receptions.map(reception => 
      this.formatReceptionResponse(reception)
    );

    return {
      data: formattedReceptions,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(id: number): Promise<ReceptionResponse> {
    const reception = await this.prisma.reception.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            provider: true
          }
        }
      }
    });

    if (!reception) {
      throw new NotFoundException('Reception not found');
    }

    return this.formatReceptionResponse(reception);
  }

  async update(id: number, updateReceptionDto: UpdateReceptionDto): Promise<ReceptionResponse> {
    try {
      // Verificar que la recepción existe
      const existingReception = await this.prisma.reception.findUnique({
        where: { id },
        select: {
          id: true,
          orderId: true,
        },
      });

      if (!existingReception) {
        throw new NotFoundException('Reception not found');
      }

      if (updateReceptionDto.fechaLlegada) {
        await this.validateArrivalDateAgainstLogisticsCompletion(
          existingReception.orderId,
          updateReceptionDto.fechaLlegada,
        );
      }

      const reception = await this.prisma.reception.update({
        where: { id },
        data: {
          ...updateReceptionDto,
          fechaLlegada: updateReceptionDto.fechaLlegada
            ? this.normalizeToUTCMidnight(updateReceptionDto.fechaLlegada)
            : undefined
        },
        include: {
          order: {
            include: {
              provider: true
            }
          }
        }
      });

      return this.formatReceptionResponse(reception);
    } catch (error) {
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const reception = await this.prisma.reception.findUnique({
      where: { id }
    });

    if (!reception) {
      throw new NotFoundException('Reception not found');
    }

    await this.prisma.reception.delete({
      where: { id }
    });
  }

  async getClassifications(): Promise<string[]> {
    const classifications = await this.prisma.reception.findMany({
      select: { clasificacionFinal: true },
      distinct: ['clasificacionFinal'],
      where: { clasificacionFinal: { not: null } }
    });

    return classifications
      .map(r => r.clasificacionFinal)
      .filter((c): c is string => c !== null)
      .sort();
  }

  async getOrdersWithoutReception(): Promise<any[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        recepcion: {
          is: null
        },
        estado: {
          in: ['CUSTODIA_COMPLETADA', 'ENTREGADO']
        }
      },
      include: {
        provider: true,
        packager: {
          select: {
            id: true,
            name: true,
          },
        },
        logistica: {
          select: {
            fechaFinalizacion: true,
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' }
    });

    return orders.map(order => ({
      id: order.id,
      codigo: order.codigo,
      provider: {
        name: order.provider.name,
        location: order.provider.location
      },
      packager: order.packager ? {
        id: order.packager.id,
        name: order.packager.name,
      } : null,
      cantidadEstimada: order.cantidadEstimada,
      precioEstimadoCompra: order.precioEstimadoCompra,
      fechaCreacion: order.fechaCreacion,
      estado: order.estado,
      logistica: {
        fechaFinalizacion: order.logistica?.fechaFinalizacion ?? null,
      },
    }));
  }

  private formatReceptionResponse(reception: any): ReceptionResponse {
    const response: ReceptionResponse = {
      id: reception.id,
      orderId: reception.orderId,
      fechaLlegada: this.formatToUTCDateString(reception.fechaLlegada),
      horaLlegada: reception.horaLlegada,
      pesoRecibido: reception.pesoRecibido,
      calidadValidada: reception.calidadValidada,
      loteAceptado: reception.loteAceptado,
      motivoRechazo: reception.motivoRechazo,
      clasificacionFinal: reception.clasificacionFinal,
      precioFinalVenta: reception.precioFinalVenta,
      condicionesVenta: reception.condicionesVenta,
      observaciones: reception.observaciones,
      createdAt: reception.createdAt,
      updatedAt: reception.updatedAt
    };

    // Incluir datos de la orden si están disponibles
    if (reception.order) {
      response.order = {
        id: reception.order.id,
        codigo: reception.order.codigo,
        provider: reception.order.provider ? {
          name: reception.order.provider.name,
          location: reception.order.provider.location
        } : { name: '', location: '' },
        cantidadEstimada: reception.order.cantidadEstimada,
        precioEstimadoCompra: reception.order.precioEstimadoCompra,
        precioEstimadoVenta: reception.order.precioEstimadoVenta,
        fechaCreacion: reception.order.fechaCreacion
      };
    }

    return response;
  }
}