import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShrimpSizesService {
  constructor(private prisma: PrismaService) {}

  // Obtener todos los tipos de camarón
  async getShrimpTypes() {
    return this.prisma.shrimpType.findMany({
      orderBy: { productionPercentage: 'desc' },
    });
  }

  // Obtener tipos de presentación
  async getPresentationTypes() {
    return this.prisma.presentationType.findMany({
      orderBy: { code: 'asc' },
    });
  }

  // Obtener tallas por tipo de camarón y presentación
  async getShrimpSizesByTypeAndPresentation(
    shrimpTypeId: number,
    presentationTypeId: number,
  ) {
    return this.prisma.shrimpSize.findMany({
      where: {
        shrimpTypeId,
        presentationTypeId,
      },
      include: {
        presentationType: true,
      },
      orderBy: { minPiecesPerLb: 'asc' },
    });
  }

  // Obtener todas las tallas de un tipo de camarón
  async getShrimpSizesByType(shrimpTypeId: number) {
    return this.prisma.shrimpSize.findMany({
      where: { shrimpTypeId },
      include: {
        presentationType: true,
      },
      orderBy: [{ presentationTypeId: 'asc' }, { minPiecesPerLb: 'asc' }],
    });
  }

  // Obtener todas las tallas de una presentación
  async getShrimpSizesByPresentation(presentationTypeId: number) {
    return this.prisma.shrimpSize.findMany({
      where: { presentationTypeId },
      include: {
        shrimpType: true,
      },
      orderBy: [{ shrimpTypeId: 'asc' }, { minPiecesPerLb: 'asc' }],
    });
  }

  // Obtener una talla específica
  async getShrimpSize(id: number) {
    return this.prisma.shrimpSize.findUnique({
      where: { id },
      include: {
        shrimpType: true,
        presentationType: true,
      },
    });
  }

  // Obtener tallas agrupadas por presentación
  async getShrimpSizesGroupedByPresentation(shrimpTypeId: number) {
    const sizes = await this.prisma.shrimpSize.findMany({
      where: { shrimpTypeId },
      include: {
        presentationType: true,
      },
      orderBy: [{ presentationTypeId: 'asc' }, { minPiecesPerLb: 'asc' }],
    });

    // Agrupar por tipo de presentación
    const grouped = sizes.reduce(
      (acc, size) => {
        const presentationCode = size.presentationType.code;
        if (!acc[presentationCode]) {
          acc[presentationCode] = {
            presentation: size.presentationType,
            sizes: [],
          };
        }
        acc[presentationCode].sizes.push(size);
        return acc;
      },
      {} as Record<
        string,
        {
          presentation: any;
          sizes: any[];
        }
      >,
    );

    return Object.values(grouped);
  }

  // Obtener información de conversión entre presentaciones
  async getConversionFactors(shrimpTypeId: number) {
    const presentations = await this.prisma.presentationType.findMany();
    
    // Base: Camarón Vivo (L) = 100%
    const livePresentation = presentations.find((p) => p.code === 'L');
    
    return presentations.map((p) => ({
      code: p.code,
      name: p.name,
      rendimiento: p.rendimiento,
      factor: p.rendimiento / (livePresentation?.rendimiento || 100),
    }));
  }
}
