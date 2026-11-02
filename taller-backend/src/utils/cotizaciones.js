const crypto = require('node:crypto');

function validarCotizacion(body) {
  if (!Number.isSafeInteger(Number(body.vehiculo_id)) || Number(body.vehiculo_id) <= 0) throw new Error('Selecciona un vehículo.');
  if (typeof body.descripcion !== 'string' || !body.descripcion.trim() || body.descripcion.length > 2000) throw new Error('Describe el trabajo (máximo 2000 caracteres).');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new Error('Agrega entre 1 y 100 conceptos.');
  const items = body.items.map(i => {
    const cantidad = Number(i.cantidad), precio = Number(i.precio_unitario);
    if (!['mano_obra', 'repuesto'].includes(i.tipo) || typeof i.descripcion !== 'string' || !i.descripcion.trim() || i.descripcion.length > 150 || !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 10000 || !Number.isFinite(precio) || precio < 0 || precio > 1000000 || Math.abs(precio * 100 - Math.round(precio * 100)) > 0.00001) throw new Error('Revisa descripción, cantidad y precio de los conceptos.');
    const repuesto_id = i.tipo === 'repuesto' ? Number(i.repuesto_id) : null;
    if (i.tipo === 'repuesto' && (!Number.isSafeInteger(repuesto_id) || repuesto_id < 1)) throw new Error('Selecciona un repuesto del inventario.');
    return { tipo: i.tipo, descripcion: i.descripcion.trim(), cantidad, precio_unitario: precio, repuesto_id };
  });
  const centimos = items.reduce((sum, i) => sum + Math.round(i.precio_unitario * 100) * i.cantidad, 0);
  if (centimos <= 0 || centimos > 800000000) throw new Error('El subtotal debe ser mayor a cero y no superar S/ 8,000,000.');
  const igv = Math.round(centimos * 0.18);
  return { vehiculo_id: Number(body.vehiculo_id), descripcion: body.descripcion.trim(), items, subtotal: centimos / 100, igv: igv / 100, total: (centimos + igv) / 100 };
}
function nuevoToken() { return crypto.randomBytes(32).toString('hex'); }
module.exports = { validarCotizacion, nuevoToken };
