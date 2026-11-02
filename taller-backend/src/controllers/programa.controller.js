const db = require("../config/supabase");
const { panel } = require("../services/programa.service");
const {
  entero,
  texto,
  validarReporte,
  estadisticas,
} = require("../utils/programa");
const recordatorios = require("../services/recordatorios.service");
function fallo(res, e) {
  return res
    .status(e.code === "P0001" || e.validacion ? 400 : 503)
    .json({
      mensaje:
        e.code === "P0001" || e.validacion
          ? e.message
          : "No se pudo completar la operación. Verifica la migración y la configuración del servidor.",
    });
}
async function auditar(u, accion, entidad, id, detalle = {}) {
  const { error } = await db
    .from("auditoria")
    .insert({
      usuario_id: u.id,
      accion,
      entidad,
      entidad_id: String(id),
      detalle,
    });
  if (error) throw error;
}
exports.panel = async (req, res) => {
  try {
    res.json(await panel(req.usuario));
  } catch (e) {
    fallo(res, e);
  }
};
exports.estadisticas = async (req, res) => {
  try {
    res.json(estadisticas(await panel(req.usuario), req.query));
  } catch (e) {
    fallo(res, e);
  }
};
exports.reportar = async (req, res) => {
  try {
    let datos, id;
    try {
      datos = validarReporte(req.body);
      id = entero(req.params.id);
    } catch (e) {
      e.validacion = true;
      throw e;
    }
    const { data, error } = await db.rpc("reportar_servicio", {
      p_orden: id,
      p_usuario: req.usuario.id,
      p_datos: datos,
    });
    if (error) throw error;
    res
      .status(201)
      .json({ id: data, mensaje: "Servicio reportado para aprobación." });
  } catch (e) {
    fallo(res, e);
  }
};
exports.revisar = async (req, res) => {
  try {
    if (typeof req.body.aprobar !== "boolean")
      return res.status(400).json({ mensaje: "Indica la decisión." });
    const { data, error } = await db.rpc("revisar_servicio", {
      p_id: entero(req.params.id),
      p_admin: req.usuario.id,
      p_aprobar: req.body.aprobar,
      p_motivo: texto(req.body.motivo || "", 2000),
    });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fallo(res, e);
  }
};
exports.regla = async (req, res) => {
  try {
    const b = req.body,
      servicios = entero(b.servicios, 1, 100000),
      vigencia_dias = entero(b.vigencia_dias, 1, 3650),
      porcentaje = Number(b.porcentaje);
    if (
      !Number.isFinite(porcentaje) ||
      porcentaje <= 0 ||
      porcentaje > 100 ||
      typeof b.activo !== "boolean"
    )
      return res
        .status(400)
        .json({ mensaje: "Revisa el porcentaje y el estado de la regla." });
    const datos = { servicios, vigencia_dias, porcentaje, activo: b.activo };
    const { data, error } = req.params.id
      ? await db
          .from("reglas_fidelidad")
          .update(datos)
          .eq("id", entero(req.params.id))
          .select()
          .single()
      : await db.from("reglas_fidelidad").insert(datos).select().single();
    if (error) {
      if (error.code === "23505")
        return res
          .status(409)
          .json({
            mensaje: "Ya existe una regla para esa cantidad de servicios.",
          });
      throw error;
    }
    await auditar(
      req.usuario,
      "configurar_fidelidad",
      "reglas_fidelidad",
      data.id,
      datos,
    );
    res.json(data);
  } catch (e) {
    e.validacion = e instanceof Error && !e.code;
    fallo(res, e);
  }
};
exports.tipo = async (req, res) => {
  try {
    const b = req.body,
      datos = {
        nombre: texto(b.nombre, 120, true),
        meses:
          b.meses == null || b.meses === "" ? null : entero(b.meses, 1, 120),
        km: b.km == null || b.km === "" ? null : entero(b.km, 1, 1000000),
        aviso_dias: entero(b.aviso_dias, 0, 365),
        aviso_km: entero(b.aviso_km, 0, 100000),
        activo: b.activo === true,
      };
    if (!datos.meses && !datos.km)
      return res
        .status(400)
        .json({ mensaje: "Configura al menos un intervalo." });
    const { data, error } = req.params.id
      ? await db
          .from("tipos_mantenimiento")
          .update(datos)
          .eq("id", entero(req.params.id))
          .select()
          .single()
      : await db.from("tipos_mantenimiento").insert(datos).select().single();
    if (error) throw error;
    await auditar(
      req.usuario,
      "configurar_intervalo",
      "tipos_mantenimiento",
      data.id,
      datos,
    );
    res.json(data);
  } catch (e) {
    e.validacion = e instanceof Error && !e.code;
    fallo(res, e);
  }
};
exports.mantenimiento = async (req, res) => {
  try {
    const b = req.body,
      vehiculo_id = entero(b.vehiculo_id),
      tipo_id = entero(b.tipo_id),
      ultimo_km = entero(b.ultimo_km, 0),
      meses =
        b.meses == null || b.meses === "" ? null : entero(b.meses, 1, 120),
      intervalo_km =
        b.intervalo_km == null || b.intervalo_km === ""
          ? null
          : entero(b.intervalo_km, 1, 1000000);
    if (!meses && !intervalo_km)
      return res
        .status(400)
        .json({ mensaje: "Configura un intervalo por fecha o kilometraje." });
    const fecha = texto(b.ultima_fecha, 10, true);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      Number.isNaN(Date.parse(fecha)) ||
      new Date(fecha).toISOString().slice(0, 10) !== fecha ||
      fecha >
        new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" })
    )
      return res.status(400).json({ mensaje: "Fecha no válida." });
    const mecanico_id = b.mecanico_id ? entero(b.mecanico_id) : null;
    if (mecanico_id) {
      const { data, error } = await db
        .from("usuarios")
        .select("id")
        .eq("id", mecanico_id)
        .eq("activo", true)
        .in("rol", ["mecanico", "admin"])
        .single();
      if (error || !data)
        return res
          .status(400)
          .json({ mensaje: "Selecciona un responsable activo." });
    }
    const { data: v, error: ve } = await db
      .from("vehiculos")
      .select("id,km_ingreso")
      .eq("id", vehiculo_id)
      .single();
    if (ve) throw ve;
    if (ultimo_km > v.km_ingreso)
      return res
        .status(400)
        .json({
          mensaje: "Actualiza primero el kilometraje actual del vehículo.",
        });
    // PostgreSQL calcula los meses naturales y conserva el final de mes.
    const { data, error } = await db.rpc("programar_mantenimiento", {
      p_admin: req.usuario.id,
      p_vehiculo: vehiculo_id,
      p_tipo: tipo_id,
      p_fecha: fecha,
      p_km: ultimo_km,
      p_meses: meses,
      p_intervalo: intervalo_km,
      p_mecanico: mecanico_id,
      p_recomendaciones: texto(b.recomendaciones || "", 4000),
    });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    e.validacion = e instanceof Error && !e.code;
    fallo(res, e);
  }
};
exports.kilometraje = async (req, res) => {
  try {
    const km = entero(req.body.km, 0),
      id = entero(req.params.id);
    const datos = await panel(req.usuario);
    if (!datos.vehiculos.some((v) => v.id === id))
      return res.status(403).json({ mensaje: "Vehículo no asignado." });
    const { data, error } = await db
      .from("vehiculos")
      .update({ km_ingreso: km })
      .eq("id", id)
      .lte("km_ingreso", km)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return res
        .status(409)
        .json({ mensaje: "El kilometraje no puede retroceder." });
    await auditar(req.usuario, "actualizar_kilometraje", "vehiculos", id, {
      km,
    });
    res.json({ mensaje: "Kilometraje actualizado." });
  } catch (e) {
    e.validacion = e instanceof Error && !e.code;
    fallo(res, e);
  }
};
exports.preferencias = async (req, res) => {
  if (
    !req.usuario.cliente_id ||
    !["email", "whatsapp", "interna"].every(
      (k) => typeof req.body[k] === "boolean",
    )
  )
    return res.status(400).json({ mensaje: "Preferencias no válidas." });
  const { error } = await db
    .from("preferencias_comunicacion")
    .upsert({
      cliente_id: req.usuario.cliente_id,
      email: req.body.email,
      whatsapp: req.body.whatsapp,
      interna: req.body.interna,
      updated_at: new Date().toISOString(),
    });
  if (error) return fallo(res, error);
  res.json({ mensaje: "Preferencias guardadas." });
};
exports.perfil = async (req, res) => {
  try {
    if (!req.usuario.cliente_id)
      return res.status(403).json({ mensaje: "No hay ficha vinculada." });
    const datos = {
      telefono: texto(req.body.telefono || "", 20),
      direccion: texto(req.body.direccion || "", 255),
    };
    const { error } = await db
      .from("clientes")
      .update(datos)
      .eq("id", req.usuario.cliente_id);
    if (error) throw error;
    res.json({ mensaje: "Datos de contacto actualizados." });
  } catch (e) {
    e.validacion = e instanceof Error && !e.code;
    fallo(res, e);
  }
};
exports.leerAlerta = async (req, res) => {
  try {
    const clave = texto(req.body.clave, 200, true);
    const datos = await panel(req.usuario);
    if (!datos.alertas.some((a) => a.clave === clave))
      return res.status(404).json({ mensaje: "Alerta no encontrada." });
    const { error } = await db
      .from("alertas_leidas")
      .upsert(
        { usuario_id: req.usuario.id, clave },
        { onConflict: "usuario_id,clave" },
      );
    if (error) throw error;
    res.json({ mensaje: "Alerta leída." });
  } catch (e) {
    fallo(res, e);
  }
};
exports.crearRecordatorio = async (req, res) => {
  try {
    const b = req.body,
      cliente_id = entero(b.cliente_id),
      canal = b.canal;
    if (!["email", "whatsapp", "interna"].includes(canal))
      return res.status(400).json({ mensaje: "Canal no válido." });
    const at = new Date(b.programado_at);
    if (!b.programado_at || Number.isNaN(at.getTime()))
      return res
        .status(400)
        .json({ mensaje: "Fecha de programación no válida." });
    const vehiculo_id = b.vehiculo_id ? entero(b.vehiculo_id) : null;
    if (vehiculo_id) {
      const { data, error } = await db
        .from("vehiculos")
        .select("id")
        .eq("id", vehiculo_id)
        .eq("cliente_id", cliente_id)
        .single();
      if (error || !data)
        return res
          .status(400)
          .json({ mensaje: "El vehículo no pertenece a ese cliente." });
    }
    const { data, error } = await db
      .from("recordatorios")
      .insert({
        cliente_id,
        vehiculo_id,
        clave: `manual:${require("node:crypto").randomUUID()}`,
        canal,
        mensaje: texto(b.mensaje, 1000, true),
        programado_at: at.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    await auditar(
      req.usuario,
      "programar_recordatorio",
      "recordatorios",
      data.id,
    );
    res.status(201).json(data);
  } catch (e) {
    e.validacion = e instanceof Error && !e.code;
    fallo(res, e);
  }
};
exports.actualizarRecordatorio = async (req, res) => {
  try {
    const id = entero(req.params.id);
    if (req.usuario.rol === "cliente") {
      const { data, error } = await db
        .from("recordatorios")
        .update({ leido_at: new Date().toISOString() })
        .eq("id", id)
        .eq("cliente_id", req.usuario.cliente_id)
        .eq("canal", "interna")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return res.status(404).json({ mensaje: "Notificación no encontrada." });
      return res.json(data);
    }
    const estado = req.body.estado;
    if (!["pendiente", "completado", "cancelado"].includes(estado))
      return res.status(400).json({ mensaje: "Estado no válido." });
    // Reintentar solo rechazos definitivos; un resultado incierto no se reenvía.
    const permitidos =
      estado === "pendiente"
        ? ["error"]
        : ["pendiente", "error", "revisar", "enviado"];
    const { data, error } = await db
      .from("recordatorios")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("estado", permitidos)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return res
        .status(409)
        .json({ mensaje: "Este recordatorio no admite esa transición." });
    await auditar(req.usuario, "actualizar_recordatorio", "recordatorios", id, {
      estado,
    });
    res.json(data);
  } catch (e) {
    fallo(res, e);
  }
};
exports.generar = async (req, res) => {
  try {
    res.json({ generados: await recordatorios.generar() });
  } catch (e) {
    fallo(res, e);
  }
};
exports.procesar = async (req, res) => {
  try {
    res.json(await recordatorios.procesar());
  } catch (e) {
    fallo(res, e);
  }
};
exports.cron = async (req, res) => {
  if (!recordatorios.cronAutorizado(req.headers.authorization))
    return res.status(401).json({ mensaje: "No autorizado." });
  try {
    const { error: se } = await db
      .from("sesiones")
      .delete()
      .lt("expires_at", new Date().toISOString());
    if (se) throw se;
    const { error: ie } = await db
      .from("intentos_login")
      .delete()
      .lt("created_at", new Date(Date.now() - 86400000).toISOString());
    if (ie) throw ie;
    res.json({
      generados: await recordatorios.generar(),
      ...(await recordatorios.procesar()),
    });
  } catch (e) {
    fallo(res, e);
  }
};
