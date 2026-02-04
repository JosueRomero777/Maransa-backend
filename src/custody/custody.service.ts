import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateCustodyDto, 
  UpdateCustodyDto, 
  CustodyFilterDto,
  AssignPersonnelDto,
  AddIncidentDto
} from './dto/custody.dto';
import { EstadoCustodia, EstadoPedido, EstadoLogistica } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CustodyService {
  private readonly logger = new Logger(CustodyService.name);

  constructor(private prisma: PrismaService) {}

  async create(createCustodyDto: CreateCustodyDto, assignedUserId: number, files?: Array<Express.Multer.File>) {
    try {
      // Verificar que el pedido existe y tiene logística asignada
      const order = await this.prisma.order.findUnique({
        where: { id: createCustodyDto.orderId },
        include: { 
          custodia: true,
          logistica: true,
          provider: true
        }
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      if (!order.logistica) {
        throw new BadRequestException('El pedido debe tener logística asignada antes de asignar custodia');
      }

      if (order.logistica.estado !== EstadoLogistica.ASIGNADO && order.logistica.estado !== EstadoLogistica.EN_RUTA) {
        throw new BadRequestException('La logística debe estar asignada o en ruta para asignar custodia');
      }

      if (order.custodia) {
        throw new BadRequestException('El pedido ya tiene custodia asignada');
      }

      // Verificar que el registro de logística existe
      const logistics = await this.prisma.logistics.findUnique({
        where: { id: createCustodyDto.logisticsId }
      });

      if (!logistics || logistics.orderId !== createCustodyDto.orderId) {
        throw new BadRequestException('Registro de logística no válido para este pedido');
      }

      // Procesar evidencias iniciales
      const evidenciasIniciales = files ? await this.saveFiles(files, createCustodyDto.orderId, 'inicial') : [];

      // Determinar estado inicial basado en si hay personal asignado
      const personalArray = createCustodyDto.personalAsignado && Array.isArray(createCustodyDto.personalAsignado)
        ? createCustodyDto.personalAsignado.filter(p => p && p.trim().length > 0)
        : [];
      const estadoInicial = personalArray.length > 0 ? EstadoCustodia.ASIGNADO : EstadoCustodia.PENDIENTE;

      // Crear registro de custodia
      const custody = await this.prisma.custody.create({
        data: {
          orderId: createCustodyDto.orderId,
          logisticsId: createCustodyDto.logisticsId,
          assignedUserId,
          estado: createCustodyDto.estado || estadoInicial,
          fechaAsignacion: new Date(),
          personalAsignado: personalArray,
          vehiculoCustodia: createCustodyDto.vehiculoCustodia,
          rutaCustodia: createCustodyDto.rutaCustodia,
          evidenciasIniciales,
          observaciones: createCustodyDto.observaciones,
          incidentes: []
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
          logistics: true,
          assignedUser: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: createCustodyDto.orderId },
        data: { estado: EstadoPedido.CUSTODIA_ASIGNADA }
      });

      // Registrar evento
      await this.logEvent(createCustodyDto.orderId, assignedUserId, 'custodia_asignada', 'Custodia asignada al pedido', custody);

      return this.formatCustodyResponse(custody);
    } catch (error) {
      this.logger.error('Error creating custody:', error);
      throw error;
    }
  }

  async findAll(filters: CustodyFilterDto) {
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
          { vehiculoCustodia: { contains: filters.search, mode: 'insensitive' } },
          { personalAsignado: { has: filters.search } },
          { rutaCustodia: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const [custody, total] = await Promise.all([
        this.prisma.custody.findMany({
          where,
          include: {
            order: {
              include: {
                provider: true,
                packager: true,
                laboratorio: true,
                logistica: true
              }
            },
            logistics: true,
            assignedUser: true
          },
          orderBy: { fechaAsignacion: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.custody.count({ where })
      ]);

      return {
        data: custody.map(cust => this.formatCustodyResponse(cust)),
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error finding custody records:', error);
      throw error;
    }
  }

  async getOrdersForCustody() {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          estado: {
            in: [
              EstadoPedido.LOGISTICA_ASIGNADA,
              EstadoPedido.EN_TRANSPORTE,
              EstadoPedido.COSECHA_APROBADA,
              EstadoPedido.EN_CUSTODIA
            ]
          },
          custodia: null,
          logistica: {
            AND: [
              { vehiculoAsignado: { not: null } },
              { choferAsignado: { not: null } }
            ]
          }
        },
        include: {
          provider: true,
          packager: true,
          laboratorio: true,
          logistica: true
        },
        orderBy: { fechaDefinitivaCosecha: 'asc' },
        take: 50
      } as any);

      return orders.map((order: any) => ({
        id: order.id,
        codigo: order.codigo,
        provider: order.provider,
        packager: order.packager,
        fechaDefinitivaCosecha: order.fechaDefinitivaCosecha,
        cantidadFinal: order.cantidadFinal,
        estado: order.estado,
        laboratorio: order.laboratorio,
        logistica: order.logistica ? {
          id: order.logistica.id,
          vehiculoAsignado: order.logistica.vehiculoAsignado,
          choferAsignado: order.logistica.choferAsignado,
          rutaPlanificada: order.logistica.rutaPlanificada,
          ubicacionOrigen: order.logistica.ubicacionOrigen,
          ubicacionDestino: order.logistica.ubicacionDestino,
          origenLat: order.logistica.origenLat,
          origenLng: order.logistica.origenLng,
          destinoLat: order.logistica.destinoLat,
          destinoLng: order.logistica.destinoLng,
          ubicacionActualLat: order.logistica.ubicacionActualLat,
          ubicacionActualLng: order.logistica.ubicacionActualLng,
          trackingActivo: order.logistica.trackingActivo
        } : null
      }));
    } catch (error) {
      this.logger.error('Error getting orders for custody:', error);
      throw error;
    }
  }

  async getActiveRoutesWithCustody() {
    try {
      const activeCustody = await this.prisma.custody.findMany({
        where: {
          estado: { in: [EstadoCustodia.ASIGNADO, EstadoCustodia.EN_CUSTODIA] }
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          logistics: true,
          assignedUser: true
        },
        orderBy: { fechaAsignacion: 'asc' }
      });

      return activeCustody.map(cust => this.formatCustodyResponse(cust));
    } catch (error) {
      this.logger.error('Error getting active routes with custody:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          logistics: true,
          assignedUser: true
        }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      return this.formatCustodyResponse(custody);
    } catch (error) {
      this.logger.error('Error finding custody:', error);
      throw error;
    }
  }

  async findByOrderId(orderId: number) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              provider: true,
              packager: true,
              laboratorio: true
            }
          },
          logistics: true,
          assignedUser: true
        }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado para este pedido');
      }

      return this.formatCustodyResponse(custody);
    } catch (error) {
      this.logger.error('Error finding custody by order:', error);
      throw error;
    }
  }

  async assignPersonnel(id: number, assignPersonnelDto: AssignPersonnelDto) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      if (custody.estado !== EstadoCustodia.PENDIENTE) {
        throw new BadRequestException('Solo se puede asignar personal a custodia pendiente');
      }

      const updatedCustody = await this.prisma.custody.update({
        where: { id },
        data: {
          personalAsignado: assignPersonnelDto.personalAsignado,
          vehiculoCustodia: assignPersonnelDto.vehiculoCustodia,
          rutaCustodia: assignPersonnelDto.rutaCustodia,
          estado: EstadoCustodia.ASIGNADO,
          observaciones: assignPersonnelDto.observaciones || custody.observaciones,
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
          logistics: true,
          assignedUser: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: custody.orderId },
        data: { estado: EstadoPedido.CUSTODIA_ASIGNADA }
      });

      // Registrar evento
      await this.logEvent(custody.orderId, custody.assignedUserId, 'personal_asignado', 'Personal de custodia asignado', assignPersonnelDto);

      return this.formatCustodyResponse(updatedCustody);
    } catch (error) {
      this.logger.error('Error assigning personnel:', error);
      throw error;
    }
  }

  async startCustody(id: number) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      if (custody.estado !== EstadoCustodia.ASIGNADO) {
        throw new BadRequestException('Solo se puede iniciar custodia asignada');
      }

      const updatedCustody = await this.prisma.custody.update({
        where: { id },
        data: {
          estado: EstadoCustodia.EN_CUSTODIA,
          fechaInicio: new Date(),
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
          logistics: true,
          assignedUser: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: custody.orderId },
        data: { estado: EstadoPedido.EN_CUSTODIA }
      });

      // Registrar evento
      await this.logEvent(custody.orderId, custody.assignedUserId, 'custodia_iniciada', 'Custodia iniciada', {});

      return this.formatCustodyResponse(updatedCustody);
    } catch (error) {
      this.logger.error('Error starting custody:', error);
      throw error;
    }
  }

  async completeCustody(id: number, updateData: { observacionesFinales?: string }, files?: Array<Express.Multer.File>) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      if (custody.estado !== EstadoCustodia.EN_CUSTODIA) {
        throw new BadRequestException('Solo se puede completar una custodia en proceso');
      }

      // Procesar evidencias finales
      const evidenciasFinales = files ? await this.saveFiles(files, custody.orderId, 'final') : [];

      const updatedCustody = await this.prisma.custody.update({
        where: { id },
        data: {
          estado: EstadoCustodia.COMPLETADO,
          fechaFinalizacion: new Date(),
          evidenciasFinales: [
            ...(Array.isArray(custody.evidenciasFinales) ? custody.evidenciasFinales : []),
            ...evidenciasFinales
          ],
          observacionesFinales: updateData.observacionesFinales,
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
          logistics: true,
          assignedUser: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: custody.orderId },
        data: { estado: EstadoPedido.CUSTODIA_COMPLETADA }
      });

      // Registrar evento
      await this.logEvent(custody.orderId, custody.assignedUserId, 'custodia_completada', 'Custodia completada', updateData);

      return this.formatCustodyResponse(updatedCustody);
    } catch (error) {
      this.logger.error('Error completing custody:', error);
      throw error;
    }
  }

  async addIncident(id: number, addIncidentDto: AddIncidentDto, files?: Array<Express.Multer.File>) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      if (custody.estado !== EstadoCustodia.EN_CUSTODIA) {
        throw new BadRequestException('Solo se pueden reportar incidentes durante custodia activa');
      }

      // Guardar evidencias del incidente
      const evidenciasIncidente = files ? await this.saveFiles(files, custody.orderId, 'incidente') : [];

      // Crear nuevo incidente
      const newIncident = {
        id: Date.now().toString(),
        tipo: addIncidentDto.tipo,
        descripcion: addIncidentDto.descripcion,
        ubicacion: addIncidentDto.ubicacion,
        gravedad: addIncidentDto.gravedad,
        accionesTomadas: addIncidentDto.accionesTomadas,
        evidencias: evidenciasIncidente,
        fechaIncidente: new Date()
      };

      const updatedCustody = await this.prisma.custody.update({
        where: { id },
        data: {
          incidentes: [...(custody.incidentes as any[] || []), newIncident],
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
          logistics: true,
          assignedUser: true
        }
      });

      // Registrar evento
      await this.logEvent(custody.orderId, custody.assignedUserId, 'incidente_reportado', `Incidente reportado: ${addIncidentDto.tipo}`, newIncident);

      return this.formatCustodyResponse(updatedCustody);
    } catch (error) {
      this.logger.error('Error adding incident:', error);
      throw error;
    }
  }

  async addIncidentSimple(id: number, incidentData: { descripcion: string; gravedad: 'leve' | 'moderada' | 'grave'; responsable?: string }) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      if (custody.estado !== EstadoCustodia.EN_CUSTODIA) {
        throw new BadRequestException('Solo se pueden reportar incidentes durante custodia activa');
      }

      // Crear nuevo incidente simple
      const newIncident = {
        fecha: new Date().toISOString(),
        descripcion: incidentData.descripcion,
        gravedad: incidentData.gravedad,
        responsable: incidentData.responsable || 'Usuario'
      };

      const updatedCustody = await this.prisma.custody.update({
        where: { id },
        data: {
          incidentes: [...(custody.incidentes as any[] || []), newIncident],
          updatedAt: new Date()
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
          logistics: true,
          assignedUser: true
        }
      });

      // Registrar evento
      await this.logEvent(custody.orderId, custody.assignedUserId, 'incidente_reportado', `Incidente ${incidentData.gravedad}: ${incidentData.descripcion}`, newIncident);

      return this.formatCustodyResponse(updatedCustody);
    } catch (error) {
      this.logger.error('Error adding simple incident:', error);
      throw error;
    }
  }

  async addEvidence(id: number, data: { descripcion?: string }, files: Array<Express.Multer.File>) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      // Guardar nuevas evidencias
      const newEvidence = await this.saveFiles(files, custody.orderId, 'evidencia');

      const updatedCustody = await this.prisma.custody.update({
        where: { id },
        data: {
          evidenciasIniciales: [...(custody.evidenciasIniciales as string[] || []), ...newEvidence],
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
          logistics: true,
          assignedUser: true
        }
      });

      // Registrar evento
      await this.logEvent(custody.orderId, custody.assignedUserId, 'evidencia_agregada', 'Evidencia adicional agregada', { descripcion: data.descripcion, archivos: newEvidence.length });

      return this.formatCustodyResponse(updatedCustody);
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

      const [total, pendientes, asignados, enCustodia, completados, totalIncidentes] = await Promise.all([
        this.prisma.custody.count({ where }),
        this.prisma.custody.count({ where: { ...where, estado: EstadoCustodia.PENDIENTE } }),
        this.prisma.custody.count({ where: { ...where, estado: EstadoCustodia.ASIGNADO } }),
        this.prisma.custody.count({ where: { ...where, estado: EstadoCustodia.EN_CUSTODIA } }),
        this.prisma.custody.count({ where: { ...where, estado: EstadoCustodia.COMPLETADO } }),
        this.prisma.custody.findMany({
          where,
          select: { incidentes: true }
        }).then(custodies => custodies.reduce((acc, custody) => acc + (custody.incidentes as string[] || []).length, 0))
      ]);

      return {
        total,
        pendientes,
        asignados,
        enCustodia,
        completados,
        totalIncidentes,
        tasaCompletacion: total > 0 ? (completados / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error getting custody statistics:', error);
      throw error;
    }
  }

  async update(id: number, updateCustodyDto: UpdateCustodyDto, files?: Array<Express.Multer.File>) {
    try {
      const custody = await this.prisma.custody.findUnique({
        where: { id }
      });

      if (!custody) {
        throw new NotFoundException('Registro de custodia no encontrado');
      }

      let updateData = { ...updateCustodyDto };

      // Procesar nuevos archivos si los hay
      if (files && files.length > 0) {
        const newFiles = await this.saveFiles(files, custody.orderId, 'update');
        // Actualizar directamente en la base de datos, no a través del DTO
        await this.prisma.custody.update({
          where: { id },
          data: {
            evidenciasIniciales: [...(custody.evidenciasIniciales as string[] || []), ...newFiles]
          }
        });
      }

      const updatedCustody = await this.prisma.custody.update({
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
          logistics: true,
          assignedUser: true
        }
      });

      return this.formatCustodyResponse(updatedCustody);
    } catch (error) {
      this.logger.error('Error updating custody:', error);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.custody.delete({
        where: { id }
      });

      return { message: 'Registro de custodia eliminado exitosamente' };
    } catch (error) {
      this.logger.error('Error removing custody:', error);
      throw error;
    }
  }

  private async saveFiles(files: Array<Express.Multer.File>, orderId: number, tipo: string): Promise<string[]> {
    const savedFiles: string[] = [];
    
    for (const file of files) {
      try {
        const uploadDir = path.join('uploads', 'custody', orderId.toString(), tipo);
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

  private formatCustodyResponse(custody: any) {
    return {
      id: custody.id,
      orderId: custody.orderId,
      logisticsId: custody.logisticsId,
      assignedUserId: custody.assignedUserId,
      estado: custody.estado,
      fechaAsignacion: custody.fechaAsignacion,
      fechaInicio: custody.fechaInicio,
      fechaFinalizacion: custody.fechaFinalizacion,
      personalAsignado: custody.personalAsignado,
      vehiculoCustodia: custody.vehiculoCustodia,
      rutaCustodia: custody.rutaCustodia,
      evidenciasIniciales: custody.evidenciasIniciales,
      evidenciasFinales: custody.evidenciasFinales,
      incidentes: custody.incidentes,
      observaciones: custody.observaciones,
      observacionesFinales: custody.observacionesFinales,
      createdAt: custody.createdAt,
      updatedAt: custody.updatedAt,
      order: custody.order ? {
        id: custody.order.id,
        codigo: custody.order.codigo,
        estado: custody.order.estado,
        cantidadFinal: custody.order.cantidadFinal,
        fechaTentativaCosecha: custody.order.fechaTentativaCosecha,
        fechaDefinitivaCosecha: custody.order.fechaDefinitivaCosecha,
        fechaEntregaEstimada: custody.order.fechaEntregaEstimada,
        provider: custody.order.provider,
        packager: custody.order.packager,
        laboratorio: custody.order.laboratorio
      } : null,
      logistics: custody.logistics ? {
        id: custody.logistics.id,
        estado: custody.logistics.estado,
        vehiculoAsignado: custody.logistics.vehiculoAsignado,
        choferAsignado: custody.logistics.choferAsignado,
        ubicacionOrigen: custody.logistics.ubicacionOrigen,
        ubicacionDestino: custody.logistics.ubicacionDestino,
        rutaPlanificada: custody.logistics.rutaPlanificada,
        origenLat: custody.logistics.origenLat,
        origenLng: custody.logistics.origenLng,
        destinoLat: custody.logistics.destinoLat,
        destinoLng: custody.logistics.destinoLng,
        trackingActivo: custody.logistics.trackingActivo,
        ubicacionActualLat: custody.logistics.ubicacionActualLat,
        ubicacionActualLng: custody.logistics.ubicacionActualLng,
        ultimaActualizacion: custody.logistics.ultimaActualizacion,
        historialUbicaciones: custody.logistics.historialUbicaciones
      } : null,
      assignedUser: custody.assignedUser ? {
        id: custody.assignedUser.id,
        name: custody.assignedUser.name,
        email: custody.assignedUser.email
      } : null
    };
  }
}