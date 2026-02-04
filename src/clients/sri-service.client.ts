import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '../common/http-client.service';

interface SriAuthorizationResult {
  success: boolean;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlAutorizado?: string;
  error?: string;
}

/**
 * Client for SRI Microservice (FIRMA_SRI_3_API)
 * Handles electronic signature and SRI authorization
 */
@Injectable()
export class SriServiceClient {
  private readonly logger = new Logger(SriServiceClient.name);
  private readonly sriServiceUrl: string;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
  ) {
    this.sriServiceUrl =
      this.configService.get<string>('SRI_SERVICE_URL') ||
      'http://localhost:9000';
  }

  /**
   * Sign and authorize XML document
   */
  async signAndAuthorize(
    xmlContent: string,
    certificadoP12: Buffer,
    claveCertificado: string,
  ): Promise<SriAuthorizationResult> {
    try {
      this.logger.log('Sending document to SRI service for signature and authorization');

      // Create FormData for multipart/form-data
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('archivo_xml', Buffer.from(xmlContent), {
        filename: 'documento.xml',
        contentType: 'application/xml',
      });
      formData.append('certificado_p12', certificadoP12, {
        filename: 'certificado.p12',
        contentType: 'application/x-pkcs12',
      });
      formData.append('clave_certificado', claveCertificado);

      const result = await this.httpClient.post<SriAuthorizationResult>(
        this.sriServiceUrl,
        '/api/facturacion/procesar',
        formData,
        {
          ...formData.getHeaders(),
        },
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to sign and authorize document: ${error.message}`,
      );
      
      return {
        success: false,
        error: error.message || 'SRI service unavailable',
      };
    }
  }

  /**
   * Verify authorization status
   */
  async verifyAuthorization(claveAcceso: string): Promise<any> {
    try {
      return await this.httpClient.get(
        this.sriServiceUrl,
        `/api/facturacion/autorizar/${claveAcceso}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to verify authorization: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.httpClient.get(this.sriServiceUrl, '/health');
      return true;
    } catch {
      return false;
    }
  }
}
