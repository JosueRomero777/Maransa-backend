import { Controller, Get, Param } from '@nestjs/common';
import { ShrimpSizesService } from './shrimp-sizes.service';

@Controller('shrimp-sizes')
export class ShrimpSizesController {
  constructor(private readonly shrimpSizesService: ShrimpSizesService) {}

  @Get('shrimp-types')
  async getShrimpTypes() {
    return this.shrimpSizesService.getShrimpTypes();
  }

  @Get('presentation-types')
  async getPresentationTypes() {
    return this.shrimpSizesService.getPresentationTypes();
  }

  @Get('by-type-and-presentation/:shrimpTypeId/:presentationTypeId')
  async getShrimpSizesByTypeAndPresentation(
    @Param('shrimpTypeId') shrimpTypeId: string,
    @Param('presentationTypeId') presentationTypeId: string,
  ) {
    return this.shrimpSizesService.getShrimpSizesByTypeAndPresentation(
      Number(shrimpTypeId),
      Number(presentationTypeId),
    );
  }

  @Get('by-type/:shrimpTypeId')
  async getShrimpSizesByType(@Param('shrimpTypeId') shrimpTypeId: string) {
    return this.shrimpSizesService.getShrimpSizesByType(Number(shrimpTypeId));
  }

  @Get('by-presentation/:presentationTypeId')
  async getShrimpSizesByPresentation(
    @Param('presentationTypeId') presentationTypeId: string,
  ) {
    return this.shrimpSizesService.getShrimpSizesByPresentation(
      Number(presentationTypeId),
    );
  }

  @Get('grouped-by-presentation/:shrimpTypeId')
  async getShrimpSizesGroupedByPresentation(
    @Param('shrimpTypeId') shrimpTypeId: string,
  ) {
    return this.shrimpSizesService.getShrimpSizesGroupedByPresentation(
      Number(shrimpTypeId),
    );
  }

  @Get('conversion-factors/:shrimpTypeId')
  async getConversionFactors(@Param('shrimpTypeId') shrimpTypeId: string) {
    return this.shrimpSizesService.getConversionFactors(Number(shrimpTypeId));
  }

  @Get(':id')
  async getShrimpSize(@Param('id') id: string) {
    return this.shrimpSizesService.getShrimpSize(Number(id));
  }
}
