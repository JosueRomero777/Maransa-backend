import { IsString, IsNumber, IsOptional, IsDateString, IsNotEmpty, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReceptionDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  orderId: number;

  @IsNotEmpty()
  @IsDateString()
  fechaLlegada: string;

  @IsNotEmpty()
  @IsString()
  horaLlegada: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01, { message: 'El peso debe ser mayor a 0' })
  pesoRecibido: number;

  @IsOptional()
  @IsBoolean()
  calidadValidada?: boolean;

  @IsOptional()
  @IsBoolean()
  loteAceptado?: boolean;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;

  @IsOptional()
  @IsString()
  clasificacionFinal?: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01, { message: 'El precio debe ser mayor a 0' })
  precioFinalVenta: number;

  @IsOptional()
  @IsString()
  condicionesVenta?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateReceptionDto {
  @IsOptional()
  @IsDateString()
  fechaLlegada?: string;

  @IsOptional()
  @IsString()
  horaLlegada?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  pesoRecibido?: number;

  @IsOptional()
  @IsBoolean()
  calidadValidada?: boolean;

  @IsOptional()
  @IsBoolean()
  loteAceptado?: boolean;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;

  @IsOptional()
  @IsString()
  clasificacionFinal?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  precioFinalVenta?: number;

  @IsOptional()
  @IsString()
  condicionesVenta?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ReceptionFilterDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  orderId?: number;

  @IsOptional()
  @IsString()
  clasificacionFinal?: string;

  @IsOptional()
  @IsBoolean()
  calidadValidada?: boolean;

  @IsOptional()
  @IsBoolean()
  loteAceptado?: boolean;

  @IsOptional()
  @IsDateString()
  fechaLlegadaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaLlegadaHasta?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ReceptionMarginDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  receptionId: number;
}

export class ReceptionResponse {
  id: number;
  orderId: number;
  fechaLlegada: Date;
  horaLlegada: string;
  pesoRecibido?: number;
  calidadValidada: boolean;
  loteAceptado: boolean;
  motivoRechazo?: string;
  clasificacionFinal?: string;
  precioFinalVenta?: number;
  condicionesVenta?: string;
  observaciones?: string;
  createdAt: Date;
  updatedAt: Date;
  order?: {
    id: number;
    codigo: string;
    provider: {
      name: string;
      location: string;
    };
    cantidadEstimada: number;
    precioEstimadoCompra: number;
    fechaCreacion: Date;
  };
}