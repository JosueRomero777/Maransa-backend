import { Module } from '@nestjs/common';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { InvoiceConfigController } from './controllers/invoice-config.controller';
import { InvoiceConfigService } from './services/invoice-config.service';
import { XmlGeneratorService } from './services/xml-generator.service';
import { SriSignatureService } from './services/sri-signature.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicingController, InvoiceConfigController],
  providers: [InvoicingService, InvoiceConfigService, XmlGeneratorService, SriSignatureService, PdfGeneratorService],
  exports: [InvoicingService, InvoiceConfigService, XmlGeneratorService, SriSignatureService, PdfGeneratorService],
})
export class InvoicingModule {}
