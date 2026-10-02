const supabase = require('../config/supabase');

const buscarPorCodigo = async (req, res) => {
  const { codigo } = req.params;
  try {
    const { data, error } = await supabase
      .from('repuestos')
      .select('*')
      .or(`codigo_barra.eq.${codigo},codigo.eq.${codigo},codigo_original.eq.${codigo}`)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al buscar producto' });
  }
};

const getVentas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*, usuarios(nombre)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(v => ({
      ...v,
      vendedor: v.usuarios ? v.usuarios.nombre : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener ventas' });
  }
};

const getVentaById = async (req, res) => {
  try {
    const { data: venta, error: vErr } = await supabase
      .from('ventas')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (vErr || !venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });

    const { data: detalle, error: dErr } = await supabase
      .from('detalle_ventas')
      .select('*, repuestos(nombre, codigo_barra)')
      .eq('venta_id', req.params.id);

    if (dErr) throw dErr;

    const formattedDetalle = (detalle || []).map(dv => ({
      ...dv,
      producto: dv.producto_nombre || dv.repuestos?.nombre || 'Producto',
      codigo_barra: dv.producto_codigo || dv.repuestos?.codigo_barra || ''
    }));

    res.json({ ...venta, detalle: formattedDetalle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener venta' });
  }
};

const createVenta = async (req, res) => {
  const { cliente_nombre, cliente_dni, metodo_pago, items, notas } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ mensaje: 'El carrito está vacío' });
  }

  try {
    // ── Validar descuentos contra costo ──
    for (const item of items) {
      if (item.descuento && item.descuento > 0) {
        const { data: rep } = await supabase
          .from('repuestos')
          .select('precio_compra, nombre')
          .eq('id', item.repuesto_id)
          .single();

        if (!rep) {
          return res.status(404).json({ mensaje: `Producto no encontrado: ID ${item.repuesto_id}` });
        }
        const costoUnitario = parseFloat(rep.precio_compra) || 0;
        const precioFinal   = parseFloat(item.precio_unitario) - parseFloat(item.descuento);
        if (precioFinal < costoUnitario) {
          return res.status(400).json({
            mensaje: `El descuento en "${rep.nombre}" supera el margen permitido. El precio mínimo de venta es S/ ${costoUnitario.toFixed(2)}.`
          });
        }
      }
    }

    // ── Totales ──
    let subtotal = 0;
    for (const item of items) {
      const precioConDesc = parseFloat(item.precio_unitario) - (parseFloat(item.descuento) || 0);
      subtotal += precioConDesc * parseInt(item.cantidad);
    }
    const igv   = parseFloat((subtotal * 0.18).toFixed(2));
    const total = parseFloat((subtotal + igv).toFixed(2));

    // ── Número de boleta ──
    const { count } = await supabase.from('ventas').select('*', { count: 'exact', head: true });
    const numero = `B-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(5, '0')}`;

    // ── Insertar venta ──
    const { data: venta, error: vErr } = await supabase
      .from('ventas')
      .insert([{
        numero,
        cliente_nombre: cliente_nombre || 'Cliente general',
        cliente_dni: cliente_dni || '',
        metodo_pago: metodo_pago || 'efectivo',
        subtotal,
        igv,
        total,
        notas: notas || '',
        usuario_id: req.usuario?.id || null
      }])
      .select('id')
      .single();

    if (vErr) throw vErr;

    // ── Detalle y actualización de stock ──
    for (const item of items) {
      const descuento    = parseFloat(item.descuento) || 0;
      const precioFinal  = parseFloat(item.precio_unitario) - descuento;
      const subtotalItem = precioFinal * parseInt(item.cantidad);

      await supabase.from('detalle_ventas').insert([{
        venta_id: venta.id,
        repuesto_id: item.repuesto_id,
        cantidad: parseInt(item.cantidad),
        precio_unitario: precioFinal,
        subtotal: subtotalItem,
        producto_nombre: item.nombre || '',
        producto_codigo: item.codigo || '',
        descuento
      }]);

      // Descontar stock
      const { data: currentStock } = await supabase
        .from('repuestos')
        .select('stock')
        .eq('id', item.repuesto_id)
        .single();

      if (currentStock) {
        await supabase
          .from('repuestos')
          .update({ stock: Math.max(0, (currentStock.stock || 0) - parseInt(item.cantidad)) })
          .eq('id', item.repuesto_id);
      }
    }

    res.status(201).json({ mensaje: 'Venta registrada', id: venta.id, numero, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar venta' });
  }
};

module.exports = { getVentas, createVenta, getVentaById, buscarPorCodigo };