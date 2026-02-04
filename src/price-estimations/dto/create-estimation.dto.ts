import { IsOptional, IsNumber, IsString, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEstimationDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  formulaId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  orderId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  providerId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  packagerId?: number;

  @IsOptional()
  @IsString()
  talla?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cantidad?: number;

  @IsOptional()
  temporada?: string;

  @IsOptional()
  @IsDateString()
  fechaEstimacion?: string;
}