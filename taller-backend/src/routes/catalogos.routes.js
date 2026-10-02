const router = require('express').Router();
const supabase = require('../config/supabase');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/', verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehiculo_catalogos')
      .select('*')
      .order('tipo')
      .order('valor');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener catálogos' });
  }
});

router.post('/', verificarToken, async (req, res) => {
  const { tipo, valor } = req.body;
  if (!tipo || !valor) {
    return res.status(400).json({ mensaje: 'tipo y valor son requeridos' });
  }
  try {
    const { data, error } = await supabase
      .from('vehiculo_catalogos')
      .upsert([{ tipo, valor: valor.trim() }], { onConflict: 'tipo,valor' })
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Agregado', id: data?.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al agregar' });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('vehiculo_catalogos')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar' });
  }
});

module.exports = router;