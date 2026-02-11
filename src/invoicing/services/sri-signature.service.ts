import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';

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
      this.logger.log(`Enviando ${tipoDocumento} al servicio de firma: ${urlFirmaService}/api/facturacion/procesar`);

      const formData = new FormData();
      // Adjuntar XML como archivo
      formData.append('archivo_xml', Buffer.from(xml, 'utf-8'), {
        filename: 'documento.xml',
        contentType: 'application/xml',
      });
      // Adjuntar certificado leyendo del disco
      if (!fs.existsSync(rutaCertificado)) {
        throw new BadRequestException(`No se encuentra el certificado en: ${rutaCertificado}`);
      }
      formData.append('certificado_p12', fs.createReadStream(rutaCertificado));
      formData.append('clave_certificado', claveCertificado);
      formData.append('tipo_documento', tipoDocumento);

      const response = await axios.post(
        `${urlFirmaService}/api/facturacion/procesar`,
        formData,
        {
          timeout: 40000,
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      if (response.data.success) {
        this.logger.log(`✅ ${tipoDocumento} procesado exitosamente`);

        const data = response.data.data;
        // Decodificar XML autorizado de Base64
        const xmlAutorizado = Buffer.from(data.xml_autorizado_base64, 'base64').toString('utf-8');

        return {
          xmlFirmado: xmlAutorizado,
          numeroAutorizacion: data.numero_autorizacion,
          fechaAutorizacion: data.fecha_autorizacion,
          estado: data.estado || 'AUTORIZADO',
        };
      } else {
        throw new BadRequestException(
          `Error en firma/autorización: ${response.data.message || 'Error desconocido'}`,
        );
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        // Errores conocidos del servicio
        throw new BadRequestException(`Error SRI: ${error.response.data.message}`);
      }
      if (error.response?.data?.error?.message) {
        // Estructura de error del PHP nueva
        throw new BadRequestException(`Error SRI: ${error.response.data.error.message}`);
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

      // El endpoint de consulta en PHP es POST /api/facturacion/consultar-autorizacion y requiere JSON body
      const response = await axios.post(
        `${urlFirmaService}/api/facturacion/consultar-autorizacion`,
        { clave_acceso: claveAcceso },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      if (response.data.success) {
        const data = response.data.data;
        let xmlAutorizado: string | undefined;
        if (data.xml_autorizado_base64) {
          xmlAutorizado = Buffer.from(data.xml_autorizado_base64, 'base64').toString('utf-8');
        }

        return {
          estado: data.estado,
          xmlAutorizado: xmlAutorizado,
          numeroAutorizacion: data.numero_autorizacion,
          fechaAutorizacion: data.fecha_autorizacion,
          mensajes: data.mensajes || [],
        };
      }

      return { estado: 'ERROR', mensajes: [response.data.message] };

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
