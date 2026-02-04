import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { InvoicingSeederService } from './invoicing-seeder.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SeederService, InvoicingSeederService],
  exports: [SeederService],
})
export class SeederModule {}