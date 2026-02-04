import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== RECEPCIONES ===');
    const receptions = await prisma.reception.findMany({
      include: {
        order: {
          include: {
            shrimpSize: true,
            presentationType: true
          }
        }
      }
    });
    console.log(`Total recepciones: ${receptions.length}`);
    receptions.forEach((r, i) => {
      console.log(`\nRecepción ${i + 1}:`);
      console.log(`  ID: ${r.id}, OrderID: ${r.orderId}`);
      console.log(`  Fecha Llegada: ${r.fechaLlegada}`);
      console.log(`  Lote Aceptado: ${r.loteAceptado}`);
      console.log(`  Precio Final Venta: ${r.precioFinalVenta}`);
      console.log(`  Talla: ${r.order?.shrimpSize?.code}`);
      console.log(`  Cantidad Final: ${r.order?.cantidadFinal}`);
      if (r.precioFinalVenta && r.order?.cantidadFinal) {
        console.log(`  Precio por Libra: ${r.precioFinalVenta / r.order.cantidadFinal}`);
      }
    });

    console.log('\n\n=== PREDICCIONES ===');
    const predictions = await prisma.prediccionesIA.findMany();
    console.log(`Total predicciones: ${predictions.length}`);
    predictions.forEach((p, i) => {
      console.log(`\nPredicción ${i + 1}:`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Fecha Creación: ${p.fechaCreacion}`);
      console.log(`  Fecha Predicción (Objetivo): ${p.fechaPrediccion}`);
      console.log(`  Calibre: ${p.calibre}`);
      console.log(`  Precio Predicho: ${p.precioPredicho}`);
    });

    console.log('\n\n=== ANÁLISIS ===');
    if (receptions.length > 0 && predictions.length > 0) {
      const r = receptions[0];
      const recDate = new Date(r.fechaLlegada);
      recDate.setUTCHours(0, 0, 0, 0);
      
      console.log(`Buscando coincidencias para recepción:`);
      console.log(`  Talla: ${r.order?.shrimpSize?.code}`);
      console.log(`  Fecha normalizada: ${recDate.toISOString()}`);
      
      const matching = predictions.filter(p => {
        const pDate = new Date(p.fechaPrediccion);
        pDate.setUTCHours(0, 0, 0, 0);
        return p.calibre === r.order?.shrimpSize?.code && 
               pDate.getTime() === recDate.getTime();
      });
      
      console.log(`  Predicciones coincidentes: ${matching.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
