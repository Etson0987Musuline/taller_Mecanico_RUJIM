const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const token = "a".repeat(64);
const registros = {
  sesiones: [
    {
      id: "sesion",
      usuario_id: 3,
      token_hash: crypto.createHash("sha256").update(token).digest("hex"),
      expires_at: "2099-01-01",
    },
  ],
  usuarios: [
    { id: 3, nombre: "Cliente 1", rol: "cliente", cliente_id: 1, activo: true },
  ],
  clientes: [
    { id: 1, nombre: "Cliente 1", apellido: "", email: "a@test.invalid" },
    { id: 2, nombre: "Cliente 2", apellido: "", email: "b@test.invalid" },
  ],
  vehiculos: [
    { id: 1, cliente_id: 1, placa: "AAA-001", km_ingreso: 100 },
    { id: 2, cliente_id: 2, placa: "BBB-002", km_ingreso: 100 },
  ],
  ordenes_trabajo: [
    { id: 1, vehiculo_id: 1, mecanico_id: 2 },
    { id: 2, vehiculo_id: 2, mecanico_id: 9 },
  ],
  mantenimientos: [
    { id: 1, vehiculo_id: 1, mecanico_id: 2, tipo_id: 1, proximo_km: 1000 },
    { id: 2, vehiculo_id: 2, mecanico_id: 9, tipo_id: 1, proximo_km: 1000 },
  ],
  tipos_mantenimiento: [{ id: 1, nombre: "Aceite" }],
  reglas_fidelidad: [],
  reportes_servicio: [
    { id: 1, cliente_id: 1, vehiculo_id: 1, mecanico_id: 2 },
    { id: 2, cliente_id: 2, vehiculo_id: 2, mecanico_id: 9 },
  ],
  recompensas: [
    { id: 1, cliente_id: 1 },
    { id: 2, cliente_id: 2 },
  ],
  recordatorios: [
    { id: 1, cliente_id: 1, estado: "enviado", programado_at: "2020-01-01" },
    { id: 2, cliente_id: 2, estado: "enviado", programado_at: "2020-01-01" },
  ],
  preferencias_comunicacion: [],
  alertas_leidas: [],
};
function from(tabla) {
  let rows = [...(registros[tabla] || [])];
  const q = {
    select() {
      return q;
    },
    order() {
      return q;
    },
    range(a, b) {
      rows = rows.slice(a, b + 1);
      return q;
    },
    eq(k, v) {
      rows = rows.filter((r) => r[k] === v);
      return q;
    },
    in(k, vs) {
      rows = rows.filter((r) => vs.includes(r[k]));
      return q;
    },
    gt(k, v) {
      rows = rows.filter((r) => r[k] > v);
      return q;
    },
    lte(k, v) {
      rows = rows.filter((r) => r[k] <= v);
      return q;
    },
    maybeSingle() {
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    then(a, b) {
      return Promise.resolve({ data: rows, error: null }).then(a, b);
    },
  };
  return q;
}
const dbPath = require.resolve("../src/config/supabase");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { from },
};
const { panel } = require("../src/services/programa.service");
const {
  verificarToken,
  soloAdmin,
} = require("../src/middlewares/auth.middleware");
const {
  alcanceOrden,
  alcanceVehiculo,
} = require("../src/middlewares/alcance.middleware");
function res() {
  return {
    statusCode: 200,
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
test("un cliente solo recibe sus fichas, vehículos, historial y beneficios", async () => {
  const p = await panel({ id: 3, rol: "cliente", cliente_id: 1 });
  for (const tabla of [
    "clientes",
    "vehiculos",
    "ordenes",
    "reportes",
    "recompensas",
    "recordatorios",
  ])
    assert.deepEqual(
      p[tabla].map((r) => r.id),
      [1],
      tabla,
    );
  assert.equal(p.personal.length, 0);
});
test("el mecánico solo recibe vehículos y alertas asignadas, sin beneficios de terceros", async () => {
  const p = await panel({ id: 2, rol: "mecanico" });
  assert.deepEqual(
    p.vehiculos.map((v) => v.id),
    [1],
  );
  assert.deepEqual(
    p.ordenes.map((o) => o.id),
    [1],
  );
  assert.deepEqual(
    p.mantenimientos.map((m) => m.id),
    [1],
  );
  assert.equal(p.recompensas.length, 0);
});
test("no se acepta un JWT antiguo del navegador ni un rol inventado por el cliente", async () => {
  const response = res();
  await verificarToken(
    {
      headers: { authorization: "Bearer jwt-antiguo" },
      usuario: { rol: "admin" },
    },
    response,
    () => assert.fail("No debe autorizar"),
  );
  assert.equal(response.statusCode, 401);
});
test("el rol actual se vuelve a consultar al servidor en cada petición", async () => {
  const req = { headers: { cookie: `rujim_session=${token}` } };
  const response = res();
  let pasa = false;
  await verificarToken(req, response, () => {
    pasa = true;
  });
  assert.equal(pasa, true);
  assert.equal(req.usuario.rol, "cliente");
  soloAdmin(req, response, () => assert.fail());
  assert.equal(response.statusCode, 403);
  registros.usuarios[0].activo = false;
  const denegado = res();
  await verificarToken({ headers: req.headers }, denegado, () => assert.fail());
  assert.equal(denegado.statusCode, 401);
  registros.usuarios[0].activo = true;
});
test("no se puede modificar una orden de otro mecánico cambiando el ID", async () => {
  const response = res();
  await alcanceOrden(
    { params: { id: 2 }, usuario: { id: 2, rol: "mecanico" }, method: "GET" },
    response,
    () => assert.fail(),
  );
  assert.equal(response.statusCode, 403);
});
test("la cookie es HttpOnly y las mutaciones de orígenes ajenos se rechazan", () => {
  const { setCookie, protegerOrigen } = require("../src/utils/session");
  let cookie;
  setCookie(
    {
      append(k, v) {
        cookie = v;
      },
    },
    "rujim_session",
    token,
    3600,
  );
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(cookie.includes("Path=/api"));
  const response = res();
  protegerOrigen(
    {
      method: "POST",
      headers: {
        origin: "https://ajeno.example",
        cookie: `rujim_session=${token}`,
      },
    },
    response,
    () => assert.fail(),
  );
  assert.equal(response.statusCode, 403);
});
test("la ruta antigua de clientes valida el ID aunque Express cambie baseUrl al montar middleware", async () => {
  const response = res();
  await alcanceVehiculo(
    {
      usuario: { id: 2, rol: "mecanico" },
      method: "GET",
      params: {},
      originalUrl: "/api/clientes/2/historial",
      baseUrl: "/api/clientes/2",
    },
    response,
    () => assert.fail(),
  );
  assert.equal(response.statusCode, 403);
});
