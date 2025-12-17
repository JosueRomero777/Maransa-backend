# Schema del Sistema de Logística de Camarón

## Resumen de Entidades

### 👥 **Users (Usuarios del Sistema)**
- **Roles**: ADMIN, COMPRAS, LABORATORIO, LOGISTICA, CUSTODIA, EMPACADORA, GERENCIA
- **Relaciones**: Crean pedidos, analizan en laboratorio, asignan logística y custodia

### 🏭 **Provider (Proveedores)**
- **Tipos**: PEQUENA_CAMARONERA, MEDIANA_CAMARONERA, GRAN_CAMARONERA
- **Campos clave**: nombre único, ubicación, capacidad, contactos, puntualidad promedio
- **Relaciones**: Tienen muchos pedidos e historial de precios

### 📦 **Packager (Empacadoras)**
- **Función**: Clientes que compran el camarón procesado
- **Campos**: nombre, ubicación, RUC, contactos
- **Relaciones**: Reciben pedidos, generan facturas

### 📋 **Order (Pedidos) - NÚCLEO DEL SISTEMA**
- **Estados**: CREADO → EN_ANALISIS → APROBADO → EN_COSECHA → EN_TRANSITO → EN_CUSTODIA → RECIBIDO → FACTURADO → FINALIZADO
- **Productos**: VANNAMEI, LANGOSTINO, OTRO
- **Tallas**: U10, U12, U15, U20, U30, U40, U50, U60, U70, U80, U100
- **Tracking completo**: Desde creación hasta facturación

### 🔬 **Laboratory (Análisis de Laboratorio)**
- **Estados**: PENDIENTE, APROBADO, RECHAZADO, EN_REEVALUACION
- **Características**: Análisis químicos, organolépticos, archivos adjuntos
- **Relación**: 1:1 con Order

### 🚛 **Logistics (Logística)**
- **Estados**: PENDIENTE, ASIGNADO, EN_RUTA, COMPLETADO
- **Recursos**: Vehículos, choferes, vines, tanques, oxígeno
- **Evidencias**: Fotos de carga y transporte
- **Relación**: 1:1 con Order

### 👮 **Custody (Custodia)**
- **Función**: Acompañamiento de vehículos durante el transporte
- **Tracking**: Horarios de pesca, llegada, ubicaciones GPS
- **Bitácora**: Incidentes y novedades durante la ruta
- **Relación**: 1:1 con Order

### 🏢 **Reception (Recepción en Empacadora)**
- **Validaciones**: Peso, calidad, aceptación/rechazo de lotes
- **Clasificación**: Tallas finales asignadas por empacadora
- **Precios**: Precio final de venta negociado
- **Relación**: 1:1 con Order

### 💰 **Invoice (Facturas)**
- **Tipos**: FACTURA, NOTA_CREDITO, NOTA_DEBITO, RETENCION
- **Estados**: BORRADOR, EMITIDA, AUTORIZADA_SRI, PAGADA, ANULADA, VENCIDA
- **SRI**: Integración con facturación electrónica ecuatoriana
- **Relación**: Muchas facturas por Order

### 💳 **Payment (Pagos)**
- **Métodos**: Efectivo, transferencia, cheque
- **Seguimiento**: Referencia, fecha, monto
- **Relación**: Muchos pagos por Invoice

### 📊 **PriceHistory (Historial de Precios)**
- **Función**: Base de datos para algoritmos predictivos
- **Dimensiones**: Proveedor, empacadora, tipo de producto, talla, temporada
- **Uso**: Estimación de precios y análisis de rentabilidad

### 📱 **Notification (Notificaciones)**
- **Canales**: WhatsApp, Email, SMS
- **Automáticas**: Confirmaciones de pedido, fechas de cosecha
- **Tracking**: Enviado, leído, respuesta

### 📝 **EventLog (Bitácora de Eventos)**
- **Función**: Auditoría completa del sistema
- **Registro**: Usuario, acción, datos anteriores/nuevos, IP
- **Trazabilidad**: Quién hizo qué y cuándo

### ⚙️ **SystemConfig (Configuraciones)**
- **Función**: Parámetros configurables del sistema
- **Ejemplos**: Días mínimos reevaluación laboratorio, márgenes por defecto

## 🔄 Flujo Principal del Sistema

1. **COMPRAS** crea un pedido asociado a un proveedor
2. **LABORATORIO** analiza y aprueba/rechaza muestras
3. **COMPRAS** define libras finales y fechas de cosecha
4. **LOGÍSTICA** asigna vehículos y recursos
5. **CUSTODIA** acompaña el transporte
6. **EMPACADORA** recibe y valida el producto
7. **ADMIN** genera facturas y gestiona pagos

## 📈 Módulos de Análisis

- **Rentabilidad por lote**: Costo compra + logística vs. precio venta
- **Análisis de proveedores**: Puntualidad, confiabilidad, calidad
- **Predicción de precios**: Basada en historial y temporadas
- **Dashboards gerenciales**: KPIs y tendencias

## 🔐 Sistema de Permisos

Cada rol tiene acceso específico a módulos según su función en el proceso.