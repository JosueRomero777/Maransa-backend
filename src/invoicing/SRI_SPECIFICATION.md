# 📋 Especificación Técnica: Facturación Electrónica SRI Ecuador

## 1. ESTRUCTURA GENERAL DE FACTURA ELECTRÓNICA

### 1.1 Campos Obligatorios Principales

```
FACTURA ELECTRÓNICA (Comprobante 01)
├─ INFORMACIÓN DEL EMISOR (Vendedor)
│  ├─ RUC (13 dígitos)
│  ├─ Razón Social
│  ├─ Nombre Comercial
│  ├─ Dirección Matriz
│  ├─ Dirección Sucursal
│  └─ Contribuyente Especial (Si/No)
│
├─ INFORMACIÓN DEL ADQUIRENTE (Comprador)
│  ├─ Tipo Identificación: RUC, Cédula, Pasaporte, Exterior
│  ├─ Identificación
│  ├─ Razón Social
│  ├─ Dirección
│  └─ Email (Opcional pero recomendado)
│
├─ INFORMACIÓN DE LA FACTURA
│  ├─ Tipo Comprobante: "01" (Factura)
│  ├─ Código Establecimiento: "001" (3 dígitos)
│  ├─ Código Punto Emisión: "001" (3 dígitos)
│  ├─ Número Secuencial: "000000001" (9 dígitos)
│  ├─ Número Factura Completo: 001-001-000000001
│  ├─ Fecha Emisión: AAAA-MM-DD
│  ├─ Ambiente: "1" (Pruebas) ó "2" (Producción)
│  ├─ Tipo Emisión: "1" (Normal)
│  └─ Clave de Acceso: 49 dígitos
│
├─ DETALLES DE LÍNEA (Items/Productos)
│  ├─ Código Principal
│  ├─ Código Auxiliar (Opcional)
│  ├─ Descripción
│  ├─ Cantidad
│  ├─ Unidad de Medida (Código)
│  ├─ Precio Unitario (Sin IVA)
│  ├─ Descuento (Opcional)
│  ├─ Código Impuesto: "2" (IVA), "3" (ICE)
│  ├─ Código Porcentaje: "0", "2", "3", "5" (Ver tabla de tarifas)
│  ├─ Tarifa: 0%, 5%, 12%, 14%, 20% (Según código)
│  ├─ Base Imponible: (Cantidad × Precio - Descuento)
│  └─ Valor Impuesto: (Base × Tarifa / 100)
│
├─ TOTALES
│  ├─ Subtotal Sin Impuestos
│  ├─ Subtotal 0% (Exentos)
│  ├─ Subtotal 5%
│  ├─ Subtotal 12%
│  ├─ Subtotal 14%
│  ├─ Subtotal 20%
│  ├─ Total Descuentos
│  ├─ Total IVA
│  ├─ Total ICE (Si aplica)
│  ├─ Total ReBIUS (Si aplica)
│  └─ TOTAL FACTURA
│
├─ INFORMACIÓN DE PAGO
│  ├─ Forma Pago: "01" (Efectivo), "02" (Cheque), "16" (Tarjeta Crédito)
│  ├─ Plazo (Días para pago)
│  └─ Total
│
└─ FIRMA DIGITAL
   ├─ Certificado X.509
   ├─ Algoritmo: SHA-256 with RSA
   └─ Valor de Firma (Base64)
```

---

## 2. CÓDIGOS DE IMPUESTOS Y TARIFAS

### 2.1 Códigos de Tipo Impuesto

| Código | Tipo Impuesto | Descripción |
|--------|---------------|------------|
| **2** | IVA | Impuesto al Valor Agregado |
| **3** | ICE | Impuesto a Consumos Especiales |
| **5** | IRBPNR | Impuesto a Rentabilidad de Bienes y Patrimonio |
| **6** | ReBIUS | Régimen Benéfico de Indemnizaciones y Subsidios |
| **7** | ISD | Impuesto a Salida de Divisas |
| **8** | OTROSIMPUESTOS | Otros Impuestos |
| **9** | ACOTACION | Acotación |

### 2.2 Códigos de Porcentaje de Tarifa IVA

