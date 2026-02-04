import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventLogsService {
  private readonly logger = new Logger(EventLogsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    orderId?: number;
    userId?: number;
    accion?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 25;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters?.orderId) {
        where.orderId = filters.orderId;
      }

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.accion) {
        where.accion = filters.accion;
      }

      if (filters?.fechaDesde || filters?.fechaHasta) {
        where.createdAt = {};
        if (filters?.fechaDesde) {
          where.createdAt.gte = new Date(filters.fechaDesde);
        }
        if (filters?.fechaHasta) {
          const fechaHasta = new Date(filters.fechaHasta);
          fechaHasta.setHours(23, 59, 59, 999);
          where.createdAt.lte = fechaHasta;
        }
      }

      const [logs, total] = await Promise.all([
        this.prisma.eventLog.findMany({
          where,
          include: {
            order: {
              include: {
                provider: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.eventLog.count({ where }),
      ]);

      return {
        data: logs.map((log) => ({
          id: log.id,
          orderId: log.orderId,
          userId: log.userId,
          accion: log.accion,
          descripcion: log.descripcion,
          fechaEvento: log.createdAt,
          createdAt: log.createdAt,
          order: log.order
            ? {
                id: log.order.id,
                codigo: log.order.codigo,
                provider: log.order.provider
                  ? {
                      name: log.order.provider.name,
                    }
                  : null,
              }
            : null,
          user: log.user,
          details: this.extractDetails(log.datosAnteriores, log.datosNuevos),
        })),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Error fetching event logs:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const log = await this.prisma.eventLog.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              provider: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!log) {
        return null;
      }

      return {
        id: log.id,
        orderId: log.orderId,
        userId: log.userId,
        accion: log.accion,
        descripcion: log.descripcion,
        fechaEvento: log.createdAt,
        createdAt: log.createdAt,
        order: log.order
          ? {
              id: log.order.id,
              codigo: log.order.codigo,
              provider: log.order.provider
                ? {
                    name: log.order.provider.name,
                  }
                : null,
            }
          : null,
        user: log.user,
        details: this.extractDetails(log.datosAnteriores, log.datosNuevos),
      };
    } catch (error) {
      this.logger.error('Error fetching event log:', error);
      throw error;
    }
  }

  async findByOrder(orderId: number) {
    try {
      const logs = await this.prisma.eventLog.findMany({
        where: { orderId },
        include: {
          order: {
            include: {
              provider: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return logs.map((log) => ({
        id: log.id,
        orderId: log.orderId,
        userId: log.userId,
        accion: log.accion,
        descripcion: log.descripcion,
        fechaEvento: log.createdAt,
        createdAt: log.createdAt,
        order: log.order
          ? {
              id: log.order.id,
              codigo: log.order.codigo,
              provider: log.order.provider
                ? {
                    name: log.order.provider.name,
                  }
                : null,
            }
          : null,
        user: log.user,
        details: this.extractDetails(log.datosAnteriores, log.datosNuevos),
      }));
    } catch (error) {
      this.logger.error('Error fetching event logs by order:', error);
      throw error;
    }
  }

  async findByUser(userId: number) {
    try {
      const logs = await this.prisma.eventLog.findMany({
        where: { userId },
        include: {
          order: {
            include: {
              provider: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return logs.map((log) => ({
        id: log.id,
        orderId: log.orderId,
        userId: log.userId,
        accion: log.accion,
        descripcion: log.descripcion,
        fechaEvento: log.createdAt,
        createdAt: log.createdAt,
        order: log.order
          ? {
              id: log.order.id,
              codigo: log.order.codigo,
              provider: log.order.provider
                ? {
                    name: log.order.provider.name,
                  }
                : null,
            }
          : null,
        user: log.user,
        details: this.extractDetails(log.datosAnteriores, log.datosNuevos),
      }));
    } catch (error) {
      this.logger.error('Error fetching event logs by user:', error);
      throw error;
    }
  }

  private extractDetails(datosAnteriores: any, datosNuevos: any): any[] {
    if (!datosAnteriores && !datosNuevos) {
      return [];
    }

    const details: any[] = [];
    const allKeys = new Set([
      ...Object.keys(datosAnteriores || {}),
      ...Object.keys(datosNuevos || {}),
    ]);

    allKeys.forEach((key) => {
      const valorAnterior = datosAnteriores?.[key];
      const valorNuevo = datosNuevos?.[key];

      if (valorAnterior !== valorNuevo) {
        details.push({
          id: details.length + 1,
          clave: key,
          valorAnterior: this.formatValue(valorAnterior),
          valorNuevo: this.formatValue(valorNuevo),
        });
      }
    });

    return details;
  }

  private formatValue(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

