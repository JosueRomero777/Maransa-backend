import { IsString, IsNumber, IsOptional, IsDateString, IsNotEmpty, IsEnum, IsArray, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoLaboratorio } from '@prisma/client';

export class CreateLaboratoryDto {
  @IsNotEmpty()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  orderId: number;

  @IsOptional()
  @IsEnum(EstadoLaboratorio)
  estado?: EstadoLaboratorio;

  @IsOptional()
  @IsString()
  resultadoGeneral?: string;

  @IsOptional()
  @IsObject()
  parametrosQuimicos?: any;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;

  @IsOptional()
  @IsString()
  olor?: string;

  @IsOptional()
  @IsString()
  sabor?: string;

  @IsOptional()
  @IsString()
  textura?: string;

  @IsOptional()
  @IsString()
  apariencia?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  archivosAdjuntos?: string[];
}

export class UpdateLaboratoryDto {
  @IsOptional()
  @IsEnum(EstadoLaboratorio)
  estado?: EstadoLaboratorio;

  @IsOptional()
  @IsString()
  resultadoGeneral?: string;

  @IsOptional()
  @IsObject()
  parametrosQuimicos?: any;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;

  @IsOptional()
  @IsString()
  olor?: string;

  @IsOptional()
  @IsString()
  sabor?: string;

  @IsOptional()
  @IsString()
  textura?: string;

  @IsOptional()
  @IsString()
  apariencia?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  archivosAdjuntos?: string[];
}

export class LaboratoryFilterDto {
  @IsOptional()
  @IsEnum(EstadoLaboratorio)
  estado?: EstadoLaboratorio;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  analistaId?: number;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ReevaluationDto {
  @IsOptional()
  @IsString()
  nuevasObservaciones?: string;

  @IsOptional()
  @IsObject()
  nuevosParametros?: any;
}

export class LaboratoryResponse {
  id: number;
  orderId: number;
  analistaId: number;
  estado: EstadoLaboratorio;
  fechaAnalisis: Date;
  fechaReevaluacion?: Date;
  resultadoGeneral?: string;
  parametrosQuimicos?: any;
  observaciones?: string;
  motivoRechazo?: string;
  archivosAdjuntos: string[];
  olor?: string;
  sabor?: string;
  textura?: string;
  apariencia?: string;
  createdAt: Date;
  updatedAt: Date;
  order?: {
    id: number;
    codigo: string;
    estado: string;
    provider?: {
      id: number;
      name: string;
      location: string;
    };
    packager?: {
      id: number;
      name: string;
      location: string;
    };
  };
  analista?: {
    id: number;
    name: string;
    email: string;
  };
}