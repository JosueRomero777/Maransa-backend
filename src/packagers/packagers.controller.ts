import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PackagersService } from './packagers.service';
import { CreatePackagerDto } from './dto/create-packager.dto';
import { UpdatePackagerDto } from './dto/update-packager.dto';
import { ListPackagersDto } from './dto/list-packagers.dto';

@Controller('packagers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagersController {
  constructor(private readonly packagersService: PackagersService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  create(@Body() createPackagerDto: CreatePackagerDto) {
    return this.packagersService.create(createPackagerDto);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  findAll(@Query() query: ListPackagersDto) {
    return this.packagersService.findAll(query);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.packagersService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePackagerDto: UpdatePackagerDto) {
    return this.packagersService.update(id, updatePackagerDto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.packagersService.remove(id);
  }

  @Get('check-name/:name')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  async checkName(@Param('name') name: string, @Query('excludeId') excludeId?: string) {
    const isDuplicate = await this.packagersService.checkDuplicateName(name, excludeId ? +excludeId : undefined);
    return { isDuplicate };
  }

  @Get('check-ruc/:ruc')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  async checkRuc(@Param('ruc') ruc: string, @Query('excludeId') excludeId?: string) {
    const isDuplicate = await this.packagersService.checkDuplicateRuc(ruc, excludeId ? +excludeId : undefined);
    return { isDuplicate };
  }
}