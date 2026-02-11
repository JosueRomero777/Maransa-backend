import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SriSignatureService {
  private readonly logger = new Logger(SriSignatureService.name);

  /**
   * Firma y autoriza un XML ante el SRI
   * @param xml XML a firmar
   * @param rutaCertificado Ruta al certificado digital .p12
   * @param claveCertificado Contraseña del certificado
   * @param tipoDocumento Tipo de documento (factura, notaCredito, etc.)
   * @param urlFirmaService URL del servicio de firma
   * @returns Resultado con XML firmado, número y fecha de autorización
   */
  async firmarYAutorizarXml(
    xml: string,
    rutaCertificado: string,
    claveCertificado: string,
    tipoDocumento: string,
    urlFirmaService: string,
  ): Promise<{
    xmlFirmado: string;
    numeroAutorizacion: string;
    fechaAutorizacion: string;
    estado: string;
  }> {
    try {
      this.logger.log(`Enviando ${tipoDocumento} al servicio de firma: ${urlFirmaService}`);

      const response = await axios.post(
        `${urlFirmaService}/api/firmar-autorizar`,
        {
          xml,
          certificadoPath: rutaCertificado,
          certificadoPassword: claveCertificado,
          tipoDocumento,
        },
        {
          timeout: 30000, // 30 segundos
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.success) {
        this.logger.log(`✅ ${tipoDocumento} firmado y autorizado exitosamente`);
        return {
          xmlFirmado: response.data.xmlFirmado,
          numeroAutorizacion: response.data.numeroAutorizacion,
          fechaAutorizacion: response.data.fechaAutorizacion,
          estado: response.data.estado || 'AUTORIZADO',
        };
      } else {
        throw new BadRequestException(
          `Error en firma/autorización: ${response.data.message || 'Error desconocido'}`,
        );
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        // Si el error indica que está en procesamiento, propagarlo
        if (error.response.data.message.includes('EN PROCESAMIENTO')) {
          throw new BadRequestException(`CLAVE DE ACCESO EN PROCESAMIENTO: ${error.response.data.claveAcceso}`);
        }
        throw new BadRequestException(`Error SRI: ${error.response.data.message}`);
      }

      if (error.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          `No se pudo conectar al servicio de firma en ${urlFirmaService}. Verifique que el servicio esté activo.`,
        );
      }

      this.logger.error(`Error firmando XML: ${error.message}`);
      throw new BadRequestException(`Error al firmar documento: ${error.message}`);
    }
  }

  /**
   * Consulta el estado de autorización de un comprobante en el SRI
   * @param claveAcceso Clave de acceso del comprobante
   * @param urlFirmaService URL del servicio de firma
   * @returns Estado y XML autorizado si está disponible
   */
  async consultarAutorizacion(
    claveAcceso: string,
    urlFirmaService: string,
  ): Promise<{
    estado: string;
    xmlAutorizado?: string;
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    mensajes?: any[];
  }> {
    try {
      this.logger.log(`Consultando autorización para clave: ${claveAcceso}`);

      const response = await axios.get(
        `${urlFirmaService}/api/consultar-autorizacion/${claveAcceso}`,
        {
          timeout: 15000, // 15 segundos
        },
      );

      return {
        estado: response.data.estado,
        xmlAutorizado: response.data.xmlAutorizado,
        numeroAutorizacion: response.data.numeroAutorizacion,
        fechaAutorizacion: response.data.fechaAutorizacion,
        mensajes: response.data.mensajes || [],
      };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          `No se pudo conectar al servicio de firma en ${urlFirmaService}`,
        );
      }

      this.logger.error(`Error consultando autorización: ${error.message}`);
      throw new BadRequestException(`Error al consultar autorización: ${error.message}`);
    }
  }
}
