const supabase = require('../config/supabase');

const getVehiculos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*, clientes(nombre, apellido)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(v => ({
      ...v,
      cliente: v.clientes ? `${v.clientes.nombre} ${v.clientes.apellido}`.trim() : 'Sin cliente'
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener vehículos' });
  }
};

const getVehiculosByCliente = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .eq('cliente_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener vehículos del cliente' });
  }
};

const createVehiculo = async (req, res) => {
  const {
    cliente_id, placa, marca, modelo, anio, anio_modelo, color, tipo,
    vin, km_ingreso, n_motor, n_serie, estado_vehiculo, propietario_registral
  } = req.body;

  if (!cliente_id || !placa || !marca || !modelo) {
    return res.status(400).json({ mensaje: 'cliente_id, placa, marca y modelo son requeridos' });
  }

  try {
    const { data, error } = await supabase
      .from('vehiculos')
      .insert([{
        cliente_id,
        placa: placa.toUpperCase().trim(),
        marca,
        modelo,
        anio: anio ? Number(anio) : null,
        anio_modelo: anio_modelo ? Number(anio_modelo) : null,
        color,
        tipo,
        vin,
        km_ingreso: Number(km_ingreso) || 0,
        n_motor,
        n_serie,
        estado_vehiculo,
        propietario_registral
      }])
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') { // Postgres duplicate key error
        return res.status(400).json({ mensaje: 'La placa ya está registrada' });
      }
      throw error;
    }

    res.status(201).json({ mensaje: 'Vehículo registrado', id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar vehículo' });
  }
};

const updateVehiculo = async (req, res) => {
  const {
    marca, modelo, anio, anio_modelo, color, tipo, vin, km_ingreso,
    n_motor, n_serie, estado_vehiculo, propietario_registral
  } = req.body;

  try {
    const { error } = await supabase
      .from('vehiculos')
      .update({
        marca,
        modelo,
        anio: anio ? Number(anio) : null,
        anio_modelo: anio_modelo ? Number(anio_modelo) : null,
        color,
        tipo,
        vin,
        km_ingreso: Number(km_ingreso) || 0,
        n_motor,
        n_serie,
        estado_vehiculo,
        propietario_registral
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Vehículo actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar vehículo' });
  }
};

const eliminarVehiculo = async (req, res) => {
  try {
    const { data: ordenes, error: oErr } = await supabase
      .from('ordenes_trabajo')
      .select('id')
      .eq('vehiculo_id', req.params.id);

    if (oErr) throw oErr;

    if (ordenes && ordenes.length > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar: el vehículo tiene ${ordenes.length} orden(es) de trabajo.`
      });
    }

    const { error } = await supabase
      .from('vehiculos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Vehículo eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar vehículo' });
  }
};

const getHistorialByPlaca = async (req, res) => {
  const rawPlaca = req.params.placa.trim().toUpperCase();
  const cleanPlaca = rawPlaca.replace(/[^A-Z0-9]/g, '');

  if (!cleanPlaca) {
    return res.status(400).json({ mensaje: 'Debe ingresar una placa válida' });
  }

  try {
    const { data: vehiculos, error: vErr } = await supabase
      .from('vehiculos')
      .select('*, clientes(nombre, apellido, telefono, dni, direccion)')
      .or(`placa.ilike.%${cleanPlaca}%,placa.ilike.%${rawPlaca}%`)
      .limit(1);

    if (vErr) throw vErr;

    if (!vehiculos || vehiculos.length === 0) {
      return res.status(404).json({ mensaje: `No se encontró ningún vehículo con la placa "${req.params.placa}"` });
    }

    const rawVehiculo = vehiculos[0];
    const vehiculo = {
      ...rawVehiculo,
      cliente: rawVehiculo.clientes ? `${rawVehiculo.clientes.nombre} ${rawVehiculo.clientes.apellido}`.trim() : '',
      telefono: rawVehiculo.clientes?.telefono,
      dni: rawVehiculo.clientes?.dni,
      direccion: rawVehiculo.clientes?.direccion
    };

    const { data: ordenes, error: oErr } = await supabase
      .from('ordenes_trabajo')
      .select(`
        *,
        usuarios(nombre),
        facturas(total, numero, estado_pago),
        orden_servicios(*, servicios(nombre)),
        orden_repuestos(*, repuestos(nombre, codigo))
      `)
      .eq('vehiculo_id', vehiculo.id)
      .order('fecha_ingreso', { ascending: false });

    if (oErr) throw oErr;

    const formattedOrdenes = (ordenes || []).map(ot => {
      const factura = Array.isArray(ot.facturas) ? ot.facturas[0] : ot.facturas;
      return {
        ...ot,
        mecanico: ot.usuarios ? ot.usuarios.nombre : null,
        total_factura: factura?.total || 0,
        factura_numero: factura?.numero || null,
        estado_pago: factura?.estado_pago || null,
        servicios: (ot.orden_servicios || []).map(os => ({
          ...os,
          servicio_nombre: os.servicios?.nombre || 'Servicio'
        })),
        repuestos: (ot.orden_repuestos || []).map(or => ({
          ...or,
          repuesto_nombre: or.repuestos?.nombre || or.repuesto_nombre || 'Repuesto',
          codigo: or.repuestos?.codigo || ''
        }))
      };
    });

    res.json({ vehiculo, ordenes: formattedOrdenes });
  } catch (err) {
    console.error('Error al obtener historial por placa:', err);
    res.status(500).json({ mensaje: 'Error al consultar historial del vehículo' });
  }
};

module.exports = {
  getVehiculos, getVehiculosByCliente,
  createVehiculo, updateVehiculo, eliminarVehiculo,
  getHistorialByPlaca
};