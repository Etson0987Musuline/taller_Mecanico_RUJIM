const supabase = require('../config/supabase');
const bcrypt   = require('bcryptjs');

const getUsuarios = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, telefono, activo, created_at,google_habilitado,cliente_id')
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
  if(!['admin','mecanico'].includes(rol))return res.status(400).json({mensaje:'Los clientes se vinculan mediante Google. Selecciona un rol de personal válido.'});
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
        email:email.trim().toLowerCase(),
        password_hash: hash,
        rol,
        telefono,
        activo: true
        ,google_habilitado:req.body.google_habilitado===true
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
  if(!['admin','mecanico','cliente'].includes(rol))return res.status(400).json({mensaje:'Rol no válido.'});
  if(rol==='cliente')return res.status(400).json({mensaje:'La identidad del cliente se administra mediante Google.'});
  if(Number(req.params.id)===req.usuario.id&&rol!=='admin')return res.status(400).json({mensaje:'No puedes quitarte tu propio acceso administrativo.'});
  try {
    const {data:prev,error:pe}=await supabase.from('usuarios').select('rol,google_uid,email').eq('id',req.params.id).single();if(pe)throw pe;
    if(prev.rol==='cliente')return res.status(400).json({mensaje:'No se puede convertir una cuenta cliente en personal. Crea una cuenta autorizada independiente.'});
    if(prev.google_uid&&prev.email.toLowerCase()!==email.trim().toLowerCase())return res.status(400).json({mensaje:'No cambies el correo de una identidad Google vinculada.'});
    const updateData = { nombre, email:email.trim().toLowerCase(), telefono, rol,google_habilitado:req.body.google_habilitado===true, updated_at: new Date().toISOString() };
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) throw error;
    const {error:ae}=await supabase.from('auditoria').insert({usuario_id:req.usuario.id,accion:'actualizar_acceso',entidad:'usuarios',entidad_id:String(req.params.id),detalle:{rol,google_habilitado:updateData.google_habilitado}});if(ae)throw ae;
    const {error:se}=await supabase.from('sesiones').delete().eq('usuario_id',Number(req.params.id));if(se)throw se;
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar usuario' });
  }
};

const toggleActivo = async (req, res) => {
  if(Number(req.params.id)===req.usuario.id)return res.status(400).json({mensaje:'No puedes desactivar tu propia cuenta.'});
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
    const {error:ae}=await supabase.from('auditoria').insert({usuario_id:req.usuario.id,accion:'cambiar_estado_usuario',entidad:'usuarios',entidad_id:String(req.params.id),detalle:{activo:!user.activo}});if(ae)throw ae;
    const {error:se}=await supabase.from('sesiones').delete().eq('usuario_id',Number(req.params.id));if(se)throw se;
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
      .in('rol',['admin','mecanico'])
      .order('nombre');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener mecánicos' });
  }
};

module.exports = { getUsuarios, createUsuario, updateUsuario, toggleActivo, getMecanicos };
