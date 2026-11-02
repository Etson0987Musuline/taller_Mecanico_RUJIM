const supabase = require('../config/cotizaciones-db');
const { validarCotizacion, nuevoToken } = require('../utils/cotizaciones');
const camposPublicos = 'codigo,descripcion,items,subtotal,igv,total,estado,vence_at,respondido_at,aprobado_por,created_at';
const tokenValido = token => /^[a-f0-9]{64}$/.test(token || '');

exports.listar = async (req, res) => {
  const { data, error } = await supabase.from('cotizaciones').select('*, vehiculos(placa,marca,modelo,clientes(nombre,apellido))').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ mensaje: 'No se pudieron cargar las cotizaciones. Verifica que la migración esté instalada.' });
  res.json(data);
};
exports.crear = async (req, res) => {
  let datos;
  try { datos = validarCotizacion(req.body); } catch (e) { return res.status(400).json({ mensaje: e.message }); }
  const { data: vehiculo, error: errorVehiculo } = await supabase.from('vehiculos').select('id').eq('id', datos.vehiculo_id).single();
  if (errorVehiculo || !vehiculo) return res.status(400).json({ mensaje: 'El vehículo no existe.' });
  const ids = [...new Set(datos.items.filter(i => i.tipo === 'repuesto').map(i => i.repuesto_id))];
  if (ids.length) {
    const { data, error } = await supabase.from('repuestos').select('id,nombre').in('id', ids).eq('activo', true);
    if (error || data.length !== ids.length) return res.status(400).json({ mensaje: 'Hay repuestos inexistentes o inactivos.' });
    datos.items = datos.items.map(i => i.tipo === 'repuesto' ? { ...i, descripcion: data.find(r => r.id === i.repuesto_id).nombre } : i);
  }
  const { data, error } = await supabase.from('cotizaciones').insert({ ...datos, token: nuevoToken(), creado_por: req.usuario.id }).select().single();
  if (error) return res.status(500).json({ mensaje: 'No se pudo guardar la cotización.' });
  res.status(201).json(data);
};
exports.consultar = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!tokenValido(req.params.token)) return res.status(404).json({ mensaje: 'Enlace no válido.' });
  const { data, error } = await supabase.from('cotizaciones').select(camposPublicos).eq('token', req.params.token).maybeSingle();
  if (error) return res.status(500).json({ mensaje: 'No se pudo consultar el presupuesto.' });
  if (!data) return res.status(404).json({ mensaje: 'Cotización no encontrada.' });
  // No publicar identificadores internos del inventario.
  data.items = data.items.map(({ repuesto_id, ...item }) => item);
  res.json(data);
};
exports.responder = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { decision, nombre, consentimiento } = req.body;
  if (!tokenValido(req.params.token) || !['aprobada', 'rechazada'].includes(decision) || typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.length > 150 || consentimiento !== true) return res.status(400).json({ mensaje: 'Indica tu nombre y confirma tu decisión.' });
  const { data, error } = await supabase.from('cotizaciones').update({ estado: decision, aprobado_por: nombre.trim(), respondido_at: new Date().toISOString() }).eq('token', req.params.token).eq('estado', 'pendiente').gt('vence_at', new Date().toISOString()).select(camposPublicos).maybeSingle();
  if (error) return res.status(500).json({ mensaje: 'No se pudo registrar tu respuesta.' });
  if (!data) return res.status(409).json({ mensaje: 'La cotización venció o ya tiene una respuesta. Actualiza la página.' });
  data.items = data.items.map(({ repuesto_id, ...item }) => item);
  res.json(data);
};
exports.convertir = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ mensaje: 'Cotización no válida.' });
  const { data, error } = await supabase.rpc('convertir_cotizacion', { p_id: Number(req.params.id), p_usuario: req.usuario.id });
  if (error) return res.status(error.code === 'P0001' ? 409 : 500).json({ mensaje: error.code === 'P0001' ? error.message : 'No se pudo crear la orden. Intenta nuevamente.' });
  res.json(data);
};
exports.anular = async (req, res) => {
  const { data, error } = await supabase.from('cotizaciones').update({ estado: 'anulada' }).eq('id', req.params.id).eq('estado', 'pendiente').select('id').maybeSingle();
  if (error) return res.status(500).json({ mensaje: 'No se pudo anular la cotización.' });
  if (!data) return res.status(409).json({ mensaje: 'Solo se pueden anular cotizaciones pendientes. Actualiza la lista.' });
  res.json({ mensaje: 'Cotización anulada. El enlace ya no permite responder.' });
};
