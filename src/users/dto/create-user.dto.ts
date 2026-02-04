import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsEnum(RolUsuario)
  role: RolUsuario;
}
