import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackagerDto } from './dto/create-packager.dto';
import { UpdatePackagerDto } from './dto/update-packager.dto';
import { ListPackagersDto } from './dto/list-packagers.dto';

@Injectable()
export class PackagersService {
  constructor(private prisma: PrismaService) {}

  async checkDuplicateName(name: string, excludeId?: number): Promise<boolean> {
    const existingPackager = await this.prisma.packager.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        },
        ...(excludeId && { NOT: { id: excludeId } })
      }
    });
    return !!existingPackager;
  }

  async checkDuplicateRuc(ruc: string, excludeId?: number): Promise<boolean> {
    if (!ruc) return false;
    
    const existingPackager = await this.prisma.packager.findFirst({
      where: {
        ruc: {
          equals: ruc.trim(),
          mode: 'insensitive'
        },
        ...(excludeId && { NOT: { id: excludeId } })
      }
    });
    return !!existingPackager;
  }

  async create(createPackagerDto: CreatePackagerDto) {
    // Check for duplicate name
    const isDuplicateName = await this.checkDuplicateName(createPackagerDto.name);
    if (isDuplicateName) {
      throw new BadRequestException(`Ya existe una empacadora con el nombre "${createPackagerDto.name}"`);
    }

    // Check for duplicate RUC if provided
    if (createPackagerDto.ruc) {
      const isDuplicateRuc = await this.checkDuplicateRuc(createPackagerDto.ruc);
      if (isDuplicateRuc) {
        throw new BadRequestException(`Ya existe una empacadora con el RUC "${createPackagerDto.ruc}"`);
      }
    }

    // Convert empty strings to null to avoid unique constraint violations
    const data: any = { ...createPackagerDto };
    if (data.ruc === '') data.ruc = null;
    if (data.contact_email === '') data.contact_email = null;
    if (data.contact_phone === '') data.contact_phone = null;
    if (data.contact_whatsapp === '') data.contact_whatsapp = null;

    return this.prisma.packager.create({ data });
  }

  findAll(query?: ListPackagersDto) {
    const where: any = {};

    if (!query) {
      where.active = true;
      return this.prisma.packager.findMany({ where, orderBy: { name: 'asc' } });
    }

    if (typeof query.active === 'boolean') where.active = query.active;
    else where.active = true;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
        { ruc: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.location) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }

    return this.prisma.packager.findMany({ where, orderBy: { name: 'asc' } });
  }

  findOne(id: number) {
    return this.prisma.packager.findUnique({ where: { id } });
  }

  async update(id: number, updatePackagerDto: UpdatePackagerDto) {
    // Check for duplicate name if name is being updated
    if (updatePackagerDto.name) {
      const isDuplicateName = await this.checkDuplicateName(updatePackagerDto.name, id);
      if (isDuplicateName) {
        throw new BadRequestException(`Ya existe una empacadora con el nombre "${updatePackagerDto.name}"`);
      }
    }

    // Check for duplicate RUC if RUC is being updated
    if (updatePackagerDto.ruc) {
      const isDuplicateRuc = await this.checkDuplicateRuc(updatePackagerDto.ruc, id);
      if (isDuplicateRuc) {
        throw new BadRequestException(`Ya existe una empacadora con el RUC "${updatePackagerDto.ruc}"`);
      }
    }

    // Convert empty strings to null to avoid unique constraint violations
    const data: any = { ...updatePackagerDto };
    if (data.ruc === '') data.ruc = null;
    if (data.contact_email === '') data.contact_email = null;
    if (data.contact_phone === '') data.contact_phone = null;
    if (data.contact_whatsapp === '') data.contact_whatsapp = null;

    return this.prisma.packager.update({ where: { id }, data });
  }

  // soft delete
  async remove(id: number) {
    return this.prisma.packager.update({ where: { id }, data: { active: false } });
  }
}