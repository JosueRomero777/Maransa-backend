import {
  Controller,
  Get,
  UseGuards,
  Query,
  Logger,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai/statistics')
@UseGuards(JwtAuthGuard)
export class AIStatisticsController {
  private readonly logger = new Logger(AIStatisticsController.name);

  constructor(private readonly aiService: AIService) {}

  @Get('predictions-vs-receptions')
  async getPredictionsVsReceptions(
    @Query('calibre') calibre?: string,
    @Query('presentacion') presentacion?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.aiService.comparePredictionsWithReceptions(
      calibre,
      presentacion,
      startDate,
      endDate,
    );
  }

  @Get('accuracy-metrics')
  async getAccuracyMetrics(
    @Query('presentacion') presentacion?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.aiService.calculateAccuracyMetrics(
      presentacion,
      startDate,
      endDate,
    );
  }

  @Get('price-comparison-summary')
  async getPriceComparisonSummary(
    @Query('presentacion') presentacion?: string,
  ) {
    return this.aiService.getPriceComparisonSummary(presentacion);
  }
}
