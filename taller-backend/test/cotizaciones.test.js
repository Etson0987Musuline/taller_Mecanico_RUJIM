const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarCotizacion, nuevoToken } = require("../src/utils/cotizaciones");
const base = () => ({
  vehiculo_id: 1,
  descripcion: "Mantenimiento",
  items: [
    {
      tipo: "mano_obra",
      descripcion: "Cambio de aceite",
      cantidad: 1,
      precio_unitario: 45,
    },
    {
      tipo: "repuesto",
      descripcion: "Aceite",
      repuesto_id: 2,
      cantidad: 3,
      precio_unitario: 29.9,
    },
  ],
});
test("calcula importes en céntimos y no acepta totales enviados por el cliente", () => {
  const c = validarCotizacion({ ...base(), total: 1, estado: "aprobada" });
  assert.equal(c.subtotal, 134.7);
  assert.equal(c.igv, 24.25);
  assert.equal(c.total, 158.95);
  assert.equal(c.estado, undefined);
});
test("redondea el IGV una sola vez sobre el subtotal", () => {
  const b = base();
  b.items = [
    {
      tipo: "mano_obra",
      descripcion: "Revisión",
      cantidad: 3,
      precio_unitario: 0.1,
    },
  ];
  const c = validarCotizacion(b);
  assert.equal(c.subtotal, 0.3);
  assert.equal(c.igv, 0.05);
  assert.equal(c.total, 0.35);
});
test("rechaza precios negativos, fracciones de céntimo y cantidades inválidas", () => {
  for (const cambio of [
    { precio_unitario: -1 },
    { precio_unitario: 0.001 },
    { precio_unitario: Infinity },
    { cantidad: 0 },
    { cantidad: 1.5 },
    { cantidad: 10001 },
  ]) {
    const b = base();
    Object.assign(b.items[0], cambio);
    assert.throws(() => validarCotizacion(b));
  }
});
test("exige vehículo, conceptos, descripción y repuestos válidos", () => {
  for (const cambio of [
    { vehiculo_id: null },
    { items: [] },
    { descripcion: " " },
    { items: Array(101).fill(base().items[0]) },
  ])
    assert.throws(() => validarCotizacion({ ...base(), ...cambio }));
  const b = base();
  b.items[1].repuesto_id = null;
  assert.throws(() => validarCotizacion(b));
});
test("genera enlaces aleatorios de 256 bits", () => {
  const a = nuevoToken(),
    b = nuevoToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
});

// Simular únicamente el límite de persistencia; se ejecutan los controladores reales.
const dbPath = require.resolve("../src/config/cotizaciones-db");
let llamada;
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    from: () => llamada,
    rpc: async (nombre, args) => {
      assert.equal(nombre, "convertir_cotizacion");
      assert.equal(args.p_id, 7);
      return { data: { id: 15, codigo: "OT-C7" }, error: null };
    },
  },
};
const controller = require("../src/controllers/cotizaciones.controller");
function response() {
  return {
    statusCode: 200,
    set() {
      return this;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
}
test("rechaza respuesta sin consentimiento antes de acceder a datos", async () => {
  const res = response();
  await controller.responder(
    {
      params: { token: nuevoToken() },
      body: { decision: "aprobada", nombre: "Cliente" },
    },
    res,
  );
  assert.equal(res.statusCode, 400);
});
test("aceptación filtra atómicamente estado y vencimiento y oculta IDs", async () => {
  const filtros = [];
  llamada = {
    update(payload) {
      assert.equal(payload.estado, "aprobada");
      return this;
    },
    eq(k, v) {
      filtros.push([k, v]);
      return this;
    },
    gt(k, v) {
      filtros.push([k, v]);
      return this;
    },
    select() {
      return this;
    },
    async maybeSingle() {
      return {
        data: {
          items: [{ descripcion: "Aceite", repuesto_id: 2 }],
          estado: "aprobada",
        },
        error: null,
      };
    },
  };
  const res = response();
  await controller.responder(
    {
      params: { token: nuevoToken() },
      body: { decision: "aprobada", nombre: "Cliente", consentimiento: true },
    },
    res,
  );
  assert.ok(filtros.some(([k, v]) => k === "estado" && v === "pendiente"));
  assert.ok(filtros.some(([k]) => k === "vence_at"));
  assert.equal(res.data.items[0].repuesto_id, undefined);
});
test("respuesta repetida o vencida devuelve conflicto", async () => {
  llamada = {
    update() {
      return this;
    },
    eq() {
      return this;
    },
    gt() {
      return this;
    },
    select() {
      return this;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
  };
  const res = response();
  await controller.responder(
    {
      params: { token: nuevoToken() },
      body: { decision: "rechazada", nombre: "Cliente", consentimiento: true },
    },
    res,
  );
  assert.equal(res.statusCode, 409);
});
test("conversión delega en la transacción con el usuario autenticado", async () => {
  const res = response();
  await controller.convertir({ params: { id: "7" }, usuario: { id: 1 } }, res);
  assert.equal(res.data.codigo, "OT-C7");
});
