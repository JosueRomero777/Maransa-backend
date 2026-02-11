import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoPedido, EstadoLaboratorio, EstadoCosecha, EstadoLogistica, TipoProveedor } from '@prisma/client';

/**
 * Seeder para datos completos de tesis
 * - Empacadora: Exportquilsa
 * - Proveedor: Jekesa S.A.
 * - 2 Pedidos completos con flujo de trabajo realista
 */
@Injectable()
export class ThesisSeederService {
    private readonly logger = new Logger(ThesisSeederService.name);

    constructor(private prisma: PrismaService) { }

    async seed() {
        try {
            this.logger.log('🌱 Iniciando seed de datos para tesis...');

            // 1. Verificar y crear admin si no existe
            await this.seedAdmin();

            // 2. Crear empacadora Exportquilsa
            const empacadora = await this.seedEmpacadora();

            // 3. Crear proveedor Jekesa
            const proveedor = await this.seedProveedor();

            // 4. Obtener tallas/presentaciones
            const tallaSinCola16_20 = await this.prisma.shrimpSize.findFirst({
                where: { code: '16/20' }
            });
            const tallaSinCola21_25 = await this.prisma.shrimpSize.findFirst({
                where: { code: '21/25' }
            });
            const presentacionSinCola = await this.prisma.presentationType.findFirst({
                where: { name: { contains: 'Cabeza' } }
            });

            if (!tallaSinCola16_20 || !tallaSinCola21_25 || !presentacionSinCola) {
                this.logger.error('No se encontraron las tallas o presentación "Sin Cola"');
                return;
            }

            // 5. Obtener usuario admin para asignar
            const admin = await this.prisma.user.findFirst({
                where: { role: 'ADMIN' }
            });

            if (!admin) {
                this.logger.error('No se encontró usuario admin');
                return;
            }

            // 6. Crear primer pedido (18 de enero)
            await this.crearPedido1(
                proveedor.id,
                empacadora.id,
                admin.id,
                tallaSinCola16_20.id,
                presentacionSinCola.id
            );

            // 7. Crear segundo pedido (4 de febrero)
            await this.crearPedido2(
                proveedor.id,
                empacadora.id,
                admin.id,
                tallaSinCola21_25.id,
                presentacionSinCola.id
            );

            this.logger.log('✅ Seed de datos para tesis completado exitosamente');
        } catch (error) {
            this.logger.error('Error en seed de datos para tesis:', error);
            throw error;
        }
    }

    private async seedAdmin() {
        const existingAdmin = await this.prisma.user.findFirst({
            where: { role: 'ADMIN' }
        });

        if (!existingAdmin) {
            // El seeder principal ya crea el admin, pero por si acaso
            this.logger.warn('No se encontró admin. Ejecuta el seeder principal primero.');
        }
    }

    private async seedEmpacadora() {
        this.logger.log('📦 Creando empacadora Exportquilsa...');

        const existente = await this.prisma.packager.findFirst({
            where: { ruc: '0992708093001' }
        });

        if (existente) {
            this.logger.log('Exportquilsa ya existe');
            return existente;
        }

        const empacadora = await this.prisma.packager.create({
            data: {
                name: 'Exportquilsa & Productores Asociados S.A.',
                ruc: '0992708093001',
                contact_whatsapp: '+593984222956',
                contact_phone: '+593984222956',
                contact_email: 'info@exportquilsa.com',
                location: 'Km 17 ½ Vía Durán Boliche, Durán',
                active: true,
            }
        });

        this.logger.log(`✅ Empacadora creada: ${empacadora.name}`);
        return empacadora;
    }

    private async seedProveedor() {
        this.logger.log('🐟 Creando proveedor Jekesa S.A....');

        const existente = await this.prisma.provider.findFirst({
            where: { name: 'Jekesa S.A.' }
        });

        if (existente) {
            this.logger.log('Jekesa S.A. ya existe');
            return existente;
        }

        const proveedor = await this.prisma.provider.create({
            data: {
                name: 'Jekesa S.A.',
                type: TipoProveedor.MEDIANA_CAMARONERA,
                location: 'LAS CASITAS, JAMBELÍ, SANTA ROSA',
                capacity: 40000,
                contact_whatsapp: '+593984301023',
                contact_phone: '+593984301023',
                contact_email: 'contacto@jekesa.com',
                notes: 'Mediana camaronera - Capacidad 40.000 libras',
                condicionesComerciales: 'Pago a 15 días, entrega en planta',
                puntualidadPromedio: 95.5,
                confiabilidadPromedio: 97.2,
                active: true,
            }
        });

        this.logger.log(`✅ Proveedor creado: ${proveedor.name}`);
        return proveedor;
    }

