import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeederService } from '../seeder/seeder.service';

async function runSeeder() {
  const app = await NestFactory.create(AppModule);
  const seederService = app.get(SeederService);
  
  console.log('Ejecutando seeder...');
  await seederService.onApplicationBootstrap();
  console.log('Seeder completado');
  
  await app.close();
}

runSeeder().catch(error => {
  console.error('Error ejecutando seeder:', error);
  process.exit(1);
});