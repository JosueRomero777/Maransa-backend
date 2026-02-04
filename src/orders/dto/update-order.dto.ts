import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsOptional, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { EstadoPedido } from '@prisma/client';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;

  @IsOptional()
  @IsNumber()
  cantidadFinal?: number;

  @IsOptional()
  @IsDateString()
  fechaDefinitivaCosecha?: string;

  @IsOptional()
  @IsNumber()
  precioRealCompra?: number;

  @IsOptional()
  @IsNumber()
  precioRealVenta?: number;
}