import { Injectable } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import * as xmlbuilder from 'xmlbuilder2';

interface InvoiceWithRelations extends Invoice {
  packager?: any;
  detalles?: any[];
}

interface InvoiceConfig {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string | null;
  direccionMatriz: string;
  direccionEstablecimiento?: string | null;
  contribuyenteEspecial?: string | null;
  obligadoContabilidad: boolean;
  codigoEstablecimiento: string;
  codigoPuntoEmision: string;
  ambienteSRI: string;
  tipoEmision: string;
}

@Injectable()
export class XmlGeneratorService {
  /**
   * Genera el XML de una factura según especificación SRI Ecuador
   */
  generateInvoiceXml(invoice: InvoiceWithRelations, config: InvoiceConfig): string {
    const claveAcceso = this.generateClaveAcceso(invoice, config);
    const secuencial = invoice.secuencialFactura || 1;
    const numeroFactura = this.formatNumeroFactura(
      config.codigoEstablecimiento,
      config.codigoPuntoEmision,
      secuencial,
    );

    const root = xmlbuilder.create({ version: '1.0', encoding: 'UTF-8' })
      .ele('factura', {
        id: 'comprobante',
        version: '1.1.0',
      });

    // INFORMACIÓN TRIBUTARIA
    const infoTributaria = root.ele('infoTributaria');
    infoTributaria.ele('ambiente').txt(config.ambienteSRI === 'PRODUCCION' ? '2' : '1');
    infoTributaria.ele('tipoEmision').txt(config.tipoEmision === 'CONTINGENCIA' ? '2' : '1');
    infoTributaria.ele('razonSocial').txt(config.razonSocial);
    if (config.nombreComercial) {
      infoTributaria.ele('nombreComercial').txt(config.nombreComercial);
    }
    infoTributaria.ele('ruc').txt(config.ruc);
    infoTributaria.ele('claveAcceso').txt(claveAcceso);
    infoTributaria.ele('codDoc').txt('01'); // 01 = Factura
    infoTributaria.ele('estab').txt(config.codigoEstablecimiento);
    infoTributaria.ele('ptoEmi').txt(config.codigoPuntoEmision);
    infoTributaria.ele('secuencial').txt(this.padSecuencial(secuencial));
    infoTributaria.ele('dirMatriz').txt(config.direccionMatriz);

    // INFORMACIÓN DE LA FACTURA
    const infoFactura = root.ele('infoFactura');
    infoFactura.ele('fechaEmision').txt(this.formatDate(invoice.fechaEmision));
    infoFactura.ele('dirEstablecimiento').txt(config.direccionEstablecimiento || config.direccionMatriz);
    
    if (config.contribuyenteEspecial) {
      infoFactura.ele('contribuyenteEspecial').txt(config.contribuyenteEspecial);
    }
    
    infoFactura.ele('obligadoContabilidad').txt(config.obligadoContabilidad ? 'SI' : 'NO');
    
    // Tipo de identificación del comprador
    const tipoIdentificacion = this.getTipoIdentificacion(invoice.identificacionComprador || '');
    infoFactura.ele('tipoIdentificacionComprador').txt(tipoIdentificacion);
    infoFactura.ele('razonSocialComprador').txt(invoice.razonSocialComprador || 'CONSUMIDOR FINAL');
    infoFactura.ele('identificacionComprador').txt(invoice.identificacionComprador || '9999999999999');
    
    if (invoice.direccionComprador) {
      infoFactura.ele('direccionComprador').txt(invoice.direccionComprador);
    }

    // Totales
    infoFactura.ele('totalSinImpuestos').txt(invoice.subtotalSinImpuestos.toFixed(2));
    infoFactura.ele('totalDescuento').txt('0.00'); // Por ahora sin descuentos globales

    // Total con impuestos
    const totalConImpuestos = infoFactura.ele('totalConImpuestos');
    
    // Agregar cada subtotal según tarifa de IVA
    if (invoice.subtotal0 > 0) {
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // IVA
      totalImpuesto.ele('codigoPorcentaje').txt('0'); // 0%
      totalImpuesto.ele('baseImponible').txt(invoice.subtotal0.toFixed(2));
      totalImpuesto.ele('valor').txt('0.00');
    }

    if (invoice.subtotal5 > 0) {
      const iva5 = invoice.subtotal5 * 0.05;
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // IVA
      totalImpuesto.ele('codigoPorcentaje').txt('4'); // 5%
      totalImpuesto.ele('baseImponible').txt(invoice.subtotal5.toFixed(2));
      totalImpuesto.ele('valor').txt(iva5.toFixed(2));
    }

    if (invoice.subtotal12 > 0) {
      const iva12 = invoice.subtotal12 * 0.12;
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // IVA
      totalImpuesto.ele('codigoPorcentaje').txt('2'); // 12%
      totalImpuesto.ele('baseImponible').txt(invoice.subtotal12.toFixed(2));
      totalImpuesto.ele('valor').txt(iva12.toFixed(2));
    }

    if (invoice.subtotal14 > 0) {
      const iva14 = invoice.subtotal14 * 0.14;
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // IVA
      totalImpuesto.ele('codigoPorcentaje').txt('3'); // 14%
      totalImpuesto.ele('baseImponible').txt(invoice.subtotal14.toFixed(2));
      totalImpuesto.ele('valor').txt(iva14.toFixed(2));
    }

    if (invoice.subtotal15 > 0) {
      const iva15 = invoice.subtotal15 * 0.15;
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // IVA
      totalImpuesto.ele('codigoPorcentaje').txt('7'); // 15%
      totalImpuesto.ele('baseImponible').txt(invoice.subtotal15.toFixed(2));
      totalImpuesto.ele('valor').txt(iva15.toFixed(2));
    }

    if (invoice.subtotal20 > 0) {
      const iva20 = invoice.subtotal20 * 0.20;
      const totalImpuesto = totalConImpuestos.ele('totalImpuesto');
      totalImpuesto.ele('codigo').txt('2'); // IVA
      totalImpuesto.ele('codigoPorcentaje').txt('5'); // 20%
      totalImpuesto.ele('baseImponible').txt(invoice.subtotal20.toFixed(2));
      totalImpuesto.ele('valor').txt(iva20.toFixed(2));
    }

    infoFactura.ele('propina').txt('0.00');
    infoFactura.ele('importeTotal').txt(invoice.total.toFixed(2));
    infoFactura.ele('moneda').txt('DOLAR'); // USD

    // Formas de pago
    const pagos = infoFactura.ele('pagos');
    const pago = pagos.ele('pago');
    pago.ele('formaPago').txt(invoice.formaPago || '01'); // 01 = Efectivo
    pago.ele('total').txt(invoice.total.toFixed(2));
    
    if (invoice.plazoCredito && invoice.plazoCredito > 0) {
      pago.ele('plazo').txt(invoice.plazoCredito.toString());
      pago.ele('unidadTiempo').txt('dias');
    }

    // DETALLES
    const detalles = root.ele('detalles');
    
    if (invoice.detalles && invoice.detalles.length > 0) {
      invoice.detalles.forEach((detalle: any) => {
        const detalleEle = detalles.ele('detalle');
        detalleEle.ele('codigoPrincipal').txt(detalle.codigoPrincipal || 'PROD001');
        
        if (detalle.codigoAuxiliar) {
          detalleEle.ele('codigoAuxiliar').txt(detalle.codigoAuxiliar);
        }
        
        detalleEle.ele('descripcion').txt(detalle.descripcion);
        detalleEle.ele('cantidad').txt(detalle.cantidad.toFixed(2));
        detalleEle.ele('precioUnitario').txt(detalle.precioUnitario.toFixed(6));
        detalleEle.ele('descuento').txt(detalle.descuento.toFixed(2));
        
        const precioTotalSinImpuesto = (detalle.cantidad * detalle.precioUnitario) - detalle.descuento;
        detalleEle.ele('precioTotalSinImpuesto').txt(precioTotalSinImpuesto.toFixed(2));

        // Impuestos del detalle
        const impuestos = detalleEle.ele('impuestos');
        const impuesto = impuestos.ele('impuesto');
        impuesto.ele('codigo').txt(detalle.codigoImpuesto || '2'); // 2 = IVA
        impuesto.ele('codigoPorcentaje').txt(detalle.codigoPorcentaje || '0');
        impuesto.ele('tarifa').txt(detalle.tarifa.toFixed(0));
        impuesto.ele('baseImponible').txt(precioTotalSinImpuesto.toFixed(2));
        
        const valorImpuesto = (precioTotalSinImpuesto * detalle.tarifa) / 100;
        impuesto.ele('valor').txt(valorImpuesto.toFixed(2));
      });
    }

    // INFORMACIÓN ADICIONAL
    const infoAdicional = root.ele('infoAdicional');
    
    if (invoice.observaciones) {
      infoAdicional.ele('campoAdicional', { nombre: 'Observaciones' }).txt(invoice.observaciones);
    }
    
    if (invoice.packager) {
      infoAdicional.ele('campoAdicional', { nombre: 'Empacadora' }).txt(invoice.packager.name);
    }

    if (invoice.orderId) {
      infoAdicional.ele('campoAdicional', { nombre: 'Orden' }).txt(invoice.orderId.toString());
    }

    return root.end({ prettyPrint: true });
  }

