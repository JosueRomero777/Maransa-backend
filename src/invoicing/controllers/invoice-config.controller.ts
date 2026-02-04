import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
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
}
