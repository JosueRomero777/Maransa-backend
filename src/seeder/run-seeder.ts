import { PrismaService } from '../prisma/prisma.service';
import { SeederService } from './seeder.service';
import { InvoicingSeederService } from './invoicing-seeder.service';
import { ThesisSeederService } from './thesis-seeder.service';

async function runSeeder() {
  const prisma = new PrismaService();
  const invoicingSeeder = new InvoicingSeederService(prisma);
  const thesisSeeder = new ThesisSeederService(prisma);
  const seeder = new SeederService(prisma, invoicingSeeder, thesisSeeder);

  try {
    console.log('🌱 Iniciando seeder...');
    await prisma.$connect();

    await seeder.seedAdminUser();
    await seeder.seedProviders();
    await seeder.seedPackagers();
    await seeder.seedPriceEstimationModule();

    console.log('✅ Seeder completado exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando seeder:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSeeder();