const supabase = require('../config/supabase');

const getServicios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .order('nombre');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener servicios' });
  }
};

const createServicio = async (req, res) => {
  const { nombre, descripcion, precio_base, categoria } = req.body;
  if (!nombre) return res.status(400).json({ mensaje: 'El nombre es requerido' });

  try {
    const { data, error } = await supabase
      .from('servicios')
      .insert([{
        nombre,
        descripcion,
        precio_base: Number(precio_base) || 0,
        categoria
      }])
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Servicio creado', id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear servicio' });
  }
};

const updateServicio = async (req, res) => {
  const { nombre, descripcion, precio_base, categoria } = req.body;
  try {
    const { error } = await supabase
      .from('servicios')
      .update({
        nombre,
        descripcion,
        precio_base: Number(precio_base) || 0,
        categoria
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Servicio actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar servicio' });
  }
};

const toggleActivo = async (req, res) => {
  try {
    const { data: current, error: getErr } = await supabase
      .from('servicios')
      .select('activo')
      .eq('id', req.params.id)
      .single();

    if (getErr || !current) return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    const { error } = await supabase
      .from('servicios')
      .update({ activo: !current.activo })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al cambiar estado' });
  }
};

module.exports = { getServicios, createServicio, updateServicio, toggleActivo };