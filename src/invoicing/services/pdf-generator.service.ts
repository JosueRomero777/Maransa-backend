import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

interface InvoiceData {
  id: string;
  numeroDocumento: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  emision?: string;
  fecha: string;
  claveAcceso: string;
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono?: string;
  email?: string;
  clienteNombre: string;
  clienteRuc: string;
  clienteDireccion: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  detalles: Array<{
    codigo: string;
    codigoAuxiliar?: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento?: number;
    subtotal: number;
  }>;
  subtotalSinImpuestos: number;
  subtotal0: number;
  subtotal5: number;
  subtotal12: number;
  subtotal14: number;
  subtotal15: number;
  subtotal20: number;
  iva: number;
  total: number;
  formaPago?: string;
  plazoCredito?: number;
  observaciones?: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  /**
   * Genera un PDF en formato RIDE (Representación Impresa de Documento Electrónico)
   * @param invoiceData Datos de la factura
   * @param outputPath Ruta donde guardar el PDF
   * @returns Ruta del archivo generado
   */
  async generateRidePdf(invoiceData: InvoiceData, outputPath: string): Promise<string> {
    try {
      this.logger.debug(`Generando RIDE para factura ${invoiceData.numeroDocumento}`);
      
      // Validar datos requeridos
      if (!invoiceData.razonSocial || invoiceData.razonSocial.trim() === '') {
        invoiceData.razonSocial = 'N/A';
      }
      if (!invoiceData.ruc || invoiceData.ruc.trim() === '') {
        invoiceData.ruc = 'N/A';
      }
      if (!invoiceData.direccion || invoiceData.direccion.trim() === '') {
        invoiceData.direccion = 'N/A';
      }
      if (!invoiceData.clienteNombre || invoiceData.clienteNombre.trim() === '') {
        invoiceData.clienteNombre = 'Consumidor Final';
      }
      if (!invoiceData.clienteRuc || invoiceData.clienteRuc.trim() === '') {
        invoiceData.clienteRuc = '9999999999999';
      }
      if (!invoiceData.clienteDireccion || invoiceData.clienteDireccion.trim() === '') {
        invoiceData.clienteDireccion = 'N/A';
      }
      if (!invoiceData.claveAcceso || invoiceData.claveAcceso.trim() === '') {
        invoiceData.claveAcceso = 'N/A';
      }

      // Crear directorio si no existe
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Crear documento PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // Guardar a archivo
      const writeStream = require('fs').createWriteStream(outputPath);
      doc.pipe(writeStream);

      const ambient = invoiceData.ambiente || this.getAmbienteFromClave(invoiceData.claveAcceso);
      const emision = invoiceData.emision || 'NORMAL';
      const numeroAutorizacion = invoiceData.numeroAutorizacion || 'N/A';
      const fechaAutorizacion = invoiceData.fechaAutorizacion
        ? this.formatDateTime(invoiceData.fechaAutorizacion)
        : 'N/A';

      // ============ HEADER ============
      const logoPath = path.resolve(process.cwd(), '..', 'maransa', 'src', 'assets', 'camaron.png');
      if (await this.fileExists(logoPath)) {
        // Logo centrado sobre la caja emisor (issuerBox x=40, w=250, centro=165)
        doc.image(logoPath, 130, 45, { width: 70 });
      }

      // Caja derecha de documento
      const docBoxX = 300;
      const docBoxY = 35;
      const docBoxW = 250;
      const docBoxH = 175;
      doc.rect(docBoxX, docBoxY, docBoxW, docBoxH).stroke();

      let cursorY = docBoxY + 8;
      doc.fontSize(8).font('Helvetica');
      doc.text(`R.U.C.: ${invoiceData.ruc || 'N/A'}`, docBoxX + 8, cursorY, { width: docBoxW - 16 });
      cursorY += 14;
      doc.fontSize(11).font('Helvetica-Bold').text('FACTURA', docBoxX + 8, cursorY, { width: docBoxW - 16, align: 'left' });
      cursorY += 18;
      doc.fontSize(8).font('Helvetica').text(`No: ${invoiceData.numeroDocumento || 'N/A'}`, docBoxX + 8, cursorY, { width: docBoxW - 16 });
      cursorY += 18;
      doc.font('Helvetica-Bold').text(`NUMERO DE AUTORIZACION:`, docBoxX + 8, cursorY, { width: docBoxW - 16 });
      cursorY += 10;
      doc.font('Helvetica').text(`${numeroAutorizacion}`, docBoxX + 8, cursorY, { width: docBoxW - 16 });
      cursorY += 14;
      doc.font('Helvetica-Bold').text(`FECHA Y HORA DE AUTORIZACION: `, docBoxX + 8, cursorY, { width: docBoxW - 16, continued: true });
      doc.font('Helvetica').text(`${fechaAutorizacion}`, { width: docBoxW - 16 });
      cursorY += 14;
      doc.font('Helvetica-Bold').text(`AMBIENTE: `, docBoxX + 8, cursorY, { continued: true });
      doc.font('Helvetica').text(`${ambient}`);
      cursorY += 14;
      doc.font('Helvetica-Bold').text(`EMISION: `, docBoxX + 8, cursorY, { continued: true });
      doc.font('Helvetica').text(`${emision}`);
      cursorY += 14;
      doc.font('Helvetica-Bold').text('CLAVE DE ACCESO:', docBoxX + 8, cursorY, { width: docBoxW - 16 });
      cursorY += 10;

      // Código de barras
      const barcodeY = cursorY;
      const barcodeBuffer = await this.generateBarcode(invoiceData.claveAcceso);
      if (barcodeBuffer) {
        doc.image(barcodeBuffer, docBoxX + 8, barcodeY, { width: docBoxW - 16, height: 25 });
        // Texto de clave debajo del código de barras
        doc.fontSize(7).font('Helvetica').text(invoiceData.claveAcceso || 'N/A', docBoxX + 8, barcodeY + 27, { width: docBoxW - 16 });
      } else {
        // Si no hay código de barras, solo mostrar el texto
        doc.fontSize(7).font('Helvetica').text(invoiceData.claveAcceso || 'N/A', docBoxX + 8, barcodeY, { width: docBoxW - 16 });
      }

      // Caja izquierda de emisor
      const issuerBoxX = 40;
      const issuerBoxY = 145;
      const issuerBoxW = 250;
      const issuerBoxH = 95;
      doc.roundedRect(issuerBoxX, issuerBoxY, issuerBoxW, issuerBoxH, 6).stroke();
      let issuerY = issuerBoxY + 8;
      doc.fontSize(8).font('Helvetica-Bold').text(invoiceData.razonSocial || 'N/A', issuerBoxX + 8, issuerY, { width: issuerBoxW - 16 });
      issuerY += 14;
      doc.fontSize(8).font('Helvetica-Bold').text(`DIRECCION:`, issuerBoxX + 8, issuerY, { continued: true });
      doc.font('Helvetica').text(` ${invoiceData.direccion || 'N/A'}`, { width: issuerBoxW - 16 });
      issuerY += 14;
      doc.font('Helvetica-Bold').text(`EMAIL:`, issuerBoxX + 8, issuerY, { continued: true });
      doc.font('Helvetica').text(` ${invoiceData.email || '-'}`, { width: issuerBoxW - 16 });
      issuerY += 14;
      doc.font('Helvetica-Bold').text(`TELEFONO:`, issuerBoxX + 8, issuerY, { continued: true });
      doc.font('Helvetica').text(` ${invoiceData.telefono || '-'}`, { width: issuerBoxW - 16 });
      issuerY += 14;
      doc.font('Helvetica-Bold').text('OBLIGADO A LLEVAR CONTABILIDAD:', issuerBoxX + 8, issuerY, { width: issuerBoxW - 16, continued: true });
      doc.font('Helvetica').text(' N/A', { width: issuerBoxW - 16 });

      // Caja cliente
      const buyerBoxX = 40;
      const buyerBoxY = 250;
      const buyerBoxW = 510;
      const buyerBoxH = 56;
      doc.rect(buyerBoxX, buyerBoxY, buyerBoxW, buyerBoxH).stroke();
      doc.fontSize(8).font('Helvetica-Bold').text('RAZON SOCIAL:', buyerBoxX + 8, buyerBoxY + 8);
      doc.fontSize(8).font('Helvetica').text(invoiceData.clienteNombre || 'N/A', buyerBoxX + 90, buyerBoxY + 8, { width: 260 });
      doc.fontSize(8).font('Helvetica-Bold').text('RUC/CI:', buyerBoxX + 360, buyerBoxY + 8);
      doc.fontSize(8).font('Helvetica').text(invoiceData.clienteRuc || 'N/A', buyerBoxX + 410, buyerBoxY + 8);
      doc.fontSize(8).font('Helvetica-Bold').text('DIRECCION:', buyerBoxX + 8, buyerBoxY + 24);
      doc.fontSize(8).font('Helvetica').text(invoiceData.clienteDireccion || 'N/A', buyerBoxX + 70, buyerBoxY + 24, { width: 260 });
      doc.fontSize(8).font('Helvetica-Bold').text('FECHA DE EMISION:', buyerBoxX + 360, buyerBoxY + 24);
      doc.fontSize(8).font('Helvetica').text(this.formatDate(invoiceData.fecha), buyerBoxX + 455, buyerBoxY + 24);
      doc.fontSize(8).font('Helvetica-Bold').text('GUÍA DE REMISIÓN:', buyerBoxX + 8, buyerBoxY + 40);
      doc.fontSize(8).font('Helvetica').text('N/A', buyerBoxX + 110, buyerBoxY + 40);

      // ============ DETALLES ============
      doc.y = buyerBoxY + buyerBoxH + 10;
      this.drawItemsTable(doc, invoiceData.detalles);

      // ============ INFO ADICIONAL Y TOTALES ============
      const bottomY = doc.y + 10;
      const infoBoxX = 40;
      const infoBoxY = bottomY;
      const infoBoxW = 300;
      const infoBoxH = 110;
      doc.rect(infoBoxX, infoBoxY, infoBoxW, infoBoxH).stroke();
      doc.fontSize(8).font('Helvetica-Bold').text('INFORMACION ADICIONAL', infoBoxX + 8, infoBoxY + 6);
      doc.fontSize(8).font('Helvetica-Bold').text(`DIRECCION:`, infoBoxX + 8, infoBoxY + 20, { continued: true });
      doc.font('Helvetica').text(` ${invoiceData.clienteDireccion || '-'}`, { width: infoBoxW - 16 });
      doc.font('Helvetica-Bold').text(`CORREO:`, infoBoxX + 8, infoBoxY + 34, { continued: true });
      doc.font('Helvetica').text(` ${invoiceData.clienteEmail || '-'}`, { width: infoBoxW - 16 });
      doc.font('Helvetica-Bold').text(`TELEFONO:`, infoBoxX + 8, infoBoxY + 48, { continued: true });
      doc.font('Helvetica').text(` ${invoiceData.clienteTelefono || '-'}`, { width: infoBoxW - 16 });

      const pagosY = infoBoxY + 70;
      doc.rect(infoBoxX + 6, pagosY, infoBoxW - 12, 34).stroke();
      doc.fontSize(7).font('Helvetica-Bold').text('COD', infoBoxX + 10, pagosY + 4);
      doc.text('FORMA DE PAGO', infoBoxX + 35, pagosY + 4);
      doc.text('VALOR', infoBoxX + 200, pagosY + 4);
      doc.text('PLAZO', infoBoxX + 245, pagosY + 4);
      doc.fontSize(7).font('Helvetica').text(invoiceData.formaPago || '01', infoBoxX + 12, pagosY + 18);
      doc.text(this.getFormaPagoNombre(invoiceData.formaPago), infoBoxX + 35, pagosY + 18, { width: 150 });
      doc.text(`$${invoiceData.total.toFixed(2)}`, infoBoxX + 200, pagosY + 18);
      doc.text(invoiceData.plazoCredito ? `${invoiceData.plazoCredito}` : '-', infoBoxX + 245, pagosY + 18);

      const totalsBoxX = 360;
      const totalsBoxY = bottomY;
      const totalsBoxW = 190;
      const totalsBoxH = 110;
      doc.rect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH).stroke();
      doc.fontSize(8).font('Helvetica');

      const totalDescuento = invoiceData.detalles.reduce((sum, d) => sum + (d.descuento || 0), 0);
      
      // Calcular IVA desglosado
      const iva5 = invoiceData.subtotal5 * 0.05;
      const iva15 = invoiceData.subtotal15 * 0.15;
      
      const totals = [
        { label: 'SUBTOTAL 5%', value: invoiceData.subtotal5 },
        { label: 'SUBTOTAL 15% (USD)', value: invoiceData.subtotal15 },
        { label: 'SUBTOTAL 0%', value: invoiceData.subtotal0 },
        { label: 'SUBTOTAL SIN IMPUESTO', value: invoiceData.subtotalSinImpuestos },
        { label: 'DESCUENTO', value: totalDescuento },
        { label: 'IVA 5% (USD)', value: iva5 },
        { label: 'IVA 15% (USD)', value: iva15 },
        { label: 'TOTAL (USD)', value: invoiceData.total },
      ];

      let totalsY = totalsBoxY + 8;
      totals.forEach((item) => {
        doc.text(item.label, totalsBoxX + 6, totalsY, { width: 120 });
        doc.text(`$${item.value.toFixed(2)}`, totalsBoxX + 120, totalsY, { width: 60, align: 'right' });
        totalsY += 12;
      });

      // ============ FOOTER ============
      const footerY = Math.max(infoBoxY + infoBoxH + 15, totalsBoxY + totalsBoxH + 15);
      doc.fontSize(7).font('Helvetica').text('Pagina 1 de 1', 40, footerY, { align: 'center', width: 510 });

      // Finalizar documento
      doc.end();

      // Esperar a que se escriba el archivo
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          this.logger.log(`✅ PDF generado: ${outputPath}`);
          resolve();
        });
        writeStream.on('error', reject);
      });

      return outputPath;
    } catch (error: any) {
      this.logger.error(`Error generando PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Dibuja tabla de items en el PDF
   */
  private drawItemsTable(doc: any, detalles: InvoiceData['detalles']): void {
    const tableTop = doc.y;
    const rowHeight = 18;

    const colNo = 42;
    const colCodigo = 60;
    const colAux = 100;
    const colDesc = 150;
    const colCant = 305;
    const colPrecio = 345;
    const colSubsidio = 390;
    const colSinSub = 435;
    const colDescVal = 480;
    const colTotal = 515;

    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('No', colNo, tableTop, { width: 15 });
    doc.text('CODIGO', colCodigo, tableTop, { width: 35 });
    doc.text('CODIGO AUX.', colAux, tableTop, { width: 45 });
    doc.text('DESCRIPCION', colDesc, tableTop, { width: 150 });
    doc.text('CANTIDAD', colCant, tableTop, { width: 35, align: 'right' });
    doc.text('PRECIO U.', colPrecio, tableTop, { width: 40, align: 'right' });
    doc.text('SUBSIDIO', colSubsidio, tableTop, { width: 40, align: 'right' });
    doc.text('PRECIO SIN', colSinSub, tableTop, { width: 40, align: 'center' });
    doc.text('SUBSIDIO', colSinSub, tableTop + 8, { width: 40, align: 'center' });
    doc.text('DESC.', colDescVal, tableTop, { width: 30, align: 'right' });
    doc.text('TOTAL', colTotal, tableTop, { width: 35, align: 'right' });

    doc.moveTo(40, tableTop + rowHeight + 2).lineTo(550, tableTop + rowHeight + 2).stroke();

    doc.fontSize(6).font('Helvetica');
    let currentY = tableTop + rowHeight + 4;

    detalles.forEach((item, index) => {
      if (currentY > 520) {
        doc.addPage();
        currentY = 50;
      }

      const descuento = item.descuento || 0;
      const precio = item.precioUnitario || 0;
      const subtotal = item.subtotal || 0;

      doc.text(String(index + 1), colNo, currentY, { width: 15 });
      doc.text(item.codigo || '-', colCodigo, currentY, { width: 35 });
      doc.text(item.codigoAuxiliar || '-', colAux, currentY, { width: 45 });
      doc.text(item.descripcion || '-', colDesc, currentY, { width: 150 });
      doc.text((item.cantidad || 0).toString(), colCant, currentY, { width: 35, align: 'right' });
      doc.text(`$${precio.toFixed(2)}`, colPrecio, currentY, { width: 40, align: 'right' });
      doc.text('$0.00', colSubsidio, currentY, { width: 40, align: 'right' });
      doc.text(`$${precio.toFixed(2)}`, colSinSub, currentY, { width: 40, align: 'right' });
      doc.text(`$${descuento.toFixed(2)}`, colDescVal, currentY, { width: 30, align: 'right' });
      doc.text(`$${subtotal.toFixed(2)}`, colTotal, currentY, { width: 35, align: 'right' });

      currentY += rowHeight;
    });

    doc.y = currentY;
  }

  /**
   * Formatea una fecha
   */
  private formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  private getAmbienteFromClave(clave?: string): string {
    if (!clave || clave.length < 24) return 'N/A';
    const ambiente = clave.charAt(23);
    if (ambiente === '2') return 'PRODUCCION';
    if (ambiente === '1') return 'PRUEBAS';
    return 'N/A';
  }

  private getFormaPagoNombre(codigo?: string): string {
    const map: Record<string, string> = {
      '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
      '15': 'COMPENSACION DE DEUDAS',
      '16': 'TARJETA DE DEBITO',
      '17': 'DINERO ELECTRONICO',
      '18': 'TARJETA PREPAGO',
      '19': 'TARJETA DE CREDITO',
      '20': 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO',
    };
    if (!codigo) return '-';
    return map[codigo] || codigo;
  }

  private async generateBarcode(text: string): Promise<Buffer | null> {
    if (!text || text === 'N/A' || text.length < 49) {
      this.logger.warn(`Codigo de barras no generado. Texto invalido o longitud < 49: ${text?.length || 0}`);
      return null;
    }
    try {
      this.logger.log(`Generando codigo de barras para clave: ${text.substring(0, 10)}...`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const bwipjs = require('bwip-js');
      const buffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text,
        scale: 3,
        height: 12,
        includetext: false,
        backgroundcolor: 'ffffff',
      });
      this.logger.log(`✅ Codigo de barras generado exitosamente (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`❌ Error generando codigo de barras: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      return null;
    }
  }
}
