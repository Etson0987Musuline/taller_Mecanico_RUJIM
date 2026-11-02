const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  estadoMantenimiento,
  validarReporte,
  estadisticas,
} = require("../src/utils/programa");
test("mantenimiento vence por el primer límite de fecha o kilometraje", () => {
  const m = {
    proxima_fecha: "2026-11-10",
    proximo_km: 5000,
    aviso_dias: 14,
    aviso_km: 500,
  };
  assert.equal(estadoMantenimiento(m, 4000, "2026-10-01"), "al_dia");
  assert.equal(estadoMantenimiento(m, 4600, "2026-10-01"), "proximo");
  assert.equal(estadoMantenimiento(m, 4000, "2026-11-02"), "proximo");
  assert.equal(estadoMantenimiento(m, 5000, "2026-10-01"), "pendiente");
  assert.equal(estadoMantenimiento(m, 5001, "2026-10-01"), "vencido");
  assert.equal(estadoMantenimiento(m, 4000, "2026-11-11"), "vencido");
});
test("valida fechas reales, kilometraje y componentes repetidos", () => {
  const base = {
    km: 100,
    fecha_servicio: "2026-11-02",
    tipo_servicio: "Revisión",
    observaciones: "Control",
    mantenimientos: [],
  };
  assert.equal(validarReporte(base).km, 100);
  assert.throws(() => validarReporte({ ...base, km: -1 }));
  assert.throws(() =>
    validarReporte({ ...base, fecha_servicio: "2026-02-30" }),
  );
  assert.throws(() =>
    validarReporte({
      ...base,
      mantenimientos: [{ tipo_id: 1 }, { tipo_id: 1 }],
    }),
  );
});
test("las estadísticas no cuentan pendientes ni cancelados y conservan el progreso histórico", () => {
  const datos = {
    clientes: [{ id: 1, nombre: "Cliente" }],
    reglas: [{ servicios: 5, porcentaje: 10, activo: true }],
    reportes: [
      {
        cliente_id: 1,
        vehiculo_id: 1,
        estado: "aprobado",
        fecha_servicio: "2026-01-01",
        tipo_servicio: "Aceite",
      },
      {
        cliente_id: 1,
        vehiculo_id: 1,
        estado: "pendiente",
        fecha_servicio: "2026-11-02",
        tipo_servicio: "Aceite",
      },
    ],
    mantenimientos: [],
    recompensas: [],
    recordatorios: [],
  };
  const s = estadisticas(datos, { desde: "2026-11-01" });
  assert.equal(s.total_servicios, 0);
  assert.equal(s.por_cliente[0].acumulados, 1);
  assert.equal(s.por_cliente[0].faltan, 4);
});
// Proveedor simulado: estas pruebas no envían mensajes ni consultan cuentas externas.
const dbPath = require.resolve("../src/config/supabase");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    from() {
      throw new Error("No se permite consultar una base real en esta prueba.");
    },
  },
};
const {
  enviarProveedor,
  cronAutorizado,
} = require("../src/services/recordatorios.service");
test("correo incluye clave idempotente y no repite un identificador de envío", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.REMINDER_FROM = "RUJIM <test@example.invalid>";
  let recibida;
  const id = await enviarProveedor(
    { id: 7, canal: "email", mensaje: "Mantenimiento" },
    { email: "cliente@example.invalid" },
    async (url, op) => {
      recibida = op;
      return { ok: true, json: async () => ({ id: "email-test" }) };
    },
  );
  assert.equal(id, "email-test");
  assert.equal(recibida.headers["Idempotency-Key"], "rujim-recordatorio-7");
});
test("WhatsApp usa una plantilla oficial y normaliza teléfono peruano", async () => {
  Object.assign(process.env, {
    WHATSAPP_TOKEN: "test-token",
    WHATSAPP_PHONE_NUMBER_ID: "123",
    WHATSAPP_TEMPLATE: "mantenimiento_rujim",
    WHATSAPP_API_VERSION: "v25.0",
  });
  let mensaje;
  await enviarProveedor(
    { id: 1, canal: "whatsapp", mensaje: "Revisión próxima" },
    { nombre: "Cliente", telefono: "999111222" },
    async (url, op) => {
      assert.ok(url.startsWith("https://graph.facebook.com/"));
      mensaje = JSON.parse(op.body);
      return {
        ok: true,
        json: async () => ({ messages: [{ id: "wa-test" }] }),
      };
    },
  );
  assert.equal(mensaje.type, "template");
  assert.equal(mensaje.to, "51999111222");
  assert.equal(mensaje.template.name, "mantenimiento_rujim");
});
test("un rechazo definitivo del proveedor se distingue de un resultado incierto", async () => {
  await assert.rejects(
    enviarProveedor(
      { id: 1, canal: "email", mensaje: "Prueba" },
      { email: "a@example.invalid" },
      async () => ({ ok: false, status: 400, json: async () => ({}) }),
    ),
    (e) => e.definitivo === true,
  );
  await assert.rejects(
    enviarProveedor(
      { id: 1, canal: "email", mensaje: "Prueba" },
      { email: "a@example.invalid" },
      async () => {
        throw new Error("timeout");
      },
    ),
    (e) => !e.definitivo,
  );
});
test("el programador requiere su secreto exacto", () => {
  process.env.CRON_SECRET = "test-secret";
  assert.equal(cronAutorizado(undefined), false);
  assert.equal(cronAutorizado("Bearer otro"), false);
  assert.equal(cronAutorizado("Bearer test-secret"), true);
});
