const supabase = require('../config/supabase');

const getFacturas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('facturas')
      .select(`
        *,
        ordenes_trabajo!inner (
          codigo,
          vehiculos!inner (
            placa,
            marca,
            modelo,
            clientes!inner (
              nombre,
              apellido
            )
          )
        )
      `)
      .order('fecha_emision', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(f => {
      const v = f.ordenes_trabajo?.vehiculos;
      const c = v?.clientes;
      return {
        ...f,
        orden_codigo: f.ordenes_trabajo?.codigo,
        cliente_nombre: c ? `${c.nombre} ${c.apellido}`.trim() : 'Sin cliente',
        placa: v?.placa || '',
        vehiculo: v ? `${v.marca} ${v.modelo}`.trim() : ''
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener facturas' });
  }
};

const buscarOrdenes = async (req, res) => {
  const { q } = req.query;
  try {
    // Obtener orden_ids que ya tienen factura
    const { data: facturasExistentes } = await supabase.from('facturas').select('orden_id');
    const idsFacturados = new Set((facturasExistentes || []).map(f => f.orden_id));

    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select(`
        id, codigo, estado, mano_obra,
        vehiculos!inner (
          placa, marca, modelo,
          clientes!inner (
            nombre, apellido, telefono
          )
        )
      `)
      .neq('estado', 'cancelado')
      .order('id', { ascending: false });

    if (error) throw error;

    const queryStr = (q || '').trim().toLowerCase();
    const filtrados = (data || [])
      .filter(ot => !idsFacturados.has(ot.id))
      .filter(ot => {
        if (!queryStr) return true;
        const cli = `${ot.vehiculos?.clientes?.nombre || ''} ${ot.vehiculos?.clientes?.apellido || ''}`.toLowerCase();
        const cod = (ot.codigo || '').toLowerCase();
        const pla = (ot.vehiculos?.placa || '').toLowerCase();
        return cod.includes(queryStr) || cli.includes(queryStr) || pla.includes(queryStr);
      })
      .slice(0, 10)
      .map(ot => {
        const c = ot.vehiculos?.clientes;
        const v = ot.vehiculos;
        return {
          id: ot.id,
          codigo: ot.codigo,
          estado: ot.estado,
          mano_obra: ot.mano_obra,
          cliente: c ? `${c.nombre} ${c.apellido}`.trim() : '',
          telefono: c?.telefono,
          placa: v?.placa,
          vehiculo: v ? `${v.marca} ${v.modelo}`.trim() : ''
        };
      });

    res.json(filtrados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al buscar órdenes' });
  }
};

const getFacturaByOrden = async (req, res) => {
  try {
    const { data: facturas, error: fErr } = await supabase
      .from('facturas')
      .select(`
        *,
        ordenes_trabajo!inner (
          codigo,
          vehiculos!inner (
            placa,
            marca,
            modelo,
            clientes!inner (
              nombre,
              apellido,
              dni,
              telefono
            )
          )
        )
      `)
      .eq('orden_id', req.params.id)
      .limit(1);

    if (fErr) throw fErr;
    if (!facturas || facturas.length === 0) {
      return res.status(404).json({ mensaje: 'Factura no encontrada' });
    }

    const fac = facturas[0];
    const v = fac.ordenes_trabajo?.vehiculos;
    const c = v?.clientes;

    // Obtener pagos
    const { data: pagos } = await supabase.from('pagos').select('*').eq('factura_id', fac.id);

    // Obtener servicios
    const { data: ordenServicios } = await supabase
      .from('orden_servicios')
      .select('precio, servicios(nombre)')
      .eq('orden_id', req.params.id);

    const servicios = (ordenServicios || []).map(os => ({
      precio: os.precio,
      servicio: os.servicios?.nombre || 'Servicio'
    }));

    // Obtener repuestos
    const { data: ordenRepuestos } = await supabase
      .from('orden_repuestos')
      .select('cantidad, precio_unitario, repuesto_nombre, repuestos(nombre)')
      .eq('orden_id', req.params.id);

    const repuestos = (ordenRepuestos || []).map(orep => ({
      cantidad: orep.cantidad,
      precio_unitario: orep.precio_unitario,
      repuesto: orep.repuestos?.nombre || orep.repuesto_nombre || 'Repuesto'
    }));

    res.json({
      ...fac,
      orden_codigo: fac.ordenes_trabajo?.codigo,
      cliente_nombre: c ? `${c.nombre} ${c.apellido}`.trim() : '',
      cliente_dni: c?.dni,
      telefono: c?.telefono,
      placa: v?.placa,
      vehiculo: v ? `${v.marca} ${v.modelo}`.trim() : '',
      pagos: pagos || [],
      servicios,
      repuestos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener factura' });
  }
};

const createFactura = async (req, res) => {
  const { orden_id, notas } = req.body;
  if (!orden_id) return res.status(400).json({ mensaje: 'orden_id es requerido' });

  try {
    const { data: orden } = await supabase
      .from('ordenes_trabajo')
      .select('mano_obra')
      .eq('id', orden_id)
      .single();

    const { data: servicios } = await supabase
      .from('orden_servicios')
      .select('precio')
      .eq('orden_id', orden_id);

    const { data: repuestos } = await supabase
      .from('orden_repuestos')
      .select('cantidad, precio_unitario')
      .eq('orden_id', orden_id);

    const manoObra = parseFloat(orden?.mano_obra) || 0;
    const totServ = (servicios || []).reduce((acc, s) => acc + (parseFloat(s.precio) || 0), 0);
    const totRep = (repuestos || []).reduce((acc, r) => acc + ((parseFloat(r.precio_unitario) || 0) * (Number(r.cantidad) || 1)), 0);

    const subtotal = manoObra + totServ + totRep;
    const igv = parseFloat((subtotal * 0.18).toFixed(2));
    const total = parseFloat((subtotal + igv).toFixed(2));

    const { count } = await supabase.from('facturas').select('*', { count: 'exact', head: true });
    const numero = `F-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

    const { data: newFactura, error } = await supabase
      .from('facturas')
      .insert([{
        orden_id,
        numero,
        subtotal,
        igv,
        total,
        notas,
        estado_pago: 'pendiente'
      }])
      .select('id')
      .single();

    if (error) throw error;

    res.status(201).json({
      mensaje: 'Factura generada',
      id: newFactura.id,
      numero,
      total,
      subtotal,
      igv
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al generar factura' });
  }
};

const registrarPago = async (req, res) => {
  const { monto, metodo, referencia } = req.body;
  if (!monto || !metodo) return res.status(400).json({ mensaje: 'monto y metodo son requeridos' });

  try {
    const { error: insErr } = await supabase
      .from('pagos')
      .insert([{
        factura_id: req.params.id,
        monto: Number(monto) || 0,
        metodo,
        referencia
      }]);

    if (insErr) throw insErr;

    const { data: factura } = await supabase
      .from('facturas')
      .select('total')
      .eq('id', req.params.id)
      .single();

    const { data: pagos } = await supabase
      .from('pagos')
      .select('monto')
      .eq('factura_id', req.params.id);

    const totalPagado = (pagos || []).reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
    const totalFactura = parseFloat(factura?.total) || 0;
    const estadoPago = totalPagado >= totalFactura ? 'pagado' : 'parcial';

    await supabase
      .from('facturas')
      .update({ estado_pago: estadoPago })
      .eq('id', req.params.id);

    res.json({ mensaje: 'Pago registrado', estado_pago: estadoPago, total_pagado: totalPagado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar pago' });
  }
};

module.exports = { getFacturas, buscarOrdenes, getFacturaByOrden, createFactura, registrarPago };