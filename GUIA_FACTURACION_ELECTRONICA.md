# Guía de Facturación Electrónica - Sistema MARANSA

## 📋 Descripción General

Este sistema implementa el flujo completo de facturación electrónica según las especificaciones del SRI (Servicio de Rentas Internas) de Ecuador.

## 🔄 Flujo de Facturación

### 1. **Configuración Inicial** (Una sola vez)

#### a. Configurar Datos de la Empresa
Ir a: **Facturación → Configuración**

Completar:
- **Información de la Empresa:**
  - RUC (13 dígitos)
  - Razón Social
  - Nombre Comercial (opcional)
  - Contribuyente Especial (opcional)
  - Dirección Matriz
  - Dirección Establecimiento (si es diferente)
  - Obligado a llevar contabilidad (Sí/No)

- **Punto de Emisión:**
  - Código Establecimiento (3 dígitos, ej: 001)
  - Código Punto de Emisión (3 dígitos, ej: 001)

- **Configuración SRI:**
  - Ambiente: `PRUEBAS` o `PRODUCCION`
  - Tipo de Emisión: `NORMAL` o `CONTINGENCIA`

- **Certificado Digital:**
  - Ruta del Certificado: `certificates/firma.p12`
  - Contraseña del Certificado: (tu contraseña)
  - URL Servicio de Firma: `http://localhost:8001`

Guardar cambios.

#### b. Iniciar Servicio de Firma

El servicio debe estar corriendo en `http://localhost:8001` (usando XAMPP con PHP).

```bash
cd C:\xampp\htdocs\Firma_sri_3_api\public
php -S localhost:8001
```

### 2. **Crear Factura**

1. Ir a: **Facturación → Nueva Factura**
2. Completar:
   - Seleccionar Empacadora (cliente)
   - Pedido (opcional)
   - Tipo de Comprobante: FACTURA
   - Fecha de Emisión
   - Fecha de Vencimiento (si es crédito)
   - Forma de Pago
   - Plazo de Crédito (si aplica)
   - Observaciones (opcionales)

3. Agregar Detalles:
   - Código Principal del Producto
   - Descripción
   - Cantidad
   - Precio Unitario
   - Descuento (si aplica)
   - Tarifa IVA (0%, 5%, 12%, 14%, 15%, 20%)

4. Guardar como **BORRADOR**

### 3. **Emitir Factura** ⚡

**Estado: BORRADOR → EMITIDA**

1. En la lista de facturas, buscar la factura en estado BORRADOR
2. Click en botón **"Emitir"**

**¿Qué hace este paso?**
- ✅ Genera el **XML** según especificación SRI
- ✅ Calcula la **Clave de Acceso** (49 dígitos)
- ✅ Genera el **PDF** (RIDE) preliminar
- ✅ Guarda los archivos en `storage/invoices/`
- ✅ Cambia estado a **EMITIDA**

### 4. **Firmar y Autorizar con SRI** 🔏

**Estado: EMITIDA → AUTORIZADA_SRI**

1. En la lista de facturas, buscar la factura en estado EMITIDA
2. Click en botón **"Firmar y Autorizar"**

**¿Qué hace este paso?**
- 🔐 Firma el XML con tu **certificado digital**
- 📤 Envía el XML firmado al **SRI** para recepción
- ⏳ Espera la **autorización** del SRI (reintentos automáticos)
- 📄 Guarda el **XML autorizado** con número de autorización
- ✅ Genera el **PDF final** (RIDE) con datos de autorización
- ✅ Cambia estado a **AUTORIZADA_SRI**

**Respuesta del SRI:**
- Número de Autorización (10 dígitos)
- Fecha y Hora de Autorización
- Estado: AUTORIZADO / NO AUTORIZADO / DEVUELTA

### 5. **Descargar Documentos** 📥

**Opciones disponibles:**
- **Ver PDF**: Abre el RIDE en nueva pestaña
- **Descargar PDF**: Descarga el archivo PDF
- **Descargar XML**: Descarga el XML firmado y autorizado

## 🔍 Estados de la Factura

| Estado | Significado | Acciones Disponibles |
|--------|-------------|---------------------|
| **BORRADOR** | Factura creada, no emitida | Editar, Emitir, Eliminar |
| **EMITIDA** | XML generado, sin enviar al SRI | Firmar y Autorizar, Ver PDF |
| **AUTORIZADA_SRI** | Autorizada por el SRI | Ver/Descargar PDF, Descargar XML, Registrar Pago |
| **PAGADA** | Pago registrado | Ver/Descargar documentos |
| **ANULADA** | Cancelada manualmente | Solo consulta |
| **VENCIDA** | Plazo de pago vencido | Registrar Pago |

