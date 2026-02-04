import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateLogisticsDto, 
  UpdateLogisticsDto, 
  LogisticsFilterDto,
  AssignVehicleDto,
  UpdateRouteDto
} from './dto/logistics.dto';
import { EstadoLogistica, EstadoPedido } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createLogisticsDto: CreateLogisticsDto, assignedUserId: number, files?: Array<Express.Multer.File>) {
    try {
      // Verificar que el pedido existe y está aprobado por laboratorio
      const order = await this.prisma.order.findUnique({
        where: { id: createLogisticsDto.orderId },
        include: { 
          logistica: true,
          laboratorio: true,
          provider: true
        }
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      if (!order.laboratorio || order.laboratorio.estado !== 'APROBADO') {
        throw new BadRequestException('El pedido debe estar aprobado por laboratorio antes de asignar logística');
      }

      if (order.logistica) {
        throw new BadRequestException('El pedido ya tiene logística asignada');
      }

      // Procesar evidencias iniciales
      const evidenciasCarga = files ? await this.saveFiles(files, createLogisticsDto.orderId, 'carga') : [];

      // Crear registro de logística
      const logistics = await this.prisma.logistics.create({
        data: {
          orderId: createLogisticsDto.orderId,
          assignedUserId,
          estado: createLogisticsDto.estado || EstadoLogistica.PENDIENTE,
          fechaAsignacion: new Date(),
          vehiculoAsignado: createLogisticsDto.vehiculoAsignado,
          choferAsignado: createLogisticsDto.choferAsignado,
          recursosUtilizados: createLogisticsDto.recursosUtilizados,
          ubicacionOrigen: createLogisticsDto.ubicacionOrigen || order.provider.location,
          ubicacionDestino: createLogisticsDto.ubicacionDestino,
          rutaPlanificada: createLogisticsDto.rutaPlanificada,
          origenLat: createLogisticsDto.origenLat,
          origenLng: createLogisticsDto.origenLng,
          destinoLat: createLogisticsDto.destinoLat,
          destinoLng: createLogisticsDto.destinoLng,
          evidenciasCarga,
          observaciones: createLogisticsDto.observaciones,
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
        where: { id: createLogisticsDto.orderId },
        data: { estado: EstadoPedido.LOGISTICA_ASIGNADA }
      });

      // Registrar evento
      await this.logEvent(createLogisticsDto.orderId, assignedUserId, 'logistica_asignada', 'Logística asignada al pedido', logistics);

      return this.formatLogisticsResponse(logistics);
    } catch (error) {
      this.logger.error('Error creating logistics:', error);
      throw error;
    }
  }

  async findAll(filters: LogisticsFilterDto) {
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
          { vehiculoAsignado: { contains: filters.search, mode: 'insensitive' } },
          { choferAsignado: { contains: filters.search, mode: 'insensitive' } },
          { ubicacionOrigen: { contains: filters.search, mode: 'insensitive' } },
          { ubicacionDestino: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const [logistics, total] = await Promise.all([
        this.prisma.logistics.findMany({
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
        this.prisma.logistics.count({ where })
      ]);

      return {
        data: logistics.map(log => this.formatLogisticsResponse(log)),
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error finding logistics:', error);
      throw error;
    }
  }

  async getApprovedOrdersForLogistics() {
    try {
      // Primer intento: con fecha de cosecha definida
      let orders = await this.prisma.order.findMany({
        where: {
          AND: [
            { estado: EstadoPedido.LABORATORIO_APROBADO },
            { logistica: { is: null } },
            { fechaDefinitivaCosecha: { not: null } }
          ]
        },
        include: {
          provider: true,
          packager: true,
          laboratorio: true
        },
        orderBy: { fechaDefinitivaCosecha: 'asc' }
      });

      // Si no hay resultados, relajar la condición de fechaDefinitivaCosecha
      if (orders.length === 0) {
        orders = await this.prisma.order.findMany({
          where: {
            AND: [
              { estado: EstadoPedido.LABORATORIO_APROBADO },
              { logistica: { is: null } }
            ]
          },
          include: {
            provider: true,
            packager: true,
            laboratorio: true
          },
          orderBy: { id: 'desc' }
        });
      }

      return orders.map(order => ({
        id: order.id,
        codigo: order.codigo,
        provider: order.provider,
        packager: order.packager,
        fechaDefinitivaCosecha: order.fechaDefinitivaCosecha,
        cantidadFinal: order.cantidadFinal,
        laboratorio: order.laboratorio
      }));
    } catch (error) {
      this.logger.error('Error getting approved orders for logistics:', error);
      throw error;
    }
  }

  async getActiveRoutes() {
    try {
      const activeLogistics = await this.prisma.logistics.findMany({
        where: {
          estado: { in: [EstadoLogistica.ASIGNADO, EstadoLogistica.EN_RUTA] }
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          assignedUser: true
        },
        orderBy: { fechaAsignacion: 'asc' }
      });

      return activeLogistics.map(log => this.formatLogisticsResponse(log));
    } catch (error) {
      this.logger.error('Error getting active routes:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
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

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      return this.formatLogisticsResponse(logistics);
    } catch (error) {
      this.logger.error('Error finding logistics:', error);
      throw error;
    }
  }

  async findByOrderId(orderId: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
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

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado para este pedido');
      }

      return this.formatLogisticsResponse(logistics);
    } catch (error) {
      this.logger.error('Error finding logistics by order:', error);
      throw error;
    }
  }

  async assignVehicle(id: number, assignVehicleDto: AssignVehicleDto) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      if (logistics.estado !== EstadoLogistica.PENDIENTE) {
        throw new BadRequestException('Solo se puede asignar vehículo a logística pendiente');
      }

      const updatedLogistics = await this.prisma.logistics.update({
        where: { id },
        data: {
          vehiculoAsignado: assignVehicleDto.vehiculoAsignado,
          choferAsignado: assignVehicleDto.choferAsignado,
          recursosUtilizados: assignVehicleDto.recursosUtilizados,
          estado: EstadoLogistica.ASIGNADO,
          observaciones: assignVehicleDto.observaciones || logistics.observaciones,
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
      await this.prisma.order.update({
        where: { id: logistics.orderId },
        data: { estado: EstadoPedido.LOGISTICA_ASIGNADA }
      });

      // Registrar evento
      await this.logEvent(logistics.orderId, logistics.assignedUserId, 'vehiculo_asignado', 'Vehículo asignado a logística', assignVehicleDto);

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error assigning vehicle:', error);
      throw error;
    }
  }

  async startRoute(id: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      if (logistics.estado !== EstadoLogistica.ASIGNADO) {
        throw new BadRequestException('Solo se puede iniciar ruta de logística asignada');
      }

      const updatedLogistics = await this.prisma.logistics.update({
        where: { id },
        data: {
          estado: EstadoLogistica.EN_RUTA,
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
          assignedUser: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: logistics.orderId },
        data: { estado: EstadoPedido.EN_TRANSPORTE }
      });

      // Registrar evento
      await this.logEvent(logistics.orderId, logistics.assignedUserId, 'ruta_iniciada', 'Ruta de logística iniciada', {});

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error starting route:', error);
      throw error;
    }
  }

  async completeRoute(id: number, updateRouteDto: UpdateRouteDto, files?: Array<Express.Multer.File>) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      if (logistics.estado !== EstadoLogistica.EN_RUTA) {
        throw new BadRequestException('Solo se puede completar una ruta en tránsito');
      }

      // Procesar evidencias de transporte
      const evidenciasTransporte = files ? await this.saveFiles(files, logistics.orderId, 'transporte') : [];

      const updatedLogistics = await this.prisma.logistics.update({
        where: { id },
        data: {
          estado: EstadoLogistica.COMPLETADO,
          fechaFinalizacion: new Date(),
          evidenciasTransporte: [...logistics.evidenciasTransporte, ...evidenciasTransporte],
          incidentes: updateRouteDto.incidentes,
          observaciones: updateRouteDto.observaciones || logistics.observaciones,
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
      await this.prisma.order.update({
        where: { id: logistics.orderId },
        data: { estado: EstadoPedido.ENTREGADO }
      });

      // Registrar evento
      await this.logEvent(logistics.orderId, logistics.assignedUserId, 'ruta_completada', 'Ruta de logística completada', updateRouteDto);

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error completing route:', error);
      throw error;
    }
  }

  async addEvidence(id: number, data: { tipo: string; descripcion?: string }, files: Array<Express.Multer.File>) {
    try {
      console.log('addEvidence received:', { tipo: data.tipo, descripcion: data.descripcion, filesCount: files?.length || 0 }); // Debug log

      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      // Guardar nuevas evidencias
      const newEvidence = await this.saveFiles(files, logistics.orderId, data.tipo);

      // Actualizar el campo correspondiente según el tipo
      let updateData: any = { updatedAt: new Date() };

      console.log('Evidence type check:', { receivedTipo: data.tipo, isCarga: data.tipo === 'carga' }); // Debug log

      if (data.tipo === 'carga') {
        updateData.evidenciasCarga = [...logistics.evidenciasCarga, ...newEvidence];
      } else if (data.tipo === 'transporte' || data.tipo === 'condiciones' || data.tipo === 'GENERAL') {
        updateData.evidenciasTransporte = [...logistics.evidenciasTransporte, ...newEvidence];
      } else {
        // Para cualquier otro tipo, guardarlo en evidenciasTransporte
        updateData.evidenciasTransporte = [...logistics.evidenciasTransporte, ...newEvidence];
      }

      const updatedLogistics = await this.prisma.logistics.update({
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

      // Registrar evento
      await this.logEvent(logistics.orderId, logistics.assignedUserId, 'evidencia_agregada', `Evidencia agregada: ${data.tipo}`, { tipo: data.tipo, descripcion: data.descripcion, archivos: newEvidence.length });

      return this.formatLogisticsResponse(updatedLogistics);
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

      const [total, pendientes, asignados, enRuta, completados] = await Promise.all([
        this.prisma.logistics.count({ where }),
        this.prisma.logistics.count({ where: { ...where, estado: EstadoLogistica.PENDIENTE } }),
        this.prisma.logistics.count({ where: { ...where, estado: EstadoLogistica.ASIGNADO } }),
        this.prisma.logistics.count({ where: { ...where, estado: EstadoLogistica.EN_RUTA } }),
        this.prisma.logistics.count({ where: { ...where, estado: EstadoLogistica.COMPLETADO } })
      ]);

      return {
        total,
        pendientes,
        asignados,
        enRuta,
        completados,
        tasaCompletacion: total > 0 ? (completados / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error getting statistics:', error);
      throw error;
    }
  }

  async update(id: number, updateLogisticsDto: UpdateLogisticsDto, files?: Array<Express.Multer.File>) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      let updateData = { ...updateLogisticsDto };

      // Procesar nuevos archivos si los hay
      if (files && files.length > 0) {
        const newFiles = await this.saveFiles(files, logistics.orderId, 'update');
        // Actualizar directamente en la base de datos, no a través del DTO
        await this.prisma.logistics.update({
          where: { id },
          data: {
            evidenciasCarga: [...logistics.evidenciasCarga, ...newFiles]
          }
        });
      }

      const updatedLogistics = await this.prisma.logistics.update({
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

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error updating logistics:', error);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.logistics.delete({
        where: { id }
      });

      return { message: 'Registro de logística eliminado exitosamente' };
    } catch (error) {
      this.logger.error('Error removing logistics:', error);
      throw error;
    }
  }

  async startTracking(id: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      if (logistics.estado !== EstadoLogistica.EN_RUTA) {
        throw new BadRequestException('Solo se puede activar el seguimiento cuando la ruta está en progreso');
      }

      const updatedLogistics = await this.prisma.logistics.update({
        where: { id },
        data: {
          trackingActivo: true,
          ultimaActualizacion: new Date()
        },
        include: {
          order: {
            include: {
              provider: true
            }
          },
          assignedUser: true
        }
      });

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error starting tracking:', error);
      throw error;
    }
  }

  async stopTracking(id: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      const updatedLogistics = await this.prisma.logistics.update({
        where: { id },
        data: {
          trackingActivo: false
        },
        include: {
          order: {
            include: {
              provider: true
            }
          },
          assignedUser: true
        }
      });

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error stopping tracking:', error);
      throw error;
    }
  }

  async updateLocation(id: number, lat: number, lng: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      if (!logistics.trackingActivo) {
        throw new BadRequestException('El seguimiento no está activo');
      }

      // Actualizar historial de ubicaciones
      const historial = (logistics.historialUbicaciones as any) || [];
      const newEntry = {
        lat,
        lng,
        timestamp: Date.now()
      };
      historial.push(newEntry);

      const updatedLogistics = await this.prisma.logistics.update({
        where: { id },
        data: {
          ubicacionActualLat: lat,
          ubicacionActualLng: lng,
          ultimaActualizacion: new Date(),
          historialUbicaciones: historial
        },
        include: {
          order: {
            include: {
              provider: true
            }
          },
          assignedUser: true
        }
      });

      // Log del evento
      await this.logEvent(logistics.orderId, logistics.assignedUserId || 0, 'ubicacion_actualizada', 'Ubicación actualizada en seguimiento', { lat, lng });

      return this.formatLogisticsResponse(updatedLogistics);
    } catch (error) {
      this.logger.error('Error updating location:', error);
      throw error;
    }
  }

  async getTrackingData(id: number) {
    try {
      const logistics = await this.prisma.logistics.findUnique({
        where: { id }
      });

      if (!logistics) {
        throw new NotFoundException('Registro de logística no encontrado');
      }

      return {
        trackingActivo: logistics.trackingActivo,
        ubicacionActual: logistics.ubicacionActualLat && logistics.ubicacionActualLng
          ? { lat: logistics.ubicacionActualLat, lng: logistics.ubicacionActualLng }
          : null,
        ultimaActualizacion: logistics.ultimaActualizacion,
        historial: (logistics.historialUbicaciones as any) || []
      };
    } catch (error) {
      this.logger.error('Error getting tracking data:', error);
      throw error;
    }
  }

  private async saveFiles(files: Array<Express.Multer.File>, orderId: number, tipo: string): Promise<string[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const savedFiles: string[] = [];
    
    for (const file of files) {
      try {
        // Usar ruta absoluta desde el directorio del proyecto
        const uploadDir = path.join(process.cwd(), 'uploads', 'logistics', orderId.toString());
        
        // Crear directorio si no existe
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
          this.logger.log(`Created directory: ${uploadDir}`);
        }
        
        // Generar nombre único para el archivo
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000000);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${timestamp}-${random}-${sanitizedName}`;
        const filepath = path.join(uploadDir, filename);
        
        // Guardar el archivo
        fs.writeFileSync(filepath, file.buffer);
        savedFiles.push(filename);
        
        this.logger.log(`File saved successfully: ${filepath}`);
        
        // Verificar que el archivo se guardó correctamente
        if (!fs.existsSync(filepath)) {
          throw new Error(`File was not saved: ${filepath}`);
        }
        
      } catch (error) {
        this.logger.error(`Error saving file ${file.originalname}:`, error);
        throw error; // Propagar el error para que el usuario sepa que falló
      }
    }
    
    return savedFiles;
  }

  async downloadFile(id: number, filename: string, res: any) {
    try {
      // Obtener el pedido asociado a esta logística
      const logistics = await this.prisma.logistics.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!logistics) {
        throw new NotFoundException('Logística no encontrada');
      }

      // Validar que el filename es seguro (prevenir directory traversal)
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new BadRequestException('Nombre de archivo inválido');
      }

      // Construir la ruta del archivo
      const filePath = path.join(
        process.cwd(),
        'uploads',
        'logistics',
        logistics.orderId.toString(),
        filename
      );

      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Archivo no encontrado');
      }

      // Enviar el archivo
      res.download(filePath, filename);
    } catch (error) {
      this.logger.error('Error downloading file:', error);
      throw error;
    }
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

  private formatLogisticsResponse(logistics: any) {
    return {
      id: logistics.id,
      orderId: logistics.orderId,
      assignedUserId: logistics.assignedUserId,
      estado: logistics.estado,
      fechaAsignacion: logistics.fechaAsignacion,
      fechaInicio: logistics.fechaInicio,
      fechaFinalizacion: logistics.fechaFinalizacion,
      vehiculoAsignado: logistics.vehiculoAsignado,
      choferAsignado: logistics.choferAsignado,
      recursosUtilizados: logistics.recursosUtilizados,
      ubicacionOrigen: logistics.ubicacionOrigen,
      ubicacionDestino: logistics.ubicacionDestino,
      rutaPlanificada: logistics.rutaPlanificada,
      origenLat: logistics.origenLat,
      origenLng: logistics.origenLng,
      destinoLat: logistics.destinoLat,
      destinoLng: logistics.destinoLng,
      trackingActivo: logistics.trackingActivo,
      ubicacionActualLat: logistics.ubicacionActualLat,
      ubicacionActualLng: logistics.ubicacionActualLng,
      ultimaActualizacion: logistics.ultimaActualizacion,
      historialUbicaciones: logistics.historialUbicaciones,
      evidenciasCarga: logistics.evidenciasCarga,
      evidenciasTransporte: logistics.evidenciasTransporte,
      observaciones: logistics.observaciones,
      incidentes: logistics.incidentes,
      createdAt: logistics.createdAt,
      updatedAt: logistics.updatedAt,
      order: logistics.order ? {
        id: logistics.order.id,
        codigo: logistics.order.codigo,
        estado: logistics.order.estado,
        cantidadFinal: logistics.order.cantidadFinal,
        fechaDefinitivaCosecha: logistics.order.fechaDefinitivaCosecha,
        provider: logistics.order.provider,
        packager: logistics.order.packager,
        laboratorio: logistics.order.laboratorio
      } : null,
      assignedUser: logistics.assignedUser ? {
        id: logistics.assignedUser.id,
        name: logistics.assignedUser.name,
        email: logistics.assignedUser.email
      } : null
    };
  }
}