import { Module } from '@nestjs/common';
import { ReceptionService } from './reception.service';
import { ReceptionController } from './reception.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicingModule } from '../invoicing/invoicing.module';

@Module({
  imports: [PrismaModule, InvoicingModule],
  controllers: [ReceptionController],
  providers: [ReceptionService],
  exports: [ReceptionService],
})
export class ReceptionModule {}