import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🦐 Iniciando seed de tallas de camarones...');

  // 1. Crear tipo de camarón (solo Camarón Blanco)
  console.log('📝 Creando tipo de camarón...');
  const shrimpType = await prisma.shrimpType.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Camarón Blanco',
      scientificName: 'Penaeus vannamei',
      productionPercentage: 95.0,
    },
  });
  console.log(`✅ Tipo de camarón creado: ${shrimpType.name}`);

  // 2. Crear tipos de presentación
  console.log('\n📝 Creando tipos de presentación...');
  
  const presentationHL = await prisma.presentationType.upsert({
    where: { code: 'HL' },
    update: {},
    create: {
      code: 'HL',
      name: 'Sin Cola (Headless)',
      rendimiento: 75,
      lifeSpanDays: 7,
      description: 'Camarón sin cabeza ni cola, procesado',
    },
  });

  const presentationHO = await prisma.presentationType.upsert({
    where: { code: 'HO' },
    update: {},
    create: {
      code: 'HO',
      name: 'Entero (Head On)',
      rendimiento: 100,
      lifeSpanDays: 5,
      description: 'Camarón entero con cabeza',
    },
  });

  const presentationL = await prisma.presentationType.upsert({
    where: { code: 'L' },
    update: {},
    create: {
      code: 'L',
      name: 'Vivo (Live)',
      rendimiento: 100,
      lifeSpanDays: 3,
      description: 'Camarón vivo',
    },
  });

  console.log(`✅ Sin Cola (HL): ${presentationHL.name}`);
  console.log(`✅ Entero (HO): ${presentationHO.name}`);
  console.log(`✅ Vivo (L): ${presentationL.name}`);

  // 3. Tallas para Sin Cola (HEADLESS - HL)
  console.log('\n📝 Creando tallas para Sin Cola (HL)...');
  const headlessSizes = [
    { code: '16/20', min: 16, max: 20, classification: 'Jumbo', minGrams: 22.7, maxGrams: 28.4 },
    { code: '21/25', min: 21, max: 25, classification: 'Extra Large', minGrams: 18.1, maxGrams: 21.6 },
    { code: '26/30', min: 26, max: 30, classification: 'Large', minGrams: 15.1, maxGrams: 17.4 },
    { code: '31/35', min: 31, max: 35, classification: 'Medium Large', minGrams: 13.0, maxGrams: 14.6 },
    { code: '36/40', min: 36, max: 40, classification: 'Medium', minGrams: 11.3, maxGrams: 12.6 },
    { code: '41/50', min: 41, max: 50, classification: 'Small', minGrams: 9.1, maxGrams: 11.1 },
    { code: '51/60', min: 51, max: 60, classification: 'Extra Small', minGrams: 7.6, maxGrams: 8.9 },
    { code: '61/70', min: 61, max: 70, classification: 'Tiny', minGrams: 6.5, maxGrams: 7.4 },
    { code: '71/90', min: 71, max: 90, classification: 'Peewee', minGrams: 5.0, maxGrams: 6.4 },
    { code: '91/110', min: 91, max: 110, classification: 'Extra Tiny', minGrams: 4.1, maxGrams: 5.0 },
  ];

  for (const size of headlessSizes) {
    await prisma.shrimpSize.upsert({
      where: {
        code_presentationTypeId: {
          code: size.code,
          presentationTypeId: presentationHL.id,
        },
      },
      update: {},
      create: {
        shrimpTypeId: shrimpType.id,
        presentationTypeId: presentationHL.id,
        code: size.code,
        classification: size.classification,
        minPiecesPerLb: size.min,
        maxPiecesPerLb: size.max,
        minWeightGrams: size.minGrams,
        maxWeightGrams: size.maxGrams,
        minWeightOz: size.minGrams / 28.35,
        maxWeightOz: size.maxGrams / 28.35,
        displayLabel: `${size.code} - ${size.classification} (Sin Cola)`,
      },
    });
    console.log(`  ✓ ${size.code} - ${size.classification}`);
  }

  // 4. Tallas para Entero (WHOLE - HO)
  console.log('\n📝 Creando tallas para Entero (HO)...');
  const wholeSizes = [
    { code: '20', min: 18, max: 22, classification: 'U20', minGrams: 45.4, maxGrams: 56.7 },
    { code: '30', min: 26, max: 34, classification: 'U30', minGrams: 34.0, maxGrams: 45.4 },
    { code: '40', min: 36, max: 44, classification: 'U40', minGrams: 25.5, maxGrams: 34.0 },
    { code: '50', min: 46, max: 54, classification: 'U50', minGrams: 20.4, maxGrams: 25.5 },
    { code: '60', min: 56, max: 64, classification: 'U60', minGrams: 17.0, maxGrams: 20.4 },
    { code: '70', min: 66, max: 74, classification: 'U70', minGrams: 14.6, maxGrams: 17.0 },
    { code: '80', min: 76, max: 84, classification: 'U80', minGrams: 12.7, maxGrams: 14.6 },
  ];

  for (const size of wholeSizes) {
    await prisma.shrimpSize.upsert({
      where: {
        code_presentationTypeId: {
          code: size.code,
          presentationTypeId: presentationHO.id,
        },
      },
      update: {},
      create: {
        shrimpTypeId: shrimpType.id,
        presentationTypeId: presentationHO.id,
        code: size.code,
        classification: size.classification,
        minPiecesPerLb: size.min,
        maxPiecesPerLb: size.max,
        minWeightGrams: size.minGrams,
        maxWeightGrams: size.maxGrams,
        minWeightOz: size.minGrams / 28.35,
        maxWeightOz: size.maxGrams / 28.35,
        displayLabel: `${size.code} - ${size.classification} (Entero)`,
      },
    });
    console.log(`  ✓ ${size.code} - ${size.classification}`);
  }

  // 5. Tallas para Vivo (LIVE - L) - Mismas que Entero
  console.log('\n📝 Creando tallas para Vivo (L)...');
  for (const size of wholeSizes) {
    await prisma.shrimpSize.upsert({
      where: {
        code_presentationTypeId: {
          code: size.code,
          presentationTypeId: presentationL.id,
        },
      },
      update: {},
      create: {
        shrimpTypeId: shrimpType.id,
        presentationTypeId: presentationL.id,
        code: size.code,
        classification: size.classification,
        minPiecesPerLb: size.min,
        maxPiecesPerLb: size.max,
        minWeightGrams: size.minGrams,
        maxWeightGrams: size.maxGrams,
        minWeightOz: size.minGrams / 28.35,
        maxWeightOz: size.maxGrams / 28.35,
        displayLabel: `${size.code} - ${size.classification} (Vivo)`,
      },
    });
    console.log(`  ✓ ${size.code} - ${size.classification}`);
  }

  console.log('\n✅ Seed completado exitosamente!');
  console.log('\n📊 Resumen:');
  console.log(`   - 1 tipo de camarón (Camarón Blanco)`);
  console.log(`   - 3 presentaciones (Sin Cola, Entero, Vivo)`);
  console.log(`   - 10 tallas para Sin Cola`);
  console.log(`   - 7 tallas para Entero`);
  console.log(`   - 7 tallas para Vivo`);
  console.log(`   - Total: 24 tallas registradas`);
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
