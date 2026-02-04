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
  Res
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { LogisticsService } from './logistics.service';
import { 
  CreateLogisticsDto, 
  UpdateLogisticsDto, 
  LogisticsFilterDto,
  AssignVehicleDto,
  UpdateRouteDto
} from './dto/logistics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  @UseInterceptors(FilesInterceptor('files', 10))
  create(
    @Body() createLogisticsDto: CreateLogisticsDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req
  ) {
    return this.logisticsService.create(createLogisticsDto, req.user.id, files);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA, RolUsuario.COMPRAS)
  findAll(@Query() filters: LogisticsFilterDto) {
    return this.logisticsService.findAll(filters);
  }

  @Get('approved-orders')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  getApprovedOrdersForLogistics() {
    return this.logisticsService.getApprovedOrdersForLogistics();
  }

  @Get('active-routes')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA)
  getActiveRoutes() {
    return this.logisticsService.getActiveRoutes();
  }

  @Get('statistics')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  getStatistics(@Query() filters: { dateFrom?: string; dateTo?: string }) {
    return this.logisticsService.getStatistics(filters);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA, RolUsuario.COMPRAS)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.logisticsService.findOne(id);
  }

  @Get(':id/files/:filename')
  @Public()
  downloadFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('filename') filename: string,
    @Res() res
  ) {
    return this.logisticsService.downloadFile(id, filename, res);
  }

  @Get('order/:orderId')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA, RolUsuario.COMPRAS)
  findByOrderId(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.logisticsService.findByOrderId(orderId);
  }

  @Patch(':id/assign-vehicle')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  assignVehicle(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignVehicleDto: AssignVehicleDto
  ) {
    return this.logisticsService.assignVehicle(id, assignVehicleDto);
  }

  @Patch(':id/start-route')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  startRoute(@Param('id', ParseIntPipe) id: number) {
    return this.logisticsService.startRoute(id);
  }

  @Patch(':id/complete-route')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  @UseInterceptors(FilesInterceptor('files', 10))
  completeRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRouteDto: UpdateRouteDto,
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.logisticsService.completeRoute(id, updateRouteDto, files);
  }

  @Post(':id/add-evidence')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  @UseInterceptors(FilesInterceptor('files', 10))
  addEvidence(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    const data = {
      tipo: req.body.tipo || 'carga',
      descripcion: req.body.descripcion
    };
    return this.logisticsService.addEvidence(id, data, files);
  }

  @Post(':id/upload-files')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadFiles(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.logisticsService.addEvidence(id, { tipo: 'GENERAL', descripcion: 'Archivos de logística' }, files);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  @UseInterceptors(FilesInterceptor('files', 10))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLogisticsDto: UpdateLogisticsDto,
    @UploadedFiles() files?: Array<Express.Multer.File>
  ) {
    return this.logisticsService.update(id, updateLogisticsDto, files);
  }

  @Patch(':id/start-tracking')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  startTracking(@Param('id', ParseIntPipe) id: number) {
    return this.logisticsService.startTracking(id);
  }

  @Patch(':id/stop-tracking')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  stopTracking(@Param('id', ParseIntPipe) id: number) {
    return this.logisticsService.stopTracking(id);
  }

  @Patch(':id/update-location')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() location: { lat: number; lng: number }
  ) {
    return this.logisticsService.updateLocation(id, location.lat, location.lng);
  }

  @Get(':id/tracking')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA, RolUsuario.GERENCIA)
  getTrackingData(@Param('id', ParseIntPipe) id: number) {
    return this.logisticsService.getTrackingData(id);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.logisticsService.remove(id);
  }
}