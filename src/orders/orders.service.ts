import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceEstimationsService } from '../price-estimations/price-estimations.service';
import { AIService } from '../ai/ai.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderFilterDto } from './dto/order-filter.dto';
import { Order, Prisma, EstadoPedido, EstadoCosecha } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private priceEstimationsService: PriceEstimationsService,
    private aiService: AIService,
  ) { }

  /**
   * Genera un código único para el pedido
   */
  private async generateOrderCode(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `ORD-${currentYear}`;

    // Buscar el último número del año actual
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        codigo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        codigo: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastOrder) {
      const lastNumber = parseInt(lastOrder.codigo.split('-')[2]) || 0;
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Crear un nuevo pedido
   */
  async create(createOrderDto: CreateOrderDto, createdById: number): Promise<Order> {
    if (!createdById) {
      throw new BadRequestException('El ID del usuario creador es requerido');
    }

    // Validar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id: createdById },
    });

    if (!user) {
      throw new NotFoundException('Usuario creador no encontrado');
    }

    // Validar que el proveedor existe
    const provider = await this.prisma.provider.findUnique({
      where: { id: createOrderDto.providerId },
    });

    if (!provider) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    // Validar empacadora si se especifica
    if (createOrderDto.packagerId) {
      const packager = await this.prisma.packager.findUnique({
        where: { id: createOrderDto.packagerId },
      });

      if (!packager) {
        throw new NotFoundException('Empacadora no encontrada');
      }
    }

    // Generar código único
    const codigo = await this.generateOrderCode();

    // Preparar datos para crear el pedido
    const orderData: Prisma.OrderCreateInput = {
      codigo,
      cantidadEstimada: createOrderDto.cantidadEstimada,
      cantidadPedida: createOrderDto.cantidadEstimada, // Inicialmente igual a la estimada
      fechaTentativaCosecha: createOrderDto.fechaTentativaCosecha
        ? new Date(createOrderDto.fechaTentativaCosecha)
        : undefined,
      precioEstimadoCompra: createOrderDto.precioEstimadoCompra,
      // precioEstimadoVenta: createOrderDto.precioEstimadoVenta, // Se elimina, se actualizará luego
      condicionesIniciales: createOrderDto.condicionesIniciales,
      observaciones: createOrderDto.observaciones,
      provider: {
        connect: { id: createOrderDto.providerId },
      },
      createdBy: {
        connect: { id: createdById },
      },
    };

    // Conectar presentationType si se proporciona
    if (createOrderDto.presentationTypeId) {
      orderData.presentationType = {
        connect: { id: createOrderDto.presentationTypeId },
      };
    }

    // Conectar shrimpSize si se proporciona
    if (createOrderDto.shrimpSizeId) {
      orderData.shrimpSize = {
        connect: { id: createOrderDto.shrimpSizeId },
      };
    }

    if (createOrderDto.packagerId) {
      orderData.packager = {
        connect: { id: createOrderDto.packagerId },
      };
    }

    const order = await this.prisma.order.create({
      data: orderData,
      include: {
        provider: true,
        packager: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Iniciar estimación automática de precios de forma asíncrona EN SEGUNDO PLANO
    // No usamos await para no bloquear la respuesta al usuario
    this.processAIPredictionAsync(
      order.id,
      order.providerId,
      order.packagerId || undefined,
      order.cantidadEstimada,
      createdById,
      createOrderDto.presentationTypeId,
      createOrderDto.shrimpSizeId
    ).catch(err => {
      console.error(`Error en el proceso asíncrono de predicción IA para la orden ${order.id}:`, err);
    });

    // Registrar evento de creación inicial (el precio de venta se actualizará luego)
    await this.prisma.eventLog.create({
      data: {
        orderId: order.id,
        userId: createdById,
        accion: 'pedido_creado',
        descripcion: `Pedido ${order.codigo} creado (predicción IA iniciada en segundo plano)`,
        datosNuevos: {
          cantidadEstimada: order.cantidadEstimada,
          proveedor: provider.name,
          precioEstimadoCompra: order.precioEstimadoCompra,
          precioEstimadoVenta: order.precioEstimadoVenta,
        },
      },
    });

    return order;
  }

  /**
   * Proceso asíncrono en segundo plano para obtener o generar la predicción de IA
   */
  private async processAIPredictionAsync(
    orderId: number,
    providerId: number,
    packagerId: number | undefined,
    cantidadEstimada: number,
    userId: number,
    presentationTypeId?: number,
    shrimpSizeId?: number
  ) {
    try {
      console.log(`[IA Async] Iniciando predicción para orden ${orderId}...`);

      let paramsParaIA = {
        tipoProducto: 'U15', // valor por defecto
        presentacion: 'HEADLESS' // valor por defecto
      };

      // Obtener detalles de talla y presentación para mejor predicción
      if (shrimpSizeId) {
        const size = await this.prisma.shrimpSize.findUnique({ where: { id: shrimpSizeId } });
        if (size) paramsParaIA.tipoProducto = size.code;
      }

      if (presentationTypeId) {
        const pres = await this.prisma.presentationType.findUnique({ where: { id: presentationTypeId } });
        if (pres) {
          const presCodeUpper = pres.code.toUpperCase();
          if (presCodeUpper === 'HL' || presCodeUpper === 'HEADLESS') {
            paramsParaIA.presentacion = 'HEADLESS';
          } else if (presCodeUpper === 'ENTERO' || presCodeUpper === 'HOSO' || presCodeUpper === 'WHOLE') {
            paramsParaIA.presentacion = 'WHOLE';
          } else {
            paramsParaIA.presentacion = pres.code;
          }
        }
      }

      // 1. Obtener la fecha actual normalizada a medianoche UTC (como se guarda en PrediccionesIA)
      const targetDate = new Date();
      // Zona horaria de Ecuador es UTC-5. Usaremos la fecha actual del sistema.
      const targetDateMidnight = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate()
      ));

      // 2. Buscar si ya existe una predicción en la base de datos (con la misma talla, presentación y fecha)
      let priceVenta: number | null = null;
      let usedExisting = false;

      // Importante: El ai.service mapPresentationToName convierte 'HEADLESS' a 'Sin Cabeza'
      const mappedPresentation = this.mapPresentationToNameLocal(paramsParaIA.presentacion);

      const existingPrediction = await this.prisma.prediccionesIA.findFirst({
        where: {
          tipoProducto: mappedPresentation,
          calibre: paramsParaIA.tipoProducto,
          fechaPrediccion: {
            gte: targetDateMidnight,
            lt: new Date(targetDateMidnight.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { fechaCreacion: 'desc' }
      });

      if (existingPrediction) {
        console.log(`[IA Async] Reutilizando predicción existente ID: ${existingPrediction.id} para orden ${orderId}`);
        priceVenta = existingPrediction.precioPredicho;
        usedExisting = true;
      } else {
        console.log(`[IA Async] No existe predicción. Consultando microservicio para orden ${orderId}...`);

        // 3. Consultar microservicio porque no existe
        const diasAhead = Math.max(1, Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
        const prediccionResult = await this.aiService.predictDespachoPrice({
          calibre: paramsParaIA.tipoProducto,
          presentacion: paramsParaIA.presentacion,
          dias: diasAhead,
        });

        // 4. Guardar predicción en la base de datos para futuros pedidos de hoy
        // Simulamos un predictionResponse compatible
        await this.prisma.prediccionesIA.create({
          data: {
            modeloId: 1, // Fallback
            fechaPrediccion: targetDateMidnight,
            tipoProducto: mappedPresentation,
            calibre: paramsParaIA.tipoProducto,
            precioPredicho: prediccionResult.precio_despacho_predicho_usd_lb,
            intervaloConfianza: {
              min: prediccionResult.intervalo_confianza_despacho.minimo,
              max: prediccionResult.intervalo_confianza_despacho.maximo,
              confianza: prediccionResult.confianza_porcentaje / 100
            },
            factoresInfluyentes: prediccionResult.correlacion || {}
          }
        });

        priceVenta = prediccionResult.precio_despacho_predicho_usd_lb;
      }

      // 5. Actualizar la orden con el precio estimado de venta
      if (priceVenta !== null) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            precioEstimadoVenta: priceVenta
          }
        });

        const origenData = usedExisting ? 'caché BD local' : 'microservicio IA';
        console.log(`[IA Async] Orden ${orderId} actualizada exitosamente con precio estimado venta: ${priceVenta} (Origen: ${origenData})`);

        // Registrar evento de actualización
        await this.prisma.eventLog.create({
          data: {
            orderId: orderId,
            userId: userId,
            accion: 'prediccion_ia_completada',
            descripcion: `Precio estimado de venta actualizado a ${priceVenta} vía IA en segundo plano`,
            datosNuevos: {
              precioEstimadoVenta: priceVenta,
              origenPrediccion: origenData
            }
          }
        });
      }

    } catch (error) {
      console.error(`[IA Async] Error procesando predicción para la orden ${orderId}:`, error);
      // Falla silenciosa para el usuario
    }
  }

  private mapPresentationToNameLocal(presentation: string | undefined): string {
    switch (presentation?.toUpperCase()) {
      case 'HEADLESS':
        return 'Sin Cabeza';
      case 'WHOLE':
        return 'Entero con Cabeza';
      case 'LIVE':
        return 'Vivo';
      default:
        return presentation || 'Camarón';
    }
  }

  /**
   * Determinar la temporada actual basada en la fecha
   */
  private getCurrentSeason(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Estaciones en Ecuador (aproximadas)
    if (month >= 11 || month <= 3) {
      return 'verano'; // Diciembre-Abril (temporada seca)
    } else {
      return 'invierno'; // Mayo-Noviembre (temporada lluviosa)
    }
  }

  /**
   * Generar estimación de precios para un pedido existente
   */
  async generatePriceEstimation(orderId: number) {
    const order = await this.findOne(orderId);

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    try {
      const estimacion = await this.priceEstimationsService.createEstimation({
        orderId: order.id,
        providerId: order.providerId,
        packagerId: order.packagerId || undefined,
        cantidad: order.cantidadEstimada,
        temporada: this.getCurrentSeason(),
      });

      // Actualizar el pedido con los nuevos precios estimados
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          precioEstimadoCompra: estimacion.precioEstimadoCompra,
          precioEstimadoVenta: estimacion.precioEstimadoVenta,
        },
      });

      return estimacion;
    } catch (error) {
      throw new BadRequestException(`Error generando estimación: ${error.message}`);
    }
  }

  /**
   * Obtener todos los pedidos con filtros
   */
  async findAll(filters: OrderFilterDto) {
    const { page = 1, limit = 10, includeRelations = false, ...filterData } = filters;
    const skip = (page - 1) * limit;

    // Construir condiciones de filtro
    const where: Prisma.OrderWhereInput = {};

    if (filterData.providerId) {
      where.providerId = filterData.providerId;
    }

    if (filterData.packagerId) {
      where.packagerId = filterData.packagerId;
    }

    if (filterData.estado) {
      where.estado = filterData.estado;
    }

    if (filterData.fechaDesde || filterData.fechaHasta) {
      where.fechaCreacion = {};
      if (filterData.fechaDesde) {
        where.fechaCreacion.gte = new Date(filterData.fechaDesde);
      }
      if (filterData.fechaHasta) {
        where.fechaCreacion.lte = new Date(filterData.fechaHasta);
      }
    }

    // Filtrar órdenes sin recepción
    if (filterData.withoutReception) {
      where.recepcion = {
        is: null
      };
      // También filtrar por estado APROBADO para recepción
      if (!filterData.estado) {
        where.estado = EstadoPedido.APROBADO;
      }
    }

    // Configurar includes según si se necesitan relaciones
    const include = includeRelations ? {
      provider: true,
      packager: true,
      presentationType: true,
      shrimpSize: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      laboratorio: true,
      logistica: true,
      custodia: true,
      recepcion: true,
      facturas: true,
    } : {
      provider: { select: { id: true, name: true } },
      packager: { select: { id: true, name: true } },
      presentationType: { select: { id: true, code: true, name: true } },
      shrimpSize: { select: { id: true, code: true, displayLabel: true } },
      createdBy: { select: { id: true, name: true } },
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fechaCreacion: 'desc' },
        include,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener un pedido por ID
   */
  async findOne(id: number): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        provider: true,
        packager: true,
        presentationType: true,
        shrimpSize: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        laboratorio: {
          include: {
            analista: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        logistica: {
          include: {
            assignedUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        custodia: {
          include: {
            assignedUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        recepcion: true,
        facturas: true,
        eventLog: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        notificaciones: true,
        estimaciones: {
          include: {
            formula: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return order;
  }

  /**
   * Actualizar un pedido
   */
  async update(id: number, updateOrderDto: UpdateOrderDto, userId: number): Promise<Order> {
    const existingOrder = await this.findOne(id);

    const approvedHarvest = await this.prisma.harvest.findUnique({
      where: { orderId: id },
      select: { estado: true },
    });

    // Validaciones según el estado actual
    if (existingOrder.estado === EstadoPedido.COSECHA_APROBADA || approvedHarvest?.estado === EstadoCosecha.APROBADO) {
      throw new BadRequestException('No se puede modificar un pedido con cosecha aprobada');
    }

    if (existingOrder.estado === EstadoPedido.FINALIZADO) {
      throw new BadRequestException('No se puede modificar un pedido finalizado');
    }

    if (existingOrder.estado === EstadoPedido.FACTURADO && updateOrderDto.estado !== EstadoPedido.FINALIZADO) {
      throw new BadRequestException('Solo se puede finalizar un pedido facturado');
    }

    const updateData = {
      ...updateOrderDto,
      fechaTentativaCosecha: updateOrderDto.fechaTentativaCosecha === undefined
        ? undefined
        : updateOrderDto.fechaTentativaCosecha
          ? new Date(updateOrderDto.fechaTentativaCosecha)
          : null,
      fechaDefinitivaCosecha: updateOrderDto.fechaDefinitivaCosecha === undefined
        ? undefined
        : updateOrderDto.fechaDefinitivaCosecha
          ? new Date(updateOrderDto.fechaDefinitivaCosecha)
          : null,
    };

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        provider: true,
        packager: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Registrar evento de actualización
    await this.prisma.eventLog.create({
      data: {
        orderId: id,
        userId,
        accion: 'pedido_actualizado',
        descripcion: `Pedido ${updatedOrder.codigo} actualizado`,
        datosNuevos: updateOrderDto as any,
      },
    });

    return updatedOrder;
  }

  /**
   * Eliminar un pedido (soft delete cambiando estado a DESCARTADO)
   */
  async remove(id: number, userId: number): Promise<{ message: string }> {
    const order = await this.findOne(id);

    if (order.estado === EstadoPedido.FINALIZADO || order.estado === EstadoPedido.FACTURADO) {
      throw new BadRequestException('No se puede eliminar un pedido finalizado o facturado');
    }

    await this.prisma.order.update({
      where: { id },
      data: { estado: EstadoPedido.DESCARTADO },
    });

    // Registrar evento
    await this.prisma.eventLog.create({
      data: {
        orderId: id,
        userId,
        accion: 'pedido_descartado',
        descripcion: `Pedido ${order.codigo} descartado`,
        datosNuevos: { motivoDescarte: 'Eliminado por usuario' },
      },
    });

    return { message: 'Pedido marcado como descartado exitosamente' };
  }

  /**
   * Cambiar estado de un pedido
   */
  async changeStatus(id: number, newStatus: EstadoPedido, userId: number): Promise<Order> {
    const order = await this.findOne(id);

    // Validaciones de transición de estados
    const validTransitions = this.getValidTransitions(order.estado);

    if (!validTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `No es posible cambiar de ${order.estado} a ${newStatus}`
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: { estado: newStatus },
      include: {
        provider: true,
        packager: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Registrar evento
    await this.prisma.eventLog.create({
      data: {
        orderId: id,
        userId,
        accion: 'cambio_estado',
        descripcion: `Estado cambiado de ${order.estado} a ${newStatus}`,
        datosAnteriores: { estado: order.estado },
        datosNuevos: { estado: newStatus },
      },
    });

    return updatedOrder;
  }

  /**
   * Obtener transiciones válidas para un estado
   */
  private getValidTransitions(currentStatus: EstadoPedido): EstadoPedido[] {
    const transitions: Record<EstadoPedido, EstadoPedido[]> = {
      [EstadoPedido.CREADO]: [EstadoPedido.EN_ANALISIS, EstadoPedido.RECHAZADO, EstadoPedido.DESCARTADO, EstadoPedido.CANCELADO],
      [EstadoPedido.EN_ANALISIS]: [EstadoPedido.APROBADO, EstadoPedido.RECHAZADO, EstadoPedido.EN_REEVALUACION, EstadoPedido.LABORATORIO_APROBADO],
      [EstadoPedido.APROBADO]: [EstadoPedido.EN_COSECHA, EstadoPedido.RECHAZADO, EstadoPedido.LABORATORIO_APROBADO],
      [EstadoPedido.RECHAZADO]: [EstadoPedido.EN_REEVALUACION, EstadoPedido.DESCARTADO, EstadoPedido.LABORATORIO_RECHAZADO],
      [EstadoPedido.EN_REEVALUACION]: [EstadoPedido.APROBADO, EstadoPedido.RECHAZADO, EstadoPedido.LABORATORIO_REEVALUACION],
      [EstadoPedido.DESCARTADO]: [], // Estado final
      [EstadoPedido.LABORATORIO_APROBADO]: [EstadoPedido.DEFINIENDO_COSECHA, EstadoPedido.LABORATORIO_RECHAZADO],
      [EstadoPedido.LABORATORIO_RECHAZADO]: [EstadoPedido.LABORATORIO_REEVALUACION, EstadoPedido.DESCARTADO],
      [EstadoPedido.LABORATORIO_REEVALUACION]: [EstadoPedido.LABORATORIO_APROBADO, EstadoPedido.LABORATORIO_RECHAZADO],
      [EstadoPedido.DEFINIENDO_COSECHA]: [EstadoPedido.COSECHA_DEFINIDA, EstadoPedido.COSECHA_RECHAZADA],
      [EstadoPedido.COSECHA_DEFINIDA]: [EstadoPedido.COSECHA_APROBADA, EstadoPedido.COSECHA_RECHAZADA],
      [EstadoPedido.COSECHA_APROBADA]: [EstadoPedido.LOGISTICA_ASIGNADA],
      [EstadoPedido.COSECHA_RECHAZADA]: [EstadoPedido.DEFINIENDO_COSECHA, EstadoPedido.DESCARTADO],
      [EstadoPedido.LOGISTICA_ASIGNADA]: [EstadoPedido.EN_TRANSPORTE],
      [EstadoPedido.EN_TRANSPORTE]: [EstadoPedido.CUSTODIA_ASIGNADA, EstadoPedido.ENTREGADO],
      [EstadoPedido.CUSTODIA_ASIGNADA]: [EstadoPedido.EN_CUSTODIA],
      [EstadoPedido.EN_CUSTODIA]: [EstadoPedido.CUSTODIA_COMPLETADA],
      [EstadoPedido.CUSTODIA_COMPLETADA]: [EstadoPedido.ENTREGADO],
      [EstadoPedido.ENTREGADO]: [EstadoPedido.RECIBIDO],
      [EstadoPedido.EN_COSECHA]: [EstadoPedido.EN_TRANSITO],
      [EstadoPedido.EN_TRANSITO]: [EstadoPedido.RECIBIDO],
      [EstadoPedido.RECIBIDO]: [EstadoPedido.FACTURADO],
      [EstadoPedido.FACTURADO]: [EstadoPedido.FINALIZADO],
      [EstadoPedido.FINALIZADO]: [], // Estado final
      [EstadoPedido.CANCELADO]: [], // Estado final
    };

    return transitions[currentStatus] || [];
  }

  /**
   * Obtener estadísticas de pedidos
   */
  async getStatistics() {
    const [
      totalOrders,
      ordersByStatus,
      recentOrders,
      avgOrderValue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.groupBy({
        by: ['estado'],
        _count: true,
      }),
      this.prisma.order.count({
        where: {
          fechaCreacion: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 días
          },
        },
      }),
      this.prisma.order.aggregate({
        _avg: {
          precioEstimadoCompra: true,
          precioRealCompra: true,
        },
      }),
    ]);

    return {
      total: totalOrders,
      byStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.estado] = item._count;
        return acc;
      }, {}),
      recent: recentOrders,
      averageValues: avgOrderValue,
    };
  }

  /**
   * Obtener fechas disponibles para filtros de calendario
   */
  async getAvailableDates(): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      select: {
        fechaCreacion: true,
        fechaTentativaCosecha: true,
        fechaDefinitivaCosecha: true,
      },
    });

    const dates = new Set<string>();

    orders.forEach(order => {
      // Agregar fecha de creación
      if (order.fechaCreacion) {
        dates.add(order.fechaCreacion.toISOString().split('T')[0]);
      }

      // Agregar fecha tentativa de cosecha
      if (order.fechaTentativaCosecha) {
        dates.add(order.fechaTentativaCosecha.toISOString().split('T')[0]);
      }

      // Agregar fecha definitiva de cosecha
      if (order.fechaDefinitivaCosecha) {
        dates.add(order.fechaDefinitivaCosecha.toISOString().split('T')[0]);
      }
    });

    return Array.from(dates).sort();
  }

  async getUsedProviders(): Promise<any[]> {
    const providers = await this.prisma.order.findMany({
      select: {
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      distinct: ['providerId'],
      orderBy: {
        provider: {
          name: 'asc',
        },
      },
    });

    return providers.map(order => order.provider);
  }

  async getUsedStatuses(): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      select: {
        estado: true,
      },
      distinct: ['estado'],
    });

    return orders.map(order => order.estado).sort();
  }
}