import { IsNotEmpty, IsOptional, IsString, IsInt, IsEmail, Min, IsEnum } from 'class-validator';
import { TipoProveedor } from './create-provider.dto';

export class UpdateProviderDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TipoProveedor, { 
    message: 'El tipo debe ser: PEQUENA_CAMARONERA, MEDIANA_CAMARONERA o GRAN_CAMARONERA' 
  })
  type?: TipoProveedor;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  contact_whatsapp?: string;

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
