function estadoMantenimiento(
  m,
  kmActual,
  hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
) {
  const fecha = m.proxima_fecha || null,
    km = m.proximo_km == null ? null : Number(m.proximo_km);
  const actual = Number(kmActual || 0);
  if ((fecha && fecha < hoy) || (km !== null && actual > km)) return "vencido";
  if ((fecha && fecha === hoy) || (km !== null && actual === km))
    return "pendiente";
  const dias = fecha
    ? Math.round(
        (Date.parse(fecha + "T00:00:00Z") - Date.parse(hoy + "T00:00:00Z")) /
          86400000,
      )
    : Infinity;
  if (
    dias <= Number(m.aviso_dias ?? 14) ||
    (km !== null && km - actual <= Number(m.aviso_km ?? 500))
  )
    return "proximo";
  return "al_dia";
}
function entero(v, min = 1, max = 2147483647) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new Error("Número fuera del rango permitido.");
  return n;
}
function texto(v, max = 2000, requerido = false) {
  if (typeof v !== "string" || v.length > max || (requerido && !v.trim()))
    throw new Error("Revisa los campos de texto.");
  return v.trim();
}
function validarReporte(b) {
  const km = entero(b.km, 0),
    tipo_servicio = texto(b.tipo_servicio, 120, true),
    observaciones = texto(b.observaciones, 4000, true);
  if (
    typeof b.fecha_servicio !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha_servicio) ||
    Number.isNaN(Date.parse(b.fecha_servicio)) ||
    new Date(b.fecha_servicio).toISOString().slice(0, 10) !== b.fecha_servicio
  )
    throw new Error("Fecha de servicio no válida.");
  if (!Array.isArray(b.mantenimientos) || b.mantenimientos.length > 30)
    throw new Error("Revisa los mantenimientos realizados.");
  const vistos = new Set();
  const mantenimientos = b.mantenimientos.map((m) => {
    const tipo_id = entero(m.tipo_id);
    if (vistos.has(tipo_id))
      throw new Error("No repitas componentes de mantenimiento.");
    vistos.add(tipo_id);
    return {
      tipo_id,
      meses: m.meses == null || m.meses === "" ? null : entero(m.meses, 1, 120),
      intervalo_km:
        m.intervalo_km == null || m.intervalo_km === ""
          ? null
          : entero(m.intervalo_km, 1, 1000000),
    };
  });
  return {
    km,
    tipo_servicio,
    observaciones,
    fecha_servicio: b.fecha_servicio,
    fallas: texto(b.fallas || "", 4000),
    recomendaciones: texto(b.recomendaciones || "", 4000),
    mantenimientos,
  };
}
function estadisticas(datos, f = {}) {
  const coincide = (r) =>
    (!f.cliente_id || Number(r.cliente_id) === Number(f.cliente_id)) &&
    (!f.vehiculo_id || Number(r.vehiculo_id) === Number(f.vehiculo_id));
  const reportes = datos.reportes.filter(
    (r) =>
      coincide(r) &&
      (!f.desde || r.fecha_servicio >= f.desde) &&
      (!f.hasta || r.fecha_servicio <= f.hasta) &&
      (!f.tipo || r.tipo_servicio === f.tipo),
  );
  const aprobados = reportes.filter((r) => r.estado === "aprobado");
  const porCliente = datos.clientes
    .filter((c) => !f.cliente_id || c.id === Number(f.cliente_id))
    .map((c) => {
      const historial = datos.reportes.filter(
        (r) => r.cliente_id === c.id && r.estado === "aprobado",
      );
      const n = historial.length;
      const siguiente = datos.reglas
        .filter((r) => r.activo && r.servicios > n)
        .sort((a, b) => a.servicios - b.servicios)[0];
      const ultima =
        historial
          .map((r) => r.fecha_servicio)
          .sort()
          .at(-1) || null;
      return {
        ...c,
        servicios: aprobados.filter((r) => r.cliente_id === c.id).length,
        acumulados: n,
        faltan: siguiente ? siguiente.servicios - n : null,
        siguiente_porcentaje: siguiente?.porcentaje,
        ultima_visita: ultima,
      };
    });
  const clientesReportes = new Set(aprobados.map((r) => r.cliente_id)),
    vehiculosReportes = new Set(aprobados.map((r) => r.vehiculo_id));
  const filtrarTipo = (r) =>
    !f.tipo ||
    (r.vehiculo_id
      ? vehiculosReportes.has(r.vehiculo_id)
      : clientesReportes.has(r.cliente_id));
  const premios = datos.recompensas.filter(
    (r) =>
      coincide(r) &&
      filtrarTipo(r) &&
      (!f.desde || r.created_at.slice(0, 10) >= f.desde) &&
      (!f.hasta || r.created_at.slice(0, 10) <= f.hasta),
  );
  const mantenimientos = datos.mantenimientos.filter(
    (r) =>
      coincide(r) &&
      filtrarTipo(r) &&
      (!f.desde || !r.proxima_fecha || r.proxima_fecha >= f.desde) &&
      (!f.hasta || !r.proxima_fecha || r.proxima_fecha <= f.hasta),
  );
  const recordatorios = datos.recordatorios.filter(
    (r) =>
      coincide(r) &&
      filtrarTipo(r) &&
      (!f.desde || r.programado_at.slice(0, 10) >= f.desde) &&
      (!f.hasta || r.programado_at.slice(0, 10) <= f.hasta),
  );
  const limite = new Date(Date.now() - 180 * 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    total_servicios: aprobados.length,
    por_cliente: porCliente,
    recompensas_generadas: premios.length,
    recompensas_utilizadas: premios.filter((r) => r.usada_at).length,
    mantenimientos_proximos: mantenimientos.filter((m) =>
      ["proximo", "pendiente"].includes(m.estado),
    ).length,
    mantenimientos_vencidos: mantenimientos.filter(
      (m) => m.estado === "vencido",
    ).length,
    recordatorios_enviados: recordatorios.filter((r) =>
      ["enviado", "completado"].includes(r.estado),
    ).length,
    recordatorios_pendientes: recordatorios.filter(
      (r) => r.estado === "pendiente",
    ).length,
    clientes_inactivos: porCliente.filter(
      (c) => c.ultima_visita && c.ultima_visita < limite,
    ),
    proximos_descuento: porCliente.filter(
      (c) => c.faltan != null && c.faltan <= 2,
    ),
  };
}
module.exports = {
  estadoMantenimiento,
  entero,
  texto,
  validarReporte,
  estadisticas,
};