| Código | Tarifa | Descripción | Ejemplos |
|--------|--------|-------------|----------|
| **0** | 0% | No Objeto de IVA | Exentos, Transfers, Seguros |
| **2** | 12% | IVA General | Mayoría de productos/servicios |
| **3** | 14% | IVA Especial | Ciertos servicios |
| **4** | 5% | IVA Reducido | Productos de primera necesidad |
| **5** | 20% | Código Especial | Casos específicos |
| **6** | 0% | Exento | Medicinas, educación |

### 2.3 Códigos ICE (Impuesto Consumos Especiales)

| Código | Tarifa | Producto | Ejemplo |
|--------|--------|----------|---------|
| **1** | 5% | Bebidas no alcohólicas | Gaseosas |
| **2** | 10% | Bebidas alcohólicas | Cerveza, vino |
| **3** | 75% | Tabaco | Cigarrillos |
| **4** | 100% | Vehículos | Autos |
| **5** | 5% | Servicios de telecomunicaciones | Telefonía móvil |

### 2.4 Códigos de Unidad de Medida

| Código | Unidad |
|--------|--------|
| **1** | Kilogramo (kg) |
| **2** | Litro (l) |
| **3** | Unidad (u) |
| **4** | Metro (m) |
| **5** | Metro cuadrado (m²) |
| **6** | Hora (h) |
| **7** | Servicio |
| **8** | Tonelada (t) |

---

## 3. CLAVE DE ACCESO - VALIDACIÓN Y CÁLCULO

### 3.1 Estructura de Clave de Acceso (49 dígitos)

```
DD MM AAAA TT RUC(9) EST(3) PTO(3) SEC(9) DigVer
├─ DD: Día de emisión (01-31)
├─ MM: Mes de emisión (01-12)
├─ AAAA: Año de emisión (2007-2099)
├─ TT: Tipo de comprobante (01-07)
├─ RUC(9): Últimos 9 dígitos del RUC del emisor
├─ EST(3): Código establecimiento (001-999)
├─ PTO(3): Código punto emisión (001-999)
├─ SEC(9): Número secuencial (000000001-999999999)
└─ DigVer: Dígito verificador (módulo 11)
```

**Ejemplo:** `2101202401123456789001001000000001X`

### 3.2 Algoritmo Dígito Verificador (Módulo 11)

```
PASO 1: Concatenar primeros 48 dígitos
        21 01 2024 01 123456789 001 001 000000001

PASO 2: Multiplicar cada dígito por su peso
        Peso: 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, ...
        Valores pares cíclicos

        2×7 = 14 → 1+4 = 5
        1×6 = 6  → 6
        0×5 = 0  → 0
        1×4 = 4  → 4
        2×3 = 6  → 6
        0×2 = 0  → 0
        2×7 = 14 → 1+4 = 5
        4×6 = 24 → 2+4 = 6
        ... (continuar para los 48 dígitos)

PASO 3: Sumar todos los resultados
        Total = suma de todos los dígitos

PASO 4: Calcular módulo 11
        Residuo = Total % 11

PASO 5: Dígito verificador
        Si Residuo = 0 → DV = 0
        Si Residuo = 1 → DV = 1
        Si Residuo > 1 → DV = 11 - Residuo

EJEMPLO:
        Si suma = 247
        247 % 11 = 5
        DV = 11 - 5 = 6
        Dígito verificador = 6
```

---

## 4. TIPOS DE COMPROBANTES

| Código | Tipo | Descripción | Uso |
|--------|------|-------------|-----|
| **01** | Factura | Comprobante de venta | Venta de bienes/servicios |
| **02** | Nota de Crédito | Devolución/descuento | Anular parcial/total |
| **03** | Nota de Débito | Adicional de valor | Incremento de valor |
| **04** | Comprobante Retención | Retención en la fuente | Retenciones IVA/Renta |
| **05** | Factura Electrónica de Exportación | Exportaciones | Ventas al exterior |
| **06** | Comprobante por Emissão Electrónica Incompleta | Emisión incompleta | Casos especiales |
| **07** | Factura Electrónica por Autorización Especial | Autorización especial | Régimen especial |

---

## 5. FORMAS DE PAGO

