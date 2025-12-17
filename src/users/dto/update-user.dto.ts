import { IsEmail, IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(RolUsuario)
  @IsOptional()
  role?: RolUsuario;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}