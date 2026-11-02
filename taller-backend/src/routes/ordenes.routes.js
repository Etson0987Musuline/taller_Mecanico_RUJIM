const router = require('express').Router();
const {
  getOrdenes, getOrdenById, createOrden, updateEstado, getEstadisticas,
  agregarServicio, eliminarServicio, agregarRepuesto, eliminarRepuesto,
  updateManoObra, eliminarOrden, updateOrden
} = require('../controllers/ordenes.controller');
const { verificarToken,soloAdmin } = require('../middlewares/auth.middleware');
const {alcanceOrden}=require('../middlewares/alcance.middleware');
router.use(verificarToken);
router.use('/:id', (req,res,next)=>req.params.id==='estadisticas'?next():alcanceOrden(req,res,next));

router.get('/estadisticas',           verificarToken, soloAdmin, getEstadisticas);
router.get('/',                       verificarToken, getOrdenes);
router.get('/:id',                    verificarToken, getOrdenById);
router.post('/',                      verificarToken, createOrden);
router.put('/:id',                    verificarToken, soloAdmin, updateOrden);
router.delete('/:id',                 verificarToken, soloAdmin, eliminarOrden);
router.patch('/:id/estado',           verificarToken, updateEstado);
router.patch('/:id/mano-obra',        verificarToken, updateManoObra);
router.post('/:id/servicios',         verificarToken, agregarServicio);
router.delete('/:id/servicios/:osId', verificarToken, eliminarServicio);
router.post('/:id/repuestos',         verificarToken, agregarRepuesto);
router.delete('/:id/repuestos/:orId', verificarToken, eliminarRepuesto);

module.exports = router;
