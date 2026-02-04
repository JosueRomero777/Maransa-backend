import { IsNotEmpty, IsInt, IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateProviderPaymentDto {
  @IsNotEmpty()
  @IsInt()
  providerId: number;

  @IsOptional()
  @IsInt()
  orderId?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  monto: number;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsNotEmpty()
  @IsString()
  formaPago: string; // EFECTIVO, TRANSFERENCIA, CHEQUE

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsString()
  numeroCuenta?: string;

  @IsOptional()
  @IsString()
  numeroComprobante?: string;

  @IsNotEmpty()
  @IsString()
  concepto: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cantidadLibras?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioLibra?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
