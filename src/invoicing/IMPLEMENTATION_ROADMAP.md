# 🔧 AJUSTES NECESARIOS EN TU CÓDIGO PARA SRI ECUADOR

## RESUMEN DE CAMBIOS

Basado en los requerimientos técnicos del SRI Ecuador, tu implementación actual está **~70% correcta** pero necesita los siguientes ajustes:

---

## 1. IMPUESTOS - CAMBIOS CRÍTICOS

### ❌ PROBLEMA ACTUAL
Tu código solo maneja 2 tarifas: 0% y 12%

```typescript
// Actual - INCOMPLETO
if (detalle.tarifa === 0) {
  subtotal0 += precioTotal;
} else if (detalle.tarifa === 12) {
  subtotal12 += precioTotal;
  iva += (precioTotal * 12) / 100;
}
```

### ✅ SOLUCIÓN: Expandir a Todas las Tarifas de Ecuador

```typescript
// Correcto - COMPLETO
private calculateTotals(detalles: any[]) {
  let subtotalSinImpuestos = 0;
  let subtotal0 = 0;      // 0% exento
  let subtotal5 = 0;      // 5% reducido
  let subtotal12 = 0;     // 12% general
  let subtotal14 = 0;     // 14% especial
  let subtotal20 = 0;     // 20% especial
  let iva = 0;            // Total IVA
  let ice = 0;            // Impuesto Consumos Especiales
  let irbpnr = 0;         // Impuesto Patrimonio
  let rebiius = 0;        // Régimen Benéfico

  detalles.forEach(detalle => {
    const precioTotal = (detalle.cantidad * detalle.precioUnitario) - (detalle.descuento || 0);
    subtotalSinImpuestos += precioTotal;

    // Clasificar por tarifa de IVA según CÓDIGO PORCENTAJE
    // Código 0 = 0% | Código 2 = 12% | Código 3 = 14% | Código 4 = 5% | Código 5 = 20%
    const codigoPorcentaje = detalle.codigoPorcentaje;
    
    switch(codigoPorcentaje) {
      case '0': // 0% Exento
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

  return {
    subtotalSinImpuestos,
    subtotal0,
    subtotal5,
    subtotal12,
    subtotal14,
    subtotal20,
    iva,
    ice,
    irbpnr,
    rebiius,
    total: subtotalSinImpuestos + iva + ice + irbpnr + rebiius
  };
}
```

---

## 2. SCHEMA PRISMA - ACTUALIZACIÓN NECESARIA

### ❌ PROBLEMA ACTUAL
Tu schema no tiene campos para todas las tarifas

```prisma
// Actual - Falta detalle
subtotal0             Float             @default(0)
subtotal12            Float             @default(0)
iva                   Float             @default(0)
ice                   Float             @default(0)
total                 Float
```

### ✅ SOLUCIÓN: Agregar Todos los Subtotales

```prisma
// Correcto - COMPLETO
model Invoice {
  // ... campos existentes ...
  
  // Montos desglosados por tarifa (SRI)
  subtotalSinImpuestos  Float             @default(0)
  subtotal0             Float             @default(0)    // 0% exento
  subtotal5             Float             @default(0)    // 5% reducido
  subtotal12            Float             @default(0)    // 12% general
  subtotal14            Float             @default(0)    // 14% especial
  subtotal20            Float             @default(0)    // 20% especial
  
  // Impuestos desglosados
  iva                   Float             @default(0)    // IVA total
  ice                   Float             @default(0)    // Impuesto Consumos Especiales
  irbpnr                Float             @default(0)    // Impuesto Patrimonio
  rebiius               Float             @default(0)    // Régimen Benéfico
  
  // Total
  total                 Float
  
  // ... resto de campos ...
}
```

**MIGRACIÓN NECESARIA:**
```bash
cd maransa-back
npx prisma migrate dev --name add_all_invoice_subtotals
```

---

## 3. CLAVE DE ACCESO - VALIDAR ALGORITMO

### ✅ BUENA NOTICIA
Tu cálculo en `generateClaveAcceso()` parece correcto. Pero VERIFICA el módulo 11:

