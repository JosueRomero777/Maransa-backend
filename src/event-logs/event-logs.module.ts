import { Module } from '@nestjs/common';
import { EventLogsController } from './event-logs.controller';
import { EventLogsService } from './event-logs.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [EventLogsController],
  providers: [EventLogsService, PrismaService]
})
export class EventLogsModule {}
