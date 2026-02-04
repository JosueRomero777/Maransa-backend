import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Limpiando datos antiguos de tallas y presentaciones...\n');
  
  // Eliminar tallas
  const deletedSizes = await prisma.shrimpSize.deleteMany({});
  console.log(`✅ Eliminadas ${deletedSizes.count} tallas`);
  
  // Eliminar presentaciones
  const deletedPresentations = await prisma.presentationType.deleteMany({});
  console.log(`✅ Eliminadas ${deletedPresentations.count} presentaciones`);
  
  // Eliminar tipos de camarón
  const deletedTypes = await prisma.shrimpType.deleteMany({});
  console.log(`✅ Eliminados ${deletedTypes.count} tipos de camarón`);
  
  console.log('\n✅ Base de datos limpiada. Ahora ejecuta el seed nuevamente.');
  
  await prisma.$disconnect();
}

cleanup().catch(console.error);