  /**
   * Genera la clave de acceso de 49 dígitos según algoritmo SRI
   */
  private generateClaveAcceso(invoice: Invoice, config: InvoiceConfig): string {
    const fecha = new Date(invoice.fechaEmision);
    const dd = fecha.getDate().toString().padStart(2, '0');
    const mm = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = fecha.getFullYear().toString();
    
    const tipoComprobante = '01'; // Factura
    const rucNumero = config.ruc.substring(0, 13).padStart(13, '0');
    const ambiente = config.ambienteSRI === 'PRODUCCION' ? '2' : '1';
    const serie = config.codigoEstablecimiento + config.codigoPuntoEmision;
    const secuencial = this.padSecuencial(invoice.secuencialFactura || 1);
    const codigoNumerico = this.generateCodigoNumerico(); // 8 dígitos aleatorios
    const tipoEmision = config.tipoEmision === 'CONTINGENCIA' ? '2' : '1';

    // Primeros 48 dígitos
    const clave48 = 
      dd + mm + yyyy + 
      tipoComprobante + 
      rucNumero + 
      ambiente + 
      serie + 
      secuencial + 
      codigoNumerico + 
      tipoEmision;

    // Calcular dígito verificador
    const digitoVerificador = this.calcularModulo11(clave48);
    
    return clave48 + digitoVerificador;
  }

