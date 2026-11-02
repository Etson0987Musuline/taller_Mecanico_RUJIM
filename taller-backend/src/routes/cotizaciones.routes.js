const router = require('express').Router();
const c = require('../controllers/cotizaciones.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');
router.use((req, res, next) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  if (!key.startsWith('sb_secret_') && role !== 'service_role') return res.status(503).json({ mensaje: 'El taller todavía no ha habilitado las cotizaciones. Configura la clave privada de Supabase en el backend.' });
  next();
});
router.get('/publica/:token', c.consultar);
router.post('/publica/:token/respuesta', c.responder);
router.use(verificarToken, soloAdmin);
router.get('/', c.listar);
router.post('/', c.crear);
router.post('/:id/convertir', c.convertir);
router.post('/:id/anular', c.anular);
module.exports = router;
