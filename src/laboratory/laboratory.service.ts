import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateLaboratoryDto, 
  UpdateLaboratoryDto, 
  LaboratoryFilterDto,
  ReevaluationDto 
} from './dto/laboratory.dto';
import { EstadoLaboratorio, EstadoPedido } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class LaboratoryService {
  private readonly logger = new Logger(LaboratoryService.name);

  constructor(private prisma: PrismaService) {}

  async create(createLaboratoryDto: CreateLaboratoryDto, analistaId: number, files?: Array<Express.Multer.File>) {
    try {
      // Verificar que el pedido existe y está en estado adecuado
      const order = await this.prisma.order.findUnique({
        where: { id: createLaboratoryDto.orderId },
        include: { laboratorio: true }
      });

      if (!order) {
        throw new NotFoundException('Pedido no encontrado');
      }

      if (order.laboratorio) {
        throw new BadRequestException('El pedido ya tiene un análisis de laboratorio');
      }

      // Procesar archivos adjuntos
      const archivosAdjuntos = files ? await this.saveFiles(files, createLaboratoryDto.orderId) : [];

      // Crear el análisis de laboratorio
      const laboratory = await this.prisma.laboratory.create({
        data: {
          orderId: createLaboratoryDto.orderId,
          analistaId: analistaId,
          estado: createLaboratoryDto.estado || EstadoLaboratorio.PENDIENTE,
          resultadoGeneral: createLaboratoryDto.resultadoGeneral,
          parametrosQuimicos: createLaboratoryDto.parametrosQuimicos,
          observaciones: createLaboratoryDto.observaciones,
          motivoRechazo: createLaboratoryDto.motivoRechazo,
          archivosAdjuntos,
          olor: createLaboratoryDto.olor,
          sabor: createLaboratoryDto.sabor,
          textura: createLaboratoryDto.textura,
          apariencia: createLaboratoryDto.apariencia,
        },
        include: {
          order: true,
          analista: true
        }
      });

      // Si el análisis inicia pendiente, reflejar el pedido en estado EN_ANALISIS
      if ((createLaboratoryDto.estado || EstadoLaboratorio.PENDIENTE) === EstadoLaboratorio.PENDIENTE) {
        await this.prisma.order.update({
          where: { id: createLaboratoryDto.orderId },
          data: { estado: EstadoPedido.EN_ANALISIS }
        });
      }

      // Actualizar estado del pedido si es necesario
      if (createLaboratoryDto.estado === EstadoLaboratorio.APROBADO) {
        await this.prisma.order.update({
          where: { id: createLaboratoryDto.orderId },
          data: { estado: EstadoPedido.LABORATORIO_APROBADO }
        });
      } else if (createLaboratoryDto.estado === EstadoLaboratorio.RECHAZADO) {
        await this.prisma.order.update({
          where: { id: createLaboratoryDto.orderId },
          data: { estado: EstadoPedido.LABORATORIO_RECHAZADO }
        });
      }

      // Registrar evento
      await this.logEvent(createLaboratoryDto.orderId, analistaId, 'laboratorio_creado', 'Análisis de laboratorio creado', laboratory);

      return this.formatLaboratoryResponse(laboratory);
    } catch (error) {
      this.logger.error('Error creating laboratory analysis:', error);
      throw error;
    }
  }

  async findAll(filters: LaboratoryFilterDto) {
    try {
      const where: any = {};

      if (filters.estado) {
        where.estado = filters.estado;
      }

      if (filters.analistaId) {
        where.analistaId = filters.analistaId;
      }

      if (filters.fechaDesde && filters.fechaHasta) {
        where.fechaAnalisis = {
          gte: new Date(filters.fechaDesde),
          lte: new Date(filters.fechaHasta)
        };
      }

      if (filters.search) {
        where.OR = [
          { order: { codigo: { contains: filters.search, mode: 'insensitive' } } },
          { resultadoGeneral: { contains: filters.search, mode: 'insensitive' } },
          { observaciones: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const [laboratories, total] = await Promise.all([
        this.prisma.laboratory.findMany({
          where,
          include: {
            order: {
              include: {
                provider: true,
                packager: true
              }
            },
            analista: true
          },
          orderBy: { fechaAnalisis: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.laboratory.count({ where })
      ]);

      return {
        data: laboratories.map(lab => this.formatLaboratoryResponse(lab)),
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error finding laboratory analyses:', error);
      throw error;
    }
  }

  async findOne(id: number) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado');
      }

      return this.formatLaboratoryResponse(laboratory);
    } catch (error) {
      this.logger.error('Error finding laboratory analysis:', error);
      throw error;
    }
  }

  async findByOrderId(orderId: number) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado para este pedido');
      }

      return this.formatLaboratoryResponse(laboratory);
    } catch (error) {
      this.logger.error('Error finding laboratory analysis by order:', error);
      throw error;
    }
  }

  async getPendingAnalysis() {
    try {
      const laboratories = await this.prisma.laboratory.findMany({
        where: { 
          estado: { in: [EstadoLaboratorio.PENDIENTE, EstadoLaboratorio.EN_REEVALUACION] }
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        },
        orderBy: { fechaAnalisis: 'asc' }
      });

      return laboratories.map(lab => this.formatLaboratoryResponse(lab));
    } catch (error) {
      this.logger.error('Error getting pending analyses:', error);
      throw error;
    }
  }

  async approve(id: number, observaciones?: string) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado');
      }

      if (laboratory.estado === EstadoLaboratorio.APROBADO) {
        throw new BadRequestException('El análisis ya está aprobado');
      }

      // Validar que tenga archivos adjuntos
      if (!laboratory.archivosAdjuntos || laboratory.archivosAdjuntos.length === 0) {
        throw new BadRequestException('Debe adjuntar al menos un archivo antes de aprobar el análisis');
      }

      // Actualizar análisis de laboratorio
      const updatedLaboratory = await this.prisma.laboratory.update({
        where: { id },
        data: {
          estado: EstadoLaboratorio.APROBADO,
          observaciones: observaciones || laboratory.observaciones,
          updatedAt: new Date()
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: laboratory.orderId },
        data: { estado: EstadoPedido.LABORATORIO_APROBADO }
      });

      // Registrar evento
      await this.logEvent(laboratory.orderId, laboratory.analistaId, 'laboratorio_aprobado', 'Análisis de laboratorio aprobado', { observaciones });

      return this.formatLaboratoryResponse(updatedLaboratory);
    } catch (error) {
      this.logger.error('Error approving laboratory analysis:', error);
      throw error;
    }
  }

  async reject(id: number, motivoRechazo: string, observaciones?: string) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado');
      }

      if (laboratory.estado === EstadoLaboratorio.RECHAZADO) {
        throw new BadRequestException('El análisis ya está rechazado');
      }

      // Validar que tenga archivos adjuntos
      if (!laboratory.archivosAdjuntos || laboratory.archivosAdjuntos.length === 0) {
        throw new BadRequestException('Debe adjuntar al menos un archivo antes de rechazar el análisis');
      }

      // Actualizar análisis de laboratorio
      const updatedLaboratory = await this.prisma.laboratory.update({
        where: { id },
        data: {
          estado: EstadoLaboratorio.RECHAZADO,
          motivoRechazo,
          observaciones: observaciones || laboratory.observaciones,
          updatedAt: new Date()
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: laboratory.orderId },
        data: { estado: EstadoPedido.LABORATORIO_RECHAZADO }
      });

      // Registrar evento
      await this.logEvent(laboratory.orderId, laboratory.analistaId, 'laboratorio_rechazado', 'Análisis de laboratorio rechazado', { motivoRechazo, observaciones });

      return this.formatLaboratoryResponse(updatedLaboratory);
    } catch (error) {
      this.logger.error('Error rejecting laboratory analysis:', error);
      throw error;
    }
  }

  async requestReevaluation(id: number, reevaluationDto: ReevaluationDto, files?: Array<Express.Multer.File>) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado');
      }

      if (laboratory.estado !== EstadoLaboratorio.RECHAZADO) {
        throw new BadRequestException('Solo se puede solicitar reevaluación de análisis rechazados');
      }

      // Verificar que han pasado al menos 7 días
      const daysSinceRejection = Math.floor((new Date().getTime() - laboratory.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceRejection < 7) {
        throw new BadRequestException(`Debe esperar al menos 7 días para solicitar reevaluación. Faltan ${7 - daysSinceRejection} días.`);
      }

      // Procesar nuevos archivos
      const newFiles = files ? await this.saveFiles(files, laboratory.orderId) : [];
      const allFiles = [...laboratory.archivosAdjuntos, ...newFiles];

      // Actualizar análisis
      const updatedLaboratory = await this.prisma.laboratory.update({
        where: { id },
        data: {
          estado: EstadoLaboratorio.EN_REEVALUACION,
          fechaReevaluacion: new Date(),
          observaciones: reevaluationDto.nuevasObservaciones || laboratory.observaciones,
          parametrosQuimicos: reevaluationDto.nuevosParametros || laboratory.parametrosQuimicos,
          archivosAdjuntos: allFiles,
          updatedAt: new Date()
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        }
      });

      // Actualizar estado del pedido
      await this.prisma.order.update({
        where: { id: laboratory.orderId },
        data: { estado: EstadoPedido.LABORATORIO_REEVALUACION }
      });

      // Registrar evento
      await this.logEvent(laboratory.orderId, laboratory.analistaId, 'laboratorio_reevaluacion', 'Solicitada reevaluación de laboratorio', reevaluationDto);

      return this.formatLaboratoryResponse(updatedLaboratory);
    } catch (error) {
      this.logger.error('Error requesting reevaluation:', error);
      throw error;
    }
  }

  async discardOrder(id: number, justificacion: string) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado');
      }

      // Actualizar estado del pedido a cancelado
      await this.prisma.order.update({
        where: { id: laboratory.orderId },
        data: { 
          estado: EstadoPedido.CANCELADO,
          observaciones: `${laboratory.order.observaciones || ''}\n\nDescartado por laboratorio: ${justificacion}`
        }
      });

      // Registrar evento
      await this.logEvent(laboratory.orderId, laboratory.analistaId, 'pedido_descartado', 'Pedido descartado por laboratorio', { justificacion });

      return { message: 'Pedido descartado exitosamente', justificacion };
    } catch (error) {
      this.logger.error('Error discarding order:', error);
      throw error;
    }
  }

  async getStatistics(filters: { dateFrom?: string; dateTo?: string }) {
    try {
      const where: any = {};

      if (filters.dateFrom && filters.dateTo) {
        where.fechaAnalisis = {
          gte: new Date(filters.dateFrom),
          lte: new Date(filters.dateTo)
        };
      }

      const [total, pendientes, aprobados, rechazados, enReevaluacion] = await Promise.all([
        this.prisma.laboratory.count({ where }),
        this.prisma.laboratory.count({ where: { ...where, estado: EstadoLaboratorio.PENDIENTE } }),
        this.prisma.laboratory.count({ where: { ...where, estado: EstadoLaboratorio.APROBADO } }),
        this.prisma.laboratory.count({ where: { ...where, estado: EstadoLaboratorio.RECHAZADO } }),
        this.prisma.laboratory.count({ where: { ...where, estado: EstadoLaboratorio.EN_REEVALUACION } })
      ]);

      return {
        total,
        pendientes,
        aprobados,
        rechazados,
        enReevaluacion,
        tasaAprobacion: total > 0 ? (aprobados / total) * 100 : 0,
        tasaRechazo: total > 0 ? (rechazados / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error getting statistics:', error);
      throw error;
    }
  }

  async update(id: number, updateDto: any, userId: number, files?: Array<Express.Multer.File>) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id },
        include: { order: true }
      });

      if (!laboratory) {
        throw new NotFoundException('Análisis de laboratorio no encontrado');
      }

      // No permitir editar si ya está aprobado o rechazado
      if (laboratory.estado === EstadoLaboratorio.APROBADO || laboratory.estado === EstadoLaboratorio.RECHAZADO) {
        throw new BadRequestException('No se puede editar un análisis aprobado o rechazado');
      }

      // Procesar nuevos archivos si se proporcionan
      let allFiles = laboratory.archivosAdjuntos || [];
      if (files && files.length > 0) {
        const newFiles = await this.saveFiles(files, laboratory.orderId);
        allFiles = [...allFiles, ...newFiles];
      }

      const updatedLaboratory = await this.prisma.laboratory.update({
        where: { id },
        data: {
          ...updateDto,
          archivosAdjuntos: allFiles,
          updatedAt: new Date()
        },
        include: {
          order: {
            include: {
              provider: true,
              packager: true
            }
          },
          analista: true
        }
      });

      // Registrar evento
      await this.logEvent(laboratory.orderId, userId, 'laboratorio_editado', 'Análisis de laboratorio editado', updateDto);

      return this.formatLaboratoryResponse(updatedLaboratory);
    } catch (error) {
      this.logger.error('Error updating laboratory:', error);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.laboratory.delete({
        where: { id }
      });

      return { message: 'Análisis de laboratorio eliminado exitosamente' };
    } catch (error) {
      this.logger.error('Error removing laboratory analysis:', error);
      throw error;
    }
  }

  private async saveFiles(files: Array<Express.Multer.File>, orderId: number): Promise<string[]> {
    const savedFiles: string[] = [];
    
    for (const file of files) {
      try {
        const uploadDir = path.join('uploads', 'laboratory', orderId.toString());
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filename = `${Date.now()}-${file.originalname}`;
        const filepath = path.join(uploadDir, filename);
        
        fs.writeFileSync(filepath, file.buffer);
        // Store only the filename, not the full path
        savedFiles.push(filename);
      } catch (error) {
        this.logger.error('Error saving file:', error);
      }
    }
    
    return savedFiles;
  }

  async addFiles(laboratoryId: number, files: Array<Express.Multer.File>) {
    try {
      const laboratory = await this.prisma.laboratory.findUnique({
        where: { id: laboratoryId }
      });

      if (!laboratory) {
        throw new NotFoundException('Laboratorio no encontrado');
      }

      const newFiles = files ? await this.saveFiles(files, laboratory.orderId) : [];
      const allFiles = [...(laboratory.archivosAdjuntos || []), ...newFiles];
      
      const updatedLaboratory = await this.prisma.laboratory.update({
        where: { id: laboratoryId },
        data: {
          archivosAdjuntos: allFiles
        },
        include: {
          order: true,
          analista: true
        }
      });

      // Log de evento de agregar archivos
      await this.logEvent(laboratory.orderId, laboratory.analistaId, 'archivos_agregados', `${newFiles.length} archivo(s) agregado(s) al informe`, { archivos: newFiles.map(f => path.basename(f)) });

      return this.formatLaboratoryResponse(updatedLaboratory);
    } catch (error) {
      this.logger.error('Error adding files to laboratory:', error);
      throw error;
    }
  }

  async downloadFile(laboratoryId: number, filename: string, res: any) {
    const laboratory = await this.prisma.laboratory.findUnique({
      where: { id: laboratoryId }
    });

    if (!laboratory) {
      throw new NotFoundException('Laboratorio no encontrado');
    }

    const orderId = laboratory.orderId;
    const filePath = path.join(process.cwd(), 'uploads', 'laboratory', orderId.toString(), filename);
    
    // Security check: ensure the file path doesn't escape the uploads directory
    const uploadDir = path.join(process.cwd(), 'uploads', 'laboratory', orderId.toString());
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(uploadDir)) {
      throw new BadRequestException('Invalid file path');
    }
    
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Archivo no encontrado');
    }
    
    return res.download(filePath);
  }

  private async logEvent(orderId: number, userId: number, accion: string, descripcion: string, datosNuevos?: any) {
    try {
      await this.prisma.eventLog.create({
        data: {
          orderId,
          userId,
          accion,
          descripcion,
          datosNuevos
        }
      });
    } catch (error) {
      this.logger.error('Error logging event:', error);
    }
  }

  private formatLaboratoryResponse(laboratory: any) {
    return {
      id: laboratory.id,
      orderId: laboratory.orderId,
      analistaId: laboratory.analistaId,
      estado: laboratory.estado,
      fechaAnalisis: laboratory.fechaAnalisis,
      fechaReevaluacion: laboratory.fechaReevaluacion,
      resultadoGeneral: laboratory.resultadoGeneral,
      parametrosQuimicos: laboratory.parametrosQuimicos,
      observaciones: laboratory.observaciones,
      motivoRechazo: laboratory.motivoRechazo,
      archivosAdjuntos: laboratory.archivosAdjuntos,
      olor: laboratory.olor,
      sabor: laboratory.sabor,
      textura: laboratory.textura,
      apariencia: laboratory.apariencia,
      createdAt: laboratory.createdAt,
      updatedAt: laboratory.updatedAt,
      order: laboratory.order ? {
        id: laboratory.order.id,
        codigo: laboratory.order.codigo,
        estado: laboratory.order.estado,
        provider: laboratory.order.provider,
        packager: laboratory.order.packager
      } : null,
      analista: laboratory.analista ? {
        id: laboratory.analista.id,
        name: laboratory.analista.name,
        email: laboratory.analista.email
      } : null
    };
  }
}