| Código | Forma Pago | Descripción |
|--------|-----------|------------|
| **01** | Efectivo | Pago en dinero |
| **02** | Cheque | Pago con cheque |
| **03** | Débito Bancario | Transferencia bancaria |
| **04** | Crédito Bancario | Crédito del banco |
| **05** | Otros con Comprobante | Otros con comprobante |
| **06** | Otros sin Comprobante | Otros sin comprobante |
| **15** | Tarjeta Débito | Tarjeta de débito |
| **16** | Tarjeta Crédito | Tarjeta de crédito |
| **17** | Dinero Electrónico | Dinero electrónico |
| **19** | Pago por Compensación | Compensación de deudas |

---

## 6. TIPOS DE IDENTIFICACIÓN

| Código | Tipo | Dígitos | Descripción |
|--------|------|---------|------------|
| **04** | RUC | 13 | Registro Único de Contribuyentes |
| **05** | Cédula | 10 | Cédula de Identidad Ecuatoriana |
| **06** | Pasaporte | Variable | Pasaporte |
| **07** | Documento Exterior | Variable | Identificación extranjera |
| **08** | Identificación Laboral | Variable | Carnet laboral |
| **09** | Tarjeta IESS | Variable | Tarjeta IESS |

---

## 7. AMBIENTES Y TIPOS DE EMISIÓN

### 7.1 Ambientes

| Código | Ambiente | Descripción |
|--------|----------|------------|
| **1** | Pruebas (Testing) | Para pruebas del sistema |
| **2** | Producción | Para transacciones reales |

### 7.2 Tipo Emisión

| Código | Tipo | Descripción |
|--------|------|------------|
| **1** | Normal | Emisión normal de comprobante |
| **2** | Indisponibilidad del SII | Por indisponibilidad del sistema |

---

## 8. ESTADOS DE FACTURA EN EL SRI

| Estado | Descripción | Significado |
|--------|------------|------------|
| **RECIBIDA** | Recibida por SRI | Factura fue recibida correctamente |
| **AUTORIZADA** | Autorizada por SRI | Factura es válida y autorizada |
| **RECHAZADA** | Rechazada por SRI | Factura tiene errores |
| **ANULADA** | Anulada | Factura fue anulada |
| **VENCIDA** | Vencida | Superó tiempo de emisión |

---

## 9. VALIDACIONES CRÍTICAS

### 9.1 Validación de RUC

- Debe ser 13 dígitos
- Primer dígito = Región (01-24)
- Dígito 3 = Tipo (0-8, donde 9 es público)
- Últimos dígitos = Secuencial

### 9.2 Validación de Cédula

- Debe ser 10 dígitos
- Primer dígito = Provincia (01-24)

### 9.3 Validación de Números Secuenciales

- Rango: 000000001 a 999999999
- No pueden saltarse números
- Deben ser consecutivos

### 9.4 Validación de Fechas

- Formato: AAAA-MM-DD
- Año: 2007-2099
- Mes: 01-12
- Día: Válido para el mes

---

## 10. ESTRUCTURA XML COMPLETA

