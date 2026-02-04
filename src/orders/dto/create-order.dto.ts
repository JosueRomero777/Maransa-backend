import { IsNotEmpty, IsString, IsInt, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsInt()
  providerId: number;

  @IsOptional()
  @IsInt()
  packagerId?: number;

  @IsOptional()
  @IsInt()
  presentationTypeId?: number;

  @IsOptional()
  @IsInt()
  shrimpSizeId?: number;

  @IsNotEmpty()
  @IsNumber()
  cantidadEstimada: number;

  @IsOptional()
  @IsDateString()
  fechaTentativaCosecha?: string;

  @IsOptional()
  @IsNumber()
  precioEstimadoCompra?: number;

  @IsOptional()
  @IsNumber()
  precioEstimadoVenta?: number;

  @IsOptional()
  @IsString()
  condicionesIniciales?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}