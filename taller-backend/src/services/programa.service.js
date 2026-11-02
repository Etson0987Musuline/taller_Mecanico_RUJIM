const db = require("../config/supabase");
const { estadoMantenimiento } = require("../utils/programa");
async function filas(factory) {
  const result = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await factory().range(desde, desde + 499);
    if (error) throw error;
    result.push(...data);
    if (data.length < 500) break;
  }
  return result;
}
async function panel(usuario) {
  const cliente = usuario.rol === "cliente",
    mecanico = usuario.rol === "mecanico";
  if (cliente && !usuario.cliente_id)
    throw new Error("La cuenta no tiene una ficha de cliente vinculada.");
  let vehiculos = await filas(() => {
    let q = db
      .from("vehiculos")
      .select("id,cliente_id,placa,marca,modelo,anio,color,km_ingreso,tipo,vin")
      .order("id");
    if (cliente) q = q.eq("cliente_id", usuario.cliente_id);
    return q;
  });
  let ordenes = await filas(() => {
    let q = db
      .from("ordenes_trabajo")
      .select(
        "id,codigo,vehiculo_id,mecanico_id,estado,descripcion_problema,observaciones,km_actual,fecha_ingreso,fecha_estimada,fecha_entrega",
      )
      .order("id");
    if (mecanico) q = q.eq("mecanico_id", usuario.id);
    return q;
  });
  let mantenimientos = await filas(() =>
    db.from("mantenimientos").select("*").order("id"),
  );
  if (mecanico) {
    const ids = new Set([
      ...ordenes.map((o) => o.vehiculo_id),
      ...mantenimientos
        .filter((m) => m.mecanico_id === usuario.id)
        .map((m) => m.vehiculo_id),
    ]);
    vehiculos = vehiculos.filter((v) => ids.has(v.id));
  }
  const vid = new Set(vehiculos.map((v) => v.id));
  ordenes = ordenes.filter((o) => vid.has(o.vehiculo_id));
  mantenimientos = mantenimientos.filter(
    (m) =>
      vid.has(m.vehiculo_id) && (!mecanico || m.mecanico_id === usuario.id),
  );
  const [tipos, reglas, reportesRaw, clientesRaw] = await Promise.all([
    filas(() => db.from("tipos_mantenimiento").select("*").order("id")),
    filas(() => db.from("reglas_fidelidad").select("*").order("servicios")),
    filas(() => {
      let q = db.from("reportes_servicio").select("*").order("id");
      if (cliente) q = q.eq("cliente_id", usuario.cliente_id);
      return q;
    }),
    filas(() => {
      let q = db
        .from("clientes")
        .select("id,nombre,apellido,email,telefono,direccion")
        .order("id");
      if (cliente) q = q.eq("id", usuario.cliente_id);
      return q;
    }),
  ]);
  const clientes = clientesRaw.filter(
    (c) => !mecanico || vehiculos.some((v) => v.cliente_id === c.id),
  );
  const reportes = reportesRaw.filter((r) => vid.has(r.vehiculo_id));
  mantenimientos = mantenimientos.map((m) => {
    const v = vehiculos.find((v) => v.id === m.vehiculo_id),
      tipo = tipos.find((t) => t.id === m.tipo_id);
    return {
      ...m,
      cliente_id: v.cliente_id,
      placa: v.placa,
      componente: tipo?.nombre,
      km_actual: v.km_ingreso,
      estado: estadoMantenimiento(
        { ...m, aviso_dias: tipo?.aviso_dias, aviso_km: tipo?.aviso_km },
        v.km_ingreso,
      ),
    };
  });
  const recompensas = mecanico
    ? []
    : await filas(() => {
        let q = db.from("recompensas").select("*").order("id");
        if (cliente) q = q.eq("cliente_id", usuario.cliente_id);
        return q;
      });
  const recordatorios = mecanico
    ? []
    : await filas(() => {
        let q = db.from("recordatorios").select("*").order("id");
        if (cliente)
          q = q
            .eq("cliente_id", usuario.cliente_id)
            .in("estado", ["enviado", "completado"])
            .lte("programado_at", new Date().toISOString());
        return q;
      });
  const { data: preferencias, error: pe } = cliente
    ? await db
        .from("preferencias_comunicacion")
        .select("email,whatsapp,interna")
        .eq("cliente_id", usuario.cliente_id)
        .maybeSingle()
    : { data: null };
  if (pe) throw pe;
  const personal =
    usuario.rol === "admin"
      ? await filas(() =>
          db
            .from("usuarios")
            .select("id,nombre,rol")
            .eq("activo", true)
            .in("rol", ["admin", "mecanico"])
            .order("id"),
        )
      : [];
  const { data: leidas, error: le } = await db
    .from("alertas_leidas")
    .select("clave")
    .eq("usuario_id", usuario.id);
  if (le) throw le;
  const alertas = mantenimientos
    .filter((m) => m.estado !== "al_dia")
    .map((m) => ({
      clave: `m:${m.id}:${m.proxima_fecha}:${m.proximo_km}:${m.estado}`,
      titulo: `${m.placa}: ${m.componente}`,
      mensaje: `Mantenimiento ${m.estado}. ${m.recomendaciones}`,
      vehiculo_id: m.vehiculo_id,
    }));
  if (mecanico)
    reportes
      .filter((r) => r.recomendaciones || r.fallas || r.estado === "rechazado")
      .forEach((r) =>
        alertas.push({
          clave: `r:${r.id}:${r.estado}`,
          titulo: `Seguimiento de ${vehiculos.find((v) => v.id === r.vehiculo_id)?.placa}`,
          mensaje: [r.fallas, r.recomendaciones, r.motivo_revision]
            .filter(Boolean)
            .join(" · "),
          vehiculo_id: r.vehiculo_id,
        }),
      );
  return {
    usuario,
    clientes,
    vehiculos,
    ordenes,
    reportes,
    reglas,
    tipos,
    mantenimientos,
    recompensas,
    recordatorios: cliente
      ? recordatorios.map(({ error, proveedor_id, clave, ...r }) => r)
      : recordatorios,
    preferencias: preferencias || {
      email: false,
      whatsapp: false,
      interna: true,
    },
    personal,
    alertas: alertas.map((a) => ({
      ...a,
      leida: (leidas || []).some((l) => l.clave === a.clave),
    })),
  };
}
module.exports = { panel, filas };
