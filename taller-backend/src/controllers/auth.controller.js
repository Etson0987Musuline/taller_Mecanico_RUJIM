const supabase = require('../config/supabase');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
  }

  try {
    const { data: rows, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('activo', true);

    if (error) {
      console.error(error);
      return res.status(500).json({ mensaje: 'Error en el servidor' });
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];
    const passwordOk = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      usuario: {
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

module.exports = { login };