### 10.1 Estructura Mínima de Factura XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
    
    <!-- INFORMACIÓN DEL COMPROBANTE -->
    <infoTributaria>
        <ambiente>1</ambiente>
        <tipoEmision>1</tipoEmision>
        <razonSocial>EMPRESA PRUEBA S.A.</razonSocial>
        <nombreComercial>EMPRESA PRUEBA</nombreComercial>
        <ruc>1234567890001</ruc>
        <claveAcceso>2101202401123456789001001000000001X</claveAcceso>
        <codDoc>01</codDoc>
        <estab>001</estab>
        <ptoEmi>001</ptoEmi>
        <secuencial>000000001</secuencial>
        <dirMatriz>Quito, Ecuador</dirMatriz>
    </infoTributaria>
    
    <!-- INFORMACIÓN DE LA FACTURA -->
    <infoFactura>
        <fechaEmision>2024-01-21</fechaEmision>
        <dirEstablecimiento>Quito, Ecuador</dirEstablecimiento>
        <contribuyenteEspecial></contribuyenteEspecial>
        <obligadoContabilidad>SI</obligadoContabilidad>
        <comprobanteModificado>NO</comprobanteModificado>
        <estab>001</estab>
        <ptoEmi>001</ptoEmi>
        <secuencial>000000001</secuencial>
        <claveAccesoModificado></claveAccesoModificado>
        <fechaEmisionModificado></fechaEmisionModificado>
        <totalSinImpuestos>100.00</totalSinImpuestos>
        <totalDescuento>0.00</totalDescuento>
        
        <!-- DETALLES DE IMPUESTOS -->
        <totalConImpuestos>
            <totalImpuesto>
                <codigo>2</codigo>
                <codigoPorcentaje>2</codigoPorcentaje>
                <baseImponible>100.00</baseImponible>
                <valor>12.00</valor>
            </totalImpuesto>
        </totalConImpuestos>
        
        <propina>0.00</propina>
        <importeTotal>112.00</importeTotal>
        <moneda>USD</moneda>
        
        <!-- FORMA DE PAGO -->
        <pagos>
            <pago>
                <formaPago>01</formaPago>
                <total>112.00</total>
            </pago>
        </pagos>
        
    </infoFactura>
    
    <!-- DETALLES (LÍNEAS) -->
    <detalles>
        <detalle>
            <codigoPrincipal>001</codigoPrincipal>
            <codigoAuxiliar></codigoAuxiliar>
            <descripcion>Producto de prueba</descripcion>
            <cantidad>1.00</cantidad>
            <precioUnitario>100.00</precioUnitario>
            <descuento>0.00</descuento>
            <precioTotalSinImpuesto>100.00</precioTotalSinImpuesto>
            
            <impuestos>
                <impuesto>
                    <codigo>2</codigo>
                    <codigoPorcentaje>2</codigoPorcentaje>
                    <tarifa>12</tarifa>
                    <baseImponible>100.00</baseImponible>
                    <valor>12.00</valor>
                </impuesto>
            </impuestos>
            
        </detalle>
    </detalles>
    
    <!-- INFORMACIÓN DEL COMPRADOR -->
    <infoAdicional>
        <campoAdicional nombre="identificacionComprador">0123456789001</campoAdicional>
        <campoAdicional nombre="razonSocialComprador">CLIENTE PRUEBA</campoAdicional>
    </infoAdicional>
    
</factura>
```

---

## 11. FIRMA DIGITAL

### 11.1 Certificado Digital

- **Tipo:** X.509
- **Algoritmo:** RSA 2048 bits (mínimo)
- **Hash:** SHA-256
- **Autoridades Certificadoras en Ecuador:**
  - ANF (Autoridad de Certificación)
  - ACCEC (Autoridad de Certificación)
  - Otros proveedores autorizados

### 11.2 Proceso de Firma

1. Generar XML sin firma
2. Calcular hash SHA-256 del XML
3. Encriptar hash con clave privada (RSA)
4. Insertar firma en XML
5. Enviar XML firmado a SRI

---

## 12. VALIDACIONES DE NEGOCIO

### 12.1 Antes de Emitir Factura

- [ ] RUC del emisor válido
- [ ] Tipo identificación comprador válido
- [ ] Identificación comprador válida
- [ ] Clave de acceso calculada correctamente
- [ ] Números secuenciales consecutivos
- [ ] Fechas válidas
- [ ] Totales calculados correctamente
- [ ] Al menos 1 detalle
- [ ] IVA aplicado según tipo producto
- [ ] Código impuesto válido

### 12.2 Después de Emitir Factura

- [ ] Generar XML
- [ ] Firmar digitalmente
- [ ] Enviar a SRI para recepción
- [ ] Esperar confirmación de recepción
- [ ] Si rechazada: corregir errores
- [ ] Si recibida: esperar autorización
- [ ] Obtener número autorización
- [ ] Guardar XML autorizado

---

## 13. ENDPOINTS SRI PARA PRODUCCIÓN

### 13.1 Ambiente de Pruebas (Sandbox)

```
Recepción: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline
Autorización: https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
```

### 13.2 Ambiente de Producción

```
Recepción: https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline
Autorización: https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
```

---

## 14. REFERENCIAS

- **Normativa:** LRTI y Reglamento
- **Documentación Oficial:** www.sri.gob.ec
- **Catálogos:** https://www.sri.gob.ec/es/
- **Fecha Actualización:** 2024

