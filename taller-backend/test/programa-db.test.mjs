import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  new URL(
    "../../.tmp/sql-check/node_modules/@electric-sql/pglite/dist/index.js",
    import.meta.url,
  )
);
let db;
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
before(async () => {
  db = new PGlite();
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;",
  );
  for (const file of [
    "supabase_migration.sql",
    "supabase_cotizaciones.sql",
    "supabase_programa_taller.sql",
  ])
    await db.exec(
      await readFile(new URL("../" + file, import.meta.url), "utf8"),
    );
  await db.exec(`INSERT INTO usuarios(id,nombre,email,rol,password_hash,google_habilitado) VALUES (1,'Admin','admin@test.invalid','admin','no-es-un-hash',true),(2,'Mecánico','mecanico@test.invalid','mecanico','no-es-un-hash',false);
    INSERT INTO clientes(id,nombre,apellido,email) VALUES(1,'Cliente','Prueba','cliente@test.invalid'),(2,'Otro','Cliente','otro@test.invalid');
    INSERT INTO vehiculos(id,cliente_id,placa,marca,modelo,km_ingreso) VALUES(1,1,'TEST-001','Toyota','Prueba',1000),(2,2,'TEST-002','Kia','Prueba',2000);
    INSERT INTO repuestos(id,nombre,stock,precio_venta) VALUES(1,'Filtro',20,50);
    UPDATE reglas_fidelidad SET activo=false;
    INSERT INTO reglas_fidelidad(servicios,porcentaje,vigencia_dias) VALUES(1,10,30);
    INSERT INTO ordenes_trabajo(id,codigo,vehiculo_id,mecanico_id,descripcion_problema,mano_obra) VALUES(1,'TEST-OT1',1,2,'Revisión',100),(2,'TEST-OT2',2,2,'Revisión',100);
    SELECT setval('usuarios_id_seq',2); SELECT setval('clientes_id_seq',2); SELECT setval('vehiculos_id_seq',2);SELECT setval('ordenes_trabajo_id_seq',2);`);
  await db.exec(await readFile(new URL('../deployment_preflight.sql',import.meta.url),'utf8'));
});
after(async () => {
  await db?.close();
});
test('el respaldo previo queda privado y conserva los registros iniciales',async()=>{
  const [r]=await query("select count(*)::int n from rujim_backup_preprograma_20261102.usuarios");assert.equal(r.n,2);
  const [p]=await query("select has_schema_privilege('anon','rujim_backup_preprograma_20261102','USAGE') permitido");assert.equal(p.permitido,false);
});
test("la operación de repuestos valida pertenencia y revierte stock insuficiente", async () => {
  const [o] = await query(
    "insert into ordenes_trabajo(id,codigo,vehiculo_id,mecanico_id,descripcion_problema) values(1000,'TEST-STOCK',1,2,'Prueba') returning id",
  );
  const [{ stock: inicial }] = await query(
    "select stock from repuestos where id=1",
  );
  await query("select modificar_repuesto_orden($1,2,1,null,2,50)", [o.id]);
  const [d] = await query("select id from orden_repuestos where orden_id=$1", [
    o.id,
  ]);
  assert.equal(
    (await query("select stock from repuestos where id=1"))[0].stock,
    inicial - 2,
  );
  await assert.rejects(
    query("select modificar_repuesto_orden($1,2,1,null,10000,50)", [o.id]),
    /Stock insuficiente/,
  );
  await assert.rejects(
    query("select modificar_repuesto_orden(2,2,null,$1,null,null)", [d.id]),
    /no pertenece/,
  );
  await query("select modificar_repuesto_orden($1,2,null,$2,null,null)", [
    o.id,
    d.id,
  ]);
  assert.equal(
    (await query("select stock from repuestos where id=1"))[0].stock,
    inicial,
  );
});
const reporte = {
  tipo_servicio: "Cambio de aceite",
  fecha_servicio: "2026-01-31",
  km: 1100,
  observaciones: "Trabajo completado",
  fallas: "",
  recomendaciones: "Control de aceite",
  mantenimientos: [{ tipo_id: 1, meses: 1, intervalo_km: 5000 }],
};
test("identidad Google: no crea administradores, no duplica correos y exige autorización de personal", async () => {
  const uid = "11111111-1111-4111-8111-111111111111";
  const [a] = await query("select vincular_google($1,$2,$3) as u", [
    uid,
    "CLIENTE@test.invalid",
    "Cliente",
  ]);
  assert.equal(a.u.rol, "cliente");
  assert.equal(a.u.cliente_id, 1);
  const [b] = await query("select vincular_google($1,$2,$3) as u", [
    uid,
    "cliente@test.invalid",
    "Cliente",
  ]);
  assert.equal(a.u.id, b.u.id);
  await assert.rejects(
    query("select vincular_google($1,$2,$3)", [
      "22222222-2222-4222-8222-222222222222",
      "mecanico@test.invalid",
      "Mecánico",
    ]),
    /autorización/,
  );
  const [admin] = await query("select vincular_google($1,$2,$3) as u", [
    "33333333-3333-4333-8333-333333333333",
    "admin@test.invalid",
    "Administrador",
  ]);
  assert.equal(admin.u.rol, "admin");
});
test("reportar y aprobar actualiza contador, ficha y recompensa una sola vez", async () => {
  await query("select reportar_servicio($1,$2,$3)", [1, 2, reporte]);
  let [c] = await query("select count(*)::int n from recompensas");
  assert.equal(c.n, 0);
  const [{ id }] = await query(
    "select id from reportes_servicio where orden_id=1",
  );
  await query("select revisar_servicio($1,$2,true)", [id, 1]);
  await query("select revisar_servicio($1,$2,true)", [id, 1]);
  [c] = await query("select count(*)::int n from recompensas");
  assert.equal(c.n, 1);
  const [m] = await query(
    "select proxima_fecha::text,proximo_km from mantenimientos where vehiculo_id=1",
  );
  assert.equal(m.proxima_fecha, "2026-02-28");
  assert.equal(m.proximo_km, 6100);
  await assert.rejects(
    query("select reportar_servicio($1,$2,$3)", [1, 2, reporte]),
    /ya fue enviado/,
  );
});
test("solo el administrador aprueba y las órdenes ajenas no se reportan", async () => {
  await assert.rejects(
    query("select revisar_servicio(1,2,true)"),
    /Solo administrador/,
  );
  await db.exec(
    `INSERT INTO usuarios(id,nombre,email,rol) VALUES(50,'Otro mecánico','m2@test.invalid','mecanico');`,
  );
  await assert.rejects(
    query("select reportar_servicio($1,$2,$3)", [
      2,
      50,
      { ...reporte, km: 2100 },
    ]),
    /no asignada/,
  );
});
test("el descuento se aplica a una visita posterior y se consume una sola vez", async () => {
  await db.exec(`INSERT INTO ordenes_trabajo(id,codigo,vehiculo_id,mecanico_id,descripcion_problema,mano_obra) VALUES(3,'TEST-OT3',1,2,'Próxima visita',100),(4,'TEST-OT4',1,2,'Otra visita',100);
    INSERT INTO orden_repuestos(orden_id,repuesto_id,cantidad,precio_unitario) VALUES(3,1,2,50);`);
  const [misma] = await query("select facturar_con_fidelidad(1,1) as f");
  assert.equal(misma.f.descuento, 0);
  const [siguiente] = await query("select facturar_con_fidelidad(3,1) as f");
  assert.equal(siguiente.f.descuento, 10);
  assert.equal(siguiente.f.subtotal, 190);
  assert.equal(siguiente.f.total, 224.2);
  const [otra] = await query("select facturar_con_fidelidad(4,1) as f");
  assert.equal(otra.f.descuento, 0);
  await assert.rejects(
    query("select facturar_con_fidelidad(3,1)"),
    /ya tiene factura/,
  );
});
test("rechazados y cancelados no generan nuevas recompensas", async () => {
  await query("select reportar_servicio($1,$2,$3)", [
    2,
    2,
    { ...reporte, km: 2100 },
  ]);
  const [{ id }] = await query(
    "select id from reportes_servicio where orden_id=2",
  );
  await query("select revisar_servicio($1,1,false,$2)", [
    id,
    "Revisar observaciones",
  ]);
  assert.equal(
    (
      await query(
        "select count(*)::int n from reportes_servicio where cliente_id=2 and estado='aprobado'",
      )
    )[0].n,
    0,
  );
  await query("select reportar_servicio($1,$2,$3)", [
    2,
    2,
    { ...reporte, km: 2100 },
  ]);
  await assert.rejects(
    db.exec("update ordenes_trabajo set estado='cancelado' where id=2"),
    /reportado conserva/,
  );
  await db.exec(
    "INSERT INTO ordenes_trabajo(id,codigo,vehiculo_id,mecanico_id,estado,descripcion_problema) VALUES(5,'OT-CANCELADA',2,2,'cancelado','Cancelado')",
  );
  await assert.rejects(
    query("select reportar_servicio($1,$2,$3)", [
      5,
      2,
      { ...reporte, km: 2100 },
    ]),
    /no admite/,
  );
});
test("la cola reclama un recordatorio una sola vez", async () => {
  await db.exec(
    "INSERT INTO recordatorios(cliente_id,clave,canal,mensaje) VALUES(1,'test-cola','email','Prueba sin envío real')",
  );
  assert.equal(
    (await query("select * from tomar_recordatorios(10)")).length,
    1,
  );
  assert.equal(
    (await query("select * from tomar_recordatorios(10)")).length,
    0,
  );
});
test("una cotización autorizada conserva conversión e inventario tras las nuevas migraciones", async () => {
  await query(
    "select setval('ordenes_trabajo_id_seq',(select max(id) from ordenes_trabajo))",
  );
  const items = [
    {
      tipo: "repuesto",
      descripcion: "Filtro",
      repuesto_id: 1,
      cantidad: 2,
      precio_unitario: 50,
    },
    {
      tipo: "mano_obra",
      descripcion: "Cambio",
      cantidad: 1,
      precio_unitario: 40,
    },
  ];
  const [c] = await query(
    "insert into cotizaciones(vehiculo_id,descripcion,items,subtotal,igv,total,token,estado,aprobado_por,respondido_at) values(1,'Prueba',$1,140,25.2,165.2,$2,'aprobada','Cliente',now()) returning id",
    [items, "f".repeat(64)],
  );
  const [{ f: a }] = await query("select convertir_cotizacion($1,1) f", [c.id]);
  const [{ f: b }] = await query("select convertir_cotizacion($1,1) f", [c.id]);
  assert.equal(a.id, b.id);
  const [r] = await query("select stock from repuestos where id=1");
  assert.equal(r.stock, 18);
});
test("los trabajos aprobados no permiten alterar importes desde las rutas antiguas", async () => {
  await assert.rejects(
    query("update ordenes_trabajo set mano_obra=1 where id=1"),
    /reportado conserva/,
  );
  await assert.rejects(
    query(
      "insert into orden_repuestos(orden_id,repuesto_id,cantidad,precio_unitario) values(1,1,1,1)",
    ),
    /reportado conserva/,
  );
  await query(
    "update ordenes_trabajo set estado='entregado',fecha_entrega=now() where id=1",
  );
  const [o] = await query("select estado from ordenes_trabajo where id=1");
  assert.equal(o.estado, "entregado");
});
test("anon no puede leer datos privados ni invocar funciones y los scripts preservan la protección", async () => {
  await db.exec(
    await readFile(
      new URL("../supabase_enable_permissions.sql", import.meta.url),
      "utf8",
    ),
  );
  const [permisos] = await query(
    "select has_table_privilege('anon','clientes','SELECT') cliente,has_table_privilege('anon','recompensas','SELECT') premio,has_function_privilege('anon','revisar_servicio(integer,integer,boolean,text)','EXECUTE') aprobar",
  );
  assert.deepEqual(permisos, { cliente: false, premio: false, aprobar: false });
});
