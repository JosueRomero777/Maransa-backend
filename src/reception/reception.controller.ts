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
  ParseIntPipe
} from '@nestjs/common';
import { ReceptionService } from './reception.service';
import { 
  CreateReceptionDto, 
  UpdateReceptionDto, 
  ReceptionFilterDto 
} from './dto/reception.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('receptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceptionController {
  constructor(private readonly receptionService: ReceptionService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  create(@Body() createReceptionDto: CreateReceptionDto, @Request() req) {
    return this.receptionService.create(createReceptionDto, req.user.id);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  findAll(@Query() filters: ReceptionFilterDto) {
    return this.receptionService.findAll(filters);
  }

  @Get('classifications')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  getClassifications() {
    return this.receptionService.getClassifications();
  }

  @Get('orders-without-reception')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  getOrdersWithoutReception() {
    return this.receptionService.getOrdersWithoutReception();
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.receptionService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.LOGISTICA)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateReceptionDto: UpdateReceptionDto) {
    return this.receptionService.update(id, updateReceptionDto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.receptionService.remove(id);
  }
}