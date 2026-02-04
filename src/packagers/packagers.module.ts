import { Module } from '@nestjs/common';
import { PackagersService } from './packagers.service';
import { PackagersController } from './packagers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PackagersController],
  providers: [PackagersService],
  exports: [PackagersService],
})
export class PackagersModule {}