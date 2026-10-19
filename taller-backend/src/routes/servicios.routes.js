const router = require('express').Router();
const { getServicios, getServiciosPublicos, createServicio, updateServicio, toggleActivo } = require('../controllers/servicios.controller');
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware');

router.get('/publicos',       getServiciosPublicos);
router.get('/',               verificarToken, getServicios);
router.post('/',              verificarToken, soloAdmin, createServicio);
router.put('/:id',            verificarToken, soloAdmin, updateServicio);
router.patch('/:id/toggle',   verificarToken, soloAdmin, toggleActivo);

module.exports = router;