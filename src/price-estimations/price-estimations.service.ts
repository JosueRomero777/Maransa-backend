import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimationDto } from './dto/create-estimation.dto';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { CreateMarketFactorDto } from './dto/create-market-factor.dto';

export interface EstimationResult {
  precioEstimadoCompra?: number;
  precioEstimadoVenta?: number;
  confiabilidad: number;
  margenEstimado?: number;
  factoresUsados: Record<string, any>;
  calculoDetallado: Record<string, any>;
  datosHistoricos: Record<string, any>;
}

@Injectable()
export class PriceEstimationsService {
  constructor(private prisma: PrismaService) {}

  // ===== FÓRMULAS DE ESTIMACIÓN =====
  
  async createFormula(createFormulaDto: CreateFormulaDto) {
    return this.prisma.priceFormula.create({
      data: createFormulaDto,
    });
  }

  async findAllFormulas() {
    return this.prisma.priceFormula.findMany({
      where: { activa: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneFormula(id: number) {
    const formula = await this.prisma.priceFormula.findUnique({
      where: { id },
      include: {
        estimaciones: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!formula) {
      throw new NotFoundException(`Fórmula con ID ${id} no encontrada`);
    }

    return formula;
  }

  // ===== FACTORES DE MERCADO =====
  
  async createMarketFactor(createMarketFactorDto: CreateMarketFactorDto) {
    return this.prisma.marketFactor.create({
      data: createMarketFactorDto,
    });
  }

  async findAllMarketFactors() {
    return this.prisma.marketFactor.findMany({
      where: { activo: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateMarketFactor(id: number, valor: number, fuente?: string) {
    return this.prisma.marketFactor.update({
      where: { id },
      data: {
        valor,
        fuente,
        fecha: new Date(),
      },
    });
  }

  // ===== ESTIMACIONES DE PRECIOS =====
  
  async createEstimation(createEstimationDto: CreateEstimationDto) {
    // Si no se especifica fórmula, usar la fórmula por defecto activa
    let formulaId = createEstimationDto.formulaId;
    if (!formulaId) {
      const formulaPorDefecto = await this.prisma.priceFormula.findFirst({
        where: { activa: true, tipo: 'compra' },
      });
      
      if (!formulaPorDefecto) {
        throw new BadRequestException('No hay fórmulas activas disponibles');
      }
      
      formulaId = formulaPorDefecto.id;
    }

    // Ejecutar la estimación
    const resultadoEstimacion = await this.calculateEstimation(createEstimationDto);

    return this.prisma.priceEstimation.create({
      data: {
        formulaId,
        orderId: createEstimationDto.orderId,
        providerId: createEstimationDto.providerId,
        packagerId: createEstimationDto.packagerId,
        talla: createEstimationDto.talla,
        cantidad: createEstimationDto.cantidad,
        temporada: createEstimationDto.temporada,
        fechaEstimacion: createEstimationDto.fechaEstimacion ? new Date(createEstimationDto.fechaEstimacion) : new Date(),
        ...resultadoEstimacion,
      },
      include: {
        formula: true,
        order: {
          include: {
            provider: true,
            packager: true,
          },
        },
      },
    });
  }

  async findAllEstimations(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [estimations, total] = await Promise.all([
      this.prisma.priceEstimation.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          formula: true,
          order: {
            include: {
              provider: true,
              packager: true,
            },
          },
        },
      }),
      this.prisma.priceEstimation.count(),
    ]);

    return {
      estimations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findEstimationById(id: number) {
    const estimation = await this.prisma.priceEstimation.findUnique({
      where: { id },
      include: {
        formula: true,
        order: {
          include: {
            provider: true,
            packager: true,
          },
        },
      },
    });

    if (!estimation) {
      throw new NotFoundException(`Estimación con ID ${id} no encontrada`);
    }

    return estimation;
  }

  // ===== LÓGICA DE CÁLCULO =====
  
  private async calculateEstimation(params: CreateEstimationDto): Promise<EstimationResult> {
    try {
      const datosHistoricos = await this.obtenerDatosHistoricos(params);
      const factoresMercado = await this.obtenerFactoresMercado();
      const calidadProveedor = await this.obtenerCalidadProveedor(params.providerId);

      // Algoritmo de estimación básico (promedio ponderado)
      const estimacion = await this.algoritmoPromedioPonderado({
        ...params,
        datosHistoricos,
        factoresMercado,
        calidadProveedor,
      });

      return estimacion;
    } catch (error) {
      console.error('Error en cálculo de estimación:', error);
      
      // Retornar estimación por defecto en caso de error
      return {
        precioEstimadoCompra: 0,
        precioEstimadoVenta: 0,
        confiabilidad: 0,
        margenEstimado: 0,
        factoresUsados: { error: 'Error en el cálculo' },
        calculoDetallado: { error: error.message },
        datosHistoricos: {},
      };
    }
  }

  private async obtenerDatosHistoricos(params: CreateEstimationDto) {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - 90); // Últimos 90 días

    const whereClause: any = {
      fecha: { gte: fechaLimite },
    };

    if (params.providerId) {
      whereClause.providerId = params.providerId;
    }

    if (params.talla) {
      whereClause.talla = params.talla;
    }

    return this.prisma.priceHistory.findMany({
      where: whereClause,
      orderBy: { fecha: 'desc' },
      take: 50,
    });
  }

  private async obtenerFactoresMercado() {
    return this.prisma.marketFactor.findMany({
      where: { activo: true },
    });
  }

  private async obtenerCalidadProveedor(providerId?: number) {
    if (!providerId) return null;

    let calidadProveedor = await this.prisma.providerQuality.findUnique({
      where: { providerId },
    });

    // Si no existe, crear con valores por defecto
    if (!calidadProveedor) {
      calidadProveedor = await this.prisma.providerQuality.create({
        data: { providerId },
      });
    }

    return calidadProveedor;
  }

  private async algoritmoPromedioPonderado(params: any): Promise<EstimationResult> {
    const { datosHistoricos, factoresMercado, calidadProveedor } = params;

    let precioCompraPromedio = 0;
    let precioVentaPromedio = 0;
    let confiabilidad = 50; // Base de 50%

    // Calcular promedios históricos
    if (datosHistoricos.length > 0) {
      const preciosCompra = datosHistoricos.filter(d => d.precioCompra).map(d => d.precioCompra);
      const preciosVenta = datosHistoricos.filter(d => d.precioVenta).map(d => d.precioVenta);

      if (preciosCompra.length > 0) {
        precioCompraPromedio = preciosCompra.reduce((a, b) => a + b, 0) / preciosCompra.length;
        confiabilidad += 20; // +20% por tener datos históricos
      }

      if (preciosVenta.length > 0) {
        precioVentaPromedio = preciosVenta.reduce((a, b) => a + b, 0) / preciosVenta.length;
        confiabilidad += 10;
      }
    }

    // Ajustes por factores de mercado
    let ajusteMercado = 1.0;
    factoresMercado.forEach(factor => {
      if (factor.categoria === 'economico') {
        ajusteMercado *= (1 + (factor.valor / 100) * factor.peso);
      }
    });

    // Ajustes por calidad del proveedor
    let ajusteCalidad = 1.0;
    if (calidadProveedor) {
      ajusteCalidad = calidadProveedor.factorPrecio || 1.0;
      confiabilidad += calidadProveedor.tasaAprobacion * 0.2; // Hasta +20% por calidad
    }

    // Aplicar ajustes
    const precioEstimadoCompra = precioCompraPromedio * ajusteMercado * ajusteCalidad;
    const precioEstimadoVenta = precioVentaPromedio * ajusteMercado;
    const margenEstimado = precioEstimadoVenta > 0 ? 
      ((precioEstimadoVenta - precioEstimadoCompra) / precioEstimadoVenta) * 100 : 0;

    return {
      precioEstimadoCompra: Math.round(precioEstimadoCompra * 100) / 100,
      precioEstimadoVenta: Math.round(precioEstimadoVenta * 100) / 100,
      confiabilidad: Math.min(Math.round(confiabilidad), 100),
      margenEstimado: Math.round(margenEstimado * 100) / 100,
      factoresUsados: {
        datosHistoricos: datosHistoricos.length,
        factoresMercado: factoresMercado.length,
        calidadProveedor: calidadProveedor ? 'incluida' : 'no disponible',
        ajusteMercado,
        ajusteCalidad,
      },
      calculoDetallado: {
        precioCompraBase: precioCompraPromedio,
        precioVentaBase: precioVentaPromedio,
        ajustePorMercado: ((ajusteMercado - 1) * 100).toFixed(2) + '%',
        ajustePorCalidad: ((ajusteCalidad - 1) * 100).toFixed(2) + '%',
      },
      datosHistoricos: {
        registros: datosHistoricos.length,
        periodoAnalizado: '90 días',
        ultimaActualizacion: new Date().toISOString(),
      },
    };
  }

  // ===== ANÁLISIS Y REPORTES =====
  
  async getEstimationAccuracy() {
    const estimaciones = await this.prisma.priceEstimation.findMany({
      where: {
        AND: [
          { precioRealCompra: { not: null } },
          { precioEstimadoCompra: { not: null } },
        ],
      },
    });

    if (estimaciones.length === 0) {
      return {
        precision: 0,
        desviacionPromedio: 0,
        totalEstimaciones: 0,
      };
    }

    const desviaciones = estimaciones.map(est => {
      if (!est.precioRealCompra || !est.precioEstimadoCompra) return 0;
      const desv = Math.abs((est.precioRealCompra - est.precioEstimadoCompra) / est.precioRealCompra) * 100;
      return isNaN(desv) ? 0 : desv;
    });

    const desviacionPromedio = desviaciones.reduce((a, b) => a + b, 0) / desviaciones.length;
    const precision = Math.max(0, 100 - desviacionPromedio);

    return {
      precision: Math.round(precision * 100) / 100,
      desviacionPromedio: Math.round(desviacionPromedio * 100) / 100,
      totalEstimaciones: estimaciones.length,
    };
  }

  async updateEstimationWithRealPrices(id: number, precioRealCompra?: number, precioRealVenta?: number) {
    const estimation = await this.findEstimationById(id);
    
    const desviacionCompra = precioRealCompra && estimation.precioEstimadoCompra ? 
      Math.abs((precioRealCompra - estimation.precioEstimadoCompra) / precioRealCompra) * 100 : null;
    
    const desviacionVenta = precioRealVenta && estimation.precioEstimadoVenta ? 
      Math.abs((precioRealVenta - estimation.precioEstimadoVenta) / precioRealVenta) * 100 : null;

    return this.prisma.priceEstimation.update({
      where: { id },
      data: {
        precioRealCompra,
        precioRealVenta,
        desviacionCompra: desviacionCompra ? Math.round(desviacionCompra * 100) / 100 : null,
        desviacionVenta: desviacionVenta ? Math.round(desviacionVenta * 100) / 100 : null,
      },
    });
  }
}