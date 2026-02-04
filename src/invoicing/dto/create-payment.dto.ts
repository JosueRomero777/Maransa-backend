import { IsNotEmpty, IsInt, IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsInt()
  invoiceId: number;

  @IsNotEmpty()
  @IsInt()
  packagerId: number;

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

  @IsOptional()
  @IsString()
  observaciones?: string;
}
