const supabase = require('../config/supabase');
const bcrypt   = require('bcryptjs');

const getUsuarios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, telefono, activo, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
};

const createUsuario = async (req, res) => {
  const { nombre, email, password, rol, telefono } = req.body;
  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ mensaje: 'Nombre, email, contraseña y rol son requeridos' });
  }
  try {
    const { data: existe, error: existErr } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email);

    if (existErr) throw existErr;
    if (existe && existe.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('usuarios')
      .insert([{
        nombre,
        email,
        password_hash: hash,
        rol,
        telefono,
        activo: true
      }])
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ mensaje: 'Usuario creado', id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear usuario' });
  }
};

const updateUsuario = async (req, res) => {
  const { nombre, email, telefono, rol, password } = req.body;
  try {
    const updateData = { nombre, email, telefono, rol, updated_at: new Date().toISOString() };
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar usuario' });
  }
};

const toggleActivo = async (req, res) => {
  try {
    const { data: user, error: getErr } = await supabase
      .from('usuarios')
      .select('activo')
      .eq('id', req.params.id)
      .single();

    if (getErr || !user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const { error } = await supabase
      .from('usuarios')
      .update({ activo: !user.activo })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ mensaje: 'Estado del usuario actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al cambiar estado' });
  }
};

const getMecanicos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, rol')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener mecánicos' });
  }
};

module.exports = { getUsuarios, createUsuario, updateUsuario, toggleActivo, getMecanicos };