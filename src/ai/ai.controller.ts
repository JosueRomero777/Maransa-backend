import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  HttpException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AIService, AIPredictionRequest, AIPredictionResponse } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

class PredictPriceDto {
  tipo_producto?: string;
  tipoProducto?: string;
  presentacion?: string;
  cantidad_estimada?: number;
  cantidad?: number;
  talla?: string;
  ubicacion?: string;
  provincia?: string;
  temporada?: string;
  mercado_destino?: string;
  mercadoDestino?: string;
  fecha_prediccion: string;
  fechaPrediccion?: string;
  incluir_factores_externos?: boolean;
  incluirFactoresExternos?: boolean;
}

class PredictDespachoDto {
  calibre: string;
  presentacion?: string;
  dias?: number;
}

class AnalyzeSentimentDto {
  content: string;
}

class SmartPredictionDto {
  tipoProducto: string;
  cantidadLibras: number;
  proveedorId: number;
  provincia: string;
  fechaEntrega?: string; // ISO date string
}

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AIController {
  private readonly logger = new Logger(AIController.name);
  
  constructor(private readonly aiService: AIService) {}

  /**
   * Predice el precio del camarón usando IA
   */
  @Post('predict/price')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  @HttpCode(HttpStatus.OK)
  async predictPrice(@Body() dto: any) {
    try {
      // Convertir si es necesario
      const typedDto = dto as PredictPriceDto;
      let fechaPrediccion: Date;

      // Soportar ambos formatos: snake_case y camelCase
      const fechaStr = typedDto.fecha_prediccion || typedDto.fechaPrediccion;
      
      if (fechaStr) {
        // Si viene como string YYYY-MM-DD, agregar hora UTC
        if (typeof fechaStr === 'string' && fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          fechaPrediccion = new Date(fechaStr + 'T00:00:00.000Z');
        } else {
          fechaPrediccion = new Date(fechaStr);
        }
      } else {
        fechaPrediccion = new Date(); // Fecha actual por defecto
      }

      // Validar que la fecha es válida
      if (isNaN(fechaPrediccion.getTime())) {
        throw new BadRequestException('Fecha de predicción inválida');
      }

      // Mapear datos desde nuevo formato o antiguo
      const tipoProducto = typedDto.tipo_producto || typedDto.tipoProducto;
      const presentacion = typedDto.presentacion;
      const cantidad = typedDto.cantidad_estimada || typedDto.cantidad;
      const mercadoDestino = typedDto.mercado_destino || typedDto.mercadoDestino;
      const provincia = typedDto.provincia;
      const incluirFactoresExternos = typedDto.incluir_factores_externos !== false && typedDto.incluirFactoresExternos !== false;

      if (!tipoProducto) {
        throw new BadRequestException('tipo_producto es requerido');
      }

      if (!mercadoDestino) {
        throw new BadRequestException('mercado_destino es requerido');
      }

      const request: AIPredictionRequest = {
        tipoProducto: tipoProducto,
        talla: typedDto.talla,
        cantidad: cantidad || 100,
        ubicacion: typedDto.ubicacion,
        temporada: typedDto.temporada,
        mercadoDestino: mercadoDestino,
        provincia: provincia || 'GUAYAS',
        fechaPrediccion: fechaPrediccion,
        incluirFactoresExternos: incluirFactoresExternos,
        presentacion: presentacion,
      };

      this.logger.log(`Request creado: ${JSON.stringify(request)}`);
      this.logger.log(`Enviando a microservicio IA con presentacion: ${presentacion}`);

      const prediction = await this.aiService.predictPrice(request);
      
      this.logger.log(`Predicción recibida: ${JSON.stringify(prediction)}`);
      
      // Guardar predicción en la base de datos
      try {
        await this.aiService.savePrediction(prediction, request);
      } catch (saveError) {
        this.logger.error(`Error guardando predicción: ${saveError.message}`);
        // No fallar la respuesta si no se pudo guardar
      }
      
      return {
        success: true,
        data: prediction,
        message: 'Predicción generada exitosamente'
      };

    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al generar predicción',
        error: error.message
      });
    }
  }

  /**
   * Predice precio de despacho con flujo simplificado
   */
  @Post('predict/despacho')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  @HttpCode(HttpStatus.OK)
  async predictDespacho(@Body() dto: PredictDespachoDto) {
    try {
      this.logger.log(`📥 Raw DTO recibido:`, JSON.stringify(dto));
      this.logger.log(`📥 DTO keys:`, Object.keys(dto || {}));
      this.logger.log(`📥 DTO calibre:`, dto?.calibre);
      this.logger.log(`📥 DTO presentacion:`, dto?.presentacion);
      this.logger.log(`📥 DTO dias:`, dto?.dias);
      
      const calibre = dto?.calibre;
      const presentacion = dto?.presentacion || 'HEADLESS';
      const dias = dto?.dias ?? 30;

      this.logger.log(`Despacho predicción request: calibre=${calibre}, presentacion=${presentacion}, dias=${dias}`);

      if (!calibre || calibre.trim() === '') {
        this.logger.warn('calibre vacío o faltante');
        throw new BadRequestException('calibre es requerido y no puede estar vacío');
      }

      if (typeof dias !== 'number' || dias <= 0 || dias > 365) {
        this.logger.warn(`dias inválido: ${dias}`);
        throw new BadRequestException('dias debe ser un número entre 1 y 365');
      }

      this.logger.log('Validación completada, llamando a aiService.predictDespachoPrice...');

      const prediction = await this.aiService.predictDespachoPrice({
        calibre: calibre.trim(),
        presentacion,
        dias,
      });

      // Guardar predicción en la BD interna (con defaults de mercado/provincia)
      try {
        let fechaObjetivo: Date;
        
        if (prediction.fecha_objetivo) {
          // Si viene fecha del API Python
          if (typeof prediction.fecha_objetivo === 'string' && prediction.fecha_objetivo.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fechaObjetivo = new Date(prediction.fecha_objetivo + 'T00:00:00.000Z');
          } else {
            fechaObjetivo = new Date(prediction.fecha_objetivo);
          }
        } else if (dias && dias > 0) {
          // Calcular fecha objetivo basado en días desde hoy (en UTC)
          const today = new Date();
          const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
          const objectiveDate = new Date(todayUTC);
          objectiveDate.setUTCDate(objectiveDate.getUTCDate() + dias);
          fechaObjetivo = objectiveDate;
        } else {
          fechaObjetivo = new Date();
        }

        this.logger.log(`Fecha objetivo calculada: ${fechaObjetivo.toISOString()}`);

        const request: AIPredictionRequest = {
          tipoProducto: calibre,
          mercadoDestino: 'NACIONAL',
          provincia: undefined,
          fechaPrediccion: fechaObjetivo,
          incluirFactoresExternos: false,
          presentacion,
        };

        const mappedPrediction: AIPredictionResponse = {
          precioPredicho: prediction.precio_despacho_predicho_usd_lb,
          intervaloConfianza: {
            min: prediction.intervalo_confianza_despacho?.minimo ?? 0,
            max: prediction.intervalo_confianza_despacho?.maximo ?? 0,
            confianza: (prediction.confianza_porcentaje ?? 0) / 100,
          },
          factoresPrincipales: {
            precioPublicoPredicho: prediction.precio_publico_predicho_usd_lb,
            rCuadrado: prediction.correlacion?.r_cuadrado,
            formula: prediction.correlacion?.formula,
            ratioPromedio: prediction.correlacion?.ratio_promedio,
          },
          confianzaModelo: (prediction.confianza_porcentaje ?? 0) / 100,
          fechaPrediccion: fechaObjetivo,
          modeloUsado: prediction.metodo || 'prediccion_despacho',
          recomendaciones: [],
        };

        await this.aiService.savePrediction(mappedPrediction, request);
      } catch (saveError) {
        this.logger.error(`Error guardando predicción despacho: ${saveError.message}`);
      }

      return {
        success: true,
        data: prediction,
        message: 'Predicción de despacho generada exitosamente',
      };
    } catch (error) {
      this.logger.error(`Error en predictDespacho catch: ${error.message}`);
      
      // Si ya es una excepción HTTP (BadRequestException, HttpException, etc), re-lanzarla
      if (error.status) {
        throw error;
      }
      
      // Si no, envolver en HttpException con código apropiado
      throw new HttpException(
        {
          success: false,
          message: 'Error al generar predicción de despacho',
          error: error.message,
          details: error.response?.data || error.data || null,
        },
        error.response?.status || HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Obtiene factores actuales del mercado
   */
  @Get('market/factors')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA, RolUsuario.LABORATORIO)
  async getMarketFactors() {
    try {
      const factors = await this.aiService.getMarketFactors();
      
      return {
        success: true,
        data: factors,
        message: 'Factores de mercado obtenidos exitosamente'
      };

    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener factores de mercado',
        error: error.message,
        data: { factors: [], total: 0 }
      };
    }
  }

  /**
   * Analiza el sentimiento de contenido del mercado
   */
  @Post('analysis/sentiment')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  @HttpCode(HttpStatus.OK)
  async analyzeSentiment(@Body() dto: AnalyzeSentimentDto) {
    try {
      const analysis = await this.aiService.analyzeSentiment(dto.content);
      
      return {
        success: true,
        data: analysis,
        message: 'Análisis de sentimiento completado'
      };

    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error en análisis de sentimiento',
        error: error.message
      });
    }
  }

  /**
   * Actualiza los datos de mercado
   */
  @Post('data/update')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateMarketData() {
    try {
      const result = await this.aiService.updateMarketData();
      
      return {
        success: true,
        data: result,
        message: 'Actualización de datos iniciada'
      };

    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al actualizar datos de mercado',
        error: error.message
      });
    }
  }

  /**
   * Verifica el estado del servicio de IA
   */
  @Get('health')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  async checkHealth() {
    const health = await this.aiService.checkHealth();
    
    return {
      success: health.status === 'healthy',
      data: health,
      message: health.status === 'healthy' ? 'Servicio de IA operativo' : 'Servicio de IA no disponible'
    };
  }

  /**
   * Obtiene predicción inteligente para un pedido
   */
  @Post('predict/smart-order')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  @HttpCode(HttpStatus.OK)
  async getSmartPrediction(@Body() dto: SmartPredictionDto) {
    try {
      const orderData = {
        tipoProducto: dto.tipoProducto,
        cantidadLibras: dto.cantidadLibras,
        proveedorId: dto.proveedorId,
        provincia: dto.provincia,
        fechaEntrega: dto.fechaEntrega ? new Date(dto.fechaEntrega) : undefined,
      };

      const smartPrediction = await this.aiService.getSmartPredictionForOrder(orderData);
      
      return {
        success: true,
        data: smartPrediction,
        message: 'Predicción inteligente generada exitosamente'
      };

    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al generar predicción inteligente',
        error: error.message
      });
    }
  }

  /**
   * Obtiene recomendaciones de mercado basadas en IA
   */
  @Get('recommendations/market')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  async getMarketRecommendations(
    @Query('tipoProducto') tipoProducto?: string,
    @Query('provincia') provincia?: string
  ) {
    try {
      // Obtener factores de mercado actuales
      const marketFactors = await this.aiService.getMarketFactors();
      
      // Generar recomendaciones basadas en factores
      const recommendations = this.generateMarketRecommendations(
        marketFactors.factors,
        tipoProducto,
        provincia
      );
      
      return {
        success: true,
        data: {
          recommendations,
          basedOnFactors: marketFactors.factors.length,
          generatedAt: new Date()
        },
        message: 'Recomendaciones de mercado generadas'
      };

    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error al generar recomendaciones',
        error: error.message
      });
    }
  }

  /**
   * Genera recomendaciones basadas en factores de mercado
   */
  private generateMarketRecommendations(
    factors: any[],
    tipoProducto?: string,
    provincia?: string
  ): string[] {
    const recommendations: string[] = [];
    
    // Validar que factors existe y es un array
    if (!factors || !Array.isArray(factors) || factors.length === 0) {
      recommendations.push(' No hay suficientes datos de mercado disponibles.');
      recommendations.push(' Actualizar datos para obtener recomendaciones precisas.');
      return recommendations;
    }
    
    try {
      // Analizar factores climáticos
      const tempFactors = factors.filter(f => f && f.factorName && f.factorName.includes('Temperatura'));
      if (tempFactors.length > 0) {
        const validTemps = tempFactors.filter(f => f.value !== null && f.value !== undefined && !isNaN(f.value));
        if (validTemps.length > 0) {
          const avgTemp = validTemps.reduce((sum, f) => sum + f.value, 0) / validTemps.length;
          if (avgTemp < 22) {
            recommendations.push(' Temperaturas bajas detectadas. Considerar impacto en producción.');
          } else if (avgTemp > 28) {
            recommendations.push(' Temperaturas altas. Monitorear calidad del camarón.');
          }
        }
      }

      // Analizar precios internacionales
      const priceFactors = factors.filter(f => f && f.factorName && f.factorName.includes('Precio'));
      if (priceFactors.length > 0) {
        const chinaPrice = priceFactors.find(f => f.factorName && f.factorName.includes('CHINA'));
        const usaPrice = priceFactors.find(f => f.factorName && f.factorName.includes('USA'));
        
        if (chinaPrice && usaPrice && 
            chinaPrice.value !== null && chinaPrice.value !== undefined && !isNaN(chinaPrice.value) &&
            usaPrice.value !== null && usaPrice.value !== undefined && !isNaN(usaPrice.value)) {
          if (chinaPrice.value > usaPrice.value) {
            recommendations.push('🇨🇳 Mercado chino ofrece mejores precios actualmente.');
          } else {
            recommendations.push('🇺🇸 Mercado estadounidense más favorable en precios.');
          }
        }
      }

      // Analizar tipos de cambio
      const exchangeFactors = factors.filter(f => f && f.factorName && f.factorName.includes('USD/'));
      if (exchangeFactors.length > 0) {
        const cnyRate = exchangeFactors.find(f => f.factorName && f.factorName.includes('CNY'));
        if (cnyRate && cnyRate.value !== null && cnyRate.value !== undefined && !isNaN(cnyRate.value) && cnyRate.value > 7.2) {
          recommendations.push(' Yuan débil - oportunidad favorable para exportación a China.');
        }
      }

      // Recomendaciones específicas por tipo de producto
      if (tipoProducto) {
        const productSize = parseInt(tipoProducto.split('/')[0]);
        if (!isNaN(productSize)) {
          if (productSize <= 30) {
            recommendations.push(' Camarón de talla grande - considerar mercados premium (Japón, Europa).');
          } else if (productSize >= 50) {
            recommendations.push(' Talla popular - ideal para mercado masivo (China, procesamiento).');
          }
        }
      }

      // Recomendaciones por provincia
      if (provincia) {
        switch (provincia) {
          case 'GUAYAS':
            recommendations.push(' Ubicación privilegiada - costos logísticos optimizados.');
            break;
          case 'MANABI':
            recommendations.push(' Zona de alta calidad - aprovechar para mercados premium.');
            break;
          case 'EL_ORO':
            recommendations.push(' Considerar factores de transporte adicionales.');
            break;
        }
      }

      // Agregar recomendaciones generales si no hay suficientes específicas
      if (recommendations.length < 3) {
        recommendations.push('Monitorear tendencias de mercado semanalmente.');
        recommendations.push('Actualizar predicciones antes de decisiones importantes.');
        recommendations.push('Diversificar mercados para reducir riesgos.');
      }

      return recommendations.slice(0, 8); // Limitar a 8 recomendaciones
      
    } catch (error) {
      this.logger.error(`Error generando recomendaciones: ${error.message}`);
      return [
        '⚠️ Error procesando datos de mercado.',
        '📊 Recomendaciones basadas en datos históricos.',
        '🔄 Actualizar datos para recomendaciones precisas.'
      ];
    }
  }

  /**
   * Obtiene el historial de predicciones guardadas
   */
  @Get('predictions/history')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  @HttpCode(HttpStatus.OK)
  async getPredictionHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const limitNum = limit ? parseInt(limit) : 50;
      const offsetNum = offset ? parseInt(offset) : 0;

      const result = await this.aiService.getPredictionHistory(limitNum, offsetNum);

      return {
        success: true,
        data: result,
        message: 'Historial recuperado exitosamente'
      };
    } catch (error) {
      this.logger.error(`Error al obtener historial: ${error.message}`);
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener historial de predicciones',
        error: error.message
      });
    }
  }

  /**
   * Obtiene una predicción específica por ID
   */
  @Get('predictions/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  @HttpCode(HttpStatus.OK)
  async getPredictionById(@Query('id') id: string) {
    try {
      const prediction = await this.aiService.getPredictionById(parseInt(id));

      return {
        success: true,
        data: prediction,
        message: 'Predicción recuperada exitosamente'
      };
    } catch (error) {
      this.logger.error(`Error al obtener predicción: ${error.message}`);
      throw new BadRequestException({
        success: false,
        message: 'Error al obtener predicción',
        error: error.message
      });
    }
  }
}