## 📁 Estructura de Archivos

```
maransa-back/
├── certificates/
│   └── firma.p12                    # Certificado digital
├── storage/
│   └── invoices/
│       ├── xml/
│       │   ├── factura_1_*.xml      # XML generado
│       │   └── factura_1_firmado_*.xml  # XML firmado
│       └── pdf/
│           └── factura_1_*.pdf      # PDF RIDE
```

## 🛠️ Servicios Backend

### XmlGeneratorService
- Genera XML según especificación SRI
- Calcula Clave de Acceso (49 dígitos)
- Valida estructura y totales

### SriSignatureService
- Se conecta al microservicio de firma (Firma_sri_3_api)
- Envía XML + Certificado + Contraseña
- Recibe XML firmado y autorizado

### PdfGeneratorService
- Genera RIDE (Representación Impresa)
- Incluye código QR con clave de acceso
- Formato oficial del SRI

## 🔧 Configuración Técnica

### Requisitos
- **Backend**: NestJS, Prisma, PostgreSQL
- **Frontend**: React, Material UI
- **Firma**: PHP 8+, extensión OpenSSL, SoapClient
- **Certificado**: Archivo .p12 válido del SRI

### Variables de Entorno

**maransa-back/.env**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/maransa"
PORT=3000
```

**maransa-api-gateway/.env**
```env
PORT=8080
BACKEND_URL=http://localhost:3000
```

### Endpoints API

#### Facturas
- `POST /invoicing/invoices` - Crear factura
- `GET /invoicing/invoices` - Listar facturas (con filtros)
- `GET /invoicing/invoices/:id` - Ver factura
- `PATCH /invoicing/invoices/:id` - Actualizar factura
- `POST /invoicing/invoices/:id/emit` - Emitir factura
- `POST /invoicing/invoices/:id/sign-and-authorize` - Firmar y autorizar
- `GET /invoicing/invoices/:id/pdf` - Descargar PDF
- `GET /invoicing/invoices/:id/xml` - Descargar XML

#### Configuración
- `GET /invoicing/config/active` - Configuración activa
- `PATCH /invoicing/config/:id` - Actualizar configuración

## 🐛 Solución de Problemas

### Error: "No se puede conectar al servicio de firma"
**Solución:** Verificar que el servicio PHP esté corriendo en puerto 8001
```bash
cd C:\xampp\htdocs\Firma_sri_3_api\public
php -S localhost:8001
```

### Error: "Certificado no encontrado"
**Solución:** 
1. Verificar que el archivo .p12 esté en `maransa-back/certificates/`
2. Verificar ruta en configuración: `certificates/firma.p12`

### Error: "Contraseña incorrecta del certificado"
**Solución:** Revisar la contraseña configurada en "Configuración de Facturación"

### Error: "Comprobante NO AUTORIZADO por el SRI"
**Solución:** Revisar los mensajes del SRI en el error. Comunes:
- Clave de acceso duplicada
- RUC no corresponde al certificado
- Ambiente incorrecto (PRUEBAS vs PRODUCCION)
- Secuencial ya utilizado

### Error: "Error de validación del XML"
**Solución:** El XML no cumple con el schema del SRI. Revisar:
- Totales calculados correctamente
- Detalles con todos los campos requeridos
- RUC del comprador válido
- Fecha de emisión en formato correcto

## 📝 Notas Importantes

1. **Ambiente de Pruebas:** Usar `PRUEBAS` hasta validar todo el flujo
2. **Certificado de Pruebas:** El SRI proporciona certificados de prueba
3. **Secuenciales:** Se incrementan automáticamente por cada factura emitida
4. **Clave de Acceso:** Única por cada documento, incluye fecha y número secuencial
5. **Reintentos:** El sistema reintenta hasta 10 veces consultar la autorización al SRI (espera de 5 segundos entre intentos)

## 📞 Soporte Técnico

Para problemas con el SRI:
- Portal SRI: https://srienlinea.sri.gob.ec/
- Teléfono: 1700 774 774
- Chat en línea: Disponible en el portal

## 🔐 Seguridad

- Los certificados digitales nunca se envían al frontend
- Las contraseñas se almacenan en la base de datos (considerar encriptación)
- Los XMLs firmados se guardan localmente como respaldo
- Logs detallados de cada operación con el SRI