```typescript
private async generateClaveAcceso(invoice: any): Promise<string> {
  // Tu código actual genera: DD MM AAAA TT RUC(9) EST(3) PTO(3) SEC(9) DV

  // IMPORTANTE: El dígito verificador debe calcularse con MÓDULO 11
  // Peso: 7,6,5,4,3,2,7,6,5,4,3,2,... (repiten)
  
  // Validar que este implementado correctamente:
  const digitoVerificador = this.calculateVerificationDigit(first48digits);
  
  return claveAcceso; // Debe ser 49 dígitos: 48 + dígito verificador
}

private calculateVerificationDigit(str: string): number {
  const weights = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < str.length; i++) {
    const digit = parseInt(str[i]);
    const weight = weights[i % weights.length];
    sum += digit * weight;
  }

  const residue = sum % 11;
  
  if (residue === 0) return 0;
  if (residue === 1) return 1;
  return 11 - residue;
}
```

---

## 4. DETALLE DE LÍNEA (DETALLES) - CAMPOS FALTANTES

### ❌ PROBLEMA ACTUAL
En `InvoiceDetail` falta el desglose completo de impuestos

```prisma
// Actual - Incompleto
model InvoiceDetail {
  codigoPrincipal       String
  codigoAuxiliar        String?
  descripcion           String
  cantidad              Float
  precioUnitario        Float
  descuento             Float?
  // ... falta desglose de impuestos ...
}
```

### ✅ SOLUCIÓN: Completar Estructura

```prisma
model InvoiceDetail {
  id                    Int       @id @default(autoincrement())
  
  // Identificación del producto
  codigoPrincipal       String    // Código de catálogo del vendedor
  codigoAuxiliar        String?   // Código auxiliar
  descripcion           String    // Descripción del producto/servicio
  
  // Cantidades
  cantidad              Float     // Cantidad vendida
  unidadMedida          String    @default("3") // "3" = Unidad, "1" = kg, "2" = litro, etc.
  
  // Precios
  precioUnitario        Float     // Precio unitario sin IVA
  descuento             Float?    // Descuento por línea
  precioTotalSinImpuesto Float    // (cantidad × precioUnitario) - descuento
  
  // Impuestos
  codigoImpuesto        String    // "2" = IVA, "3" = ICE, "5" = IRBPNR, etc.
  codigoPorcentaje      String    // "0" (0%), "4" (5%), "2" (12%), "3" (14%), "5" (20%)
  tarifa                Float     // Valor en %: 0, 5, 12, 14, 20, etc.
  baseImponible         Float     // Base sobre la que se calcula el impuesto
  valor                 Float     // Valor del impuesto aplicado
  
  // Relación
  invoiceId             Int
  invoice               Invoice   @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

---

## 5. TIPOS DE COMPROBANTE - EXPANDIR

### ❌ PROBLEMA ACTUAL
Solo tienes FACTURA (01)

```typescript
enum TipoComprobante {
  FACTURA = "01"
}
```

### ✅ SOLUCIÓN: Agregar Todos los Tipos

```typescript
enum TipoComprobante {
  FACTURA = "01",
  NOTA_CREDITO = "02",
  NOTA_DEBITO = "03",
  COMPROBANTE_RETENCION = "04",
  FACTURA_EXPORTACION = "05",
  COMPROBANTE_EMISION_INCOMPLETA = "06",
  FACTURA_AUTORIZACION_ESPECIAL = "07"
}
```

---

## 6. FORMAS DE PAGO - COMPLETAR

### ❌ PROBLEMA ACTUAL
Tienes hardcoded solo 4 formas

```typescript
// Actual en InvoiceForm
<MenuItem value="EFECTIVO">Efectivo</MenuItem>
<MenuItem value="TRANSFERENCIA">Transferencia</MenuItem>
<MenuItem value="CHEQUE">Cheque</MenuItem>
<MenuItem value="CREDITO">Crédito</MenuItem>
```

### ✅ SOLUCIÓN: Agregar Todos los Códigos SRI

```typescript
enum FormaPago {
  EFECTIVO = "01",
  CHEQUE = "02",
  DEBITO_BANCARIO = "03",
  CREDITO_BANCARIO = "04",
  OTROS_CON_COMPROBANTE = "05",
  OTROS_SIN_COMPROBANTE = "06",
  TARJETA_DEBITO = "15",
  TARJETA_CREDITO = "16",
  DINERO_ELECTRONICO = "17",
  COMPENSACION = "19"
}
```

**En InvoiceForm.tsx:**
```tsx
const FORMA_PAGO = [
  { value: "01", label: "Efectivo" },
  { value: "02", label: "Cheque" },
  { value: "03", label: "Débito Bancario" },
  { value: "04", label: "Crédito Bancario" },
  { value: "15", label: "Tarjeta Débito" },
  { value: "16", label: "Tarjeta Crédito" },
  { value: "17", label: "Dinero Electrónico" },
];

