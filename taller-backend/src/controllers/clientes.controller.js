const supabase = require('../config/supabase');

const getClientes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener clientes' });
  }
};

const getClienteById = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener cliente' });
  }
};

const createCliente = async (req, res) => {
  const { tipo_documento, nombre, apellido, dni, telefono, email, direccion } = req.body;
  if (!nombre) return res.status(400).json({ mensaje: 'El nombre es requerido' });

  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        tipo_documento: tipo_documento || 'dni',
        nombre,
        apellido: apellido || '',
        dni,
        telefono,
        email,
        direccion
      }])
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Cliente creado', id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear cliente' });
  }
};

const updateCliente = async (req, res) => {
  const { tipo_documento, nombre, apellido, dni, telefono, email, direccion } = req.body;
  try {
    const { error } = await supabase
      .from('clientes')
      .update({
        tipo_documento: tipo_documento || 'dni',
        nombre,
        apellido: apellido || '',
        dni,
        telefono,
        email,
        direccion,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Cliente actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar cliente' });
  }
};

const eliminarCliente = async (req, res) => {
  try {
    // Verificar si tiene vehículos asociados
    const { data: vehiculos, error: vErr } = await supabase
      .from('vehiculos')
      .select('id')
      .eq('cliente_id', req.params.id);

    if (vErr) throw vErr;

    if (vehiculos && vehiculos.length > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar: el cliente tiene ${vehiculos.length} vehículo(s) registrado(s). Elimina primero sus vehículos.`
      });
    }

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Cliente eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar cliente' });
  }
};

// ── HISTORIAL DEL CLIENTE ──
const getHistorialCliente = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select(`
        id,
        codigo,
        descripcion_problema,
        estado,
        fecha_ingreso,
        fecha_entrega,
        mano_obra,
        vehiculos!inner (
          placa,
          marca,
          modelo,
          cliente_id
        ),
        usuarios (
          nombre
        ),
        facturas (
          total,
          estado_pago,
          numero
        )
      `)
      .eq('vehiculos.cliente_id', req.params.id)
      .order('fecha_ingreso', { ascending: false });

    if (error) throw error;

    const historial = (data || []).map(ot => {
      const factura = Array.isArray(ot.facturas) ? ot.facturas[0] : ot.facturas;
      return {
        id: ot.id,
        codigo: ot.codigo,
        descripcion: ot.descripcion_problema,
        estado: ot.estado,
        fecha_ingreso: ot.fecha_ingreso,
        fecha_entrega: ot.fecha_entrega,
        mano_obra: ot.mano_obra,
        placa: ot.vehiculos ? ot.vehiculos.placa : null,
        vehiculo: ot.vehiculos ? `${ot.vehiculos.marca} ${ot.vehiculos.modelo}`.trim() : '',
        mecanico: ot.usuarios ? ot.usuarios.nombre : null,
        total: factura?.total || 0,
        estado_pago: factura?.estado_pago || null,
        numero_factura: factura?.numero || null
      };
    });

    res.json(historial);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener historial' });
  }
};

const updateOrdenHistorial = async (req, res) => {
  const { descripcion_problema, estado, mano_obra, fecha_estimada } = req.body;
  try {
    const { error } = await supabase
      .from('ordenes_trabajo')
      .update({
        descripcion_problema,
        estado,
        mano_obra: Number(mano_obra) || 0,
        fecha_estimada: fecha_estimada || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.ordenId);

    if (error) throw error;
    res.json({ mensaje: 'Orden actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar orden' });
  }
};

const deleteOrdenHistorial = async (req, res) => {
  try {
    // Al tener ON DELETE CASCADE configurado en Supabase, eliminar la orden elimina facturas, seguimiento, servicios y repuestos asociados
    const { error } = await supabase
      .from('ordenes_trabajo')
      .delete()
      .eq('id', req.params.ordenId);

    if (error) throw error;
    res.json({ mensaje: 'Orden eliminada del historial' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar orden del historial' });
  }
};

module.exports = {
  getClientes, getClienteById, createCliente, updateCliente,
  eliminarCliente, getHistorialCliente, updateOrdenHistorial, deleteOrdenHistorial
};