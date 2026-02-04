import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateHarvestDto, 
  UpdateHarvestDto, 
  HarvestFilterDto,
  DefineHarvestDto
} from './dto/harvest.dto';
import { EstadoCosecha, EstadoPedido, EstadoLaboratorio } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class HarvestService {
  private readonly logger = new Logger(HarvestService.name);

  constructor(private prisma: PrismaService) {}

  async create(createHarvestDto: CreateHarvestDto, assignedUserId: number, files?: Array<Express.Multer.File>) {
    try {
      // Verificar que el pedido existe y está aprobado por laboratorio
      const order = await this.prisma.order.findUnique({
        where: { id: createHarvestDto.orderId },
        include: { 
          cosecha: true,
          laboratorio: true,
          provider: true
        }
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      if (!order.laboratorio || order.laboratorio.estado !== EstadoLaboratorio.APROBADO) {
        throw new BadRequestException('El pedido debe estar aprobado por laboratorio antes de definir cosecha');
      }

      if (order.cosecha) {
        throw new BadRequestException('El pedido ya tiene definición de cosecha');
      }

      // Procesar evidencias iniciales
      const evidenciasIniciales = files ? await this.saveFiles(files, createHarvestDto.orderId, 'inicial') : [];

      // Crear registro de cosecha
      const harvest = await this.prisma.harvest.create({
        data: {
          orderId: createHarvestDto.orderId,
          assignedUserId,
          estado: createHarvestDto.estado || EstadoCosecha.PENDIENTE,
          fechaAsignacion: new Date(),
          cantidadEstimada: createHarvestDto.cantidadEstimada || order.cantidadPedida,
          fechaEstimada: createHarvestDto.fechaEstimada,
          evidenciasIniciales,
          observaciones: createHarvestDto.observaciones,
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          assignedUser: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: createHarvestDto.orderId },
        data: { estado: EstadoPedido.DEFINIENDO_COSECHA }
      });

      // Registrar evento
      await this.logEvent(createHarvestDto.orderId, assignedUserId, 'cosecha_asignada', 'Definición de cosecha asignada', harvest);

      return this.formatHarvestResponse(harvest);
    } catch (error) {
      this.logger.error('Error creating harvest definition:', error);
      throw error;
    }
  }

  async findAll(filters: HarvestFilterDto) {
    try {
      const where: any = {};

      if (filters.estado) {
        where.estado = filters.estado;
      }

      if (filters.assignedUserId) {
        where.assignedUserId = filters.assignedUserId;
      }

      if (filters.fechaDesde && filters.fechaHasta) {
        where.fechaAsignacion = {
          gte: new Date(filters.fechaDesde),
          lte: new Date(filters.fechaHasta)
        };
      }

      if (filters.search) {
        where.OR = [
          { order: { codigo: { contains: filters.search, mode: 'insensitive' } } },
          { calidadEsperada: { contains: filters.search, mode: 'insensitive' } },
          { condicionesCosecha: { contains: filters.search, mode: 'insensitive' } },
          { observaciones: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const [harvests, total] = await Promise.all([
        this.prisma.harvest.findMany({
          where,
          include: {
            order: {
              include: {
                provider: true,
                packager: true,
                laboratorio: true
              }
            },
            assignedUser: true
          },
          orderBy: { fechaAsignacion: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.harvest.count({ where })
      ]);

      return {
        data: harvests.map(harvest => this.formatHarvestResponse(harvest)),
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error finding harvest definitions:', error);
      throw error;
    }
  }

  async getPendingOrders() {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          AND: [
            { estado: EstadoPedido.LABORATORIO_APROBADO },
            { cosecha: { is: null } }
          ]
        },
        include: {
          provider: true,
          packager: true,
          laboratorio: true
        },
        orderBy: { createdAt: 'asc' }
      });

      return orders.map(order => ({
        id: order.id,
        codigo: order.codigo,
        provider: order.provider,
        packager: order.packager,
        cantidadPedida: order.cantidadPedida,
        cantidadEstimada: order.cantidadEstimada,
        fechaTentativaCosecha: order.fechaTentativaCosecha,
        fechaEntregaEstimada: order.fechaEntregaEstimada,
        laboratorio: order.laboratorio
      }));
    } catch (error) {
      this.logger.error('Error getting pending orders for harvest definition:', error);
      throw error;
    }
  }

  async getApprovedForLogistics() {
    try {
      const harvests = await this.prisma.harvest.findMany({
        where: {
          estado: EstadoCosecha.APROBADO
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true,
              logistica: true
            }
          },
          assignedUser: true
        },
        orderBy: { fechaDefinitiva: 'asc' }
      });

      return harvests.map(harvest => this.formatHarvestResponse(harvest));
    } catch (error) {
      this.logger.error('Error getting approved harvests for logistics:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          assignedUser: true
        }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada');
      }

      return this.formatHarvestResponse(harvest);
    } catch (error) {
      this.logger.error('Error finding harvest definition:', error);
      throw error;
    }
  }

  async findByOrderId(orderId: number) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          assignedUser: true
        }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada para este pedido');
      }

      return this.formatHarvestResponse(harvest);
    } catch (error) {
      this.logger.error('Error finding harvest definition by order:', error);
      throw error;
    }
  }

  async defineHarvest(id: number, defineHarvestDto: DefineHarvestDto, files?: Array<Express.Multer.File>) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada');
      }

      if (harvest.estado !== EstadoCosecha.PENDIENTE) {
        throw new BadRequestException('Solo se puede definir cosecha pendiente');
      }

      // Procesar evidencias de definición
      const evidenciasDefinicion = files ? await this.saveFiles(files, harvest.orderId, 'definicion') : [];

      const updatedHarvest = await this.prisma.$transaction(async (prisma) => {
        // Actualizar definición de cosecha
        const harvestUpdated = await prisma.harvest.update({
          where: { id },
          data: {
            cantidadFinal: defineHarvestDto.cantidadFinal,
            fechaDefinitiva: defineHarvestDto.fechaDefinitiva,
            calidadEsperada: defineHarvestDto.calidadEsperada,
            condicionesCosecha: defineHarvestDto.condicionesCosecha,
            temperaturaOptima: defineHarvestDto.temperaturaOptima,
            tiempoMaximoTransporte: defineHarvestDto.tiempoMaximoTransporte,
            requerimientosEspeciales: defineHarvestDto.requerimientosEspeciales,
            estado: EstadoCosecha.DEFINIDO,
            fechaDefinicion: new Date(),
            evidenciasDefinicion,
            observaciones: defineHarvestDto.observaciones || harvest.observaciones,
            updatedAt: new Date()
          },
          include: {
            order: {
              include: {
                provider: true,
                packager: true,
                laboratorio: true
              }
            },
            assignedUser: true
          }
        });

        // Actualizar cantidad y fecha definitiva en el pedido
        await prisma.order.update({
          where: { id: harvest.orderId },
          data: {
            cantidadFinal: defineHarvestDto.cantidadFinal,
            fechaDefinitivaCosecha: defineHarvestDto.fechaDefinitiva,
            estado: EstadoPedido.COSECHA_DEFINIDA
          }
        });

        return harvestUpdated;
      });

      // Registrar evento
      await this.logEvent(harvest.orderId, harvest.assignedUserId, 'cosecha_definida', 'Cosecha definida con cantidad y fecha final', defineHarvestDto);

      return this.formatHarvestResponse(updatedHarvest);
    } catch (error) {
      this.logger.error('Error defining harvest:', error);
      throw error;
    }
  }

  async approve(id: number, observaciones?: string) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada');
      }

      if (harvest.estado !== EstadoCosecha.DEFINIDO) {
        throw new BadRequestException('Solo se puede aprobar cosecha definida');
      }

      const updatedHarvest = await this.prisma.$transaction(async (prisma) => {
        // Actualizar estado de cosecha
        const harvestUpdated = await prisma.harvest.update({
          where: { id },
          data: {
            estado: EstadoCosecha.APROBADO,
            fechaAprobacion: new Date(),
            observaciones: observaciones || harvest.observaciones,
            updatedAt: new Date()
          },
          include: {
            order: {
              include: {
                provider: true,
                packager: true,
                laboratorio: true
              }
            },
            assignedUser: true
          }
        });

        // Actualizar estado del pedido
        await prisma.order.update({
          where: { id: harvest.orderId },
          data: { estado: EstadoPedido.COSECHA_APROBADA }
        });

        return harvestUpdated;
      });

      // Registrar evento
      await this.logEvent(harvest.orderId, harvest.assignedUserId, 'cosecha_aprobada', 'Definición de cosecha aprobada', { observaciones });

      return this.formatHarvestResponse(updatedHarvest);
    } catch (error) {
      this.logger.error('Error approving harvest:', error);
      throw error;
    }
  }

  async reject(id: number, motivo: string, observaciones?: string) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada');
      }

      if (harvest.estado !== EstadoCosecha.DEFINIDO) {
        throw new BadRequestException('Solo se puede rechazar cosecha definida');
      }

      const updatedHarvest = await this.prisma.$transaction(async (prisma) => {
        // Actualizar estado de cosecha
        const harvestUpdated = await prisma.harvest.update({
          where: { id },
          data: {
            estado: EstadoCosecha.RECHAZADO,
            fechaRechazo: new Date(),
            motivoRechazo: motivo,
            observaciones: observaciones || harvest.observaciones,
            updatedAt: new Date()
          },
          include: {
            order: {
              include: {
                provider: true,
                packager: true,
                laboratorio: true
              }
            },
            assignedUser: true
          }
        });

        // Actualizar estado del pedido
        await prisma.order.update({
          where: { id: harvest.orderId },
          data: { estado: EstadoPedido.COSECHA_RECHAZADA }
        });

        return harvestUpdated;
      });

      // Registrar evento
      await this.logEvent(harvest.orderId, harvest.assignedUserId, 'cosecha_rechazada', 'Definición de cosecha rechazada', { motivo, observaciones });

      return this.formatHarvestResponse(updatedHarvest);
    } catch (error) {
      this.logger.error('Error rejecting harvest:', error);
      throw error;
    }
  }

  async addEvidence(id: number, data: { descripcion?: string }, files: Array<Express.Multer.File>) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada');
      }

      // Guardar nuevas evidencias
      const newEvidence = await this.saveFiles(files, harvest.orderId, 'evidencia');

      const updatedHarvest = await this.prisma.harvest.update({
        where: { id },
        data: {
          evidenciasIniciales: [...(harvest.evidenciasIniciales as string[] || []), ...newEvidence],
          updatedAt: new Date()
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          assignedUser: true
        }
      });

      // Registrar evento
      await this.logEvent(harvest.orderId, harvest.assignedUserId, 'evidencia_agregada', 'Evidencia adicional agregada', { descripcion: data.descripcion, archivos: newEvidence.length });

      return this.formatHarvestResponse(updatedHarvest);
    } catch (error) {
      this.logger.error('Error adding evidence:', error);
      throw error;
    }
  }

  async getStatistics(filters: { dateFrom?: string; dateTo?: string }) {
    try {
      const where: any = {};

      if (filters.dateFrom && filters.dateTo) {
        where.fechaAsignacion = {
          gte: new Date(filters.dateFrom),
          lte: new Date(filters.dateTo)
        };
      }

      const [total, pendientes, definidos, aprobados, rechazados] = await Promise.all([
        this.prisma.harvest.count({ where }),
        this.prisma.harvest.count({ where: { ...where, estado: EstadoCosecha.PENDIENTE } }),
        this.prisma.harvest.count({ where: { ...where, estado: EstadoCosecha.DEFINIDO } }),
        this.prisma.harvest.count({ where: { ...where, estado: EstadoCosecha.APROBADO } }),
        this.prisma.harvest.count({ where: { ...where, estado: EstadoCosecha.RECHAZADO } })
      ]);

      return {
        total,
        pendientes,
        definidos,
        aprobados,
        rechazados,
        tasaAprobacion: (definidos + aprobados) > 0 ? (aprobados / (definidos + aprobados)) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error getting harvest statistics:', error);
      throw error;
    }
  }

  async update(id: number, updateHarvestDto: UpdateHarvestDto, files?: Array<Express.Multer.File>) {
    try {
      const harvest = await this.prisma.harvest.findUnique({
        where: { id }
      });

      if (!harvest) {
        throw new NotFoundException('Definición de cosecha no encontrada');
      }

      let updateData = { ...updateHarvestDto };

      // Procesar nuevos archivos si los hay
      if (files && files.length > 0) {
        const newFiles = await this.saveFiles(files, harvest.orderId, 'update');
        // Actualizar directamente en la base de datos, no a través del DTO
        await this.prisma.harvest.update({
          where: { id },
          data: {
            evidenciasIniciales: [...(harvest.evidenciasIniciales as string[] || []), ...newFiles]
          }
        });
      }

      const updatedHarvest = await this.prisma.harvest.update({
        where: { id },
        data: updateData,
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          assignedUser: true
        }
      });

      return this.formatHarvestResponse(updatedHarvest);
    } catch (error) {
      this.logger.error('Error updating harvest definition:', error);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.harvest.delete({
        where: { id }
      });

      return { message: 'Definición de cosecha eliminada exitosamente' };
    } catch (error) {
      this.logger.error('Error removing harvest definition:', error);
      throw error;
    }
  }

  private async saveFiles(files: Array<Express.Multer.File>, orderId: number, tipo: string): Promise<string[]> {
    const savedFiles: string[] = [];
    
    for (const file of files) {
      try {
        const uploadDir = path.join('uploads', 'harvest', orderId.toString(), tipo);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filename = `${Date.now()}-${file.originalname}`;
        const filepath = path.join(uploadDir, filename);
        
        fs.writeFileSync(filepath, file.buffer);
        savedFiles.push(filepath);
      } catch (error) {
        this.logger.error('Error saving file:', error);
      }
    }
    
    return savedFiles;
  }

  private async logEvent(orderId: number, userId: number | null, accion: string, descripcion: string, datosNuevos?: any) {
    try {
      if (userId) {
        await this.prisma.eventLog.create({
          data: {
            orderId,
            userId,
            accion,
            descripcion,
            datosNuevos
          }
        });
      }
    } catch (error) {
      this.logger.error('Error logging event:', error);
    }
  }

  private formatHarvestResponse(harvest: any) {
    return {
      id: harvest.id,
      orderId: harvest.orderId,
      assignedUserId: harvest.assignedUserId,
      estado: harvest.estado,
      fechaAsignacion: harvest.fechaAsignacion,
      fechaDefinicion: harvest.fechaDefinicion,
      fechaAprobacion: harvest.fechaAprobacion,
      fechaRechazo: harvest.fechaRechazo,
      cantidadEstimada: harvest.cantidadEstimada,
      cantidadFinal: harvest.cantidadFinal,
      fechaEstimada: harvest.fechaEstimada,
      fechaDefinitiva: harvest.fechaDefinitiva,
      calidadEsperada: harvest.calidadEsperada,
      condicionesCosecha: harvest.condicionesCosecha,
      temperaturaOptima: harvest.temperaturaOptima,
      tiempoMaximoTransporte: harvest.tiempoMaximoTransporte,
      requerimientosEspeciales: harvest.requerimientosEspeciales,
      evidenciasIniciales: harvest.evidenciasIniciales,
      evidenciasDefinicion: harvest.evidenciasDefinicion,
      observaciones: harvest.observaciones,
      motivoRechazo: harvest.motivoRechazo,
      createdAt: harvest.createdAt,
      updatedAt: harvest.updatedAt,
      order: harvest.order ? {
        id: harvest.order.id,
        codigo: harvest.order.codigo,
        estado: harvest.order.estado,
        cantidadPedida: harvest.order.cantidadPedida,
        cantidadFinal: harvest.order.cantidadFinal,
        fechaEntregaEstimada: harvest.order.fechaEntregaEstimada,
        fechaDefinitivaCosecha: harvest.order.fechaDefinitivaCosecha,
        provider: harvest.order.provider,
        packager: harvest.order.packager,
        laboratorio: harvest.order.laboratorio
      } : null,
      assignedUser: harvest.assignedUser ? {
        id: harvest.assignedUser.id,
        name: harvest.assignedUser.name,
        email: harvest.assignedUser.email
      } : null
    };
  }
}