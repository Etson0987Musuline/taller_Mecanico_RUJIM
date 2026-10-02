const router = require('express').Router();
const {
  getVehiculos, getVehiculosByCliente,
  createVehiculo, updateVehiculo, eliminarVehiculo,
  getHistorialByPlaca
} = require('../controllers/vehiculos.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/',                       verificarToken, getVehiculos);
router.get('/placa/:placa/historial', verificarToken, getHistorialByPlaca);
router.get('/cliente/:id',            verificarToken, getVehiculosByCliente);
router.post('/',                      verificarToken, createVehiculo);
router.put('/:id',                    verificarToken, updateVehiculo);
router.delete('/:id',                 verificarToken, eliminarVehiculo);

module.exports = router;