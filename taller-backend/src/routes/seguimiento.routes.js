const router = require('express').Router();
const { consultarPorNombre, consultarPorDni, consultarPorPlaca } = require('../controllers/seguimiento.controller');

// Rutas PÚBLICAS — sin token (para que el cliente consulte desde el index)
router.get('/nombre/:nombre', consultarPorNombre);
router.get('/dni/:dni',       consultarPorDni);
router.get('/placa/:placa',   consultarPorPlaca);

module.exports = router;