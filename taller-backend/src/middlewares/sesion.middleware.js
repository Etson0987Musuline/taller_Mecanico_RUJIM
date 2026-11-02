const db = require("../config/supabase");
const { cookies, hash, cookieName } = require("../utils/session");
const verificarToken = async (req, res, next) => {
  if (req.sesionId && req.usuario) return next();
  const token = cookies(req)[cookieName];
  if (!/^[a-f0-9]{64}$/.test(token || ""))
    return res.status(401).json({ mensaje: "Inicia sesión para continuar." });
  try {
    const { data, error } = await db
      .from("sesiones")
      .select("id,usuario_id")
      .eq("token_hash", hash(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error)
      return res.status(503).json({ mensaje: "No se pudo validar la sesión." });
    if (!data)
      return res.status(401).json({ mensaje: "Sesión vencida o cerrada." });
    const { data: u, error: err } = await db
      .from("usuarios")
      .select("id,nombre,email,rol,cliente_id")
      .eq("id", data.usuario_id)
      .eq("activo", true)
      .maybeSingle();
    if (err)
      return res
        .status(503)
        .json({ mensaje: "No se pudo validar el usuario." });
    if (!u) return res.status(401).json({ mensaje: "Cuenta desactivada." });
    req.usuario = u;
    req.sesionId = data.id;
    next();
  } catch {
    res.status(503).json({ mensaje: "No se pudo validar la sesión." });
  }
};
const roles =
  (...permitidos) =>
  (req, res, next) =>
    permitidos.includes(req.usuario?.rol)
      ? next()
      : res
          .status(403)
          .json({ mensaje: "No tienes permiso para esta operación." });
const soloAdmin = roles("admin");
const soloPersonal = roles("admin", "mecanico");
module.exports = { verificarToken, soloAdmin, soloPersonal, roles };
