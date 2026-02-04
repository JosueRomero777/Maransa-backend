import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { AIStatisticsController } from './ai-statistics.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 segundos de timeout para el servicio de IA
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [AIController, AIStatisticsController],
  providers: [AIService, PrismaService],
  exports: [AIService], // Exportar para usar en otros módulos
})
export class AIModule {}