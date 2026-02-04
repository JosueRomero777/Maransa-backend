# 📋 IMPLEMENTACIÓN COMPLETA: XML → Firma → PDF → Visualización

## ✅ Lo que se implementó

### 1. **Servicio de Firma Digital (SriSignatureService)**
- Integración con microservicio FIRMA_SRI_3_API
- Envía XML a firmar con certificado PKCS#12
- Recibe XML firmado, número de autorización y fecha de autorización
- Manejo robusto de errores con mensajes descriptivos
- Timeout de 30 segundos para solicitudes

**Archivo**: `src/invoicing/services/sri-signature.service.ts`

```typescript
// Uso
const resultado = await this.sriSignature.firmarYAutorizarXml(
  xmlContent,
  certificadoPath,
  claveCertificado,
  'factura',
  'http://localhost:9000'
);
// Retorna: { xmlFirmado, numeroAutorizacion, fechaAutorizacion, estado }
```

### 2. **Generador de PDF RIDE (PdfGeneratorService)**
- Genera PDF en formato RIDE (Representación Impresa de Documento Electrónico)
- Incluye código QR con clave de acceso
- Detalles de factura con desglose de tarifas IVA
- Información de empresa y cliente
- Resumen de totales por tarifa

**Archivo**: `src/invoicing/services/pdf-generator.service.ts`

**Características**:
- Código QR automático con clave de acceso
- Tabla de items con descripción, cantidad y precios
- Desglose de tarifas: 0%, 5%, 12%, 14%, 15%, 20%
- Logo y datos de empresa
- Información de cliente
- Forma de pago y plazo de crédito

### 3. **Método de Autorización Completa (signAndAuthorizeInvoice)**
- Valida que la factura esté EMITIDA
- Firma el XML contra el SRI
- Genera PDF RIDE
- Actualiza la factura con todos los datos
- Estado final: AUTORIZADA_SRI

**Archivo**: `src/invoicing/invoicing.service.ts`

```typescript
// Uso en endpoint POST /invoicing/invoices/:id/sign-and-authorize
const factura = await this.invoicingService.signAndAuthorizeInvoice(id);
```

### 4. **Endpoints de Descarga**
Dos nuevos endpoints para descargar documentos:

**GET `/invoicing/invoices/:id/pdf`**
- Descarga el PDF RIDE generado
- Requiere que la factura esté AUTORIZADA_SRI
- Retorna archivo PDF

**GET `/invoicing/invoices/:id/xml`**
- Descarga el XML generado
- Retorna archivo XML

### 5. **Frontend - Botones de Acción**
Se agregaron nuevos botones en la tabla de facturas:

| Estado | Botón | Acción |
|--------|-------|--------|
| BORRADOR | ✓ Editar | Permite editar facturas sin emitir |
| BORRADOR | ✓ Emitir | Genera XML, estado → EMITIDA |
| EMITIDA | ✓ Firmar y Autorizar | Firma contra SRI, genera PDF, estado → AUTORIZADA_SRI |
| AUTORIZADA_SRI | ⬇️ Descargar PDF | Descarga PDF RIDE |
| EMITIDA/AUTORIZADA_SRI | 💰 Registrar Pago | Abre formulario de pago |

## 🔄 Flujo Completo de Facturación SRI

```
1. CREAR FACTURA
   ↓ estado: BORRADOR
   └─→ InvoiceForm.tsx

2. EMITIR FACTURA
   ↓ POST /invoicing/invoices/:id/emit
   ├─ Genera XML según especificación SRI
   ├─ Calcula clave de acceso (49 dígitos)
   ├─ Guarda en storage/invoices/xml/
   └─ estado: EMITIDA

3. FIRMAR Y AUTORIZAR
   ↓ POST /invoicing/invoices/:id/sign-and-authorize
   ├─ Valida configuración activa
   ├─ Envía XML a FIRMA_SRI_3_API
   ├─ Recibe XML firmado
   ├─ Genera PDF RIDE con QR
   ├─ Guarda en storage/invoices/pdf/
   ├─ Guarda en storage/invoices/xml/ (firmado)
   └─ estado: AUTORIZADA_SRI

4. DESCARGAR PDF
   ↓ GET /invoicing/invoices/:id/pdf
   └─ Descarga factura_numeroFactura.pdf

5. REGISTRAR PAGO
   ↓ POST /invoicing/payments
   ├─ Valida que factura sea AUTORIZADA_SRI o EMITIDA
   ├─ Crea registro de pago
   └─ Opcionalmente estado: PAGADA
```

