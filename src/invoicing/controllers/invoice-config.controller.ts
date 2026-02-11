import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { InvoiceConfigService } from '../services/invoice-config.service';
import { CreateInvoiceConfigDto, UpdateInvoiceConfigDto } from '../dto/invoice-config.dto';

@Controller('invoicing/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceConfigController {
  constructor(private readonly configService: InvoiceConfigService) {}

  @Post()
  @Roles('ADMIN', 'GERENCIA')
  create(@Body() createDto: CreateInvoiceConfigDto) {
    return this.configService.create(createDto);
  }

  @Get()
  @Roles('ADMIN', 'GERENCIA')
  findAll() {
    return this.configService.findAll();
  }

  @Get('active')
  @Roles('ADMIN', 'GERENCIA')
  findActive() {
    return this.configService.findActive();
  }

  @Get(':id')
  @Roles('ADMIN', 'GERENCIA')
  findOne(@Param('id') id: string) {
    return this.configService.findOne(+id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'GERENCIA')
  update(@Param('id') id: string, @Body() updateDto: UpdateInvoiceConfigDto) {
    return this.configService.update(+id, updateDto);
  }

  @Patch(':id/activate')
  @Roles('ADMIN', 'GERENCIA')
  setActive(@Param('id') id: string) {
    return this.configService.setActive(+id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.configService.delete(+id);
  }

  @Post(':id/certificate')
  @Roles('ADMIN', 'GERENCIA')
  @UseInterceptors(
    FileInterceptor('certificate', {
      storage: diskStorage({
        destination: './certificates',
        filename: (req, file, cb) => {
          // Usar un nombre único con timestamp
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `cert-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/x-pkcs12' || extname(file.originalname) === '.p12') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Solo se permiten archivos .p12'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  async uploadCertificate(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    // Actualizar la configuración con la ruta del certificado
    return this.configService.updateCertificatePath(+id, file.path);
  }
}
