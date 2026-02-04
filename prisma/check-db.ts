import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('🔍 Verificando base de datos...\n');
  
  const presentations = await prisma.presentationType.findMany();
  console.log('📋 Presentaciones en BD:');
  presentations.forEach(p => {
    console.log(`  - ${p.code}: ${p.name}`);
  });
  
  console.log('\n📏 Tallas por presentación:');
  for (const pres of presentations) {
    const sizes = await prisma.shrimpSize.findMany({
      where: { presentationTypeId: pres.id },
      orderBy: { code: 'asc' }
    });
    console.log(`\n  ${pres.name} (${pres.code}):`);
    if (sizes.length === 0) {
      console.log('    ⚠️  No hay tallas registradas');
    } else {
      sizes.forEach(s => console.log(`    ✓ ${s.code}`));
    }
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
