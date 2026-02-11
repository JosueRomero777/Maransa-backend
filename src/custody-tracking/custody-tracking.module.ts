import { Module } from '@nestjs/common';
import { CustodyTrackingGateway } from './custody-tracking.gateway';
import { CustodyTrackingSessionService } from './custody-tracking-session.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CustodyTrackingGateway, CustodyTrackingSessionService, PrismaService],
  exports: [CustodyTrackingSessionService],
})
export class CustodyTrackingModule {}
