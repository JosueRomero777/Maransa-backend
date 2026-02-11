import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicingService } from './invoicing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EstadoFactura, RolUsuario } from '@prisma/client';
import * as fs from 'fs/promises';

@Controller('invoicing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  // ===== FACTURAS =====

  @Post('invoices')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  createInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicingService.createInvoice(createInvoiceDto);
  }

  @Get('invoices')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.FACTURACION)
  findAllInvoices(
    @Query('packagerId') packagerId?: string,
    @Query('estado') estado?: EstadoFactura,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const filters: any = {};

    if (packagerId) filters.packagerId = parseInt(packagerId);
    if (estado) filters.estado = estado;
    if (desde) filters.desde = desde;
    if (hasta) filters.hasta = hasta;

    return this.invoicingService.findAll(filters);
  }

  @Get('invoices/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.FACTURACION)
  findOneInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoicingService.findOne(id);
  }

  @Patch('invoices/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  updateInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicingService.update(id, updateInvoiceDto);
  }

  @Post('invoices/:id/emit')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  emitInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoicingService.emitInvoice(id);
  }

  @Post('invoices/:id/authorize')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  authorizeInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { numeroAutorizacion: string; xmlAutorizado: string },
  ) {
    return this.invoicingService.authorizeInvoice(id, body.numeroAutorizacion, body.xmlAutorizado);
  }

  @Post('invoices/:id/sign-and-authorize')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  signAndAuthorizeInvoice(@Param('id', ParseIntPipe) id: number) {
    return this.invoicingService.signAndAuthorizeInvoice(id);
  }

  @Post('invoices/:id/cancel')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  cancelInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivoAnulacion: string },
  ) {
    return this.invoicingService.cancelInvoice(id, body.motivoAnulacion);
  }

  @Get('invoices/:id/pdf')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.FACTURACION)
  async downloadPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const invoice = await this.invoicingService.findOne(id);

      let pdfPath = invoice.rutaPdfRide;

      // Si no tiene PDF o no existe en disco, generarlo ahora
      if (!pdfPath || !(await this.fileExists(pdfPath))) {
        const invoiceWithPdf = await this.invoicingService.generatePdfForInvoice(id);
        pdfPath = invoiceWithPdf.rutaPdfRide;
        if (!pdfPath || !(await this.fileExists(pdfPath))) {
          throw new BadRequestException('No se pudo generar el PDF para esta factura');
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="factura_${invoice.numeroFactura}.pdf"`);

      const fileStream = require('fs').createReadStream(pdfPath);
      fileStream.pipe(res);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  @Get('invoices/:id/xml')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.FACTURACION)
  async downloadXml(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const invoice = await this.invoicingService.findOne(id);

      if (!invoice.xmlGenerado) {
        throw new BadRequestException('No hay XML generado para esta factura');
      }

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="factura_${invoice.numeroFactura}.xml"`);

      res.send(invoice.xmlGenerado);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async fileExists(filePath?: string) {
    if (!filePath) return false;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ===== PAGOS RECIBIDOS =====

  @Post('payments')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.FACTURACION)
  createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.invoicingService.createPayment(createPaymentDto);
  }

  @Get('payments')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.FACTURACION)
  findAllPayments(
    @Query('invoiceId') invoiceId?: string,
    @Query('packagerId') packagerId?: string,
  ) {
    const filters: any = {};

    if (invoiceId) filters.invoiceId = parseInt(invoiceId);
    if (packagerId) filters.packagerId = parseInt(packagerId);

    return this.invoicingService.findAllPayments(filters);
  }

  // ===== PAGOS A PROVEEDORES =====

  @Post('provider-payments')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  createProviderPayment(@Body() createProviderPaymentDto: CreateProviderPaymentDto) {
    return this.invoicingService.createProviderPayment(createProviderPaymentDto);
  }

  @Get('provider-payments')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  findAllProviderPayments(
    @Query('providerId') providerId?: string,
    @Query('orderId') orderId?: string,
  ) {
    const filters: any = {};

    if (providerId) filters.providerId = parseInt(providerId);
    if (orderId) filters.orderId = parseInt(orderId);

    return this.invoicingService.findAllProviderPayments(filters);
  }

  // ===== REPORTES =====

  @Get('reports/cuentas-por-cobrar')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  getCuentasPorCobrar() {
    return this.invoicingService.getCuentasPorCobrar();
  }

  @Get('reports/cuentas-por-pagar')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  getCuentasPorPagar() {
    return this.invoicingService.getCuentasPorPagar();
  }
}
