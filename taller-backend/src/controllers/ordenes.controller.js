const supabase = require('../config/supabase');

const getOrdenes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_ordenes_resumen')
      .select('*')
      .order('fecha_ingreso', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener órdenes' });
  }
};

const getOrdenById = async (req, res) => {
  try {
    const { data: ordenes, error: oErr } = await supabase
      .from('ordenes_trabajo')
      .select(`
        *,
        vehiculos!inner (
          placa, marca, modelo,
          clientes!inner (
            nombre, apellido, telefono
          )
        ),
        usuarios (
          nombre
        )
      `)
      .eq('id', req.params.id)
      .limit(1);

    if (oErr) throw oErr;
    if (!ordenes || ordenes.length === 0) {
      return res.status(404).json({ mensaje: 'Orden no encontrada' });
    }

    const raw = ordenes[0];
    const c = raw.vehiculos?.clientes;
    const v = raw.vehiculos;

    const orden = {
      ...raw,
      cliente: c ? `${c.nombre} ${c.apellido}`.trim() : '',
      telefono: c?.telefono || '',
      vehiculo: v ? `${v.marca} ${v.modelo}`.trim() : '',
      placa: v?.placa || '',
      mecanico: raw.usuarios ? raw.usuarios.nombre : null
    };

    // Servicios
    const { data: osRows } = await supabase
      .from('orden_servicios')
      .select('*, servicios(nombre)')
      .eq('orden_id', req.params.id);

    const servicios = (osRows || []).map(os => ({
      ...os,
      servicio_nombre: os.servicios?.nombre || 'Servicio'
    }));

    // Repuestos
    const { data: orRows } = await supabase
      .from('orden_repuestos')
      .select('*, repuestos(nombre, codigo)')
      .eq('orden_id', req.params.id);

    const repuestos = (orRows || []).map(orep => ({
      ...orep,
      repuesto_nombre: orep.repuestos?.nombre || orep.repuesto_nombre || 'Producto eliminado',
      codigo: orep.repuestos?.codigo || ''
    }));

    // Seguimiento
    const { data: segRows } = await supabase
      .from('seguimiento')
      .select('*, usuarios(nombre)')
      .eq('orden_id', req.params.id)
      .order('fecha', { ascending: true });

    const seguimiento = (segRows || []).map(seg => ({
      ...seg,
      usuario_nombre: seg.usuarios ? seg.usuarios.nombre : null
    }));

    const totalServicios = servicios.reduce((a, s) => a + parseFloat(s.precio || 0), 0);
    const totalRepuestos = repuestos.reduce((a, r) => a + (parseFloat(r.precio_unitario || 0) * (Number(r.cantidad) || 1)), 0);
    const manoObra       = parseFloat(orden.mano_obra) || 0;
    const subtotal       = totalServicios + totalRepuestos + manoObra;
    const igv            = parseFloat((subtotal * 0.18).toFixed(2));
    const total          = parseFloat((subtotal + igv).toFixed(2));

    res.json({
      ...orden,
      servicios,
      repuestos,
      seguimiento,
      totalServicios,
      totalRepuestos,
      subtotal,
      igv,
      total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener orden' });
  }
};

const createOrden = async (req, res) => {
  const { vehiculo_id, mecanico_id, descripcion_problema, fecha_estimada, km_actual, mano_obra } = req.body;
  if (!vehiculo_id || !descripcion_problema) {
    return res.status(400).json({ mensaje: 'vehiculo_id y descripcion_problema son requeridos' });
  }

  try {
    const { count } = await supabase.from('ordenes_trabajo').select('*', { count: 'exact', head: true });
    const numero = String((count || 0) + 1).padStart(3, '0');
    const codigo = `OT-${new Date().getFullYear()}-${numero}`;

    const { data: newOrden, error } = await supabase
      .from('ordenes_trabajo')
      .insert([{
        codigo,
        vehiculo_id,
        mecanico_id: mecanico_id || null,
        descripcion_problema,
        fecha_estimada: fecha_estimada || null,
        km_actual: km_actual ? Number(km_actual) : null,
        mano_obra: Number(mano_obra) || 0,
        estado: 'recibido'
      }])
      .select('id')
      .single();

    if (error) throw error;

    await supabase.from('seguimiento').insert([{
      orden_id: newOrden.id,
      usuario_id: req.usuario?.id || null,
      estado: 'recibido',
      comentario: 'Vehículo recibido en el taller'
    }]);

    res.status(201).json({ mensaje: 'Orden creada', id: newOrden.id, codigo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear orden' });
  }
};

const updateEstado = async (req, res) => {
  const { estado, comentario } = req.body;
  const estadosValidos = ['recibido','diagnostico','en_reparacion','espera_repuestos','listo','entregado','cancelado'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ mensaje: 'Estado no válido' });
  }

  try {
    const updatePayload = { estado, updated_at: new Date().toISOString() };
    if (estado === 'entregado') {
      updatePayload.fecha_entrega = new Date().toISOString();
    }

    const { error: updErr } = await supabase
      .from('ordenes_trabajo')
      .update(updatePayload)
      .eq('id', req.params.id);

    if (updErr) throw updErr;

    await supabase.from('seguimiento').insert([{
      orden_id: req.params.id,
      usuario_id: req.usuario?.id || null,
      estado,
      comentario: comentario || ''
    }]);

    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar estado' });
  }
};

const agregarServicio = async (req, res) => {
  const { servicio_id, precio, observacion } = req.body;
  if (!servicio_id) return res.status(400).json({ mensaje: 'servicio_id es requerido' });

  try {
    const { error } = await supabase
      .from('orden_servicios')
      .insert([{
        orden_id: req.params.id,
        servicio_id,
        precio: Number(precio) || 0,
        observacion: observacion || ''
      }]);

    if (error) throw error;
    res.status(201).json({ mensaje: 'Servicio agregado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al agregar servicio' });
  }
};

const eliminarServicio = async (req, res) => {
  try {
    const { error } = await supabase
      .from('orden_servicios')
      .delete()
      .eq('id', req.params.osId);

    if (error) throw error;
    res.json({ mensaje: 'Servicio eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar servicio' });
  }
};

const agregarRepuesto = async (req, res) => {
  const { repuesto_id, cantidad, precio_unitario } = req.body;
  if (!repuesto_id) return res.status(400).json({ mensaje: 'repuesto_id es requerido' });

  try {
    const { data: rep, error: rErr } = await supabase
      .from('repuestos')
      .select('stock')
      .eq('id', repuesto_id)
      .single();

    if (rErr || !rep) return res.status(404).json({ mensaje: 'Repuesto no encontrado' });

    const cant = Number(cantidad) || 1;
    if (rep.stock < cant) {
      return res.status(400).json({ mensaje: `Stock insuficiente. Disponible: ${rep.stock}` });
    }

    const { error: insErr } = await supabase
      .from('orden_repuestos')
      .insert([{
        orden_id: req.params.id,
        repuesto_id,
        cantidad: cant,
        precio_unitario: Number(precio_unitario) || 0
      }]);

    if (insErr) throw insErr;

    // Descontar stock
    await supabase
      .from('repuestos')
      .update({ stock: rep.stock - cant })
      .eq('id', repuesto_id);

    res.status(201).json({ mensaje: 'Repuesto agregado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al agregar repuesto' });
  }
};

const eliminarRepuesto = async (req, res) => {
  try {
    const { data: detalle, error: detErr } = await supabase
      .from('orden_repuestos')
      .select('repuesto_id, cantidad')
      .eq('id', req.params.orId)
      .single();

    if (detErr || !detalle) return res.status(404).json({ mensaje: 'Repuesto no encontrado en la orden' });

    const { error: delErr } = await supabase
      .from('orden_repuestos')
      .delete()
      .eq('id', req.params.orId);

    if (delErr) throw delErr;

    // Reponer stock
    if (detalle.repuesto_id) {
      const { data: rep } = await supabase
        .from('repuestos')
        .select('stock')
        .eq('id', detalle.repuesto_id)
        .single();

      if (rep) {
        await supabase
          .from('repuestos')
          .update({ stock: rep.stock + (Number(detalle.cantidad) || 1) })
          .eq('id', detalle.repuesto_id);
      }
    }

    res.json({ mensaje: 'Repuesto eliminado y stock repuesto' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar repuesto' });
  }
};

const updateManoObra = async (req, res) => {
  const { mano_obra } = req.body;
  try {
    const { error } = await supabase
      .from('ordenes_trabajo')
      .update({ mano_obra: Number(mano_obra) || 0, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Mano de obra actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar mano de obra' });
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const { data: ordenesData } = await supabase.from('ordenes_trabajo').select('estado');
    const ordenesList = ordenesData || [];
    const ordenes = {
      total: ordenesList.length,
      recibido: ordenesList.filter(o => o.estado === 'recibido').length,
      en_reparacion: ordenesList.filter(o => o.estado === 'en_reparacion').length,
      listo: ordenesList.filter(o => o.estado === 'listo').length,
      entregado: ordenesList.filter(o => o.estado === 'entregado').length
    };

    const { count: totalClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
    const { count: totalVehiculos } = await supabase.from('vehiculos').select('*', { count: 'exact', head: true });
    const { count: totalStockBajo } = await supabase.from('v_stock_bajo').select('*', { count: 'exact', head: true });

    // Ingresos del mes
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: facturasMes } = await supabase
      .from('facturas')
      .select('total')
      .gte('fecha_emision', startOfMonth)
      .lte('fecha_emision', endOfMonth);

    const ingresosTotal = (facturasMes || []).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);

    const { data: ultimasOrdenes } = await supabase
      .from('v_ordenes_resumen')
      .select('*')
      .order('fecha_ingreso', { ascending: false })
      .limit(5);

    res.json({
      ordenes,
      clientes: totalClientes || 0,
      vehiculos: totalVehiculos || 0,
      stockBajo: totalStockBajo || 0,
      ingresosMes: ingresosTotal,
      ultimasOrdenes: ultimasOrdenes || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener estadísticas' });
  }
};

const eliminarOrden = async (req, res) => {
  try {
    const { error } = await supabase
      .from('ordenes_trabajo')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Orden eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar orden:', err);
    res.status(500).json({ mensaje: 'Error al eliminar orden', detalle: err.message });
  }
};

const updateOrden = async (req, res) => {
  const { mecanico_id, descripcion_problema, fecha_estimada, km_actual, mano_obra, observaciones } = req.body;
  try {
    const { error } = await supabase
      .from('ordenes_trabajo')
      .update({
        mecanico_id: mecanico_id || null,
        descripcion_problema,
        fecha_estimada: fecha_estimada || null,
        km_actual: km_actual ? Number(km_actual) : null,
        mano_obra: Number(mano_obra) || 0,
        observaciones: observaciones || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Orden actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar orden' });
  }
};

module.exports = {
  getOrdenes, getOrdenById, createOrden, updateEstado, getEstadisticas,
  agregarServicio, eliminarServicio, agregarRepuesto, eliminarRepuesto,
  updateManoObra, eliminarOrden, updateOrden
};