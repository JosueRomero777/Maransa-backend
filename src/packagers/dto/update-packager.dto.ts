import { IsOptional, IsNotEmpty, IsString, IsEmail, ValidateIf } from 'class-validator';

export class UpdatePackagerDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  location?: string;

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
