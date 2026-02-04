import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  Res,
  BadRequestException
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { LaboratoryService } from './laboratory.service';
import { 
  CreateLaboratoryDto, 
  UpdateLaboratoryDto, 
  LaboratoryFilterDto,
  ReevaluationDto 
} from './dto/laboratory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('laboratory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaboratoryController {
  constructor(private readonly laboratoryService: LaboratoryService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  create(
    @Body() createLaboratoryDto: CreateLaboratoryDto, 
    @Request() req
  ) {
    return this.laboratoryService.create(createLaboratoryDto, req.user.id, []);
  }

  @Post(':id/files')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req
  ) {
    const laboratoryId = parseInt(id, 10);
    return this.laboratoryService.addFiles(laboratoryId, files);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.GERENCIA)
  findAll(@Query() filters: LaboratoryFilterDto) {
    return this.laboratoryService.findAll(filters);
  }

  @Get('pending')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  getPendingAnalysis() {
    return this.laboratoryService.getPendingAnalysis();
  }

  @Get('statistics')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.GERENCIA)
  getStatistics(@Query() filters: { dateFrom?: string; dateTo?: string }) {
    return this.laboratoryService.getStatistics(filters);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.GERENCIA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.laboratoryService.findOne(id);
  }

  @Get('order/:orderId')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.GERENCIA)
  findByOrderId(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.laboratoryService.findByOrderId(orderId);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateLaboratoryDto: UpdateLaboratoryDto,
    @Request() req
  ) {
    return this.laboratoryService.update(id, updateLaboratoryDto, req.user.id);
  }

  @Post(':id/approve')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  approve(@Param('id', ParseIntPipe) id: number, @Body() data: { observaciones?: string }) {
    return this.laboratoryService.approve(id, data.observaciones);
  }

  @Post(':id/reject')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  reject(@Param('id', ParseIntPipe) id: number, @Body() data: { motivoRechazo: string; observaciones?: string }) {
    return this.laboratoryService.reject(id, data.motivoRechazo, data.observaciones);
  }

  @Post(':id/request-reevaluation')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  @UseInterceptors(FilesInterceptor('files', 10))
  requestReevaluation(
    @Param('id', ParseIntPipe) id: number, 
    @Body() reevaluationDto: ReevaluationDto,
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.laboratoryService.requestReevaluation(id, reevaluationDto, files);
  }

  @Get(':id/files/:filename')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO, RolUsuario.GERENCIA)
  downloadFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    try {
      // Get the laboratory to find its orderId
      return this.laboratoryService.downloadFile(id, filename, res);
    } catch (error) {
      throw new BadRequestException('Error descargando archivo');
    }
  }

  @Post(':id/discard')
  @Roles(RolUsuario.ADMIN, RolUsuario.LABORATORIO)
  discardOrder(@Param('id', ParseIntPipe) id: number, @Body() data: { justificacion: string }) {
    return this.laboratoryService.discardOrder(id, data.justificacion);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.laboratoryService.remove(id);
  }
}