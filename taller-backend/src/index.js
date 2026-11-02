const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();
const {origenes,protegerOrigen} = require('./utils/session');
const {verificarToken,soloAdmin,soloPersonal} = require('./middlewares/auth.middleware');

// Middlewares globales
app.use(cors({origin:origenes(),credentials:true}));
app.use(express.json({limit:'256kb'}));
app.use(protegerOrigen);
app.use('/api', (req,res,next) => { res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').set('Referrer-Policy','no-referrer'); next(); });
app.use('/api/programa', require('./routes/programa.routes'));
// Defensa común a módulos internos; los clientes usan exclusivamente /programa/mi-panel.
for (const modulo of ['clientes','vehiculos','ordenes','repuestos','catalogos','usuarios']) {
  app.use('/api/'+modulo,verificarToken,soloPersonal);
}
for (const modulo of ['facturas','ventas']) app.use('/api/'+modulo,verificarToken,soloAdmin);
app.use('/api/catalogos',(req,res,next)=>req.method==='GET'?next():soloAdmin(req,res,next));
app.use('/api/servicios',(req,res,next) => req.path==='/publicos' && req.method==='GET' ? next() : verificarToken(req,res,() => soloPersonal(req,res,next)));

// Rutas PÚBLICAS (sin token)
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/seguimiento',  require('./routes/seguimiento.routes'));
app.use('/api/consulta-doc',verificarToken,soloAdmin,require('./routes/consulta-doc.routes'));
app.use('/api/cotizaciones', require('./routes/cotizaciones.routes'));

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
