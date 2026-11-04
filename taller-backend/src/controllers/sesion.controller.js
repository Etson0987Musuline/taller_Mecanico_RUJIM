const db = require("../config/supabase");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const {
  cookies,
  hash,
  setCookie,
  crearSesion,
  cookieName,
  origenes,
} = require("../utils/session");
const publicUser = (u) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  rol: u.rol,
  cliente_id: u.cliente_id,
});
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 150 ||
    password.length > 200
  )
    return res
      .status(400)
      .json({ mensaje: "Revisa el correo y la contraseña." });
  const clave = hash(
    `${email.trim().toLowerCase()}:${Math.floor(Date.now() / 900000)}`,
  );
  const { data: intentos, error: ie } = await db.rpc("limitar_login", {
    p_clave: clave,
  });
  if (ie)
    return res.status(503).json({
      mensaje:
        "No se pudo validar el acceso. Revisa la configuración del servidor.",
    });
  if (intentos > 10)
    return res.status(429).json({
      mensaje: "Demasiados intentos. Espera 15 minutos antes de reintentar.",
    });
  const { data: u, error } = await db
    .from("usuarios")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("activo", true)
    .maybeSingle();
  if (error)
    return res.status(503).json({
      mensaje:
        "No se pudo iniciar sesión. Verifica la configuración del servidor.",
    });
  if (!u?.password_hash || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ mensaje: "Credenciales incorrectas." });
  try {
    await crearSesion(res, u);
    res.set("Cache-Control", "no-store").json({ usuario: publicUser(u) });
  } catch {
    res.status(503).json({
      mensaje:
        "No se pudo crear la sesión. Instala la migración del programa del taller.",
    });
  }
};
exports.me = (req, res) =>
  res.set("Cache-Control", "no-store").json({ usuario: req.usuario });
exports.logout = async (req, res) => {
  const { error } = await db
    .from("sesiones")
    .delete()
    .eq("token_hash", hash(cookies(req)[cookieName] || ""));
  if (error)
    return res
      .status(503)
      .json({ mensaje: "No se pudo cerrar la sesión. Inténtalo nuevamente." });
  setCookie(res, cookieName, "", 0);
  res.json({ mensaje: "Sesión cerrada." });
};
exports.google = async (req, res) => {
  const volver = (mensaje) => res.set('Cache-Control','no-store').redirect(`${origenes()[0]}/login?error=${encodeURIComponent(mensaje)}`);
  if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_PUBLIC_KEY ||
    !process.env.AUTH_PUBLIC_URL
  )
    return volver('El acceso con Google todavía no está configurado. Contacta al administrador del taller.');
  try {
    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: process.env.SUPABASE_PUBLIC_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return volver('No se pudo comprobar el acceso con Google. Inténtalo nuevamente más tarde.');
    const settings = await response.json();
    if (settings.external?.google !== true)
      return volver('El registro y acceso con Google aún no está habilitado. El administrador debe configurar el proveedor Google en Supabase.');
  } catch {
    return volver('No se pudo conectar con el servicio de acceso. Inténtalo nuevamente más tarde.');
  }
  const verifier = crypto.randomBytes(48).toString("base64url");
  const state = crypto.randomBytes(32).toString("hex");
  setCookie(res, "rujim_pkce", verifier, 600);
  setCookie(res, "rujim_oauth_state", state, 600);
  const callback = `${process.env.AUTH_PUBLIC_URL.replace(/\/$/, "")}/auth/google/callback?state=${state}`;
  const url = new URL(`${process.env.SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", callback);
  url.searchParams.set(
    "code_challenge",
    crypto.createHash("sha256").update(verifier).digest("base64url"),
  );
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("scopes", "openid email profile");
  res.set("Cache-Control", "no-store").redirect(url.toString());
};
exports.googleCallback = async (req, res) => {
  res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
  const cookie = cookies(req);
  setCookie(res, "rujim_pkce", "", 0);
  setCookie(res, "rujim_oauth_state", "", 0);
  const home = origenes()[0];
  try {
    if (
      !cookie.rujim_pkce ||
      !cookie.rujim_oauth_state ||
      typeof req.query.state !== "string" ||
      cookie.rujim_oauth_state !== req.query.state ||
      typeof req.query.code !== "string"
    )
      throw new Error("La solicitud de acceso venció. Intenta nuevamente.");
    const response = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_PUBLIC_KEY,
        },
        body: JSON.stringify({
          auth_code: req.query.code,
          code_verifier: cookie.rujim_pkce,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const session = await response.json();
    if (!response.ok || !session.access_token)
      throw new Error("No se pudo verificar el acceso con Google.");
    const { data, error } = await db.auth.getUser(session.access_token);
    const user = data?.user;
    const identidadGoogle = user?.identities?.find(
      (i) => i.provider === "google",
    )?.identity_data;
    if (
      error ||
      !user?.email_confirmed_at ||
      !user.email ||
      !identidadGoogle ||
      identidadGoogle.email?.toLowerCase() !== user.email.toLowerCase() ||
      ![true, "true"].includes(identidadGoogle.email_verified)
    )
      throw new Error(
        "Se requiere una identidad Google con correo verificado.",
      );
    const { data: u, error: linkError } = await db.rpc("vincular_google", {
      p_uid: user.id,
      p_email: user.email,
      p_nombre: user.user_metadata?.full_name || user.email.split("@")[0],
    });
    if (linkError)
      throw new Error(
        linkError.code === "P0001"
          ? linkError.message
          : "No se pudo vincular la cuenta. Contacta al administrador.",
      );
    await crearSesion(res, u);
    res.redirect(`${home}/login?google=ok`);
  } catch (e) {
    res.redirect(
      `${home}/login?error=${encodeURIComponent(e.message.startsWith("fetch") ? "No se pudo conectar con el proveedor." : e.message)}`,
    );
  }
};