    /**
     * PEDIDO 1: 18 de enero de 2026
     * - Talla: 16/20
     * - Cantidad: 20,000 libras
     * - Precio compra: $2.70, venta: $2.80
     */
    private async crearPedido1(
        providerId: number,
        packagerId: number,
        userId: number,
        shrimpSizeId: number,
        presentationTypeId: number
    ) {
        this.logger.log('📝 Creando Pedido 1 (18 enero 2026)...');

        // Fechas con timestamps realistas
        const fechaCreacion = new Date('2026-01-18T16:00:00.000Z'); // 4:00 PM
        const fechaLaboratorio = new Date('2026-01-18T16:05:00.000Z'); // 4:05 PM
        const fechaCosecha = new Date('2026-01-18T16:10:00.000Z'); // 4:10 PM
        const fechaLogistica = new Date('2026-01-18T16:15:00.000Z'); // 4:15 PM
        const fechaLlegada = new Date('2026-01-19T05:00:00.000Z'); // 5:00 AM del 19

        // Verificar si ya existe
        const existing = await this.prisma.order.findFirst({
            where: { codigo: 'PED-2026-001' }
        });

        if (existing) {
            this.logger.log('Pedido 1 ya existe');
            return;
        }

        // Crear pedido
        const pedido = await this.prisma.order.create({
            data: {
                codigo: 'PED-2026-001',
                providerId,
                packagerId,
                createdById: userId,
                presentationTypeId,
                shrimpSizeId,
                cantidadEstimada: 20000,
                cantidadPedida: 20000,
                cantidadFinal: 20000,
                fechaTentativaCosecha: new Date('2026-01-18'),
                fechaDefinitivaCosecha: new Date('2026-01-18'),
                estado: EstadoPedido.RECIBIDO,
                precioEstimadoCompra: 2.70,
                precioRealCompra: 2.70,
                precioEstimadoVenta: 2.80,
                precioRealVenta: 2.80,
                condicionesIniciales: 'Camarón fresco, talla 16/20, calidad premium',
                observaciones: 'Pedido completo procesado exitosamente',
                createdAt: fechaCreacion,
                updatedAt: fechaLlegada,
            }
        });

        // Crear informe de laboratorio
        await this.prisma.laboratory.create({
            data: {
                orderId: pedido.id,
                analistaId: userId,
                estado: EstadoLaboratorio.APROBADO,
                fechaAnalisis: fechaLaboratorio,
                resultadoGeneral: 'Camarón en excelente estado sanitario y organoléptico',
                olor: 'Fresco característico a mar, sin olores extraños o amoniacales',
                sabor: 'Dulce natural del camarón fresco, sin sabores rancios',
                textura: 'Firme y elástica, carne adherida al caparazón, sin decoloración',
                apariencia: 'Caparazón brillante, translúcido, ojos negros prominentes, sin melanosis',
                observaciones: 'Producto cumple con todos los estándares de calidad. Apto para procesamiento inmediato.',
                parametrosQuimicos: {
                    pH: 7.2,
                    temperatura: 4.5,
                    contaminantes: 'No detectados',
                    bacterias: 'Dentro de límites permisibles'
                },
                createdAt: fechaLaboratorio,
                updatedAt: fechaLaboratorio,
            }
        });

        // Crear definición de cosecha
        await this.prisma.harvest.create({
            data: {
                orderId: pedido.id,
                assignedUserId: userId,
                estado: EstadoCosecha.APROBADO,
                fechaAsignacion: fechaCosecha,
                fechaDefinicion: fechaCosecha,
                fechaAprobacion: fechaCosecha,
                cantidadEstimada: 20000,
                cantidadFinal: 20000,
                fechaEstimada: new Date('2026-01-18'),
                fechaDefinitiva: new Date('2026-01-18'),
                calidadEsperada: 'Premium - Talla uniforme 16/20',
                condicionesCosecha: 'Cosecha en fase de luna óptima, temperatura controlada',
                temperaturaOptima: 26.5,
                tiempoMaximoTransporte: 8,
                requerimientosEspeciales: 'Transporte en tanques oxigenados, temperatura < 5°C',
                observaciones: 'Condiciones ideales para cosecha. Calidad confirmada.',
                createdAt: fechaCosecha,
                updatedAt: fechaCosecha,
            }
        });

        // Crear logística
        await this.prisma.logistics.create({
            data: {
                orderId: pedido.id,
                assignedUserId: userId,
                estado: EstadoLogistica.COMPLETADO,
                fechaAsignacion: fechaLogistica,
                fechaInicio: fechaLogistica,
                fechaFinalizacion: fechaLlegada,
                vehiculoAsignado: '03-KZT',
                choferAsignado: 'Pedro',
                recursosUtilizados: {
                    medios: 'tanques',
                    oxigeno: true,
                    hielo: true
                },
                ubicacionOrigen: 'LAS CASITAS, JAMBELÍ, SANTA ROSA',
                ubicacionDestino: 'Km 17 ½ Vía Durán Boliche, Durán',
                rutaPlanificada: 'Ruta ideal: 188.6 km (~184 min)',
                origenLat: -3.375755,
                origenLng: -80.130504,
                destinoLat: -2.221064,
                destinoLng: -79.684932,
                trackingActivo: false,
                observaciones: 'Transporte completado sin incidentes. Temperatura mantenida.',
                createdAt: fechaLogistica,
                updatedAt: fechaLlegada,
            }
        });

        // Crear recepción
        await this.prisma.reception.create({
            data: {
                orderId: pedido.id,
                fechaLlegada: fechaLlegada,
                horaLlegada: '05:00',
                pesoRecibido: 20000,
                calidadValidada: true,
                loteAceptado: true,
                precioFinalVenta: 2.80,
                clasificacionFinal: 'Calidad A - Premium',
                tallasFinales: {
                    '16/20': 20000
                },
                condicionesVenta: 'FOB Ecuador, empaque estándar exportación',
                observaciones: 'Lote completo aceptado. Calidad excepcional.',
                createdAt: fechaLlegada,
                updatedAt: fechaLlegada,
            }
        });

        this.logger.log(`✅ Pedido 1 creado: ${pedido.codigo}`);
    }

