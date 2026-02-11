import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { InvoicingSeederService } from './invoicing-seeder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ThesisSeederService } from './thesis-seeder.service';

@Module({
  imports: [PrismaModule],
  providers: [SeederService, InvoicingSeederService, ThesisSeederService],
  exports: [SeederService, ThesisSeederService],
})
export class SeederModule { }