import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  name: string;

  @IsEnum(RolUsuario, { 
    message: 'El rol debe ser uno de: COMPRAS, LABORATORIO, LOGISTICA, CUSTODIA, EMPACADORA, GERENCIA' 
  })
  role: RolUsuario;
}