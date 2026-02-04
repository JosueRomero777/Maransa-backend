import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario, TipoProveedor } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedPriceEstimationData } from './price-estimation.seed';
import { InvoicingSeederService } from './invoicing-seeder.service';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private prisma: PrismaService,
    private invoicingSeeder: InvoicingSeederService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdminUser();
    await this.seedProviders();
    await this.seedPackagers();
    await this.seedPriceEstimationModule();
    await this.invoicingSeeder.seed();
  }

  public async seedAdminUser() {
    try {
      // Verificar si ya existe un usuario admin
      const existingAdmin = await this.prisma.user.findFirst({
        where: {
          role: RolUsuario.ADMIN,
        },
      });

      if (existingAdmin) {
        this.logger.log('Usuario admin ya existe');
        return;
      }

      // Crear el usuario admin por defecto
      const defaultAdmin = {
        name: 'Administrador',
        email: 'admin@maransa.com',
        password: 'admin123', // Contraseña por defecto
        role: RolUsuario.ADMIN,
      };

      // Hashear la contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(defaultAdmin.password, saltRounds);

      // Crear el usuario admin
      const adminUser = await this.prisma.user.create({
        data: {
          name: defaultAdmin.name,
          email: defaultAdmin.email,
          password: hashedPassword,
          role: defaultAdmin.role,
        },
      });

      this.logger.log(`Usuario admin creado exitosamente:`);
      this.logger.log(`Email: ${defaultAdmin.email}`);
      this.logger.log(`Password: ${defaultAdmin.password}`);
      this.logger.warn('CAMBIAR LA CONTRASEÑA POR DEFECTO EN PRODUCCIÓN');

    } catch (error) {
      this.logger.error('Error al crear usuario admin:', error);
    }
  }

  public async seedProviders() {
    try {
      const existingProviders = await this.prisma.provider.findMany();
      
      if (existingProviders.length > 0) {
        this.logger.log('Proveedores ya existen');
        return;
      }

      const providersData = [
        {
          name: 'Camaronera del Pacífico',
          type: TipoProveedor.GRAN_CAMARONERA,
          location: 'Guayaquil, Guayas',
          capacity: 5000,
          contact_whatsapp: '+593987654321',
          contact_email: 'contacto@camaronerapacifico.com',
          contact_phone: '+593987654321',
          notes: 'Camaronera especializada en tallas grandes',
          condicionesComerciales: 'Pago a 30 días, descuento por volumen',
          puntualidadPromedio: 95.5,
          confiabilidadPromedio: 98.2,
        },
        {
          name: 'Aquacultura Marina S.A.',
          type: TipoProveedor.MEDIANA_CAMARONERA,
          location: 'Machala, El Oro',
          capacity: 3500,
          contact_whatsapp: '+593987654322',
          contact_email: 'ventas@aquamarina.com',
          contact_phone: '+593987654322',
          notes: 'Productor de camarón orgánico certificado',
          condicionesComerciales: 'Pago anticipado 50%, saldo contraentrega',
          puntualidadPromedio: 92.1,
          confiabilidadPromedio: 96.8,
        },
        {
          name: 'Grupo Camaronero El Oro',
          type: TipoProveedor.MEDIANA_CAMARONERA,
          location: 'Santa Rosa, El Oro',
          capacity: 4200,
          contact_whatsapp: '+593987654323',
          contact_email: 'info@grupocamaroneoro.com',
          contact_phone: '+593987654323',
          notes: 'Empresa familiar con 20 años de experiencia',
          condicionesComerciales: 'Pago a 15 días, certificación sanitaria incluida',
          puntualidadPromedio: 89.7,
          confiabilidadPromedio: 94.5,
        },
        {
          name: 'Camarones de Manabí Ltda.',
          type: TipoProveedor.MEDIANA_CAMARONERA,
          location: 'Manta, Manabí',
          capacity: 2800,
          contact_whatsapp: '+593987654324',
          contact_email: 'comercial@camaronesmanabi.com',
          contact_phone: '+593987654324',
          notes: 'Especialistas en camarón de alta calidad',
          condicionesComerciales: 'Pago a 21 días, garantía de calidad',
          puntualidadPromedio: 91.3,
          confiabilidadPromedio: 97.1,
        },
        {
          name: 'Costa Azul Aquaculture',
          type: TipoProveedor.PEQUENA_CAMARONERA,
          location: 'Esmeraldas, Esmeraldas',
          capacity: 1500,
          contact_whatsapp: '+593987654325',
          contact_email: 'ventas@costaazul.com',
          contact_phone: '+593987654325',
          notes: 'Pequeño productor con excelente calidad',
          condicionesComerciales: 'Pago al contado, descuento 2%',
          puntualidadPromedio: 87.9,
          confiabilidadPromedio: 95.3,
        },
      ];

      for (const providerData of providersData) {
        await this.prisma.provider.create({
          data: providerData,
        });
      }

      this.logger.log(`${providersData.length} proveedores creados exitosamente`);
    } catch (error) {
      this.logger.error('Error al crear proveedores:', error.message);
    }
  }

  public async seedPackagers() {
    try {
      // Verificar si ya existen empacadoras
      const existingPackagers = await this.prisma.packager.count();

      if (existingPackagers > 0) {
        this.logger.log('Las empacadoras ya existen');
        return;
      }

      // Datos de empacadoras de ejemplo
      const packagersData = [
        {
          name: 'Empacadora del Pacífico S.A.',
          location: 'Guayaquil',
          contact_email: 'contacto@empapacifico.com',
          contact_phone: '+593-4-2234567',
          contact_whatsapp: '+593987654321',
          ruc: '0992345678001',
          active: true,
        },
        {
          name: 'Procesadora Marina del Ecuador',
          location: 'Machala',
          contact_email: 'ventas@marinaecuador.com',
          contact_phone: '+593-7-2987654',
          contact_whatsapp: '+593912345678',
          ruc: '0991234567001',
          active: true,
        },
        {
          name: 'Empacadora Costa Azul',
          location: 'Manta',
          contact_email: 'info@costaazul.com',
          contact_phone: '+593-5-2876543',
          contact_whatsapp: '+593998765432',
          ruc: '0990987654001',
          active: true,
        },
        {
          name: 'Industrial Pesquera del Sur',
          location: 'Santa Elena',
          contact_email: 'industrial@pesquerasur.com',
          contact_phone: '+593-4-2765432',
          contact_whatsapp: '+593976543210',
          ruc: '0990876543001',
          active: true,
        },
        {
          name: 'Mariscos Premium Ecuador',
          location: 'Durán',
          contact_email: 'premium@mariscos.ec',
          contact_phone: '+593-4-2654321',
          contact_whatsapp: '+593965432109',
          ruc: '0990765432001',
          active: true,
        }
      ];

      // Crear las empacadoras
      for (const packagerData of packagersData) {
        await this.prisma.packager.create({
          data: packagerData,
        });
      }

      this.logger.log(`${packagersData.length} empacadoras creadas exitosamente`);

    } catch (error) {
      this.logger.error('Error al crear empacadoras:', error);
    }
  }

  public async seedPriceEstimationModule() {
    try {
      // Verificar si ya existen datos del módulo de estimaciones
      const existingFormulas = await this.prisma.priceFormula.findMany();
      const existingMarketFactors = await this.prisma.marketFactor.findMany();
      
      if (existingFormulas.length > 0 && existingMarketFactors.length > 0) {
        this.logger.log('El módulo de estimaciones de precios ya tiene datos');
        return;
      }

      this.logger.log('Iniciando seed del módulo de estimaciones de precios...');
      await seedPriceEstimationData(this.prisma);
    } catch (error) {
      this.logger.error('Error al inicializar módulo de estimaciones de precios:', error);
    }
  }
}