{FORMA_PAGO.map(fp => (
  <MenuItem key={fp.value} value={fp.value}>
    {fp.label}
  </MenuItem>
))}
```

---

## 7. INFORMACIÓN DEL COMPRADOR - VALIDAR

### ⚠️ FALTA EN TU CÓDIGO
No captas información completa del comprador

**Campos necesarios:**
```typescript
interface CompradorInfo {
  tipoIdentificacion: "04" | "05" | "06" | "07" | "08" | "09"; // RUC, Cédula, Pasaporte, etc.
  identificacion: string;      // RUC o Cédula
  razonSocial: string;         // Nombre del cliente
  nombreComercial?: string;
  direccion?: string;
  email?: string;              // Recomendado
  telefono?: string;
}
```

**Actualizar la factura para captar esto:**
```prisma
model Invoice {
  // ... campos existentes ...
  
  // Información del Comprador/Adquirente
  tipoIdentificacionComprador  String?  // "04"=RUC, "05"=Cédula, "06"=Pasaporte
  identificacionComprador      String?  // RUC o Cédula del cliente
  razonSocialComprador         String?  // Nombre del cliente
  emailComprador               String?
  
  // ... resto ...
}
```

---

## 8. ESTADOS DE FACTURA - AGREGAR VALIDACIONES

### ❌ PROBLEMA
No validas transiciones de estado correctamente

```typescript
// Actual - Sin validación
async emitInvoice(id: number) {
  // Solo verifica BORRADOR
  if (invoice.estado !== EstadoFactura.BORRADOR) {
    throw new BadRequestException(...);
  }
}
```

### ✅ SOLUCIÓN: Máquina de Estados Estricta

```typescript
// Estados válidos según SRI
enum EstadoFactura {
  BORRADOR = "BORRADOR",              // Inicial
  EMITIDA = "EMITIDA",                // Después de emitir
  AUTORIZADA_SRI = "AUTORIZADA_SRI",  // SRI autorizó
  PAGADA = "PAGADA",                  // Totalmente pagada
  PARCIALMENTE_PAGADA = "PARCIALMENTE_PAGADA",
  RECHAZADA = "RECHAZADA",            // SRI rechazó
  ANULADA = "ANULADA",                // Usuario anuló
  VENCIDA = "VENCIDA"                 // Superó tiempo
}

// Máquina de estados válida
const TRANSICIONES_VALIDAS = {
  [EstadoFactura.BORRADOR]: [EstadoFactura.EMITIDA],
  [EstadoFactura.EMITIDA]: [EstadoFactura.AUTORIZADA_SRI, EstadoFactura.ANULADA],
  [EstadoFactura.AUTORIZADA_SRI]: [EstadoFactura.PAGADA, EstadoFactura.PARCIALMENTE_PAGADA, EstadoFactura.ANULADA],
  [EstadoFactura.PAGADA]: [],
  [EstadoFactura.ANULADA]: [],
  [EstadoFactura.RECHAZADA]: [EstadoFactura.BORRADOR] // Corregir y reintentar
};

async updateInvoiceState(id: number, nuevoEstado: EstadoFactura) {
  const invoice = await this.findOne(id);
  const estadoActual = invoice.estado;
  const transicionesValidas = TRANSICIONES_VALIDAS[estadoActual];
  
  if (!transicionesValidas.includes(nuevoEstado)) {
    throw new BadRequestException(
      `No se puede pasar de ${estadoActual} a ${nuevoEstado}`
    );
  }
  
  // Proceder con la actualización
}
```

---

## 9. XML GENERADO - ESTRUCTURA CORRECTA

### ⚠️ PENDIENTE EN TU CÓDIGO
No encuentro generación de XML en el servicio actual

**Necesitas crear:**

```typescript
// invoicing/xml-generator.service.ts
@Injectable()
export class XmlGeneratorService {
  
