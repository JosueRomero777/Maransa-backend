import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateReceptionDto, 
  UpdateReceptionDto, 
  ReceptionFilterDto, 
  ReceptionResponse 
} from './dto/reception.dto';

@Injectable()
export class ReceptionService {
  constructor(private prisma: PrismaService) {}

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

  async create(createReceptionDto: CreateReceptionDto, userId: string): Promise<ReceptionResponse> {
    try {
      // Verificar que la orden existe
      const order = await this.prisma.order.findUnique({
        where: { id: createReceptionDto.orderId },
        include: {
          provider: true
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

      const reception = await this.prisma.reception.create({
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
          { order: { codigo: { contains: search, mode: 'insensitive' } } },
          { order: { provider: { name: { contains: search, mode: 'insensitive' } } } },
          { order: { provider: { company: { contains: search, mode: 'insensitive' } } } }
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
        where: { id }
      });

      if (!existingReception) {
        throw new NotFoundException('Reception not found');
      }

      const reception = await this.prisma.reception.update({
        where: { id },
        data: {
          ...updateReceptionDto,
          fechaLlegada: updateReceptionDto.fechaLlegada ? new Date(updateReceptionDto.fechaLlegada) : undefined
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
        provider: true
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
      cantidadEstimada: order.cantidadEstimada,
      precioEstimadoCompra: order.precioEstimadoCompra,
      fechaCreacion: order.fechaCreacion,
      estado: order.estado
    }));
  }

  private formatReceptionResponse(reception: any): ReceptionResponse {
    const response: ReceptionResponse = {
      id: reception.id,
      orderId: reception.orderId,
      fechaLlegada: reception.fechaLlegada,
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
        fechaCreacion: reception.order.fechaCreacion
      };
    }

    return response;
  }
}