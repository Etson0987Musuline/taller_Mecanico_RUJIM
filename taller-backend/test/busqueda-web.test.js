const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearBusquedaWeb } = require('../src/services/busqueda-web.service');
const req = q => ({ query: { q }, usuario: { id: 1 } });
const res = () => ({ status(n) { this.codigo = n; return this; }, json(data) { this.data = data; return this; } });

test('no consulta proveedores sin clave ni con una consulta inválida', async () => {
  let llamadas = 0;
  const buscar = crearBusquedaWeb({ apiKey: () => '', fetcher: async () => { llamadas++; } });
  for (const q of ['', 'ab', ['filtro'], 'a'.repeat(161)]) {
    const respuesta = res(); await buscar(req(q), respuesta); assert.equal(respuesta.codigo, 400);
  }
  const respuesta = res(); await buscar(req('filtro Toyota'), respuesta);
  assert.equal(respuesta.codigo, 503); assert.equal(respuesta.data.codigo, 'BUSQUEDA_WEB_NO_CONFIGURADA'); assert.equal(llamadas, 0);
});

test('consulta Brave con la clave en cabecera y devuelve páginas externas válidas sin duplicarlas', async () => {
  const buscar = crearBusquedaWeb({ apiKey: () => 'clave-de-prueba', fetcher: async (url, options) => {
    assert.equal(url.origin, 'https://api.search.brave.com');
    assert.equal(url.searchParams.get('q'), 'bomba & filtro repuesto automotriz Perú');
    assert.equal(options.headers['X-Subscription-Token'], 'clave-de-prueba');
    assert.ok(!url.href.includes('clave-de-prueba')); assert.ok(options.signal);
    return { ok: true, json: async () => ({ web: { results: [
      { title: '<b>Bomba</b>', description: 'Para Toyota', url: 'https://ejemplo.test/bomba' },
      { title: 'Duplicado', url: 'https://ejemplo.test/bomba' },
      { title: 'No válido', url: 'javascript:alert(1)' },
      { title: 'Credenciales', url: 'https://usuario:clave@ejemplo.test/' },
      { title: 'Otro', url: 'https://otro.test/filtro' },
    ] } }) };
  } });
  const respuesta = res(); await buscar(req(' bomba  & filtro '), respuesta);
  assert.deepEqual(respuesta.data.resultados.map(r => r.titulo), ['Bomba', 'Otro']);
  assert.equal(respuesta.data.fuente, 'Brave Search'); assert.equal(respuesta.data.consulta, 'bomba & filtro');
});

test('distingue cero resultados de un fallo del proveedor sin exponer detalles privados', async () => {
  for (const fetcher of [async () => { throw new Error('clave privada'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ error: 'privado' }) })]) {
    const respuesta = res(); await crearBusquedaWeb({ apiKey: () => 'prueba', fetcher })(req('sensor'), respuesta);
    assert.equal(respuesta.codigo, 503); assert.ok(!JSON.stringify(respuesta.data).includes('privad'));
  }
  const respuesta = res(); await crearBusquedaWeb({ apiKey: () => 'prueba', fetcher: async () => ({ ok: true, json: async () => ({ type: 'search' }) }) })(req('sensor'), respuesta);
  assert.deepEqual(respuesta.data.resultados, []); assert.equal(respuesta.codigo, undefined);
});

test('limita búsquedas por usuario y permite continuar al vencer la ventana', async () => {
  let llamadas = 0, tiempo = 0;
  const buscar = crearBusquedaWeb({ apiKey: () => 'prueba', now: () => tiempo, fetcher: async () => { llamadas++; return { ok: true, json: async () => ({ type: 'search' }) }; } });
  for (let i = 0; i < 10; i++) await buscar(req('sensor'), res());
  const limitada = res(); await buscar(req('sensor'), limitada); assert.equal(limitada.codigo, 429); assert.equal(llamadas, 10);
  await buscar({ ...req('sensor'), usuario: { id: 2 } }, res()); assert.equal(llamadas, 11);
  tiempo = 60000; await buscar(req('sensor'), res()); assert.equal(llamadas, 12);
});
