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
    const now = new Date();

    // Rango de fechas
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    const sieteDiasAtras = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).toISOString();

    // Consultas paralelas a Supabase
    const [
      { data: ordenesData },
      { count: totalClientes },
      { count: totalVehiculos },
      { count: totalStockBajo },
      { data: facturasMes },
      { data: facturasHoy },
      { data: ventasMes },
      { data: ventasHoy },
      { data: pagosMes },
      { data: repuestosData },
      { data: ultimasOrdenes },
      { data: ultimasVentas },
      { data: facturasSieteDias },
      { data: ventasSieteDias }
    ] = await Promise.all([
      supabase.from('ordenes_trabajo').select('estado'),
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      supabase.from('vehiculos').select('*', { count: 'exact', head: true }),
      supabase.from('v_stock_bajo').select('*', { count: 'exact', head: true }),
      supabase.from('facturas').select('id, total, fecha_emision').gte('fecha_emision', startOfMonth).lte('fecha_emision', endOfMonth),
      supabase.from('facturas').select('id, total, fecha_emision').gte('fecha_emision', startOfToday).lte('fecha_emision', endOfToday),
      supabase.from('ventas').select('id, numero, total, metodo_pago, created_at').gte('created_at', startOfMonth).lte('created_at', endOfMonth),
      supabase.from('ventas').select('id, numero, total, metodo_pago, created_at').gte('created_at', startOfToday).lte('created_at', endOfToday),
      supabase.from('pagos').select('monto, metodo, fecha_pago').gte('fecha_pago', startOfMonth).lte('fecha_pago', endOfMonth),
      supabase.from('repuestos').select('id, codigo, nombre, categoria, stock, stock_minimo, precio_compra, precio_venta, precio_mayor, moneda').eq('activo', true),
      supabase.from('v_ordenes_resumen').select('*').order('fecha_ingreso', { ascending: false }).limit(6),
      supabase.from('ventas').select('id, numero, cliente_nombre, total, metodo_pago, created_at').order('created_at', { ascending: false }).limit(6),
      supabase.from('facturas').select('total, fecha_emision').gte('fecha_emision', sieteDiasAtras),
      supabase.from('ventas').select('total, created_at').gte('created_at', sieteDiasAtras)
    ]);

    // Resumen de órdenes
    const ordenesList = ordenesData || [];
    const ordenes = {
      total: ordenesList.length,
      recibido: ordenesList.filter(o => o.estado === 'recibido').length,
      diagnostico: ordenesList.filter(o => o.estado === 'diagnostico').length,
      en_reparacion: ordenesList.filter(o => o.estado === 'en_reparacion').length,
      espera_repuestos: ordenesList.filter(o => o.estado === 'espera_repuestos').length,
      listo: ordenesList.filter(o => o.estado === 'listo').length,
      entregado: ordenesList.filter(o => o.estado === 'entregado').length,
      cancelado: ordenesList.filter(o => o.estado === 'cancelado').length,
      en_proceso: ordenesList.filter(o => ['recibido', 'diagnostico', 'en_reparacion', 'espera_repuestos'].includes(o.estado)).length
    };

    // Venta Diaria (Taller + Mostrador)
    const tallerHoy = (facturasHoy || []).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
    const mostradorHoy = (ventasHoy || []).reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
    const totalHoy = tallerHoy + mostradorHoy;
    const cantHoy = (facturasHoy || []).length + (ventasHoy || []).length;
    const ventaDiaria = {
      total: Math.round(totalHoy * 100) / 100,
      taller: Math.round(tallerHoy * 100) / 100,
      mostrador: Math.round(mostradorHoy * 100) / 100,
      cantidad: cantHoy,
      cantTaller: (facturasHoy || []).length,
      cantMostrador: (ventasHoy || []).length
    };

    // Venta Mensual (Taller + Mostrador)
    const tallerMes = (facturasMes || []).reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);
    const mostradorMes = (ventasMes || []).reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
    const totalMes = tallerMes + mostradorMes;
    const cantMes = (facturasMes || []).length + (ventasMes || []).length;
    const ventaMensual = {
      total: Math.round(totalMes * 100) / 100,
      taller: Math.round(tallerMes * 100) / 100,
      mostrador: Math.round(mostradorMes * 100) / 100,
      cantidad: cantMes,
      cantTaller: (facturasMes || []).length,
      cantMostrador: (ventasMes || []).length,
      ticketPromedio: cantMes > 0 ? Math.round((totalMes / cantMes) * 100) / 100 : 0
    };

    // Inventario y Precios de Productos
    const repuestos = repuestosData || [];
    let valorInventarioVenta = 0;
    let valorInventarioCosto = 0;
    let sinStockCount = 0;
    let criticoCount = 0;

    for (const r of repuestos) {
      const s = r.stock || 0;
      const pv = parseFloat(r.precio_venta) || 0;
      const pc = parseFloat(r.precio_compra) || 0;
      if (s <= 0) {
        sinStockCount++;
      } else {
        valorInventarioVenta += s * pv;
        valorInventarioCosto += s * pc;
        if (s <= (r.stock_minimo || 5)) {
          criticoCount++;
        }
      }
    }

    const inventario = {
      totalProductos: repuestos.length,
      valorInventarioVenta: Math.round(valorInventarioVenta * 100) / 100,
      valorInventarioCosto: Math.round(valorInventarioCosto * 100) / 100,
      margenPotencial: Math.round((valorInventarioVenta - valorInventarioCosto) * 100) / 100,
      sinStock: sinStockCount,
      critico: criticoCount,
      conStock: repuestos.length - sinStockCount
    };

    // Métodos de pago (Mes)
    const metodosPago = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, transferencia: 0 };
    for (const v of (ventasMes || [])) {
      const m = (v.metodo_pago || 'efectivo').toLowerCase();
      if (metodosPago[m] !== undefined) {
        metodosPago[m] += parseFloat(v.total) || 0;
      } else {
        metodosPago.efectivo += parseFloat(v.total) || 0;
      }
    }
    for (const p of (pagosMes || [])) {
      const m = (p.metodo || 'efectivo').toLowerCase();
      if (metodosPago[m] !== undefined) {
        metodosPago[m] += parseFloat(p.monto) || 0;
      } else {
        metodosPago.efectivo += parseFloat(p.monto) || 0;
      }
    }
    // Redondear métodos
    Object.keys(metodosPago).forEach(k => {
      metodosPago[k] = Math.round(metodosPago[k] * 100) / 100;
    });

    // Gráfico de los últimos 7 días
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const ultimos7Dias = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const label = i === 0 ? 'Hoy' : `${diasSemana[d.getDay()]} ${d.getDate()}`;

      const tD = (facturasSieteDias || [])
        .filter(f => (f.fecha_emision || '').startsWith(dayStr))
        .reduce((acc, f) => acc + (parseFloat(f.total) || 0), 0);

      const mD = (ventasSieteDias || [])
        .filter(v => (v.created_at || '').startsWith(dayStr))
        .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

      ultimos7Dias.push({
        fecha: dayStr,
        label,
        taller: Math.round(tD * 100) / 100,
        mostrador: Math.round(mD * 100) / 100,
        total: Math.round((tD + mD) * 100) / 100
      });
    }

    res.json({
      ordenes,
      clientes: totalClientes || 0,
      vehiculos: totalVehiculos || 0,
      stockBajo: totalStockBajo || 0,
      ingresosMes: totalMes, // Retrocompatible
      ventaDiaria,
      ventaMensual,
      inventario,
      metodosPago,
      ultimos7Dias,
      ultimasOrdenes: ultimasOrdenes || [],
      ultimasVentas: ultimasVentas || []
    });
  } catch (err) {
    console.error('Error al obtener estadísticas del dashboard:', err);
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