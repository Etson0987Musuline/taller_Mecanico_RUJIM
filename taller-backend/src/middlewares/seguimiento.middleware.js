const db = require("../config/supabase");
module.exports = async (req, res, next) => {
  if (req.usuario.rol === "admin") return next();
  try {
    let ids;
    if (req.usuario.rol === "mecanico") {
      const { data, error } = await db
        .from("ordenes_trabajo")
        .select("vehiculo_id")
        .eq("mecanico_id", req.usuario.id);
      if (error) throw error;
      ids = data.map((o) => o.vehiculo_id);
    }
    let q = db.from("vehiculos").select("placa");
    if (req.usuario.rol === "cliente")
      q = q.eq("cliente_id", req.usuario.cliente_id || -1);
    else q = q.in("id", ids.length ? ids : [-1]);
    const { data, error } = await q;
    if (error) throw error;
    req.placasPermitidas = data.length
      ? data.map((v) => v.placa)
      : ["__sin_vehiculos__"];
    next();
  } catch {
    res
      .status(503)
      .json({ mensaje: "No se pudo verificar la propiedad del vehículo." });
  }
};
