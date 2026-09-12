const express = require('express');
const ReporteController = require('../controllers/reporteController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Todas las rutas de reporte requieren autenticación
router.use(authMiddleware);

// 2. PDF DETALLADO (MATRIZ DE ASISTENCIA)
router.get('/pdf_detallado', ReporteController.obtenerDetalladoPdf);
router.get('/docentes', ReporteController.generarReporteDocentes);
router.get('/pdf_docente', ReporteController.generarReporteDocentes);
router.get('/pdf_tareas', ReporteController.obtenerTareasPdf);

module.exports = router;
