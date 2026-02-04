import { IsString, IsBoolean, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class CreateInvoiceConfigDto {
  @IsString()
  @MaxLength(13)
  ruc: string;

  @IsString()
  razonSocial: string;

  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @IsString()
  direccionMatriz: string;

  @IsOptional()
  @IsString()
  direccionEstablecimiento?: string;

  @IsOptional()
  @IsString()
  contribuyenteEspecial?: string;

  @IsBoolean()
  obligadoContabilidad: boolean;

  @IsString()
  @MaxLength(3)
  codigoEstablecimiento: string;

  @IsString()
  @MaxLength(3)
  codigoPuntoEmision: string;

  @IsString()
  ambienteSRI: string; // PRUEBAS o PRODUCCION

  @IsString()
  tipoEmision: string; // NORMAL o CONTINGENCIA

  @IsOptional()
  @IsString()
  rutaCertificado?: string;

  @IsOptional()
  @IsString()
  claveCertificado?: string;

  @IsOptional()
  @IsString()
  urlFirmaService?: string;
}

export class UpdateInvoiceConfigDto {
  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  direccionMatriz?: string;

  @IsOptional()
  @IsString()
  direccionEstablecimiento?: string;

  @IsOptional()
  @IsString()
  contribuyenteEspecial?: string;

  @IsOptional()
  @IsBoolean()
  obligadoContabilidad?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  codigoEstablecimiento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  codigoPuntoEmision?: string;

  @IsOptional()
  @IsString()
  ambienteSRI?: string;

  @IsOptional()
  @IsString()
  tipoEmision?: string;

  @IsOptional()
  @IsString()
  rutaCertificado?: string;

  @IsOptional()
  @IsString()
  claveCertificado?: string;

  @IsOptional()
  @IsString()
  urlFirmaService?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
