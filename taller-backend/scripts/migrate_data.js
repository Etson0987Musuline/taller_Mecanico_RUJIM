const pool = require('../src/config/db');
const supabase = require('../src/config/supabase');

async function migrateTable(tableName, batchSize = 50, transform = (row) => row) {
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
    console.log(`\n📦 Migrando ${tableName}: ${rows.length} registros...`);

    if (rows.length === 0) {
      console.log(`✓ ${tableName} está vacía.`);
      return;
    }

    const transformedRows = rows.map(transform);

    for (let i = 0; i < transformedRows.length; i += batchSize) {
      const batch = transformedRows.slice(i, i + batchSize);
      const { error } = await supabase.from(tableName).upsert(batch);

      if (error) {
        console.error(`❌ Error al insertar lote ${i / batchSize + 1} en ${tableName}:`, error.message);
        return;
      }
      process.stdout.write(`  -> Progreso: ${Math.min(i + batchSize, transformedRows.length)} / ${transformedRows.length}\r`);
    }

    console.log(`\n✅ ${tableName} migrado con éxito (${rows.length} filas).`);
  } catch (err) {
    console.error(`❌ Error general en ${tableName}:`, err.message);
  }
}

async function run() {
  console.log('🚀 Iniciando migración de datos de MySQL a Supabase...');

  // 1. Usuarios
  await migrateTable('usuarios', 50, (r) => ({
    ...r,
    activo: Boolean(r.activo),
  }));

  // 2. Clientes
  await migrateTable('clientes', 50);

  // 3. Catálogos de vehículos
  await migrateTable('vehiculo_catalogos', 50);

  // 4. Servicios
  await migrateTable('servicios', 50, (r) => ({
    ...r,
    activo: Boolean(r.activo),
  }));

  // 5. Repuestos (713 registros)
  await migrateTable('repuestos', 50, (r) => ({
    ...r,
    activo: Boolean(r.activo),
    stock: Number(r.stock) || 0,
    stock_minimo: Number(r.stock_minimo) || 5,
    precio_compra: Number(r.precio_compra) || 0,
    precio_venta: Number(r.precio_venta) || 0,
    precio_mayor: Number(r.precio_mayor) || 0,
    cantidad_mayor: Number(r.cantidad_mayor) || 0,
    precio_dist1: Number(r.precio_dist1) || 0,
    precio_dist2: Number(r.precio_dist2) || 0,
    precio_dist3: Number(r.precio_dist3) || 0,
  }));

  // 6. Vehículos
  await migrateTable('vehiculos', 50, (r) => ({
    ...r,
    anio: r.anio ? Number(r.anio) : null,
    anio_modelo: r.anio_modelo ? Number(r.anio_modelo) : null,
    km_ingreso: Number(r.km_ingreso) || 0,
  }));

  // 7. Órdenes de trabajo
  await migrateTable('ordenes_trabajo', 50, (r) => ({
    ...r,
    km_actual: r.km_actual ? Number(r.km_actual) : null,
    mano_obra: Number(r.mano_obra) || 0,
  }));

  // 8. Orden Servicios
  await migrateTable('orden_servicios', 50, (r) => ({
    ...r,
    precio: Number(r.precio) || 0,
  }));

  // 9. Orden Repuestos
  await migrateTable('orden_repuestos', 50, (r) => ({
    ...r,
    cantidad: Number(r.cantidad) || 1,
    precio_unitario: Number(r.precio_unitario) || 0,
  }));

  // 10. Seguimiento
  await migrateTable('seguimiento', 50);

  // 11. Facturas
  await migrateTable('facturas', 50, (r) => ({
    ...r,
    subtotal: Number(r.subtotal) || 0,
    igv: Number(r.igv) || 0,
    total: Number(r.total) || 0,
  }));

  // 12. Pagos
  await migrateTable('pagos', 50, (r) => ({
    ...r,
    monto: Number(r.monto) || 0,
  }));

  // 13. Ventas
  await migrateTable('ventas', 50, (r) => ({
    ...r,
    subtotal: Number(r.subtotal) || 0,
    igv: Number(r.igv) || 0,
    total: Number(r.total) || 0,
  }));

  // 14. Detalle Ventas
  await migrateTable('detalle_ventas', 50, (r) => ({
    ...r,
    cantidad: Number(r.cantidad) || 1,
    precio_unitario: Number(r.precio_unitario) || 0,
    subtotal: Number(r.subtotal) || 0,
    descuento: Number(r.descuento) || 0,
  }));

  console.log('\n🎉 ¡Proceso de migración finalizado!');
  await pool.end();
  setTimeout(() => process.exit(0), 500);
}

run().catch((err) => {
  console.error('Error fatal en la migración:', err);
  process.exit(1);
});
