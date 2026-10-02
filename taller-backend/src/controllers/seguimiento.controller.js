const supabase = require('../config/supabase');

const consultarPorNombre = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_consulta_cliente')
      .select('*')
      .ilike('cliente', `%${req.params.nombre}%`);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron órdenes para ese cliente' });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al consultar' });
  }
};

const consultarPorDni = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_consulta_cliente')
      .select('*')
      .eq('dni', req.params.dni);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron órdenes para ese DNI' });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al consultar' });
  }
};

const consultarPorPlaca = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v_consulta_cliente')
      .select('*')
      .ilike('placa', `%${req.params.placa}%`);

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron órdenes para esa placa' });
    }
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al consultar' });
  }
};

module.exports = { consultarPorNombre, consultarPorDni, consultarPorPlaca };