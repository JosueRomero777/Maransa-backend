import { PrismaService } from '../prisma/prisma.service';
import { SeederService } from './seeder.service';
import { InvoicingSeederService } from './invoicing-seeder.service';


async function runSeeder() {
  const prisma = new PrismaService();
  const invoicingSeeder = new InvoicingSeederService(prisma);
  const seeder = new SeederService(prisma, invoicingSeeder);

  try {
    console.log('🌱 Iniciando seeder...');
    await prisma.$connect();

    // Ejecutar el seeder completo usando onApplicationBootstrap
    await seeder.onApplicationBootstrap();

    console.log('✅ Seeder completado exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando seeder:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSeeder();