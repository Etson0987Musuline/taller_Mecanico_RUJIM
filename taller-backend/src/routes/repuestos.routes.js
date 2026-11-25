const router  = require('express').Router();
const multer  = require('multer');
const upload  = require('../config/storage');
const uploadExcel = multer({ storage: multer.memoryStorage() });
const {
  getRepuestos, getStockBajo, createRepuesto, updateRepuesto,
  eliminarRepuesto, eliminarGrupal, previewEliminar, importarExcel
} = require('../controllers/repuestos.controller');
const { verificarToken, soloAdmin, soloPersonal } = require('../middlewares/auth.middleware');
const { crearBusquedaWeb } = require('../services/busqueda-web.service');

router.get('/',                  verificarToken, getRepuestos);
router.get('/sugerencias-web', verificarToken, soloPersonal, crearBusquedaWeb());
router.get('/tipo-cambio', verificarToken, async (req, res) => {
  try {
    const { obtenerTipoCambio } = require('../services/tipo-cambio.service');
    res.json(await obtenerTipoCambio());
  } catch {
    res.status(503).json({ mensaje: 'Tipo de cambio no disponible.' });
  }
});
router.get('/stock-bajo',        verificarToken, getStockBajo);
router.post('/',                 verificarToken, soloAdmin, upload.single('imagen'), createRepuesto);
router.put('/:id',               verificarToken, soloAdmin, upload.single('imagen'), updateRepuesto);
router.delete('/:id',            verificarToken, soloAdmin, eliminarRepuesto);
router.post('/eliminar-grupal',  verificarToken, soloAdmin, eliminarGrupal);
router.post('/preview-eliminar', verificarToken, soloAdmin, previewEliminar);
router.post('/importar',         verificarToken, soloAdmin, uploadExcel.single('archivo'), importarExcel);

module.exports = router;