  async generateFacturaXml(invoice: Invoice): Promise<string> {
    const packager = invoice.packager;
    
    // Detalles de la factura
    const totalImpuestos = this.generateTotalImpuestos(invoice);
    const detalles = this.generateDetalles(invoice.detalles);
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
    <infoTributaria>
        <ambiente>${invoice.ambiente}</ambiente>
        <tipoEmision>1</tipoEmision>
        <razonSocial>${escapeXml(packager.razonSocial)}</razonSocial>
        <nombreComercial>${escapeXml(packager.nombreComercial)}</nombreComercial>
        <ruc>${packager.ruc}</ruc>
        <claveAcceso>${invoice.claveAcceso}</claveAcceso>
        <codDoc>${invoice.tipoComprobante}</codDoc>
        <estab>${invoice.numeroFactura.substring(0, 3)}</estab>
        <ptoEmi>${invoice.numeroFactura.substring(4, 7)}</ptoEmi>
        <secuencial>${invoice.numeroFactura.substring(8)}</secuencial>
        <dirMatriz>${escapeXml(packager.direccion)}</dirMatriz>
    </infoTributaria>
    
    <infoFactura>
        <fechaEmision>${this.formatDate(invoice.fechaEmision)}</fechaEmision>
        <dirEstablecimiento>${escapeXml(packager.direccion)}</dirEstablecimiento>
        <obligadoContabilidad>SI</obligadoContabilidad>
        <totalSinImpuestos>${invoice.subtotalSinImpuestos.toFixed(2)}</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        
        <totalConImpuestos>
            ${totalImpuestos}
        </totalConImpuestos>
        
        <propina>0.00</propina>
        <importeTotal>${invoice.total.toFixed(2)}</importeTotal>
        <moneda>USD</moneda>
        
        <pagos>
            <pago>
                <formaPago>${invoice.formaPago}</formaPago>
                <total>${invoice.total.toFixed(2)}</total>
            </pago>
        </pagos>
    </infoFactura>
    
    <detalles>
        ${detalles}
    </detalles>
    
</factura>`;
    
    return xml;
  }
  
  private generateTotalImpuestos(invoice: Invoice): string {
    let xml = '';
    
    if (invoice.iva > 0) {
      xml += `<totalImpuesto>
                <codigo>2</codigo>
                <codigoPorcentaje>2</codigoPorcentaje>
                <baseImponible>${invoice.subtotal12.toFixed(2)}</baseImponible>
                <valor>${invoice.iva.toFixed(2)}</valor>
              </totalImpuesto>`;
    }
    
    if (invoice.ice > 0) {
      xml += `<totalImpuesto>
                <codigo>3</codigo>
                <valor>${invoice.ice.toFixed(2)}</valor>
              </totalImpuesto>`;
    }
    
    return xml;
  }
}
```

---

## 10. CHECKLIST DE IMPLEMENTACIÓN

- [ ] Expandir tarifas IVA a 5 niveles (0%, 5%, 12%, 14%, 20%)
- [ ] Agregar subtotales para cada tarifa en Prisma
- [ ] Validar cálculo de dígito verificador (módulo 11)
- [ ] Completar tipos de comprobante (01-07)
- [ ] Actualizar formas de pago a códigos SRI (01-19)
- [ ] Captar información completa del comprador
- [ ] Implementar máquina de estados para transiciones
- [ ] Crear servicio de generación XML
- [ ] Generar XML antes de firmar
- [ ] Validar estructura XML contra XSD del SRI
- [ ] Implementar firma digital
- [ ] Enviar a SRI para recepción
- [ ] Procesar respuesta de autorización
- [ ] Guardar XML autorizado

---

## PRIORIDAD DE CAMBIOS

### 1️⃣ CRÍTICO (Hacer primero)
- Tarifas IVA completas
- Clave de acceso validada
- Máquina de estados

### 2️⃣ IMPORTANTE (Hacer segundo)
- Estructura XML correcta
- Información comprador completa
- Formas de pago SRI

### 3️⃣ OPCIONAL (Complementarios)
- Firma digital
- Envío a SRI (ya tienes el microservicio)
- Reportes de autorización

