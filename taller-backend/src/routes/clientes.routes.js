const router = require('express').Router();
const {
  getClientes, getClienteById, createCliente, updateCliente,
  eliminarCliente, getHistorialCliente, updateOrdenHistorial, deleteOrdenHistorial
} = require('../controllers/clientes.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

router.get('/',     verificarToken, getClientes);
router.get('/:id',  verificarToken, getClienteById);
router.post('/',    verificarToken, createCliente);
router.put('/:id',  verificarToken, updateCliente);
router.delete('/:id', verificarToken, soloAdmin, eliminarCliente);

// Historial — cualquier usuario autenticado puede ver
router.get('/:id/historial', verificarToken, getHistorialCliente);

// Editar y eliminar orden del historial — solo admin
router.put('/:id/historial/:ordenId',    verificarToken, soloAdmin, updateOrdenHistorial);
router.delete('/:id/historial/:ordenId', verificarToken, soloAdmin, deleteOrdenHistorial);

module.exports = router;