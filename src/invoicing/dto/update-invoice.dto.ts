import { IsOptional, IsEnum, IsString, IsDateString, IsBoolean, IsInt } from 'class-validator';
import { EstadoFactura } from '@prisma/client';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsEnum(EstadoFactura)
  estado?: EstadoFactura;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  formaPago?: string;

  @IsOptional()
  @IsInt()
  plazoCredito?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  motivoAnulacion?: string;
}
