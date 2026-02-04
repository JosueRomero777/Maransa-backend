import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderFilterDto } from './dto/order-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario, EstadoPedido } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(createOrderDto, req.user.id);
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  findAll(@Query() filters: OrderFilterDto) {
    return this.ordersService.findAll(filters);
  }

  @Get('statistics')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  getStatistics() {
    return this.ordersService.getStatistics();
  }

  @Get('available-dates')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  getAvailableDates() {
    return this.ordersService.getAvailableDates();
  }

  @Get('used-providers')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  getUsedProviders() {
    return this.ordersService.getUsedProviders();
  }

  @Get('used-statuses')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.GERENCIA)
  getUsedStatuses() {
    return this.ordersService.getUsedStatuses();
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA, RolUsuario.FACTURACION, RolUsuario.GERENCIA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/estimate-prices')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.GERENCIA)
  generatePriceEstimation(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.generatePriceEstimation(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
    @Request() req,
  ) {
    return this.ordersService.update(id, updateOrderDto, req.user.id);
  }

  @Patch(':id/status')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS, RolUsuario.LABORATORIO, RolUsuario.LOGISTICA, RolUsuario.CUSTODIA, RolUsuario.FACTURACION)
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: EstadoPedido,
    @Request() req,
  ) {
    return this.ordersService.changeStatus(id, estado, req.user.id);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.COMPRAS)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ordersService.remove(id, req.user.id);
  }
}