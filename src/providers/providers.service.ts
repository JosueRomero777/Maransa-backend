import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto, TipoProveedor } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ListProvidersDto } from './dto/list-providers.dto';

@Injectable()
export class ProvidersService {
  constructor(private prisma: PrismaService) {}

  private getFriendlyTypeName(tipo: TipoProveedor): string {
    switch (tipo) {
      case TipoProveedor.PEQUENA_CAMARONERA:
        return 'Pequeña Camaronera';
      case TipoProveedor.MEDIANA_CAMARONERA:
        return 'Mediana Camaronera';
      case TipoProveedor.GRAN_CAMARONERA:
        return 'Gran Camaronera';
      default:
        return tipo;
    }
  }

  async checkDuplicateName(name: string, excludeId?: number): Promise<boolean> {
    const existingProvider = await this.prisma.provider.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        },
        ...(excludeId && { NOT: { id: excludeId } })
      }
    });
    return !!existingProvider;
  }

  async create(createProviderDto: CreateProviderDto) {
    // Check for duplicate name
    const isDuplicate = await this.checkDuplicateName(createProviderDto.name);
    if (isDuplicate) {
      throw new BadRequestException(`Ya existe un proveedor con el nombre "${createProviderDto.name}"`);
    }

    return this.prisma.provider.create({ data: createProviderDto as any });
  }

  findAll(query?: ListProvidersDto) {
    const where: any = {};

    if (!query) {
      // default: return active providers
      where.active = true;
      return this.prisma.provider.findMany({ where });
    }

    if (typeof query.active === 'boolean') where.active = query.active;
    else where.active = true;

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      const matchingTypes = Object.values(TipoProveedor).filter(tipo => 
        tipo.toLowerCase().includes(searchLower) || 
        this.getFriendlyTypeName(tipo).toLowerCase().includes(searchLower)
      );

      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
        ...(matchingTypes.length > 0 ? [{ type: { in: matchingTypes } }] : []),
      ];
    }

    if (query.type && typeof query.type === 'string') {
      // If type is provided as enum value, use exact match
      if (Object.values(TipoProveedor).includes(query.type as TipoProveedor)) {
        where.type = query.type as TipoProveedor;
      } else {
        // If it's a search term, find matching enum values
        const matchingType = Object.values(TipoProveedor).find(tipo => 
          tipo.toLowerCase().includes(query.type!.toLowerCase()) || 
          this.getFriendlyTypeName(tipo).toLowerCase().includes(query.type!.toLowerCase())
        );
        if (matchingType) {
          where.type = matchingType;
        }
      }
    }

    if (query.location) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }

    if (typeof query.minCapacity === 'number' || typeof query.maxCapacity === 'number') {
      where.capacity = {};
      if (typeof query.minCapacity === 'number') where.capacity.gte = query.minCapacity;
      if (typeof query.maxCapacity === 'number') where.capacity.lte = query.maxCapacity;
    }

    return this.prisma.provider.findMany({ where });
  }

  findOne(id: number) {
    return this.prisma.provider.findUnique({ where: { id } });
  }

  async update(id: number, updateProviderDto: UpdateProviderDto) {
    // Check for duplicate name if name is being updated
    if (updateProviderDto.name) {
      const isDuplicate = await this.checkDuplicateName(updateProviderDto.name, id);
      if (isDuplicate) {
        throw new BadRequestException(`Ya existe un proveedor con el nombre "${updateProviderDto.name}"`);
      }
    }

    return this.prisma.provider.update({ where: { id }, data: updateProviderDto as any });
  }

  // soft remove
  async remove(id: number) {
    return this.prisma.provider.update({ where: { id }, data: { active: false } });
  }
}
