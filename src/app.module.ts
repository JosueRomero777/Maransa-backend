import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ProvidersModule } from './providers/providers.module';
import { AuthModule } from './auth/auth.module';
import { SeederModule } from './seeder/seeder.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { PackagersModule } from './packagers/packagers.module';
import { PriceEstimationsModule } from './price-estimations/price-estimations.module';
import { AIModule } from './ai/ai.module';
import { ReceptionModule } from './reception/reception.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { LogisticsModule } from './logistics/logistics.module';
import { CustodyModule } from './custody/custody.module';
import { HarvestModule } from './harvest/harvest.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { EventLogsModule } from './event-logs/event-logs.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { ShrimpSizesModule } from './shrimp-sizes/shrimp-sizes.module';
import { TrackingModule } from './tracking/tracking.module';
import { CustodyTrackingModule } from './custody-tracking/custody-tracking.module';

@Module({
  imports: [
    ProvidersModule, 
    AuthModule, 
    SeederModule,
    UsersModule, 
    OrdersModule, 
    PackagersModule,
    PriceEstimationsModule,
    AIModule,
    ReceptionModule,
    LaboratoryModule,
    LogisticsModule,
    CustodyModule,
    HarvestModule,
    EventLogsModule,
    InvoicingModule,
    ShrimpSizesModule,
    TrackingModule,
    CustodyTrackingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
