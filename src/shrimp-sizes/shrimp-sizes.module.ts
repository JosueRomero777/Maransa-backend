import { Module } from '@nestjs/common';
import { ShrimpSizesService } from './shrimp-sizes.service';
import { ShrimpSizesController } from './shrimp-sizes.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ShrimpSizesController],
  providers: [ShrimpSizesService, PrismaService],
  exports: [ShrimpSizesService],
})
export class ShrimpSizesModule {}
