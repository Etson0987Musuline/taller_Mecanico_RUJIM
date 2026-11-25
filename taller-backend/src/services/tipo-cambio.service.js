const endpoint = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04638PD/json';
let cache;
let consulta;

async function obtenerTipoCambio() {
  if (cache && cache.vence > Date.now()) return cache.dato;
  consulta ??= actualizar().finally(() => { consulta = undefined; });
  return consulta;
}

async function actualizar() {
  const fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' })
    .format(new Date());
  const inicio = new Date(Date.parse(fecha) - 14 * 86400000).toISOString().slice(0, 10);
  const res = await fetch(`${endpoint}/${inicio}/${fecha}/esp`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('BCRP no disponible');
  // BCRP puede añadir diagnósticos HTML después del documento JSON.
  const cuerpo = (await res.text()).trim();
  const html = cuerpo.indexOf('<');
  const { periods } = JSON.parse(html === -1 ? cuerpo : cuerpo.slice(0, html));
  const ultimo = periods?.findLast(p => Number.isFinite(Number(p.values?.[0])) && Number(p.values[0]) > 0);
  if (!ultimo || typeof ultimo.name !== 'string') throw new Error('Sin tipo de cambio publicado');
  const dato = { tasa: Number(ultimo.values[0]), fecha: ultimo.name };
  cache = { dato, vence: Date.now() + 15 * 60 * 1000 };
  return dato;
}

module.exports = { obtenerTipoCambio };