    /**
     * PEDIDO 2: 4 de febrero de 2026
     * - Talla: 21/25
     * - Cantidad: 15,000 libras
     * - Precio compra: $2.40, venta: $2.50
     */
    private async crearPedido2(
        providerId: number,
        packagerId: number,
        userId: number,
        shrimpSizeId: number,
        presentationTypeId: number
    ) {
        this.logger.log('📝 Creando Pedido 2 (4 febrero 2026)...');

        // Fechas con timestamps realistas
        const fechaCreacion = new Date('2026-02-04T09:00:00.000Z'); // 9:00 AM
        const fechaLaboratorio = new Date('2026-02-04T09:06:00.000Z'); // 9:06 AM
        const fechaCosecha = new Date('2026-02-04T09:12:00.000Z'); // 9:12 AM
        const fechaLogistica = new Date('2026-02-04T09:18:00.000Z'); // 9:18 AM
        const fechaLlegada = new Date('2026-02-04T16:00:00.000Z'); // 4:00 PM

        // Verificar si ya existe
        const existing = await this.prisma.order.findFirst({
            where: { codigo: 'PED-2026-002' }
        });

        if (existing) {
            this.logger.log('Pedido 2 ya existe');
            return;
        }

        // Crear pedido
        const pedido = await this.prisma.order.create({
            data: {
                codigo: 'PED-2026-002',
                providerId,
                packagerId,
                createdById: userId,
                presentationTypeId,
                shrimpSizeId,
                cantidadEstimada: 15000,
                cantidadPedida: 15000,
                cantidadFinal: 15000,
                fechaTentativaCosecha: new Date('2026-02-04'),
                fechaDefinitivaCosecha: new Date('2026-02-04'),
                estado: EstadoPedido.RECIBIDO,
                precioEstimadoCompra: 2.40,
                precioRealCompra: 2.40,
                precioEstimadoVenta: 2.50,
                precioRealVenta: 2.50,
                condicionesIniciales: 'Camarón fresco, talla 21/25, calidad estándar',
                observaciones: 'Pedido procesado satisfactoriamente',
                createdAt: fechaCreacion,
                updatedAt: fechaLlegada,
            }
        });

        // Crear informe de laboratorio
        await this.prisma.laboratory.create({
            data: {
                orderId: pedido.id,
                analistaId: userId,
                estado: EstadoLaboratorio.APROBADO,
                fechaAnalisis: fechaLaboratorio,
                resultadoGeneral: 'Camarón cumple con estándares de calidad comercial',
                olor: 'Característico a mar fresco, sin señales de descomposición',
                sabor: 'Dulce natural propio del camarón, sin alteraciones',
                textura: 'Firme al tacto, buena consistencia muscular, sin signos de reblandecimiento',
                apariencia: 'Caparazón íntegro y brillante, coloración uniforme rosada, ausencia de manchas negras',
                observaciones: 'Muestra representa lote homogéneo. Calidad apropiada para comercialización.',
                parametrosQuimicos: {
                    pH: 7.1,
                    temperatura: 4.8,
                    contaminantes: 'No detectados',
                    bacterias: 'Dentro de límites permisibles'
                },
                createdAt: fechaLaboratorio,
                updatedAt: fechaLaboratorio,
            }
        });

        // Crear definición de cosecha
        await this.prisma.harvest.create({
            data: {
                orderId: pedido.id,
                assignedUserId: userId,
                estado: EstadoCosecha.APROBADO,
                fechaAsignacion: fechaCosecha,
                fechaDefinicion: fechaCosecha,
                fechaAprobacion: fechaCosecha,
                cantidadEstimada: 15000,
                cantidadFinal: 15000,
                fechaEstimada: new Date('2026-02-04'),
                fechaDefinitiva: new Date('2026-02-04'),
                calidadEsperada: 'Estándar comercial - Talla 21/25',
                condicionesCosecha: 'Cosecha matutina, condiciones climáticas favorables',
                temperaturaOptima: 27.0,
                tiempoMaximoTransporte: 7,
                requerimientosEspeciales: 'Transporte refrigerado en tanques, mantener cadena de frío',
                observaciones: 'Cosecha realizada según protocolo. Calidad verificada.',
                createdAt: fechaCosecha,
                updatedAt: fechaCosecha,
            }
        });

        // Crear logística
        await this.prisma.logistics.create({
            data: {
                orderId: pedido.id,
                assignedUserId: userId,
                estado: EstadoLogistica.COMPLETADO,
                fechaAsignacion: fechaLogistica,
                fechaInicio: fechaLogistica,
                fechaFinalizacion: fechaLlegada,
                vehiculoAsignado: '03-QXR',
                choferAsignado: 'Marco',
                recursosUtilizados: {
                    medios: 'tanques',
                    oxigeno: true,
                    hielo: true
                },
                ubicacionOrigen: 'LAS CASITAS, JAMBELÍ, SANTA ROSA',
                ubicacionDestino: 'Km 17 ½ Vía Durán Boliche, Durán',
                rutaPlanificada: 'Ruta ideal: 188.6 km (~184 min)',
                origenLat: -3.375755,
                origenLng: -80.130504,
                destinoLat: -2.221064,
                destinoLng: -79.684932,
                trackingActivo: false,
                observaciones: 'Traslado completado exitosamente. Sin novedades reportadas.',
                createdAt: fechaLogistica,
                updatedAt: fechaLlegada,
            }
        });

        // Crear recepción
        await this.prisma.reception.create({
            data: {
                orderId: pedido.id,
                fechaLlegada: fechaLlegada,
                horaLlegada: '16:00',
                pesoRecibido: 15000,
                calidadValidada: true,
                loteAceptado: true,
                precioFinalVenta: 2.50,
                clasificacionFinal: 'Calidad A - Estándar',
                tallasFinales: {
                    '21/25': 15000
                },
                condicionesVenta: 'FOB Ecuador, empaque estándar exportación',
                observaciones: 'Lote recibido conforme. Calidad satisfactoria.',
                createdAt: fechaLlegada,
                updatedAt: fechaLlegada,
            }
        });

        this.logger.log(`✅ Pedido 2 creado: ${pedido.codigo}`);
    }
}
