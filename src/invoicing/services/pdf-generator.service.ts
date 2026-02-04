import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

interface InvoiceData {
  id: string;
  numeroDocumento: string;
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
  detalles: Array<{
    codigo: string;
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

      // Generar código QR
      const qrCodeDataUrl = await QRCode.toDataURL(invoiceData.claveAcceso, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 100,
      });

      const qrBuffer = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

      // ============ HEADER ============
      doc.fontSize(16).font('Helvetica-Bold').text(invoiceData.razonSocial || 'N/A', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`RUC: ${invoiceData.ruc || 'N/A'}`, { align: 'center' });
      doc.fontSize(10).text(invoiceData.direccion || 'N/A', { align: 'center' });
      if (invoiceData.telefono) {
        doc.fontSize(9).text(`Tel: ${invoiceData.telefono}`, { align: 'center' });
      }

      doc.moveTo(40, doc.y + 5).lineTo(550, doc.y + 5).stroke();
      doc.moveDown();

      // ============ INFORMACIÓN DE DOCUMENTO ============
      doc.fontSize(12).font('Helvetica-Bold').text('FACTURA', { align: 'center' });
      doc.fontSize(9).font('Helvetica');

      const infoBox = [
        { label: 'Número:', value: invoiceData.numeroDocumento || 'N/A' },
        { label: 'Fecha:', value: this.formatDate(invoiceData.fecha) },
        { label: 'Clave de Acceso:', value: invoiceData.claveAcceso || 'N/A' },
      ];

      doc.x = 40;
      infoBox.forEach((item, index) => {
        const y = doc.y;
        doc.text(`${item.label} ${item.value}`, 50, y);
        if (index < infoBox.length - 1) doc.moveDown(0.5);
      });

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // ============ INFORMACIÓN DEL CLIENTE ============
      doc.fontSize(10).font('Helvetica-Bold').text('CLIENTE:', 50);
      doc.fontSize(9).font('Helvetica');
      doc.text(`Nombre: ${invoiceData.clienteNombre || 'N/A'}`);
      doc.text(`RUC/Cédula: ${invoiceData.clienteRuc || 'N/A'}`);
      doc.text(`Dirección: ${invoiceData.clienteDireccion || 'N/A'}`);

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // ============ DETALLES ============
      this.drawItemsTable(doc, invoiceData.detalles);

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // ============ TOTALES ============
      const rightX = 450;
      doc.fontSize(9).font('Helvetica');

      const totals: Array<{ label: string; value: string; isBold?: boolean }> = [
        { label: 'Subtotal:', value: `$${invoiceData.subtotalSinImpuestos.toFixed(2)}` },
      ];

      if (invoiceData.subtotal0 > 0) {
        totals.push({ label: '  Tarifa 0%:', value: `$${invoiceData.subtotal0.toFixed(2)}` });
      }
      if (invoiceData.subtotal5 > 0) {
        totals.push({ label: '  Tarifa 5%:', value: `$${invoiceData.subtotal5.toFixed(2)}` });
      }
      if (invoiceData.subtotal12 > 0) {
        totals.push({ label: '  Tarifa 12%:', value: `$${invoiceData.subtotal12.toFixed(2)}` });
      }
      if (invoiceData.subtotal14 > 0) {
        totals.push({ label: '  Tarifa 14%:', value: `$${invoiceData.subtotal14.toFixed(2)}` });
      }
      if (invoiceData.subtotal15 > 0) {
        totals.push({ label: '  Tarifa 15%:', value: `$${invoiceData.subtotal15.toFixed(2)}` });
      }
      if (invoiceData.subtotal20 > 0) {
        totals.push({ label: '  Tarifa 20%:', value: `$${invoiceData.subtotal20.toFixed(2)}` });
      }

      totals.push({ label: 'IVA Total:', value: `$${invoiceData.iva.toFixed(2)}` });
      totals.push({ label: 'TOTAL:', value: `$${invoiceData.total.toFixed(2)}`, isBold: true });

      totals.forEach((total) => {
        if (total.isBold) {
          doc.font('Helvetica-Bold').fontSize(11);
        }
        doc.text(total.label, 40);
        doc.text(total.value, rightX, doc.y - doc.currentLineHeight(), { align: 'right' });
        if (total.isBold) {
          doc.font('Helvetica').fontSize(9);
        } else {
          doc.moveDown(0.3);
        }
      });

      doc.moveDown();

      // ============ INFORMACIÓN ADICIONAL ============
      if (invoiceData.formaPago) {
        doc.fontSize(9).text(`Forma de Pago: ${invoiceData.formaPago}`);
      }
      if (invoiceData.plazoCredito) {
        doc.text(`Plazo de Crédito: ${invoiceData.plazoCredito} días`);
      }
      if (invoiceData.observaciones) {
        doc.text(`Observaciones: ${invoiceData.observaciones}`);
      }

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // ============ CÓDIGO QR ============
      doc.fontSize(10).font('Helvetica-Bold').text('Clave de Acceso:', 40);
      doc.fontSize(9).font('Helvetica').text(invoiceData.claveAcceso || 'N/A', { align: 'center' });
      doc.moveDown(1);

      // Insertar QR (centrado)
      const qrY = doc.y;
      doc.image(qrBuffer, 250, qrY, { width: 100, height: 100 });
      
      // Mover cursor después del QR
      doc.y = qrY + 110;

      // ============ FOOTER ============
      doc.fontSize(8).text(
        'RIDE (Representación Impresa de Documento Electrónico)',
        { align: 'center' },
      );
      doc.text('Este documento es una representación del Comprobante Electrónico', { align: 'center' });
      doc.text('Generado por MARANSA CIA LTDA', { align: 'center' });

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
    const col1X = 45;
    const col2X = 130;
    const col3X = 340;
    const col4X = 415;
    const col5X = 490;
    const rowHeight = 20;

    // Encabezados
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Código', col1X, tableTop);
    doc.text('Descripción', col2X, tableTop);
    doc.text('Cant.', col3X, tableTop, { width: 60, align: 'center' });
    doc.text('Precio', col4X, tableTop, { width: 60, align: 'right' });
    doc.text('Total', col5X, tableTop, { width: 60, align: 'right' });

    // Línea separadora
    doc.moveTo(40, tableTop + rowHeight - 5).lineTo(550, tableTop + rowHeight - 5).stroke();

    // Items
    doc.fontSize(8).font('Helvetica');
    let currentY = tableTop + rowHeight;

    detalles.forEach((item) => {
      // Saltar a nueva página si es necesario
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(item.codigo || '-', col1X, currentY, { width: 70 });
      doc.text(item.descripcion || '-', col2X, currentY, { width: 180 });
      doc.text((item.cantidad || 0).toString(), col3X, currentY, { width: 60, align: 'center' });
      doc.text(`$${(item.precioUnitario || 0).toFixed(2)}`, col4X, currentY, { width: 60, align: 'right' });
      doc.text(`$${(item.subtotal || 0).toFixed(2)}`, col5X, currentY, { width: 60, align: 'right' });

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
}
