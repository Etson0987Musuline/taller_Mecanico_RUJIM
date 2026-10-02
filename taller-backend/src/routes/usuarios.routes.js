const router = require('express').Router();
const { getUsuarios, createUsuario, updateUsuario, toggleActivo, getMecanicos } = require('../controllers/usuarios.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

// Ruta especial: cualquier usuario autenticado puede buscar mecánicos
router.get('/mecanicos', verificarToken, getMecanicos);

// Rutas solo admin
router.get('/',              verificarToken, soloAdmin, getUsuarios);
router.post('/',             verificarToken, soloAdmin, createUsuario);
router.put('/:id',           verificarToken, soloAdmin, updateUsuario);
router.patch('/:id/toggle',  verificarToken, soloAdmin, toggleActivo);

module.exports = router;