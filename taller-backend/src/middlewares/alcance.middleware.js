const db = require("../config/supabase");
async function alcanceOrden(req, res, next) {
  if (!["admin", "mecanico"].includes(req.usuario?.rol))
    return res.status(403).json({ mensaje: "Acceso reservado al personal." });
  const { data: o, error } = await db
    .from("ordenes_trabajo")
    .select("id,mecanico_id,estado")
    .eq("id", req.params.ordenId || req.params.id)
    .maybeSingle();
  if (error)
    return res.status(503).json({ mensaje: "No se pudo validar la orden." });
  if (!o) return res.status(404).json({ mensaje: "Orden no encontrada." });
  if (req.usuario.rol === "mecanico" && o.mecanico_id !== req.usuario.id)
    return res
      .status(403)
      .json({ mensaje: "Esta orden no está asignada a tu cuenta." });
  if (req.method !== "GET") {
    const { data: r, error: re } = await db
      .from("reportes_servicio")
      .select("estado")
      .eq("orden_id", o.id)
      .maybeSingle();
    if (re)
      return res
        .status(503)
        .json({ mensaje: "No se pudo verificar la aprobación del servicio." });
    if (r && r.estado !== "rechazado") {
      const entregar =
        req.usuario.rol === "admin" &&
        req.method === "PATCH" &&
        req.path.endsWith("/estado") &&
        req.body.estado === "entregado" &&
        r.estado === "aprobado";
      if (!entregar)
        return res.status(409).json({
          mensaje:
            "El trabajo reportado está protegido. Devuelve el reporte pendiente antes de corregirlo. Los servicios aprobados conservan su historial.",
        });
    }
    if (
      req.usuario.rol === "mecanico" &&
      req.path.endsWith("/estado") &&
      ["cancelado", "entregado"].includes(req.body.estado)
    )
      return res.status(403).json({
        mensaje: "La cancelación y entrega requieren revisión administrativa.",
      });
  }
  next();
}
async function alcanceVehiculo(req, res, next) {
  if (req.usuario.rol === "admin") return next();
  if (req.usuario.rol !== "mecanico")
    return res.status(403).json({ mensaje: "Acceso reservado al personal." });
  try {
    const { data: ordenes, error } = await db
      .from("ordenes_trabajo")
      .select("vehiculo_id")
      .eq("mecanico_id", req.usuario.id);
    if (error) throw error;
    const { data: mant, error: me } = await db
      .from("mantenimientos")
      .select("vehiculo_id")
      .eq("mecanico_id", req.usuario.id);
    if (me) throw me;
    const ids = [...new Set([...ordenes, ...mant].map((o) => o.vehiculo_id))];
    req.vehiculosPermitidos = ids;
    if (req.method !== "GET")
      return res.status(403).json({
        mensaje:
          "El registro de clientes y vehículos corresponde al administrador.",
      });
    const segmentos = req.originalUrl.split("?")[0].split("/").filter(Boolean),
      modulo = segmentos[1],
      ruta = segmentos.slice(2);
    if (modulo === "vehiculos" && ruta[0] === "placa") {
      const { data, error: ve } = await db
        .from("vehiculos")
        .select("id")
        .eq("placa", decodeURIComponent(ruta[1]))
        .maybeSingle();
      if (ve) throw ve;
      if (!data || !ids.includes(data.id))
        return res.status(403).json({ mensaje: "Vehículo no asignado." });
    }
    if (modulo === "clientes" && ruta[0]) {
      const { data, error: ce } = ids.length
        ? await db.from("vehiculos").select("cliente_id").in("id", ids)
        : { data: [] };
      if (ce) throw ce;
      if (!data.some((v) => v.cliente_id === Number(ruta[0])))
        return res.status(403).json({ mensaje: "Cliente no asignado." });
    }
    if (
      modulo === "vehiculos" &&
      ruta[0] &&
      !["cliente", "placa"].includes(ruta[0]) &&
      !ids.includes(Number(ruta[0]))
    )
      return res.status(403).json({ mensaje: "Vehículo no asignado." });
    next();
  } catch {
    res.status(503).json({ mensaje: "No se pudo validar la asignación." });
  }
}
module.exports = { alcanceOrden, alcanceVehiculo };
