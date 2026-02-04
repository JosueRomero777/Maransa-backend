import { Module } from '@nestjs/common';
import { PriceEstimationsService } from './price-estimations.service';
import { PriceEstimationsController } from './price-estimations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PriceEstimationsController],
  providers: [PriceEstimationsService],
  exports: [PriceEstimationsService],
})
export class PriceEstimationsModule {}