import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingSessionService } from './tracking-session.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [TrackingGateway, TrackingSessionService, PrismaService],
  exports: [TrackingSessionService],
})
export class TrackingModule {}
