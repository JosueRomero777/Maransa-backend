import { IsNotEmpty, IsInt, IsNumber, IsOptional, IsString, IsDateString, IsArray, ValidateNested, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoComprobante } from '@prisma/client';

export class CreateInvoiceDetailDto {
  @IsNotEmpty()
  @IsString()
  codigoPrincipal: string;

  @IsOptional()
  @IsString()
  codigoAuxiliar?: string;

  @IsNotEmpty()
  @IsString()
  descripcion: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  cantidad: number;

  @IsOptional()
  @IsString()
  unidadMedida?: string; // 1=kg, 2=litro, 3=unidad

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  precioUnitario: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsNotEmpty()
  @IsString()
  codigoImpuesto: string; // 2=IVA, 3=ICE, 5=IRBPNR, 6=ReBIUS

  @IsNotEmpty()
  @IsString()
  codigoPorcentaje: string; // 0=0%, 2=12%, 3=14%, 4=5%, 5=20%

  @IsNotEmpty()
  @IsNumber()
  tarifa: number; // 0, 5, 12, 14, 20, etc.
}

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsInt()
  packagerId: number;

  @IsOptional()
  @IsInt()
  orderId?: number;

  @IsOptional()
  @IsEnum(TipoComprobante)
  tipoComprobante?: TipoComprobante;

  @IsOptional()
  @IsDateString()
  fechaEmision?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  formaPago?: string; // Códigos SRI: 01, 02, 15, 16, 17, etc.

  @IsOptional()
  @IsInt()
  plazoCredito?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  // Información del Comprador (SRI)
  @IsOptional()
  @IsString()
  tipoIdentificacionComprador?: string; // 04=RUC, 05=Cédula, 06=Pasaporte

  @IsOptional()
  @IsString()
  identificacionComprador?: string;

  @IsOptional()
  @IsString()
  razonSocialComprador?: string;

  @IsOptional()
  @IsString()
  direccionComprador?: string;

  @IsOptional()
  @IsString()
  emailComprador?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceDetailDto)
  detalles: CreateInvoiceDetailDto[];
}
