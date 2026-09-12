const express = require('express');
const PortalController = require('../controllers/portalController');

const router = express.Router();

// Rutas Públicas para el Portal de Padres (No requieren Auth Token)
router.get('/status', PortalController.verificarEstadoDia);
router.get('/calendar', PortalController.obtenerCalendario);
router.get('/history/:nfc_uid', PortalController.obtenerHistorialAlumno);
router.get('/entry-exit', PortalController.obtenerEstadoGrados);
router.get('/avisos', PortalController.obtenerAvisos);


module.exports = router;
