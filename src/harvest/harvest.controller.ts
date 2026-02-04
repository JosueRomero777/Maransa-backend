import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { HarvestService } from './harvest.service';
import { CreateHarvestDto, UpdateHarvestDto, HarvestFilterDto, DefineHarvestDto } from './dto/harvest.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('harvest')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HarvestController {
  constructor(private readonly harvestService: HarvestService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  @UseInterceptors(FilesInterceptor('files', 10))
  create(
    @Body() createHarvestDto: CreateHarvestDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req
  ) {
    return this.harvestService.create(createHarvestDto, req.user.id, files);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.COMPRAS)
  findAll(@Query() filters: HarvestFilterDto) {
    return this.harvestService.findAll(filters);
  }

  @Get('pending-definition')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  getPendingOrders() {
    return this.harvestService.getPendingOrders();
  }

  @Get('approved-for-logistics')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA)
  getApprovedForLogistics() {
    return this.harvestService.getApprovedForLogistics();
  }

  @Get('statistics')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  getStatistics(@Query() filters: { dateFrom?: string; dateTo?: string }) {
    return this.harvestService.getStatistics(filters);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.COMPRAS)
  findOne(@Param('id') id: string) {
    return this.harvestService.findOne(+id);
  }

  @Get('order/:orderId')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.COMPRAS)
  findByOrderId(@Param('orderId') orderId: string) {
    return this.harvestService.findByOrderId(+orderId);
  }

  @Post(':id/define-harvest')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  @UseInterceptors(FilesInterceptor('files', 5))
  defineHarvest(
    @Param('id') id: string,
    @Body() defineHarvestDto: DefineHarvestDto,
    @UploadedFiles() files?: Array<Express.Multer.File>
  ) {
    return this.harvestService.defineHarvest(+id, defineHarvestDto, files);
  }

  @Patch(':id/approve')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  approve(
    @Param('id') id: string,
    @Body() data: { observaciones?: string }
  ) {
    return this.harvestService.approve(+id, data.observaciones);
  }

  @Patch(':id/reject')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  reject(
    @Param('id') id: string,
    @Body() data: { motivo: string; observaciones?: string }
  ) {
    return this.harvestService.reject(+id, data.motivo, data.observaciones);
  }

  @Post(':id/add-evidence')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  @UseInterceptors(FilesInterceptor('files', 10))
  addEvidence(
    @Param('id') id: string,
    @Body() data: { descripcion?: string },
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.harvestService.addEvidence(+id, data, files);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  @UseInterceptors(FilesInterceptor('files', 10))
  update(
    @Param('id') id: string,
    @Body() updateHarvestDto: UpdateHarvestDto,
    @UploadedFiles() files?: Array<Express.Multer.File>
  ) {
    return this.harvestService.update(+id, updateHarvestDto, files);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.harvestService.remove(+id);
  }
}