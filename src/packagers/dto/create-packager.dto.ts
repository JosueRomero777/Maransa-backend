import { IsNotEmpty, IsOptional, IsString, IsEmail, ValidateIf } from 'class-validator';

export class CreatePackagerDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsOptional()
  @ValidateIf((o) => o.contact_email !== '' && o.contact_email !== undefined)
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsString()
  contact_whatsapp?: string;

  @IsOptional()
  @IsString()
  ruc?: string;
}
