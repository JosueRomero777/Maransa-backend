import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { EventLogsService } from './event-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('event-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventLogsController {
  constructor(private readonly eventLogsService: EventLogsService) {}

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  findAll(
    @Query('orderId') orderId?: string,
    @Query('userId') userId?: string,
    @Query('accion') accion?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      orderId: orderId ? parseInt(orderId, 10) : undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      accion,
      fechaDesde,
      fechaHasta,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.eventLogsService.findAll(filters);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.eventLogsService.findOne(id);
  }

  @Get('order/:orderId')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  findByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.eventLogsService.findByOrder(orderId);
  }

  @Get('user/:userId')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.eventLogsService.findByUser(userId);
  }
}

