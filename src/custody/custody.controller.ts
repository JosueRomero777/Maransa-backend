import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CustodyService } from './custody.service';
import { CreateCustodyDto, UpdateCustodyDto, CustodyFilterDto, AssignPersonnelDto, AddIncidentDto } from './dto/custody.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('custody')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustodyController {
  constructor(private readonly custodyService: CustodyService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  @UseInterceptors(FilesInterceptor('files', 10))
  create(
    @Body() createCustodyDto: CreateCustodyDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req
  ) {
    return this.custodyService.create(createCustodyDto, req.user.id, files);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA, RolUsuario.LOGISTICA, RolUsuario.COMPRAS)
  findAll(@Query() filters: CustodyFilterDto) {
    return this.custodyService.findAll(filters);
  }

  @Get('pending-assignments')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  getOrdersForCustody() {
    return this.custodyService.getOrdersForCustody();
  }

  @Get('active-routes')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA, RolUsuario.LOGISTICA)
  getActiveRoutesWithCustody() {
    return this.custodyService.getActiveRoutesWithCustody();
  }

  @Get('statistics')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  getStatistics(@Query() filters: { dateFrom?: string; dateTo?: string }) {
    return this.custodyService.getStatistics(filters);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA, RolUsuario.LOGISTICA, RolUsuario.COMPRAS)
  findOne(@Param('id') id: string) {
    return this.custodyService.findOne(+id);
  }

  @Get('order/:orderId')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA, RolUsuario.LOGISTICA, RolUsuario.COMPRAS)
  findByOrderId(@Param('orderId') orderId: string) {
    return this.custodyService.findByOrderId(+orderId);
  }

  @Patch(':id/assign-personnel')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  assignPersonnel(
    @Param('id') id: string,
    @Body() assignPersonnelDto: AssignPersonnelDto
  ) {
    return this.custodyService.assignPersonnel(+id, assignPersonnelDto);
  }

  @Patch(':id/start-custody')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  startCustody(@Param('id') id: string) {
    return this.custodyService.startCustody(+id);
  }

  @Patch(':id/complete-custody')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  @UseInterceptors(FilesInterceptor('files', 10))
  completeCustody(
    @Param('id') id: string,
    @Body() updateData: { observacionesFinales?: string },
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.custodyService.completeCustody(+id, updateData, files);
  }

  @Post(':id/add-incident')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  @UseInterceptors(FilesInterceptor('files', 5))
  addIncident(
    @Param('id') id: string,
    @Body() addIncidentDto: AddIncidentDto,
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.custodyService.addIncident(+id, addIncidentDto, files);
  }

  @Post(':id/incidents')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA, RolUsuario.LOGISTICA)
  addIncidentSimple(
    @Param('id') id: string,
    @Body() incidentData: { descripcion: string; gravedad: 'leve' | 'moderada' | 'grave'; responsable?: string }
  ) {
    return this.custodyService.addIncidentSimple(+id, incidentData);
  }

  @Post(':id/start')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  startCustodyAlternative(@Param('id') id: string) {
    return this.custodyService.startCustody(+id);
  }

  @Post(':id/complete')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  completeCustodyAlternative(
    @Param('id') id: string,
    @Body() data: { observacionesFinales?: string }
  ) {
    return this.custodyService.completeCustody(+id, data, []);
  }

  @Post(':id/add-evidence')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  @UseInterceptors(FilesInterceptor('files', 10))
  addEvidence(
    @Param('id') id: string,
    @Body() data: { descripcion?: string },
    @UploadedFiles() files: Array<Express.Multer.File>
  ) {
    return this.custodyService.addEvidence(+id, data, files);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.CUSTODIA)
  @UseInterceptors(FilesInterceptor('files', 10))
  update(
    @Param('id') id: string,
    @Body() updateCustodyDto: UpdateCustodyDto,
    @UploadedFiles() files?: Array<Express.Multer.File>
  ) {
    return this.custodyService.update(+id, updateCustodyDto, files);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.custodyService.remove(+id);
  }
}