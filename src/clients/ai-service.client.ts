import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '../common/http-client.service';

interface PricePrediction {
  precioEstimado: number;
  confianza: number;
  factoresInfluencia: any;
}

/**
 * Client for AI Microservice
 * Handles price predictions and market analysis
 */
@Injectable()
export class AiServiceClient {
  private readonly logger = new Logger(AiServiceClient.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://localhost:8000';
  }

  /**
   * Predict price for an order
   */
  async predictPrice(
    providerId: number,
    cantidadLibras: number,
    fechaPedido: string,
  ): Promise<PricePrediction> {
    try {
      this.logger.log(
        `Requesting price prediction from AI service for provider ${providerId}`,
      );

      const result = await this.httpClient.post<PricePrediction>(
        this.aiServiceUrl,
        '/api/ai/predict/price',
        {
          providerId,
          cantidadLibras,
          fechaPedido,
        },
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get price prediction: ${error.message}`,
      );
      
      // Fallback: return basic estimation
      return {
        precioEstimado: 2.5,
        confianza: 0.5,
        factoresInfluencia: {
          error: 'AI service unavailable, using fallback',
        },
      };
    }
  }

  /**
   * Get market factors
   */
  async getMarketFactors(): Promise<any> {
    try {
      return await this.httpClient.get(
        this.aiServiceUrl,
        '/api/ai/market/factors',
      );
    } catch (error) {
      this.logger.error(`Failed to get market factors: ${error.message}`);
      return {
        demandaInternacional: 'MEDIA',
        estacionalidad: 'NORMAL',
        competencia: 'ALTA',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.httpClient.get(this.aiServiceUrl, '/health');
      return true;
    } catch {
      return false;
    }
  }
}