  /**
   * Calcula el dígito verificador usando módulo 11
   */
  private calcularModulo11(clave48: string): string {
    const multiplicadores = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;

    for (let i = 0; i < clave48.length; i++) {
      suma += parseInt(clave48[i]) * multiplicadores[i];
    }

    const residuo = suma % 11;
    const digitoVerificador = residuo === 0 ? 0 : 11 - residuo;

    return digitoVerificador.toString();
  }

  /**
   * Genera código numérico aleatorio de 8 dígitos
   */
  private generateCodigoNumerico(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Formatea el número de factura: 001-001-000000001
   */
  private formatNumeroFactura(estab: string, punto: string, secuencial: number): string {
    return `${estab}-${punto}-${this.padSecuencial(secuencial)}`;
  }

  /**
   * Formatea el secuencial a 9 dígitos
   */
  private padSecuencial(secuencial: number): string {
    return secuencial.toString().padStart(9, '0');
  }

  /**
   * Formatea fecha a dd/mm/yyyy
   */
  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Determina el tipo de identificación según formato
   */
  private getTipoIdentificacion(identificacion: string): string {
    if (!identificacion || identificacion === '9999999999999') {
      return '07'; // Consumidor final
    }
    
    const len = identificacion.length;
    
    if (len === 13) {
      return '04'; // RUC
    } else if (len === 10) {
      return '05'; // Cédula
    } else if (len >= 6 && len <= 20) {
      return '06'; // Pasaporte
    }
    
    return '07'; // Otros
  }
}
