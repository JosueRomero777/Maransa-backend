import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { EstadoFactura, TipoComprobante } from '@prisma/client';
import { XmlGeneratorService } from './services/xml-generator.service';
import { SriSignatureService } from './services/sri-signature.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    private prisma: PrismaService,
    private xmlGenerator: XmlGeneratorService,
    private sriSignature: SriSignatureService,
    private pdfGenerator: PdfGeneratorService,
  ) {}

  // ===== FACTURAS =====

  async createInvoice(createInvoiceDto: CreateInvoiceDto) {
    // Verificar que la empacadora existe
    const packager = await this.prisma.packager.findUnique({
      where: { id: createInvoiceDto.packagerId },
    });

    if (!packager) {
      throw new NotFoundException(`Empacadora con ID ${createInvoiceDto.packagerId} no encontrada`);
    }

    // Verificar que el pedido existe (si se proporciona)
    if (createInvoiceDto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: createInvoiceDto.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Pedido con ID ${createInvoiceDto.orderId} no encontrado`);
      }
    }

    // Obtener configuración de facturación
    const config = await this.prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de facturación activa');
    }

    // Generar número de factura secuencial
    const numeroFactura = this.generateInvoiceNumber(config);

    // Calcular totales
    const totals = this.calculateTotals(createInvoiceDto.detalles);

    // Crear factura con detalles
    const invoice = await this.prisma.invoice.create({
      data: {
        numeroFactura,
        packagerId: createInvoiceDto.packagerId,
        orderId: createInvoiceDto.orderId,
        tipoComprobante: createInvoiceDto.tipoComprobante || TipoComprobante.FACTURA,
        estado: EstadoFactura.BORRADOR,
        fechaEmision: createInvoiceDto.fechaEmision ? new Date(createInvoiceDto.fechaEmision) : new Date(),
        fechaVencimiento: createInvoiceDto.fechaVencimiento ? new Date(createInvoiceDto.fechaVencimiento) : null,
        subtotalSinImpuestos: totals.subtotalSinImpuestos,
        subtotal0: totals.subtotal0,
        subtotal5: totals.subtotal5,
        subtotal12: totals.subtotal12,
        subtotal14: totals.subtotal14,
        subtotal15: totals.subtotal15,
        subtotal20: totals.subtotal20,
        iva: totals.iva,
        ice: totals.ice,
        irbpnr: totals.irbpnr,
        rebiius: totals.rebiius,
        total: totals.total,
        formaPago: createInvoiceDto.formaPago,
        plazoCredito: createInvoiceDto.plazoCredito,
        observaciones: createInvoiceDto.observaciones,
        tipoIdentificacionComprador: createInvoiceDto.tipoIdentificacionComprador,
        identificacionComprador: createInvoiceDto.identificacionComprador,
        razonSocialComprador: createInvoiceDto.razonSocialComprador,
        direccionComprador: createInvoiceDto.direccionComprador,
        emailComprador: createInvoiceDto.emailComprador,
        detalles: {
          create: createInvoiceDto.detalles.map(detalle => {
            const precioTotalSinImpuesto = (detalle.cantidad * detalle.precioUnitario) - (detalle.descuento || 0);
            const baseImponible = precioTotalSinImpuesto;
            const valorImpuesto = (baseImponible * detalle.tarifa) / 100;

            return {
              codigoPrincipal: detalle.codigoPrincipal,
              codigoAuxiliar: detalle.codigoAuxiliar,
              descripcion: detalle.descripcion,
              cantidad: detalle.cantidad,
              unidadMedida: detalle.unidadMedida || '3', // Default: unidad
              precioUnitario: detalle.precioUnitario,
              descuento: detalle.descuento || 0,
              precioTotalSinImpuesto,
              codigoImpuesto: detalle.codigoImpuesto,
              codigoPorcentaje: detalle.codigoPorcentaje,
              tarifa: detalle.tarifa,
              baseImponible,
              valor: valorImpuesto,
            };
          }),
        },
      },
      include: {
        detalles: true,
        packager: true,
        order: true,
      },
    });

    // Actualizar secuencial en configuración
    await this.prisma.invoiceConfig.update({
      where: { id: config.id },
      data: { secuencialFactura: config.secuencialFactura + 1 },
    });

    return invoice;
  }

  async findAll(filters?: { packagerId?: number; estado?: EstadoFactura; desde?: string; hasta?: string }) {
    const where: any = {};

    if (filters?.packagerId) {
      where.packagerId = filters.packagerId;
    }

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.desde || filters?.hasta) {
      where.fechaEmision = {};
      if (filters.desde) where.fechaEmision.gte = new Date(filters.desde);
      if (filters.hasta) where.fechaEmision.lte = new Date(filters.hasta);
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        packager: { select: { id: true, name: true, ruc: true } },
        order: { select: { id: true, codigo: true } },
        detalles: true,
        pagos: true,
      },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        packager: true,
        order: true,
        detalles: true,
        pagos: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    return invoice;
  }

  async update(id: number, updateInvoiceDto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);

    // No permitir editar facturas autorizadas o pagadas
    if (invoice.estado === EstadoFactura.AUTORIZADA_SRI || invoice.estado === EstadoFactura.PAGADA) {
      throw new BadRequestException('No se puede editar una factura autorizada o pagada');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateInvoiceDto,
      include: {
        packager: true,
        order: true,
        detalles: true,
        pagos: true,
      },
    });
  }

  async emitInvoice(id: number) {
    const invoice = await this.findOne(id);

    if (invoice.estado !== EstadoFactura.BORRADOR) {
      throw new BadRequestException('Solo se pueden emitir facturas en estado BORRADOR');
    }

    // Obtener configuración activa
    const config = await this.prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de facturación activa');
    }

    // Generar XML de la factura
    const xmlContent = this.xmlGenerator.generateInvoiceXml(invoice, config);

    // Generar clave de acceso (49 dígitos según SRI) - ya está en el XML
    const claveAccesoMatch = xmlContent.match(/<claveAcceso>(.*?)<\/claveAcceso>/);
    const claveAcceso = claveAccesoMatch ? claveAccesoMatch[1] : '';

    // Guardar el XML generado
    const xmlDir = path.join(process.cwd(), 'storage', 'invoices', 'xml');
    await fs.mkdir(xmlDir, { recursive: true });
    const xmlPath = path.join(xmlDir, `factura_${invoice.id}_${Date.now()}.xml`);
    await fs.writeFile(xmlPath, xmlContent, 'utf-8');

    // Generar PDF directamente (sin esperar firma SRI)
    const pdfDir = path.join(process.cwd(), 'storage', 'invoices', 'pdf');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, `factura_${invoice.id}_${Date.now()}.pdf`);

    await this.pdfGenerator.generateRidePdf(
      {
        id: invoice.id.toString(),
        numeroDocumento: invoice.numeroFactura,
        fecha: invoice.fechaEmision.toISOString(),
        claveAcceso: claveAcceso || '',
        razonSocial: config.razonSocial,
        ruc: config.ruc,
        direccion: config.direccionMatriz,
        email: undefined,
        clienteNombre: invoice.razonSocialComprador || 'Consumidor Final',
        clienteRuc: invoice.identificacionComprador || 'Consumidor Final',
        clienteDireccion: invoice.packager?.location || invoice.direccionComprador || '',
        detalles: invoice.detalles.map((d) => ({
          codigo: d.codigoPrincipal || d.codigoAuxiliar || '',
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precioUnitario: d.precioUnitario,
          descuento: d.descuento,
          subtotal: d.precioTotalSinImpuesto,
        })),
        subtotalSinImpuestos: invoice.subtotalSinImpuestos,
        subtotal0: invoice.subtotal0,
        subtotal5: invoice.subtotal5,
        subtotal12: invoice.subtotal12,
        subtotal14: invoice.subtotal14,
        subtotal15: invoice.subtotal15,
        subtotal20: invoice.subtotal20,
        iva: invoice.iva,
        total: invoice.total,
        formaPago: invoice.formaPago || '',
        plazoCredito: invoice.plazoCredito || undefined,
        observaciones: invoice.observaciones || undefined,
      },
      pdfPath,
    );

    this.logger.log(`✅ Factura ${invoice.numeroFactura} emitida con XML y PDF generados`);

    // Actualizar factura con XML, PDF y clave de acceso
    return this.prisma.invoice.update({
      where: { id },
      data: {
        estado: EstadoFactura.EMITIDA,
        claveAcceso,
        xmlGenerado: xmlContent,
        rutaXmlGenerado: xmlPath,
        rutaPdfRide: pdfPath,
      },
      include: {
        packager: true,
        order: true,
        detalles: true,
      },
    });
  }

  async authorizeInvoice(id: number, numeroAutorizacion: string, xmlAutorizado: string) {
    const invoice = await this.findOne(id);

    if (invoice.estado !== EstadoFactura.EMITIDA) {
      throw new BadRequestException('Solo se pueden autorizar facturas en estado EMITIDA');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        estado: EstadoFactura.AUTORIZADA_SRI,
        numeroAutorizacion,
        xmlAutorizado,
        fechaAutorizacion: new Date(),
      },
    });
  }

  /**
   * Firma y autoriza una factura contra el SRI
   * Realiza el flujo completo: XML → Firma → Autorización → PDF
   */
  async signAndAuthorizeInvoice(id: number) {
    const invoice = await this.findOne(id);

    if (invoice.estado !== EstadoFactura.EMITIDA) {
      throw new BadRequestException('Solo se pueden firmar facturas en estado EMITIDA');
    }

    if (!invoice.xmlGenerado) {
      throw new BadRequestException('No hay XML generado para firmar');
    }

    // Obtener configuración activa
    const config = await this.prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de facturación activa');
    }

    try {
      this.logger.log(`Iniciando firma y autorización de factura ${invoice.numeroFactura}`);

      // Paso 1: Firmar XML con FIRMA_SRI_3_API
      const firmaResult = await this.sriSignature.firmarYAutorizarXml(
        invoice.xmlGenerado,
        config.rutaCertificado || '',
        config.claveCertificado || '',
        'factura',
        config.urlFirmaService,
      );

      // Paso 2: Guardar XML firmado
      const xmlDir = path.join(process.cwd(), 'storage', 'invoices', 'xml');
      await fs.mkdir(xmlDir, { recursive: true });
      const xmlFirmadoPath = path.join(xmlDir, `factura_${invoice.id}_firmado_${Date.now()}.xml`);
      await fs.writeFile(xmlFirmadoPath, firmaResult.xmlFirmado, 'utf-8');

      // Paso 3: Generar PDF (RIDE)
      const pdfDir = path.join(process.cwd(), 'storage', 'invoices', 'pdf');
      await fs.mkdir(pdfDir, { recursive: true });
      const pdfPath = path.join(pdfDir, `factura_${invoice.id}_${Date.now()}.pdf`);

      await this.pdfGenerator.generateRidePdf(
        {
          id: invoice.id.toString(),
          numeroDocumento: invoice.numeroFactura,
          fecha: invoice.fechaEmision.toISOString(),
          claveAcceso: invoice.claveAcceso || '',
          razonSocial: config.razonSocial,
          ruc: config.ruc,
          direccion: config.direccionMatriz,
          email: undefined,
          clienteNombre: invoice.packager?.name || invoice.razonSocialComprador || 'Consumidor Final',
          clienteRuc: invoice.packager?.ruc || invoice.identificacionComprador || 'Consumidor Final',
          clienteDireccion: invoice.packager?.location || invoice.direccionComprador || '',
          detalles: invoice.detalles.map((d) => ({
            codigo: d.codigoPrincipal || d.codigoAuxiliar || '',
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            descuento: d.descuento,
            subtotal: d.precioTotalSinImpuesto,
          })),
          subtotalSinImpuestos: invoice.subtotalSinImpuestos,
          subtotal0: invoice.subtotal0,
          subtotal5: invoice.subtotal5,
          subtotal12: invoice.subtotal12,
          subtotal14: invoice.subtotal14,
          subtotal15: invoice.subtotal15,
          subtotal20: invoice.subtotal20,
          iva: invoice.iva,
          total: invoice.total,
          formaPago: invoice.formaPago || '',
          plazoCredito: invoice.plazoCredito || undefined,
          observaciones: invoice.observaciones || undefined,
        },
        pdfPath,
      );

      // Paso 4: Actualizar factura con datos de autorización
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id },
        data: {
          estado: EstadoFactura.AUTORIZADA_SRI,
          numeroAutorizacion: firmaResult.numeroAutorizacion,
          fechaAutorizacion: new Date(firmaResult.fechaAutorizacion),
          xmlFirmado: firmaResult.xmlFirmado,
          rutaXmlFirmado: xmlFirmadoPath,
          rutaPdfRide: pdfPath,
        },
        include: {
          packager: true,
          order: true,
          detalles: true,
        },
      });

      this.logger.log(
        `✅ Factura ${invoice.numeroFactura} autorizada exitosamente. Autorización: ${firmaResult.numeroAutorizacion}`,
      );

      return updatedInvoice;
    } catch (error: any) {
      this.logger.error(`Error en firma y autorización: ${error.message}`);
      throw new BadRequestException(`Error en firma: ${error.message}`);
    }
  }

  /**
   * Genera PDF para una factura que no lo tiene
   */
  async generatePdfForInvoice(id: number) {
    const invoice = await this.findOne(id);

    // Obtener configuración activa
    const config = await this.prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    if (!config) {
      throw new BadRequestException('No hay configuración de facturación activa');
    }

    try {
      this.logger.log(`Generando PDF para factura ${invoice.numeroFactura}`);

      // Generar PDF
      const pdfDir = path.join(process.cwd(), 'storage', 'invoices', 'pdf');
      await fs.mkdir(pdfDir, { recursive: true });
      const pdfPath = path.join(pdfDir, `factura_${invoice.id}_${Date.now()}.pdf`);

      await this.pdfGenerator.generateRidePdf(
        {
          id: invoice.id.toString(),
          numeroDocumento: invoice.numeroFactura,
          fecha: invoice.fechaEmision.toISOString(),
          claveAcceso: invoice.claveAcceso || '',
          razonSocial: config.razonSocial,
          ruc: config.ruc,
          direccion: config.direccionMatriz,
          email: undefined,
          clienteNombre: invoice.packager?.name || invoice.razonSocialComprador || 'Consumidor Final',
          clienteRuc: invoice.packager?.ruc || invoice.identificacionComprador || 'Consumidor Final',
          clienteDireccion: invoice.packager?.location || invoice.direccionComprador || '',
          detalles: invoice.detalles.map((d) => ({
            codigo: d.codigoPrincipal || d.codigoAuxiliar || '',
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            descuento: d.descuento,
            subtotal: d.precioTotalSinImpuesto,
          })),
          subtotalSinImpuestos: invoice.subtotalSinImpuestos,
          subtotal0: invoice.subtotal0,
          subtotal5: invoice.subtotal5,
          subtotal12: invoice.subtotal12,
          subtotal14: invoice.subtotal14,
          subtotal15: invoice.subtotal15,
          subtotal20: invoice.subtotal20,
          iva: invoice.iva,
          total: invoice.total,
          formaPago: invoice.formaPago || '',
          plazoCredito: invoice.plazoCredito || undefined,
          observaciones: invoice.observaciones || undefined,
        },
        pdfPath,
      );

      // Actualizar factura con ruta del PDF
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id },
        data: { rutaPdfRide: pdfPath },
        include: {
          packager: true,
          order: true,
          detalles: true,
        },
      });

      this.logger.log(`✅ PDF generado para factura ${invoice.numeroFactura}`);

      return updatedInvoice;
    } catch (error: any) {
      this.logger.error(`Error generando PDF: ${error.message}`);
      throw new BadRequestException(`Error al generar PDF: ${error.message}`);
    }
  }

  async cancelInvoice(id: number, motivoAnulacion: string) {
    const invoice = await this.findOne(id);

    if (invoice.estado === EstadoFactura.PAGADA) {
      throw new BadRequestException('No se puede anular una factura pagada');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        estado: EstadoFactura.ANULADA,
        motivoAnulacion,
      },
    });
  }

  // ===== PAGOS RECIBIDOS (DE EMPACADORAS) =====

  async createPayment(createPaymentDto: CreatePaymentDto) {
    const invoice = await this.findOne(createPaymentDto.invoiceId);

    // Verificar que la factura esté autorizada
    if (invoice.estado !== EstadoFactura.AUTORIZADA_SRI && invoice.estado !== EstadoFactura.EMITIDA) {
      throw new BadRequestException('Solo se pueden registrar pagos a facturas emitidas o autorizadas');
    }

    // Calcular total pagado hasta ahora
    const pagosPrevios = await this.prisma.payment.findMany({
      where: { invoiceId: createPaymentDto.invoiceId },
    });

    const totalPagado = pagosPrevios.reduce((sum, p) => sum + p.monto, 0) + createPaymentDto.monto;

    if (totalPagado > invoice.total) {
      throw new BadRequestException(`El monto total de pagos ($${totalPagado}) excede el total de la factura ($${invoice.total})`);
    }

    // Generar número de pago
    const numeroPago = `PAG-${Date.now()}`;

    const payment = await this.prisma.payment.create({
      data: {
        numeroPago,
        invoiceId: createPaymentDto.invoiceId,
        packagerId: createPaymentDto.packagerId,
        monto: createPaymentDto.monto,
        fechaPago: createPaymentDto.fechaPago ? new Date(createPaymentDto.fechaPago) : new Date(),
        formaPago: createPaymentDto.formaPago,
        banco: createPaymentDto.banco,
        numeroCuenta: createPaymentDto.numeroCuenta,
        numeroComprobante: createPaymentDto.numeroComprobante,
        observaciones: createPaymentDto.observaciones,
      },
      include: {
        invoice: true,
        packager: true,
      },
    });

    // Actualizar estado de factura si está completamente pagada
    if (totalPagado === invoice.total) {
      await this.prisma.invoice.update({
        where: { id: createPaymentDto.invoiceId },
        data: { estado: EstadoFactura.PAGADA },
      });
    }

    return payment;
  }

  async findAllPayments(filters?: { invoiceId?: number; packagerId?: number }) {
    const where: any = {};

    if (filters?.invoiceId) where.invoiceId = filters.invoiceId;
    if (filters?.packagerId) where.packagerId = filters.packagerId;

    return this.prisma.payment.findMany({
      where,
      include: {
        invoice: { select: { id: true, numeroFactura: true, total: true } },
        packager: { select: { id: true, name: true } },
      },
      orderBy: { fechaPago: 'desc' },
    });
  }

  // ===== PAGOS A PROVEEDORES =====

  async createProviderPayment(createProviderPaymentDto: CreateProviderPaymentDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: createProviderPaymentDto.providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Proveedor con ID ${createProviderPaymentDto.providerId} no encontrado`);
    }

    if (createProviderPaymentDto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: createProviderPaymentDto.orderId },
      });

      if (!order) {
        throw new NotFoundException(`Pedido con ID ${createProviderPaymentDto.orderId} no encontrado`);
      }
    }

    const numeroLiquidacion = `LIQ-${Date.now()}`;

    return this.prisma.providerPayment.create({
      data: {
        numeroLiquidacion,
        providerId: createProviderPaymentDto.providerId,
        orderId: createProviderPaymentDto.orderId,
        monto: createProviderPaymentDto.monto,
        fechaPago: createProviderPaymentDto.fechaPago ? new Date(createProviderPaymentDto.fechaPago) : new Date(),
        formaPago: createProviderPaymentDto.formaPago,
        banco: createProviderPaymentDto.banco,
        numeroCuenta: createProviderPaymentDto.numeroCuenta,
        numeroComprobante: createProviderPaymentDto.numeroComprobante,
        concepto: createProviderPaymentDto.concepto,
        cantidadLibras: createProviderPaymentDto.cantidadLibras,
        precioLibra: createProviderPaymentDto.precioLibra,
        observaciones: createProviderPaymentDto.observaciones,
      },
      include: {
        provider: true,
        order: true,
      },
    });
  }

  async findAllProviderPayments(filters?: { providerId?: number; orderId?: number }) {
    const where: any = {};

    if (filters?.providerId) where.providerId = filters.providerId;
    if (filters?.orderId) where.orderId = filters.orderId;

    return this.prisma.providerPayment.findMany({
      where,
      include: {
        provider: { select: { id: true, name: true } },
        order: { select: { id: true, codigo: true } },
      },
      orderBy: { fechaPago: 'desc' },
    });
  }

  // ===== CUENTAS POR COBRAR Y PAGAR =====

  async getCuentasPorCobrar() {
    const facturas = await this.prisma.invoice.findMany({
      where: {
        estado: {
          in: [EstadoFactura.EMITIDA, EstadoFactura.AUTORIZADA_SRI],
        },
      },
      include: {
        packager: { select: { id: true, name: true, ruc: true } },
        pagos: true,
      },
    });

    return facturas.map(factura => {
      const totalPagado = factura.pagos.reduce((sum, p) => sum + p.monto, 0);
      const saldoPendiente = factura.total - totalPagado;

      return {
        ...factura,
        totalPagado,
        saldoPendiente,
      };
    });
  }

  async getCuentasPorPagar() {
    // Obtener pedidos completados sin pago o con pago parcial
    const orders = await this.prisma.order.findMany({
      where: {
        estado: {
          in: ['CUSTODIA_COMPLETADA', 'ENTREGADO', 'FINALIZADO'],
        },
      },
      include: {
        provider: { select: { id: true, name: true } },
        pagosProveedor: true,
      },
    });

    return orders.map(order => {
      const totalPagado = order.pagosProveedor.reduce((sum, p) => sum + p.monto, 0);
      const montoEstimado = (order.cantidadFinal || order.cantidadPedida) * (order.precioRealCompra || 0);
      const saldoPendiente = montoEstimado - totalPagado;

      return {
        orderId: order.id,
        codigo: order.codigo,
        provider: order.provider,
        cantidadLibras: order.cantidadFinal || order.cantidadPedida,
        precioLibra: order.precioRealCompra,
        montoEstimado,
        totalPagado,
        saldoPendiente,
        pagos: order.pagosProveedor,
      };
    });
  }

  // ===== UTILIDADES =====

  private generateInvoiceNumber(config: any): string {
    const establecimiento = config.codigoEstablecimiento.padStart(3, '0');
    const puntoEmision = config.codigoPuntoEmision.padStart(3, '0');
    const secuencial = config.secuencialFactura.toString().padStart(9, '0');

    return `${establecimiento}-${puntoEmision}-${secuencial}`;
  }

  private calculateTotals(detalles: any[]) {
    let subtotalSinImpuestos = 0;
    let subtotal0 = 0;      // 0% exento
    let subtotal5 = 0;      // 5% reducido
    let subtotal12 = 0;     // 12% general
    let subtotal14 = 0;     // 14% especial
    let subtotal15 = 0;     // 15% especial
    let subtotal20 = 0;     // 20% especial
    let iva = 0;            // Total IVA
    let ice = 0;            // Impuesto Consumos Especiales
    let irbpnr = 0;         // Impuesto Patrimonio
    let rebiius = 0;        // Régimen Benéfico

    detalles.forEach(detalle => {
      const precioTotal = (detalle.cantidad * detalle.precioUnitario) - (detalle.descuento || 0);
      subtotalSinImpuestos += precioTotal;

      // Clasificar por código de porcentaje (según SRI Ecuador)
      // Código 0 = 0% | Código 2 = 12% | Código 3 = 14% | Código 4 = 5% | Código 5 = 20% | Código 7 = 15%
      const codigoPorcentaje = detalle.codigoPorcentaje;
      
      switch(codigoPorcentaje) {
        case '0': // 0% Exento o No objeto
        case '6': // 0% No objeto
          subtotal0 += precioTotal;
          break;
        case '4': // 5% Reducido
          subtotal5 += precioTotal;
          iva += (precioTotal * 5) / 100;
          break;
        case '2': // 12% General
          subtotal12 += precioTotal;
          iva += (precioTotal * 12) / 100;
          break;
        case '3': // 14% Especial
          subtotal14 += precioTotal;
          iva += (precioTotal * 14) / 100;
          break;
        case '7': // 15% Especial
          subtotal15 += precioTotal;
          iva += (precioTotal * 15) / 100;
          break;
        case '5': // 20% Especial
          subtotal20 += precioTotal;
          iva += (precioTotal * 20) / 100;
          break;
      }

      // Calcular ICE (Código Impuesto = '3')
      if (detalle.codigoImpuesto === '3') {
        ice += (precioTotal * detalle.tarifa) / 100;
      }

      // Calcular IRBPNR (Código Impuesto = '5')
      if (detalle.codigoImpuesto === '5') {
        irbpnr += (precioTotal * detalle.tarifa) / 100;
      }

      // Calcular ReBIUS (Código Impuesto = '6')
      if (detalle.codigoImpuesto === '6') {
        rebiius += (precioTotal * detalle.tarifa) / 100;
      }
    });

    const total = subtotalSinImpuestos + iva + ice + irbpnr + rebiius;

    return {
      subtotalSinImpuestos,
      subtotal0,
      subtotal5,
      subtotal12,
      subtotal14,
      subtotal15,
      subtotal20,
      iva,
      ice,
      irbpnr,
      rebiius,
      total,
    };
  }

  private async generateClaveAcceso(invoice: any): Promise<string> {
    const config = await this.prisma.invoiceConfig.findFirst({
      where: { activo: true },
    });

    if (!config) {
      throw new BadRequestException('No hay configuración activa');
    }

    const fecha = new Date(invoice.fechaEmision);
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear().toString();

    const tipoComprobante = '01'; // 01=FACTURA
    const ruc = config.ruc;
    const ambiente = config.ambienteSRI === 'PRODUCCION' ? '2' : '1';
    const serie = `${config.codigoEstablecimiento}${config.codigoPuntoEmision}`;
    const numeroDocumento = config.secuencialFactura.toString().padStart(9, '0');
    const codigoNumerico = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const tipoEmision = '1'; // Normal

    const claveSinDigito = `${dia}${mes}${anio}${tipoComprobante}${ruc}${ambiente}${serie}${numeroDocumento}${codigoNumerico}${tipoEmision}`;

    // Calcular dígito verificador módulo 11
    const digitoVerificador = this.calcularDigitoVerificador(claveSinDigito);

    return `${claveSinDigito}${digitoVerificador}`;
  }

  private calcularDigitoVerificador(clave: string): number {
    const factores = [2, 3, 4, 5, 6, 7];
    let suma = 0;
    let factor = 0;

    for (let i = clave.length - 1; i >= 0; i--) {
      suma += parseInt(clave[i]) * factores[factor];
      factor = (factor + 1) % 6;
    }

    const residuo = suma % 11;
    const digito = residuo === 0 ? 0 : 11 - residuo;

    return digito === 11 ? 0 : digito;
  }
}
