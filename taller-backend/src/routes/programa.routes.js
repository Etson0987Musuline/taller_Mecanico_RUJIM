const router = require("express").Router();
const c = require("../controllers/programa.controller");
const {
  verificarToken,
  soloAdmin,
  soloPersonal,
  roles,
} = require("../middlewares/auth.middleware");
router.get("/cron", c.cron);
router.use(verificarToken);
router.get("/panel", c.panel);
router.get("/estadisticas", soloAdmin, c.estadisticas);
router.post("/ordenes/:id/reportar", soloPersonal, c.reportar);
router.post("/reportes/:id/revisar", soloAdmin, c.revisar);
router.post("/reglas", soloAdmin, c.regla);
router.put("/reglas/:id", soloAdmin, c.regla);
router.post("/tipos", soloAdmin, c.tipo);
router.put("/tipos/:id", soloAdmin, c.tipo);
router.post("/mantenimientos", soloAdmin, c.mantenimiento);
router.patch("/vehiculos/:id/km", soloPersonal, c.kilometraje);
router.patch("/preferencias", roles("cliente"), c.preferencias);
router.patch("/perfil", roles("cliente"), c.perfil);
router.post("/alertas/leida", c.leerAlerta);
router.post("/recordatorios", soloAdmin, c.crearRecordatorio);
router.patch(
  "/recordatorios/:id",
  roles("admin", "cliente"),
  c.actualizarRecordatorio,
);
router.post("/recordatorios/generar", soloAdmin, c.generar);
router.post("/recordatorios/procesar", soloAdmin, c.procesar);
module.exports = router;
