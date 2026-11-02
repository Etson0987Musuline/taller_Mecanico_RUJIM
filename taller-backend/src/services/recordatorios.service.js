const crypto = require("node:crypto");
const db = require("../config/supabase");
const { panel, filas } = require("./programa.service");
const { estadoMantenimiento } = require("../utils/programa");
async function publicarInternos() {
  const pendientes = await filas(() =>
    db
      .from("recordatorios")
      .select("id,cliente_id")
      .eq("canal", "interna")
      .eq("estado", "pendiente")
      .lte("programado_at", new Date().toISOString())
      .order("id"),
  );
  for (const r of pendientes) {
    const { data: p, error: pe } = await db
      .from("preferencias_comunicacion")
      .select("interna")
      .eq("cliente_id", r.cliente_id)
      .maybeSingle();
    if (pe) throw pe;
    const { error } = await db
      .from("recordatorios")
      .update({
        estado: p?.interna === false ? "cancelado" : "enviado",
        enviado_at: p?.interna === false ? null : new Date().toISOString(),
      })
      .eq("id", r.id)
      .eq("estado", "pendiente");
    if (error) throw error;
  }
}
async function generar() {
  const datos = await panel({ id: 0, rol: "admin" });
  const preferencias = await filas(() =>
    db.from("preferencias_comunicacion").select("*").order("cliente_id"),
  );
  let generados = 0;
  for (const m of datos.mantenimientos.filter((m) => m.estado !== "al_dia")) {
    const pref = preferencias.find((p) => p.cliente_id === m.cliente_id) || {
      interna: true,
    };
    const mensaje = `Estimado cliente, su vehículo ${m.placa} requiere atención de ${m.componente}. Estado: ${m.estado}. Le recomendamos programar su próximo mantenimiento. Gracias por confiar en Taller RUJIM.`;
    for (const canal of ["interna", "email", "whatsapp"].filter(
      (c) => pref[c],
    )) {
      const clave = `m:${m.id}:${m.proxima_fecha}:${m.proximo_km}:${m.estado}:${canal}`;
      const { data, error } = await db
        .from("recordatorios")
        .upsert(
          {
            cliente_id: m.cliente_id,
            vehiculo_id: m.vehiculo_id,
            mantenimiento_id: m.id,
            clave,
            canal,
            mensaje,
            estado: canal === "interna" ? "enviado" : "pendiente",
            enviado_at: canal === "interna" ? new Date().toISOString() : null,
          },
          { onConflict: "clave", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      generados += data.length;
    }
  }
  return generados;
}
async function enviarProveedor(r, cliente, fetcher = fetch) {
  if (r.canal === "email") {
    if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM)
      throw Object.assign(
        new Error("Configura Resend y el remitente verificado."),
        { definitivo: true },
      );
    if (!cliente.email)
      throw Object.assign(new Error("El cliente no tiene correo registrado."), {
        definitivo: true,
      });
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `rujim-recordatorio-${r.id}`,
      },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM,
        to: [cliente.email],
        subject: "Recordatorio de mantenimiento · Taller RUJIM",
        text: r.mensaje,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(`Resend rechazó el envío (${response.status}).`),
        {
          definitivo:
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 408 &&
            response.status !== 429,
        },
      );
    if (!data.id) throw new Error("Respuesta del proveedor sin identificador.");
    return data.id;
  }
  if (r.canal === "whatsapp") {
    const {
      WHATSAPP_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_TEMPLATE,
      WHATSAPP_API_VERSION,
    } = process.env;
    if (
      !WHATSAPP_TOKEN ||
      !WHATSAPP_PHONE_NUMBER_ID ||
      !WHATSAPP_TEMPLATE ||
      !/^v\d+\.\d+$/.test(WHATSAPP_API_VERSION || "")
    )
      throw Object.assign(
        new Error(
          "Configura WhatsApp Cloud API, versión y plantilla aprobada.",
        ),
        { definitivo: true },
      );
    let phone = (cliente.telefono || "").replace(/\D/g, "");
    if (phone.length === 9) phone = "51" + phone;
    if (!/^\d{10,15}$/.test(phone))
      throw Object.assign(new Error("El teléfono del cliente no es válido."), {
        definitivo: true,
      });
    const response = await fetcher(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE,
            language: {
              code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es_PE",
            },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: cliente.nombre },
                  { type: "text", text: r.mensaje },
                ],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(`WhatsApp rechazó el envío (${response.status}).`),
        {
          definitivo:
            response.status >= 400 &&
            response.status < 500 &&
            response.status !== 408 &&
            response.status !== 429,
        },
      );
    if (!data.messages?.[0]?.id)
      throw new Error("Respuesta del proveedor sin identificador.");
    return data.messages[0].id;
  }
  throw Object.assign(new Error("Canal no válido."), { definitivo: true });
}
async function procesar() {
  await publicarInternos();
  // Un envío interrumpido puede haber llegado al proveedor: revisión manual, sin reenvío automático.
  const { error: stale } = await db
    .from("recordatorios")
    .update({
      estado: "revisar",
      error:
        "Envío interrumpido. Verificar en el proveedor antes de cualquier reenvío.",
    })
    .eq("estado", "procesando")
    .lt("updated_at", new Date(Date.now() - 10 * 60000).toISOString());
  if (stale) throw stale;
  const resumen = { enviados: 0, errores: 0, cancelados: 0 };
  const inicio = Date.now();
  for (let n = 0; n < 10 && Date.now() - inicio < 35000; n++) {
    const { data: cola, error } = await db.rpc("tomar_recordatorios", {
      p_limite: 1,
    });
    if (error) throw error;
    if (!cola.length) break;
    const r = cola[0];
    try {
      const { data: pref, error: pe } = await db
        .from("preferencias_comunicacion")
        .select("email,whatsapp")
        .eq("cliente_id", r.cliente_id)
        .maybeSingle();
      if (pe) throw pe;
      if (!pref?.[r.canal]) {
        const { error: e } = await db
          .from("recordatorios")
          .update({
            estado: "cancelado",
            error: "Canal desactivado por el cliente.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        if (e) throw e;
        resumen.cancelados++;
        continue;
      }
      if (r.vehiculo_id) {
        const { data: v, error: ve } = await db
          .from("vehiculos")
          .select("cliente_id,km_ingreso")
          .eq("id", r.vehiculo_id)
          .single();
        if (ve) throw ve;
        let vigente = v.cliente_id === r.cliente_id;
        if (r.mantenimiento_id) {
          const { data: m, error: me } = await db
            .from("mantenimientos")
            .select("*,tipos_mantenimiento(aviso_dias,aviso_km)")
            .eq("id", r.mantenimiento_id)
            .single();
          if (me) throw me;
          const estado = estadoMantenimiento(
            { ...m, ...m.tipos_mantenimiento },
            v.km_ingreso,
          );
          vigente =
            vigente &&
            r.clave ===
              `m:${m.id}:${m.proxima_fecha}:${m.proximo_km}:${estado}:${r.canal}` &&
            estado !== "al_dia";
        }
        if (!vigente) {
          const { error: e } = await db
            .from("recordatorios")
            .update({
              estado: "cancelado",
              error: "El mantenimiento o la propiedad del vehículo cambió.",
            })
            .eq("id", r.id);
          if (e) throw e;
          resumen.cancelados++;
          continue;
        }
      }
      const { data: cliente, error: ce } = await db
        .from("clientes")
        .select("nombre,email,telefono")
        .eq("id", r.cliente_id)
        .single();
      if (ce) throw ce;
      const id = await enviarProveedor(r, cliente);
      const { error: ue } = await db
        .from("recordatorios")
        .update({
          estado: "enviado",
          proveedor_id: id,
          enviado_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", r.id);
      if (ue) throw ue;
      resumen.enviados++;
    } catch (e) {
      const { error: ue } = await db
        .from("recordatorios")
        .update({
          estado: e.definitivo ? "error" : "revisar",
          error: e.definitivo
            ? e.message
            : "Resultado incierto. Revisa el proveedor antes de reenviar.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (ue) throw ue;
      resumen.errores++;
    }
  }
  return resumen;
}
function cronAutorizado(header) {
  const secret = process.env.CRON_SECRET,
    esperado = `Bearer ${secret}`;
  return (
    !!secret &&
    typeof header === "string" &&
    Buffer.byteLength(header) === Buffer.byteLength(esperado) &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(esperado))
  );
}
module.exports = {
  generar,
  procesar,
  enviarProveedor,
  cronAutorizado,
  publicarInternos,
};
