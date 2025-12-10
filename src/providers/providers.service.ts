import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  create(createProviderDto: CreateProviderDto) {
    return this.prisma.provider.create({ data: createProviderDto as any });
  }

  findAll() {
    return this.prisma.provider.findMany({ where: { active: true } });
  }

  findOne(id: number) {
    return this.prisma.provider.findUnique({ where: { id } });
  }

  update(id: number, updateProviderDto: UpdateProviderDto) {
    return this.prisma.provider.update({ where: { id }, data: updateProviderDto as any });
  }

  // soft remove
  async remove(id: number) {
    return this.prisma.provider.update({ where: { id }, data: { active: false } });
  }
}
