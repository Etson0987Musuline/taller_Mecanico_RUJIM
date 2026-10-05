const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas PÚBLICAS (sin token)
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/seguimiento',  require('./routes/seguimiento.routes'));
app.use('/api/consulta-doc', require('./routes/consulta-doc.routes'));

// Rutas PROTEGIDAS (con token)
app.use('/api/clientes',  require('./routes/clientes.routes'));
app.use('/api/vehiculos', require('./routes/vehiculos.routes'));
app.use('/api/ordenes',   require('./routes/ordenes.routes'));
app.use('/api/repuestos', require('./routes/repuestos.routes'));
app.use('/api/facturas',  require('./routes/facturas.routes'));
app.use('/api/ventas',    require('./routes/ventas.routes'));
app.use('/api/usuarios',  require('./routes/usuarios.routes'));
app.use('/api/servicios', require('./routes/servicios.routes'));
app.use('/api/catalogos', require('./routes/catalogos.routes'));

// Imágenes estáticas
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: 'API Taller Mecánico funcionando ✅' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;