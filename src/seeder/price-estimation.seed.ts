import { PrismaService } from '../prisma/prisma.service';

export async function seedPriceEstimationData(prisma: PrismaService) {
  console.log('🌱 Seeding Price Estimation Module data...');

  // Verificar si ya existen registros de calidad de proveedores (indicador de que el seed ya se ejecutó)
  const existingQualityRecords = await prisma.providerQuality.findMany();
  if (existingQualityRecords.length > 0) {
    console.log('✅ Price Estimation Module data already exists, skipping...');
    return;
  }

  // 1. Crear fórmula de estimación por defecto para compras
  const formulaCompra = await prisma.priceFormula.upsert({
    where: { nombre: 'Formula_Compra_Basica' },
    update: {},
    create: {
      nombre: 'Formula_Compra_Basica',
      descripcion: 'Fórmula básica para estimación de precios de compra basada en promedio ponderado',
      tipo: 'compra',
      algoritmo: 'promedio_ponderado',
      factores: {
        historial_proveedor: { activo: true, peso: 0.3 },
        temporada: { activo: true, peso: 0.2 },
        talla_producto: { activo: true, peso: 0.2 },
        mercado_general: { activo: true, peso: 0.3 },
      },
      ventanaHistorica: 90,
      pesoTemporada: 0.2,
      pesoProveedor: 0.3,
      pesoTalla: 0.2,
      pesoMercado: 0.3,
      ajustePorVolumen: 0.05,
      ajustePorCalidad: 0.1,
      margenSeguridad: 0.05,
      version: '1.0',
    },
  });

  // 2. Crear fórmula de estimación para ventas
  const formulaVenta = await prisma.priceFormula.upsert({
    where: { nombre: 'Formula_Venta_Basica' },
    update: {},
    create: {
      nombre: 'Formula_Venta_Basica',
      descripcion: 'Fórmula básica para estimación de precios de venta',
      tipo: 'venta',
      algoritmo: 'promedio_ponderado',
      factores: {
        historial_empacadora: { activo: true, peso: 0.4 },
        demanda_mercado: { activo: true, peso: 0.3 },
        temporada: { activo: true, peso: 0.3 },
      },
      ventanaHistorica: 60,
      pesoTemporada: 0.3,
      pesoProveedor: 0.1,
      pesoTalla: 0.3,
      pesoMercado: 0.3,
      ajustePorVolumen: 0.03,
      ajustePorCalidad: 0.05,
      margenSeguridad: 0.08,
      version: '1.0',
    },
  });

  // 3. Crear factores de mercado iniciales
  const factoresMercado = [
    {
      nombre: 'Precio_Diesel',
      descripcion: 'Precio del diesel que afecta los costos de transporte',
      categoria: 'economico',
      valor: 1.25,
      unidad: 'dolares_por_galon',
      peso: 0.1,
      fuente: 'Ministerio de Energía',
    },
    {
      nombre: 'Demanda_Internacional',
      descripcion: 'Índice de demanda internacional de camarón',
      categoria: 'demanda',
      valor: 85,
      unidad: 'indice_0_100',
      peso: 0.3,
      fuente: 'Cámara Nacional de Acuacultura',
    },
    {
      nombre: 'Temporada_Alta',
      descripcion: 'Multiplicador para temporada alta de demanda',
      categoria: 'temporal',
      valor: 15,
      unidad: 'porcentaje',
      peso: 0.2,
      fuente: 'Análisis histórico interno',
    },
    {
      nombre: 'Tipo_Cambio_USD_EUR',
      descripcion: 'Tipo de cambio USD/EUR para exportaciones',
      categoria: 'economico',
      valor: 0.92,
      unidad: 'tasa_cambio',
      peso: 0.15,
      fuente: 'Banco Central del Ecuador',
    },
    {
      nombre: 'Clima_Condiciones',
      descripcion: 'Índice de condiciones climáticas favorables',
      categoria: 'climatico',
      valor: 75,
      unidad: 'indice_0_100',
      peso: 0.1,
      fuente: 'INAMHI',
    },
  ];

  for (const factor of factoresMercado) {
    await prisma.marketFactor.upsert({
      where: { nombre: factor.nombre },
      update: {
        valor: factor.valor,
        fecha: new Date(),
      },
      create: factor,
    });
  }

  // 4. Crear registros de calidad para proveedores existentes
  const providers = await prisma.provider.findMany();
  
  for (const provider of providers) {
    await prisma.providerQuality.upsert({
      where: { providerId: provider.id },
      update: {},
      create: {
        providerId: provider.id,
        tasaAprobacion: Math.random() * 20 + 80, // 80-100%
        puntualidadPromedio: Math.random() * 15 + 85, // 85-100%
        calidadConsistencia: Math.random() * 2 + 8, // 8-10
        pedidosCompletados: Math.floor(Math.random() * 50 + 10), // 10-60 pedidos
        pedidosRechazados: Math.floor(Math.random() * 5), // 0-5 rechazados
        promedioTiempoEntrega: Math.random() * 2 + 1, // 1-3 días
        factorConfiabilidad: 0.95 + Math.random() * 0.1, // 0.95-1.05
        factorPrecio: 0.98 + Math.random() * 0.04, // 0.98-1.02
      },
    });
  }

  // 5. Crear algunos datos históricos de precios simulados
  const tallas = ['U10', 'U12', 'U15', 'U20', 'U30'];
  const temporadas = ['verano', 'invierno'];
  
  for (let i = 0; i < 100; i++) {
    const fechaAleatoria = new Date();
    fechaAleatoria.setDate(fechaAleatoria.getDate() - Math.floor(Math.random() * 180)); // Últimos 6 meses
    
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const talla = tallas[Math.floor(Math.random() * tallas.length)];
    const temporada = temporadas[Math.floor(Math.random() * temporadas.length)];
    
    // Precios base variables según talla
    const preciosBase = {
      U10: { compra: 5.50, venta: 6.80 },
      U12: { compra: 5.00, venta: 6.20 },
      U15: { compra: 4.50, venta: 5.70 },
      U20: { compra: 4.00, venta: 5.20 },
      U30: { compra: 3.50, venta: 4.70 },
    };
    
    const precioBase = preciosBase[talla as keyof typeof preciosBase];
    
    // Variación aleatoria ±10%
    const variacionCompra = (Math.random() - 0.5) * 0.2;
    const variacionVenta = (Math.random() - 0.5) * 0.2;
    
    await prisma.priceHistory.create({
      data: {
        providerId: provider.id,
        talla: talla as any,
        precioCompra: precioBase.compra * (1 + variacionCompra),
        precioVenta: precioBase.venta * (1 + variacionVenta),
        fecha: fechaAleatoria,
        temporada,
        observaciones: `Precio histórico simulado - ${temporada}`,
      },
    });
  }

  console.log('✅ Price Estimation Module data seeded successfully');
  console.log(`   - Fórmulas creadas: 2 (compra y venta)`);
  console.log(`   - Factores de mercado: ${factoresMercado.length}`);
  console.log(`   - Registros de calidad de proveedores: ${providers.length}`);
  console.log(`   - Registros históricos de precios: 100`);
}