import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.seedAdminUser();
  }

  private async seedAdminUser() {
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
}