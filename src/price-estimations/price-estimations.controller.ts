import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PriceEstimationsService } from './price-estimations.service';
import { CreateEstimationDto } from './dto/create-estimation.dto';
import { CreateFormulaDto } from './dto/create-formula.dto';
import { CreateMarketFactorDto } from './dto/create-market-factor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';

@Controller('price-estimations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PriceEstimationsController {
  constructor(private readonly priceEstimationsService: PriceEstimationsService) {}

  // ===== ENDPOINTS PARA FÓRMULAS =====

  @Post('formulas')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  async createFormula(@Body() createFormulaDto: CreateFormulaDto) {
    return this.priceEstimationsService.createFormula(createFormulaDto);
  }

  @Get('formulas')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.COMPRAS)
  async findAllFormulas() {
    return this.priceEstimationsService.findAllFormulas();
  }

  @Get('formulas/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.COMPRAS)
  async findOneFormula(@Param('id', ParseIntPipe) id: number) {
    return this.priceEstimationsService.findOneFormula(id);
  }

  // ===== ENDPOINTS PARA FACTORES DE MERCADO =====

  @Post('market-factors')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  async createMarketFactor(@Body() createMarketFactorDto: CreateMarketFactorDto) {
    return this.priceEstimationsService.createMarketFactor(createMarketFactorDto);
  }

  @Get('market-factors')
  async findAllMarketFactors() {
    return this.priceEstimationsService.findAllMarketFactors();
  }

  @Patch('market-factors/:id')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.COMPRAS)
  async updateMarketFactor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { valor: number; fuente?: string }
  ) {
    return this.priceEstimationsService.updateMarketFactor(id, body.valor, body.fuente);
  }

  // ===== ENDPOINTS PRINCIPALES PARA ESTIMACIONES =====

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.COMPRAS)
  async createEstimation(@Body() createEstimationDto: CreateEstimationDto) {
    return this.priceEstimationsService.createEstimation(createEstimationDto);
  }

  @Get()
  async findAllEstimations(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ) {
    return this.priceEstimationsService.findAllEstimations(page || 1, limit || 10);
  }

  @Get('accuracy')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA)
  async getEstimationAccuracy() {
    return this.priceEstimationsService.getEstimationAccuracy();
  }

  @Get(':id')
  async findEstimationById(@Param('id', ParseIntPipe) id: number) {
    return this.priceEstimationsService.findEstimationById(id);
  }

  @Patch(':id/real-prices')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.COMPRAS)
  async updateRealPrices(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { precioRealCompra?: number; precioRealVenta?: number }
  ) {
    return this.priceEstimationsService.updateEstimationWithRealPrices(
      id,
      body.precioRealCompra,
      body.precioRealVenta
    );
  }

  // ===== ENDPOINT ESPECIAL PARA ESTIMACIÓN RÁPIDA =====

  @Post('quick-estimate')
  @Roles(RolUsuario.ADMIN, RolUsuario.GERENCIA, RolUsuario.COMPRAS)
  async quickEstimate(@Body() params: {
    providerId?: number;
    talla?: string;
    cantidad?: number;
    temporada?: string;
  }) {
    return this.priceEstimationsService.createEstimation({
      providerId: params.providerId,
      talla: params.talla as any,
      cantidad: params.cantidad,
      temporada: params.temporada,
    });
  }
}