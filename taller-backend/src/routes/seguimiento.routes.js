const router = require('express').Router();
const {verificarToken}=require('../middlewares/auth.middleware');
router.use(verificarToken,require('../middlewares/seguimiento.middleware'));
const { consultarPorNombre, consultarPorDni, consultarPorPlaca } = require('../controllers/seguimiento.controller');

// Consultas privadas: propiedad/asignación comprobada en el backend.
router.get('/nombre/:nombre', consultarPorNombre);
router.get('/dni/:dni',       consultarPorDni);
router.get('/placa/:placa',   consultarPorPlaca);

module.exports = router;
