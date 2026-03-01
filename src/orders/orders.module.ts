import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PriceEstimationsModule } from '../price-estimations/price-estimations.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, PriceEstimationsModule, AIModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule { }