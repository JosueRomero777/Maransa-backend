import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ListProvidersDto } from './dto/list-providers.dto';
import { Query } from '@nestjs/common';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  create(@Body() createProviderDto: CreateProviderDto) {
    return this.providersService.create(createProviderDto);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  findAll(@Query() query: ListProvidersDto) {
    return this.providersService.findAll(query);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.providersService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateProviderDto: UpdateProviderDto) {
    return this.providersService.update(id, updateProviderDto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.providersService.remove(id);
  }

  @Get('check-name/:name')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  async checkName(@Param('name') name: string, @Query('excludeId') excludeId?: string) {
    const isDuplicate = await this.providersService.checkDuplicateName(name, excludeId ? +excludeId : undefined);
    return { isDuplicate };
  }
}
