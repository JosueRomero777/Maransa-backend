import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export interface AIPredictionRequest {
  tipoProducto?: string;
  talla?: string;
  cantidad?: number;
  ubicacion?: string;
  temporada?: string;
  mercadoDestino: string;
  provincia?: string;
  fechaPrediccion: Date;
  incluirFactoresExternos?: boolean;
  presentacion?: string;
}

export interface AIPredictionResponse {
  precioPredicho: number;
  intervaloConfianza: {
    min: number;
    max: number;
    confianza: number;
  };
  factoresPrincipales: Record<string, number>;
  confianzaModelo: number;
  fechaPrediccion: Date;
  modeloUsado: string;
  recomendaciones: string[];
}

export interface MarketFactor {
  factorName: string;
  value: number;
  impactScore: number;
  source: string;
  timestamp: Date;
}

export interface SentimentAnalysis {
  sentimiento: number;
  confianza: number;
  temas: string[];
  impactoPrecios: number;
  resumen: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  /**
   * Mapea presentación a nombre descriptivo
   */
  private mapPresentationToName(presentation: string | undefined): string {
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
   * Predice el precio del camarón usando IA
   */
  async predictPrice(request: AIPredictionRequest): Promise<AIPredictionResponse> {
    try {
      this.logger.log(`Solicitando predicción de precio para ${request.talla} en ${request.ubicacion}`);
      this.logger.log(`Presentación: ${request.presentacion}`);
      this.logger.log(`Fecha recibida: ${request.fechaPrediccion}`);

      const payload = {
        tipo_producto: request.tipoProducto || 'CAMARONES',
        talla: request.talla || 'U15',
        cantidad: request.cantidad || 100,
        cantidad_estimada: request.cantidad || 100,
        ubicacion: request.ubicacion || request.provincia || 'Guayas',
        provincia: request.provincia || 'GUAYAS',
        temporada: request.temporada || 'verano',
        mercado_destino: request.mercadoDestino || 'NACIONAL',
        presentacion: request.presentacion || 'HEADLESS',
        fecha_prediccion: request.fechaPrediccion.toISOString().split('T')[0],
        incluir_factores_externos: request.incluirFactoresExternos ?? true,
      };

      this.logger.log(`Payload para microservicio: ${JSON.stringify(payload)}`);
      this.logger.log(`Enviando a ${this.aiServiceUrl}/predict/price`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/predict/price`, payload)
      );

      const data = response.data;
      
      this.logger.log(`Respuesta del microservicio: ${JSON.stringify(data)}`);
      
      return {
        precioPredicho: data.precio_predicho,
        intervaloConfianza: data.intervalo_confianza,
        factoresPrincipales: data.factores_principales,
        confianzaModelo: data.confianza_modelo,
        fechaPrediccion: new Date(data.fecha_prediccion),
        modeloUsado: data.modelo_usado,
        recomendaciones: data.recomendaciones,
      };

    } catch (error) {
      this.logger.error(`Error en predicción de precio: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      
      if (error.response?.status === 500) {
        this.logger.error(`Respuesta del servidor: ${JSON.stringify(error.response.data)}`);
        throw new HttpException(
          'Error en el servicio de IA',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      
      throw new HttpException(
        'No se pudo obtener predicción de precio',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Predice el precio de despacho usando el microservicio Python
   * Flujo: market-prices -> correlations/calculate -> predict/despacho-price
   */
  async predictDespachoPrice(params: {
    calibre: string;
    presentacion: string;
    dias: number;
  }): Promise<any> {
    try {
      const { calibre, presentacion, dias } = params;

      this.logger.log(`Predicción despacho: calibre=${calibre}, presentacion=${presentacion}, dias=${dias}`);

      // Step 1: Obtener precios de mercado
      this.logger.log('Step 1: Obteniendo precios de mercado...');
      try {
        const marketPricesResponse = await firstValueFrom(
          this.httpService.get(`${this.aiServiceUrl}/data/market-prices`, {
            params: { force_refresh: true },
            timeout: 30000,
          })
        );
        this.logger.log('✓ Precios de mercado obtenidos');
      } catch (marketErr) {
        this.logger.error(`✗ Error obteniendo precios de mercado: ${marketErr.message}`);
        throw new HttpException(
          `Error obteniendo precios de mercado: ${marketErr.message}`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Step 2: Calcular correlaciones
      this.logger.log('Step 2: Calculando correlaciones...');
      try {
        const correlationResponse = await firstValueFrom(
          this.httpService.post(`${this.aiServiceUrl}/correlations/calculate`, null, {
            params: { calibre, presentacion },
            timeout: 30000,
          })
        );
        this.logger.log('✓ Correlaciones calculadas');
      } catch (corrErr) {
        const status = (corrErr as any)?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const detail = (corrErr as any)?.response?.data?.detail || (corrErr as any)?.message;

        if (status === HttpStatus.NOT_FOUND) {
          this.logger.warn(`⚠️ Correlación no disponible: ${detail}. Continuando con predicción...`);
        } else {
          this.logger.error(`✗ Error calculando correlaciones: ${detail}`);
          throw new HttpException(
            `Error calculando correlaciones: ${detail}`,
            status
          );
        }
      }

      // Step 3: Obtener predicción
      this.logger.log('Step 3: Obteniendo predicción de despacho...');
      try {
        const predictionResponse = await firstValueFrom(
          this.httpService.get(`${this.aiServiceUrl}/predict/despacho-price`, {
            params: { calibre, presentacion, dias },
            timeout: 30000,
          })
        );
        this.logger.log('✓ Predicción obtenida exitosamente');
        return predictionResponse.data;
      } catch (predErr) {
        const status = (predErr as any)?.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
        const detail = (predErr as any)?.response?.data?.detail || (predErr as any)?.message;
        this.logger.error(`✗ Error obteniendo predicción: ${detail}`);
        throw new HttpException(
          `Error obteniendo predicción: ${detail}`,
          status
        );
      }
    } catch (error) {
      this.logger.error(`Error en predicción despacho: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);

      throw new HttpException(
        'No se pudo obtener predicción de despacho',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Obtiene factores actuales del mercado
   */
  async getMarketFactors(): Promise<{ factors: MarketFactor[]; total: number }> {
    try {
      this.logger.log('Obteniendo factores de mercado desde IA');

      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/data/market-factors`)
      );

      return response.data;

    } catch (error) {
      this.logger.error(`Error obteniendo factores de mercado: ${error.message}`);
      
      // Retornar datos básicos como fallback
      return {
        factors: [
          {
            factorName: 'Precio Internacional Promedio',
            value: 6.0,
            impactScore: 0.8,
            source: 'Fallback Data',
            timestamp: new Date(),
          }
        ],
        total: 1
      };
    }
  }

  /**
   * Analiza el sentimiento de contenido del mercado
   */
  async analyzeSentiment(content: string): Promise<SentimentAnalysis> {
    try {
      this.logger.log('Analizando sentimiento del mercado');

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/analysis/sentiment`, { content })
      );

      return response.data.analysis;

    } catch (error) {
      this.logger.error(`Error en análisis de sentimiento: ${error.message}`);
      
      // Retornar análisis neutral como fallback
      return {
        sentimiento: 0.0,
        confianza: 0.3,
        temas: ['general'],
        impactoPrecios: 0.0,
        resumen: 'Análisis no disponible'
      };
    }
  }

  /**
   * Actualiza los datos de mercado
   */
  async updateMarketData(): Promise<{ message: string }> {
    try {
      this.logger.log('Solicitando actualización de datos de mercado');

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/data/update`)
      );

      return response.data;

    } catch (error) {
      this.logger.error(`Error actualizando datos de mercado: ${error.message}`);
      throw new HttpException(
        'No se pudo actualizar datos de mercado',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Verifica el estado del servicio de IA
   */
  async checkHealth(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/health`)
      );

      return response.data;

    } catch (error) {
      this.logger.error(`Servicio de IA no disponible: ${error.message}`);
      return {
        status: 'unavailable',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Obtiene predicción inteligente para un pedido específico
   */
  async getSmartPredictionForOrder(orderData: {
    tipoProducto: string;
    cantidadLibras: number;
    proveedorId: number;
    provincia: string;
    fechaEntrega?: Date;
  }): Promise<{
    prediccionPrecio: AIPredictionResponse;
    recomendaciones: string[];
    riesgoMercado: 'BAJO' | 'MEDIO' | 'ALTO';
    oportunidadCompra: number; // 0-100
  }> {
    try {
      const fechaPrediccion = orderData.fechaEntrega || new Date();
      
      // Determinar mejor mercado basado en cantidad
      let mercadoRecomendado = 'NACIONAL';
      if (orderData.cantidadLibras > 10000) {
        mercadoRecomendado = 'CHINA'; // Mayor volumen
      } else if (orderData.cantidadLibras > 5000) {
        mercadoRecomendado = 'USA';   // Volumen medio
      }

      const prediccion = await this.predictPrice({
        tipoProducto: orderData.tipoProducto,
        mercadoDestino: mercadoRecomendado,
        provincia: orderData.provincia,
        fechaPrediccion,
        incluirFactoresExternos: true,
      });

      // Calcular riesgo de mercado basado en intervalo de confianza
      const rangoRiesgo = prediccion.intervaloConfianza.max - prediccion.intervaloConfianza.min;
      const riesgoRelativo = rangoRiesgo / prediccion.precioPredicho;
      
      let riesgoMercado: 'BAJO' | 'MEDIO' | 'ALTO';
      if (riesgoRelativo < 0.1) riesgoMercado = 'BAJO';
      else if (riesgoRelativo < 0.2) riesgoMercado = 'MEDIO';
      else riesgoMercado = 'ALTO';

      // Calcular oportunidad de compra (0-100)
      const factorClimatico = prediccion.factoresPrincipales.clima || 1;
      const factorEstacional = prediccion.factoresPrincipales.estacionalidad || 1;
      const factorConfianza = prediccion.confianzaModelo;
      
      const oportunidadCompra = Math.round(
        (factorClimatico * factorEstacional * factorConfianza * 100)
      );

      const recomendaciones = [
        ...prediccion.recomendaciones,
        `Riesgo de mercado: ${riesgoMercado}`,
        `Mercado recomendado: ${mercadoRecomendado}`,
        `Oportunidad de compra: ${oportunidadCompra}%`
      ];

      return {
        prediccionPrecio: prediccion,
        recomendaciones,
        riesgoMercado,
        oportunidadCompra,
      };

    } catch (error) {
      this.logger.error(`Error en predicción inteligente: ${error.message}`);
      throw new HttpException(
        'No se pudo generar predicción inteligente',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Guarda una predicción en la base de datos
   */
  async savePrediction(
    prediction: AIPredictionResponse,
    request: AIPredictionRequest,
  ) {
    try {
      this.logger.log('Intentando guardar predicción en la base de datos...');
      
      // Asegurar que existe un modelo ML (crear uno por defecto si no existe)
      let modeloId = 1;
      try {
        const modelo = await this.prisma.modelosML.findFirst({
          where: { activo: true },
        });
        
        if (!modelo) {
          this.logger.log('No existe modelo ML activo, creando uno por defecto...');
          const nuevoModelo = await this.prisma.modelosML.create({
            data: {
              nombre: 'Modelo Ensemble Default',
              algoritmo: 'ENSEMBLE',
              version: '1.0.0',
              rutaModelo: '/models/ensemble_v1',
              parametros: {},
              metricas: {},
              fechaEntrenamiento: new Date(),
              activo: true,
            },
          });
          modeloId = nuevoModelo.id;
          this.logger.log(`Modelo creado con ID: ${modeloId}`);
        } else {
          modeloId = modelo.id;
        }
      } catch (modelError) {
        this.logger.warn(`Error verificando modelo: ${modelError.message}, usando ID 1 por defecto`);
      }

      this.logger.log(`Guardando predicción con modelo ID: ${modeloId}`);

      // Evitar guardados duplicados en ventana corta (posibles reintentos/duplicados de cliente)
      try {
        const dedupeWindowMs = 10 * 1000; // 10 segundos
        const windowStart = new Date(Date.now() - dedupeWindowMs);

        const existing = await this.prisma.prediccionesIA.findFirst({
          where: {
            tipoProducto: this.mapPresentationToName(request.presentacion),
            calibre: request.tipoProducto || 'U15',
            fechaPrediccion: request.fechaPrediccion,
            fechaCreacion: { gte: windowStart },
          },
        });

        if (existing) {
          this.logger.warn(`Predicción duplicada detectada (últimos ${dedupeWindowMs / 1000}s). Usando registro existente ID: ${existing.id}`);
          return existing;
        }
      } catch (dedupeErr) {
        this.logger.warn(`Error comprobando duplicados: ${dedupeErr.message}`);
        // En caso de error en dedupe, continuar y guardar normalmente
      }

      try {
        const saved = await this.prisma.prediccionesIA.create({
          data: {
            modeloId: modeloId,
            fechaPrediccion: request.fechaPrediccion,
            tipoProducto: this.mapPresentationToName(request.presentacion),
            calibre: request.tipoProducto || 'U15',
            precioPredicho: prediction.precioPredicho,
            intervaloConfianza: prediction.intervaloConfianza,
            factoresInfluyentes: {
              ...prediction.factoresPrincipales,
              confianzaModelo: prediction.confianzaModelo,
              recomendaciones: prediction.recomendaciones,
              modeloUsado: prediction.modeloUsado,
            },
          },
        });

        this.logger.log(`✅ Predicción guardada exitosamente con ID: ${saved.id}`);
        return saved;
      } catch (createErr) {
        // Manejar violación de constraint único (evita duplicados en concurrencia)
        const code = (createErr as any)?.code;
        if (code === 'P2002') {
          this.logger.warn('Unique constraint violation al guardar predicción, recuperando registro existente...');
          try {
            const existing = await this.prisma.prediccionesIA.findFirst({
              where: {
                tipoProducto: this.mapPresentationToName(request.presentacion),
                calibre: request.tipoProducto || 'U15',
                fechaPrediccion: request.fechaPrediccion,
              },
            });

            if (existing) {
              this.logger.warn(`Registro existente encontrado ID: ${existing.id}`);
              return existing;
            }
          } catch (findErr) {
            this.logger.error(`Error recuperando registro existente tras P2002: ${findErr.message}`);
          }
        }

        // Si no es P2002 o no encontramos el registro, re-lanzar
        this.logger.error(`Error creando predicción: ${(createErr as any)?.message || createErr}`);
        throw createErr;
      }
    } catch (error) {
      this.logger.error(`❌ Error al guardar predicción: ${error.message}`);
      this.logger.error(error.stack);
      throw new HttpException(
        'Error al guardar predicción',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene el historial de predicciones
   */
  async getPredictionHistory(limit = 50, offset = 0) {
    try {
      const predictions = await this.prisma.prediccionesIA.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          fechaCreacion: 'desc',
        },
      });

      const total = await this.prisma.prediccionesIA.count();

      // Calcular días para cada predicción
      const predictionsWithDias = predictions.map(p => {
        const now = new Date(p.fechaCreacion);
        const target = new Date(p.fechaPrediccion);
        
        // Normalizar a medianoche UTC para cálculo de días
        const nowMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const targetMidnight = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
        
        const diasPrediccion = Math.floor((targetMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          ...p,
          diasPrediccion,
        };
      });

      return {
        predictions: predictionsWithDias,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Error al obtener historial: ${error.message}`);
      throw new HttpException(
        'Error al obtener historial de predicciones',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtiene una predicción específica por ID
   */
  async getPredictionById(id: number) {
    try {
      const prediction = await this.prisma.prediccionesIA.findUnique({
        where: { id },
      });

      if (!prediction) {
        throw new HttpException('Predicción no encontrada', HttpStatus.NOT_FOUND);
      }

      // Calcular días
      const now = new Date(prediction.fechaCreacion);
      const target = new Date(prediction.fechaPrediccion);
      
      // Normalizar a medianoche UTC para cálculo de días
      const nowMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const targetMidnight = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
      
      const diasPrediccion = Math.floor((targetMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...prediction,
        diasPrediccion,
      };
    } catch (error) {
      this.logger.error(`Error al obtener predicción: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compara predicciones de IA con precios reales de recepciones
   */
  async comparePredictionsWithReceptions(
    calibre?: string,
    presentacion?: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      this.logger.log('Comparando predicciones con recepciones...');

      // Obtener todas las recepciones aceptadas
      const receptions = await this.prisma.reception.findMany({
        where: {
          loteAceptado: true,
          ...(startDate || endDate ? {
            fechaLlegada: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate + 'T23:59:59Z') })
            }
          } : {}),
          order: {
            ...(presentacion && {
              presentationType: {
                code: presentacion,
              }
            })
          }
        },
        include: {
          order: {
            include: {
              shrimpSize: true,
              presentationType: true,
            }
          }
        }
      });

      this.logger.log(`Recepciones encontradas: ${receptions.length}`);

      // Obtener predicciones
      const predictions = await this.prisma.prediccionesIA.findMany({
        orderBy: { fechaCreacion: 'desc' }
      });

      this.logger.log(`Predicciones encontradas: ${predictions.length}`);

      // Comparar: Recepción con Predicción
      // Coincidencia: misma talla + fecha objetivo = fecha de recepción
      const comparisons: any[] = [];

      for (const reception of receptions) {
        if (!reception.order.shrimpSize || !reception.precioFinalVenta || !reception.order.cantidadFinal) {
          continue; // Saltar si falta información
        }

        const shrimpSizeCode = reception.order.shrimpSize.code; // ej: "16/20"
        
        // Extraer la fecha en ISO format y convertir a medianoche UTC
        const receptionDate = new Date(reception.fechaLlegada);
        const receptionDateOnly = new Date(Date.UTC(
          receptionDate.getUTCFullYear(),
          receptionDate.getUTCMonth(),
          receptionDate.getUTCDate()
        ));

        this.logger.log(`Recepción - Talla: ${shrimpSizeCode}, Fecha normalizada: ${receptionDateOnly.toISOString()}`);

        // Buscar predicciones con mismo calibre
        const matchingPredictions = predictions.filter((pred) => {
          if (pred.calibre !== shrimpSizeCode) {
            return false;
          }

          // Normalizar fecha de predicción a medianoche UTC
          const predDate = new Date(pred.fechaPrediccion);
          const predDateOnly = new Date(Date.UTC(
            predDate.getUTCFullYear(),
            predDate.getUTCMonth(),
            predDate.getUTCDate()
          ));

          const isMatch = predDateOnly.getTime() === receptionDateOnly.getTime();
          if (isMatch) {
            this.logger.log(`✓ Coincidencia encontrada: Predicción ${pred.id} con Recepción ${reception.id}`);
          }
          return isMatch;
        });

        // Calcular precio por libra real
        // precioFinalVenta ya es el precio por libra
        const realPricePerLb = reception.precioFinalVenta || 0;

        if (matchingPredictions.length > 0) {
          comparisons.push({
            receptionId: reception.id,
            orderId: reception.orderId,
            calibre: shrimpSizeCode,
            presentacion: reception.order.presentationType?.code || 'N/A',
            receptionDate: reception.fechaLlegada,
            realPrice: parseFloat(realPricePerLb.toFixed(4)),
            precioTotalRecepcion: reception.precioFinalVenta,
            cantidadLibras: reception.order.cantidadFinal,
            predictions: matchingPredictions.map((p) => ({
              id: p.id,
              predictedPrice: parseFloat(p.precioPredicho.toFixed(4)),
              predictionDate: p.fechaCreacion,
              targetDate: p.fechaPrediccion,
              difference: parseFloat((realPricePerLb - p.precioPredicho).toFixed(4)),
              percentageDifference: parseFloat(
                ((Math.abs(realPricePerLb - p.precioPredicho) / realPricePerLb) * 100).toFixed(2)
              ),
              accuracy: realPricePerLb > 0 
                ? parseFloat((100 - (Math.abs(realPricePerLb - p.precioPredicho) / realPricePerLb) * 100).toFixed(2))
                : 0
            }))
          });
        }
      }

      this.logger.log(`Comparaciones encontradas: ${comparisons.length}`);

      // Resumen por calibre
      const summaryByCalibres = Array.from(new Set(comparisons.map(c => c.calibre))).map((cal) => {
        const calibreComparisons = comparisons.filter(c => c.calibre === cal);
        const allPredictions = calibreComparisons.flatMap(c => c.predictions);
        
        const avgRealPrice = calibreComparisons.reduce((sum, c) => sum + c.realPrice, 0) / calibreComparisons.length;
        const avgPredictedPrice = allPredictions.length > 0
          ? allPredictions.reduce((sum, p) => sum + p.predictedPrice, 0) / allPredictions.length
          : 0;

        const avgAccuracy = allPredictions.length > 0
          ? allPredictions.reduce((sum, p) => sum + p.accuracy, 0) / allPredictions.length
          : 0;

        return {
          calibre: cal,
          receptionCount: calibreComparisons.length,
          predictionCount: allPredictions.length,
          averageRealPrice: parseFloat(avgRealPrice.toFixed(4)),
          averagePredictedPrice: parseFloat(avgPredictedPrice.toFixed(4)),
          difference: parseFloat(Math.abs(avgRealPrice - avgPredictedPrice).toFixed(4)),
          percentageDifference: avgRealPrice > 0 
            ? parseFloat(((Math.abs(avgRealPrice - avgPredictedPrice) / avgRealPrice) * 100).toFixed(2))
            : 0,
          averageAccuracy: parseFloat(avgAccuracy.toFixed(2))
        };
      });

      return {
        status: 'success',
        message: 'Comparativa de predicciones vs recepciones',
        totalReceptions: receptions.length,
        totalMatches: comparisons.length,
        comparisons,
        summary: summaryByCalibres,
      };
    } catch (error) {
      this.logger.error(`Error comparando predicciones: ${error.message}`);
      throw new HttpException(
        'Error al comparar predicciones',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Calcula métricas de precisión del modelo
   */
  async calculateAccuracyMetrics(
    presentacion?: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const predictions = await this.prisma.prediccionesIA.findMany({
        where: {
          fechaCreacion: { gte: start, lte: end },
        },
      });

      const withRealPrice = predictions.filter((p) => p.precioReal !== null);
      const differences: number[] = [];

      withRealPrice.forEach((pred) => {
        if (pred.precioReal !== null) {
          const diff = Math.abs(pred.precioReal - pred.precioPredicho);
          differences.push(diff);
        }
      });

      const avgDifference = differences.length > 0 ? differences.reduce((a, b) => a + b, 0) / differences.length : 0;
      const maxDifference = differences.length > 0 ? Math.max(...differences) : 0;
      const minDifference = differences.length > 0 ? Math.min(...differences) : 0;
      const accuracy = withRealPrice.length > 0 ? 100 - (avgDifference / (avgDifference + 1)) * 100 : 0;

      return {
        status: 'success',
        period: { startDate: start, endDate: end },
        presentacion: presentacion || 'Todas',
        metrics: {
          totalMatches: withRealPrice.length,
          totalReceptions: 0,
          totalPredictions: predictions.length,
          averageDifference: parseFloat(avgDifference.toFixed(4)),
          maxDifference: parseFloat(maxDifference.toFixed(4)),
          minDifference: parseFloat(minDifference.toFixed(4)),
          accuracy: parseFloat(accuracy.toFixed(2)),
        },
      };
    } catch (error) {
      this.logger.error(`Error calculando métricas: ${error.message}`);
      throw new HttpException(
        'Error al calcular métricas de precisión',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Resumen de comparación de precios (recepciones vs predicciones)
   */
  async getPriceComparisonSummary(presentacion?: string) {
    try {
      // Obtener todas las recepciones aceptadas
      const receptions = await this.prisma.reception.findMany({
        where: {
          loteAceptado: true,
          order: {
            ...(presentacion && {
              presentationType: {
                code: presentacion,
              }
            })
          }
        },
        include: {
          order: {
            include: {
              shrimpSize: true,
              presentationType: true,
            }
          }
        }
      });

      const predictions = await this.prisma.prediccionesIA.findMany();

      // Crear comparaciones
      const comparisons: any[] = [];

      for (const reception of receptions) {
        if (!reception.order.shrimpSize || !reception.precioFinalVenta || !reception.order.cantidadFinal) {
          continue;
        }

        const shrimpSizeCode = reception.order.shrimpSize.code;
        
        // Normalizar fecha de recepción a medianoche UTC
        const receptionDate = new Date(reception.fechaLlegada);
        const receptionDateOnly = new Date(Date.UTC(
          receptionDate.getUTCFullYear(),
          receptionDate.getUTCMonth(),
          receptionDate.getUTCDate()
        ));

        const matchingPredictions = predictions.filter((pred) => {
          if (pred.calibre !== shrimpSizeCode) {
            return false;
          }

          // Normalizar fecha de predicción a medianoche UTC
          const predDate = new Date(pred.fechaPrediccion);
          const predDateOnly = new Date(Date.UTC(
            predDate.getUTCFullYear(),
            predDate.getUTCMonth(),
            predDate.getUTCDate()
          ));

          return predDateOnly.getTime() === receptionDateOnly.getTime();
        });

        if (matchingPredictions.length > 0) {
          // precioFinalVenta ya es el precio por libra
          const realPricePerLb = reception.precioFinalVenta || 0;

          comparisons.push({
            calibre: shrimpSizeCode,
            presentacion: reception.order.presentationType?.code || 'N/A',
            realPrice: realPricePerLb,
            predictions: matchingPredictions.map(p => ({
              predictedPrice: p.precioPredicho,
              difference: realPricePerLb - p.precioPredicho
            }))
          });
        }
      }

      // Agrupar y resumir por calibre
      const summary = Array.from(new Set(comparisons.map(c => c.calibre))).map((calibre) => {
        const calibreComparisons = comparisons.filter(c => c.calibre === calibre);
        const allPredictions = calibreComparisons.flatMap(c => c.predictions);

        const avgRealPrice = calibreComparisons.reduce((sum, c) => sum + c.realPrice, 0) / calibreComparisons.length;
        const avgPredictedPrice = allPredictions.length > 0
          ? allPredictions.reduce((sum, p) => sum + p.predictedPrice, 0) / allPredictions.length
          : 0;

        return {
          calibre,
          averageRealPrice: parseFloat(avgRealPrice.toFixed(4)),
          averagePredictedPrice: parseFloat(avgPredictedPrice.toFixed(4)),
          difference: parseFloat(Math.abs(avgRealPrice - avgPredictedPrice).toFixed(4)),
          percentageDifference: avgRealPrice > 0
            ? parseFloat(((Math.abs(avgRealPrice - avgPredictedPrice) / avgRealPrice) * 100).toFixed(2))
            : 0,
          receptionCount: calibreComparisons.length,
          predictionCount: allPredictions.length,
        };
      });

      return {
        status: 'success',
        presentacion: presentacion || 'Todas',
        summary,
      };
    } catch (error) {
      this.logger.error(`Error obteniendo resumen: ${error.message}`);
      throw new HttpException(
        'Error al obtener resumen de comparación',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
