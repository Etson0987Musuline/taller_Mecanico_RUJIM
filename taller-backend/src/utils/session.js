const crypto = require("node:crypto");
const db = require("../config/supabase");
const cookieName = "rujim_session";
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((c) => c.trim().split(/=(.*)/s))
      .filter((c) => c[0])
      .map(([k, v]) => [k, v || ""]),
  );
}
const secure = () =>
  process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
function setCookie(res, name, value, age, path = "/api") {
  res.append(
    "Set-Cookie",
    `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${secure() ? "; Secure" : ""}`,
  );
}
async function crearSesion(res, usuario) {
  const token = crypto.randomBytes(32).toString("hex");
  const { error } = await db
    .from("sesiones")
    .insert({
      usuario_id: usuario.id,
      token_hash: hash(token),
      expires_at: new Date(Date.now() + 8 * 3600000).toISOString(),
    });
  if (error) throw error;
  setCookie(res, cookieName, token, 8 * 3600);
}
function origenes() {
  return (process.env.FRONTEND_URL || "http://localhost:4200")
    .split(",")
    .map((x) => x.trim().replace(/\/$/, ""));
}
function protegerOrigen(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers.origin && !origenes().includes(req.headers.origin))
    return res.status(403).json({ mensaje: "Origen no permitido." });
  if (req.headers.cookie?.includes(cookieName + "=") && !req.headers.origin)
    return res
      .status(403)
      .json({ mensaje: "Origen requerido para esta operación." });
  next();
}
module.exports = {
  cookies,
  hash,
  setCookie,
  crearSesion,
  origenes,
  protegerOrigen,
  cookieName,
};
