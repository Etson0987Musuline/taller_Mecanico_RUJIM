const endpoint = 'https://api.search.brave.com/res/v1/web/search';

function limpiarTexto(value, maximo) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, maximo) : '';
}

// No se consulta el inventario ni se envían datos de clientes al proveedor.
function crearBusquedaWeb({ fetcher = fetch, apiKey = () => process.env.BRAVE_SEARCH_API_KEY, now = Date.now } = {}) {
  const limites = new Map();
  return async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.replace(/\s+/g, ' ').trim() : '';
    if (q.length < 3 || q.length > 160) return res.status(400).json({ mensaje: 'Escribe entre 3 y 160 caracteres para buscar en internet.' });
    const key = apiKey()?.trim();
    if (!key) return res.status(503).json({ codigo: 'BUSQUEDA_WEB_NO_CONFIGURADA', mensaje: 'La búsqueda en internet todavía no está habilitada. El administrador debe configurar el proveedor.' });
    const tiempo = now();
    for (const [id, ventana] of limites) if (ventana.hasta <= tiempo) limites.delete(id);
    const id = req.usuario.id;
    const ventana = limites.get(id) || { hasta: tiempo + 60000, consultas: 0 };
    if (ventana.consultas >= 10) return res.status(429).json({ mensaje: 'Espera un minuto antes de realizar más búsquedas en internet.' });
    ventana.consultas++; limites.set(id, ventana);
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ q: `${q} repuesto automotriz Perú`, count: '6', search_lang: 'es', country: 'ALL', safesearch: 'moderate', text_decorations: 'false' }).toString();
    try {
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': key },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) return res.status(503).json({ mensaje: 'El proveedor de búsqueda no está disponible. Intenta nuevamente más tarde.' });
      const data = await response.json();
      if (!data || !Array.isArray(data.web?.results)) {
        // Brave puede omitir el bloque web cuando no encuentra páginas.
        if (data?.type !== 'search') throw new Error('Respuesta no válida');
        return res.json({ consulta: q, fuente: 'Brave Search', resultados: [] });
      }
      const usados = new Set();
      const resultados = [];
      for (const item of data.web.results) {
        if (!item || typeof item.url !== 'string') continue;
        let enlace;
        try { enlace = new URL(item.url); } catch { continue; }
        if (!['https:', 'http:'].includes(enlace.protocol) || enlace.username || enlace.password || usados.has(enlace.href)) continue;
        const titulo = limpiarTexto(item.title, 200);
        if (!titulo) continue;
        usados.add(enlace.href);
        resultados.push({ titulo, descripcion: limpiarTexto(item.description, 500), url: enlace.href, dominio: enlace.hostname });
        if (resultados.length === 6) break;
      }
      res.json({ consulta: q, fuente: 'Brave Search', resultados });
    } catch {
      res.status(503).json({ mensaje: 'No se pudieron obtener sugerencias de internet. Intenta nuevamente más tarde.' });
    }
  };
}

module.exports = { crearBusquedaWeb };
