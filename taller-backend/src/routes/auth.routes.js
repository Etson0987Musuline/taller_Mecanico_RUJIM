const router = require('express').Router();
const { login,me,logout,google,googleCallback } = require('../controllers/sesion.controller');
const {verificarToken} = require('../middlewares/auth.middleware');

router.post('/login', login);
router.get('/me',verificarToken,me);
router.post('/logout',logout);
router.get('/google',google);
router.get('/google/callback',googleCallback);

module.exports = router;
