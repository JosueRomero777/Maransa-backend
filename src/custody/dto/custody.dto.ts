import { IsNumber, IsOptional, IsString, IsEnum, IsArray, IsDate, ValidateNested, Matches, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EstadoCustodia } from '@prisma/client';

export class CreateCustodyDto {
  @IsNumber()
  @Type(() => Number)
  orderId: number;

  @IsNumber()
  @Type(() => Number)
  logisticsId: number;

  @IsOptional()
  @IsEnum(EstadoCustodia)
  estado?: EstadoCustodia;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{10}$/, {
    each: true,
    message: 'Cada miembro del personal debe tener una cédula de 10 dígitos'
  })
  personalAsignado?: string[];

  @IsOptional()
  @IsString()
  vehiculoCustodia?: string;

  @IsOptional()
  @IsString()
  rutaCustodia?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateCustodyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{10}$/, {
    each: true,
    message: 'Cada miembro del personal debe tener una cédula de 10 dígitos'
  })
  personalAsignado?: string[];

  @IsOptional()
  @IsString()
  vehiculoCustodia?: string;

  @IsOptional()
  @IsString()
  rutaCustodia?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  observacionesFinales?: string;
}

export class CustodyFilterDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsEnum(EstadoCustodia)
  estado?: EstadoCustodia;

  @IsOptional()
  @Type(() => Number)
  assignedUserId?: number;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AssignPersonnelDto {
  @IsArray()
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  @Matches(/^\d{10}$/, {
    each: true,
    message: 'Cada miembro del personal debe tener una cédula de 10 dígitos'
  })
  personalAsignado: string[];

  @IsString()
  vehiculoCustodia: string;

  @IsString()
  rutaCustodia: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class AddIncidentDto {
  @IsString()
  tipo: string;

  @IsString()
  descripcion: string;

  @IsString()
  ubicacion: string;

  @IsEnum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'])
  gravedad: string;

  @IsOptional()
  @IsString()
  accionesTomadas?: string;
}

export class IncidentDto {
  id: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  gravedad: string;
  accionesTomadas?: string;
  evidencias: string[];
  fechaIncidente: Date;
}