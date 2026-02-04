import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs/promises';

@Injectable()
export class SriSignatureService {
  private readonly logger = new Logger(SriSignatureService.name);
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024, // 50MB
    });
  }

  /**
   * Envía un XML al microservicio de firma para ser firmado y autorizado por el SRI
   * @param xmlContent Contenido del XML a firmar
   * @param certificadoPath Ruta al archivo .p12 del certificado
   * @param claveCertificado Contraseña del certificado
   * @param tipoDocumento Tipo de documento (factura, notaCredito, etc)
   * @param urlFirmaService URL del microservicio de firma
   * @returns XML firmado y autorizado
   */
  async firmarYAutorizarXml(
    xmlContent: string,
    certificadoPath: string,
    claveCertificado: string,
    tipoDocumento: string = 'factura',
    urlFirmaService: string = 'http://localhost:9000',
  ): Promise<{
    xmlFirmado: string;
    numeroAutorizacion: string;
    fechaAutorizacion: string;
    estado: string;
  }> {
    try {
      this.logger.debug(`Iniciando firma de ${tipoDocumento} en ${urlFirmaService}`);

      // Verificar que el archivo del certificado existe
      const certExists = await this.fileExists(certificadoPath);
      if (!certExists) {
        throw new BadRequestException(`Certificado no encontrado en: ${certificadoPath}`);
      }

      // Crear FormData con los archivos y parámetros
      const form = new FormData();

      // Agregar XML como string (no como archivo)
      form.append('archivo_xml', Buffer.from(xmlContent), {
        filename: `factura_${Date.now()}.xml`,
        contentType: 'application/xml',
      });

      // Agregar certificado como archivo
      const certData = await fs.readFile(certificadoPath);
      form.append('certificado_p12', certData, {
        filename: 'certificado.p12',
        contentType: 'application/x-pkcs12',
      });

      // Agregar parámetros
      form.append('clave_certificado', claveCertificado);
      form.append('tipo_documento', tipoDocumento);

      // Realizar la solicitud POST
      const endpoint = `${urlFirmaService}/api/facturacion/procesar`;
      this.logger.debug(`Enviando XML a: ${endpoint}`);

      const response = await this.axiosInstance.post(endpoint, form, {
        headers: form.getHeaders(),
      });

      if (!response.data.success) {
        throw new BadRequestException(
          `Error del servicio de firma: ${response.data.error?.message || 'Error desconocido'}`,
        );
      }

      this.logger.log(`✅ XML firmado exitosamente. Autorización: ${response.data.data.numero_autorizacion}`);

      return {
        xmlFirmado: response.data.data.documento_firmado,
        numeroAutorizacion: response.data.data.numero_autorizacion,
        fechaAutorizacion: response.data.data.fecha_autorizacion,
        estado: 'AUTORIZADO',
      };
    } catch (error: any) {
      this.logger.error(`Error en firma: ${error.message}`);

      if (error.response?.status === 400) {
        throw new BadRequestException(`Error de validación: ${error.response.data?.error?.message}`);
      }

      if (error.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          `No se puede conectar al servicio de firma en ${urlFirmaService}. ¿Está ejecutándose?`,
        );
      }

      if (error.code === 'ETIMEDOUT') {
        throw new BadRequestException('Timeout al conectar con el servicio de firma');
      }

      throw new BadRequestException(`Error en firma de XML: ${error.message}`);
    }
  }

  /**
   * Verifica si un archivo existe
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
