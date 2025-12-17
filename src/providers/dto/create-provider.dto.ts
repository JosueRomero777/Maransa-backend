import { IsNotEmpty, IsOptional, IsString, IsInt, IsEmail, Min, IsEnum } from 'class-validator';

export enum TipoProveedor {
  PEQUENA_CAMARONERA = 'PEQUENA_CAMARONERA',
  MEDIANA_CAMARONERA = 'MEDIANA_CAMARONERA',
  GRAN_CAMARONERA = 'GRAN_CAMARONERA'
}

export class CreateProviderDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(TipoProveedor, { 
    message: 'El tipo debe ser: PEQUENA_CAMARONERA, MEDIANA_CAMARONERA o GRAN_CAMARONERA' 
  })
  type: TipoProveedor;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  capacity: number;

  @IsNotEmpty()
  @IsString()
  contact_whatsapp: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