## 📦 Dependencias Instaladas

```bash
npm install pdfkit qrcode form-data @types/pdfkit --legacy-peer-deps
```

- **pdfkit**: Generación de PDF
- **qrcode**: Generación de códigos QR
- **form-data**: Multipart para enviar archivos a FIRMA_SRI_3_API
- **@types/pdfkit**: TypeScript definitions

## 🛠️ Configuración Requerida

### Backend (.env)
```env
# Microservicio de firma (debe estar ejecutándose)
FIRMA_SRI_API_URL=http://localhost:9000
```

### Base de Datos (Prisma)
Campos agregados a Invoice:
- `xmlFirmado`: XML firmado por SRI (Text)
- `xmlAutorizado`: Alias de xmlFirmado (Text)
- `rutaXmlFirmado`: Path al archivo XML firmado
- `rutaXmlAutorizado`: Path al archivo (alias)
- `rutaPdfRide`: Path al PDF RIDE
- `numeroAutorizacion`: Número de autorización del SRI (String, 49 chars)
- `fechaAutorizacion`: Fecha de autorización

### Rutas de Almacenamiento
```
storage/
├── invoices/
│   ├── xml/          # XMLs generados y firmados
│   └── pdf/          # PDFs RIDE generados
└── certificates/    # Certificados PKCS#12
```

## 🔐 Certificados PKCS#12

Para producción, necesitas:
1. Obtener certificado PKCS#12 del SRI
2. Guardar en ruta configurada en InvoiceConfig
3. Configurar contraseña en InvoiceConfig

Por ahora: Usar certificado dummy en `certificates/dummy-cert.p12`

## ⚠️ Requisitos Previos

### FIRMA_SRI_3_API debe estar ejecutándose
```bash
# En terminal aparte (necesitas PHP >= 7.4)
cd ruta/al/servicio && php -S localhost:9000
```

El servicio espera:
- **Endpoint**: `POST /api/facturacion/procesar`
- **Parámetros**:
  - `archivo_xml`: Buffer XML
  - `certificado_p12`: Buffer certificado
  - `clave_certificado`: String contraseña
  - `tipo_documento`: 'factura'
- **Respuesta**:
  ```json
  {
    "success": true,
    "data": {
      "documento_firmado": "<?xml...>",
      "numero_autorizacion": "1234567890123456789012345678901234567890123456789",
      "fecha_autorizacion": "2024-01-28T15:30:00"
    }
  }
  ```

## 🧪 Testing Manual

### 1. Crear Factura
```bash
POST /invoicing/invoices
{
  "packagerId": 1,
  "tipoComprobante": "FACTURA",
  "fechaEmision": "2024-01-28",
  "formaPago": "01",
  "detalles": [
    {
      "codigoPrincipal": "ART001",
      "descripcion": "Camarón",
      "cantidad": 100,
      "precioUnitario": 15.00,
      "codigoPorcentaje": "5",
      "tarifa": 0
    }
  ]
}
```

### 2. Emitir Factura
```bash
POST /invoicing/invoices/1/emit
```
✅ Retorna: factura con xmlGenerado y claveAcceso

### 3. Firmar y Autorizar
```bash
POST /invoicing/invoices/1/sign-and-authorize
```
✅ Retorna: factura con numeroAutorizacion, rutaPdfRide

### 4. Descargar PDF
```bash
GET /invoicing/invoices/1/pdf
```
✅ Descarga: factura_FAC-001.pdf

## 📊 Estados de Factura Actualizado

```
BORRADOR → EMITIDA → AUTORIZADA_SRI → PAGADA
          ↓                         ↓
        ANULADA (en cualquier momento)
```

## 🎯 Próximas Mejoras (Futuras)

- [ ] Reintentos automáticos si FIRMA_SRI_3_API falla
- [ ] Cambiar a PRODUCCION una vez validado
- [ ] Reportes de facturas autorizadas
- [ ] Auditoría de cambios en facturas
- [ ] Envío de PDF por email
- [ ] Portal de consulta de facturas para clientes
- [ ] Integración con contabilidad

## 📞 Soporte

Si hay errores:
1. Verifica que FIRMA_SRI_3_API esté ejecutándose: `http://localhost:9000/health`
2. Verifica configuración activa: `GET /invoicing/config/active`
3. Revisa logs del backend en consola
4. Verifica permisos en carpetas `storage/invoices/`

---

**Actualizado**: 2024-01-28
**Versión**: 1.0 - Implementación Completa
