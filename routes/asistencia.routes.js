const express = require('express');
const AsistenciaController = require('../controllers/asistenciaController');
const authMiddleware = require('../middleware/auth');
const Institucion = require('../models/Institucion');

const router = express.Router();

router.use(authMiddleware);

// --- SUSCRIPCION ---
router.get('/sub-status', async (req, res) => {
    try {
        const result = await Institucion.checkSubscriptionStatus(req.usuario.institucion_id);
        if (!result) return res.status(404).json({ error: 'Institución no encontrada.' });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ALUMNOS ---
router.get('/alumnos', AsistenciaController.obtenerAlumnos);
router.post('/registrar', AsistenciaController.registrarAlumno);
router.put('/alumnos/:id', AsistenciaController.actualizarAlumno);
router.post('/alumnos/borrar', AsistenciaController.borrarAlumno);

// --- ASISTENCIA ---
router.post('/marcar', AsistenciaController.marcar);
router.get('/asistencias/hoy', AsistenciaController.obtenerAsistenciasHoy);
router.post('/asistencias/manual', AsistenciaController.registrarAsistenciaManual);
router.post('/sync', AsistenciaController.sync);
router.post('/justificar', AsistenciaController.justificar);
router.get('/clase-activa', AsistenciaController.obtenerClaseActiva);

// --- CALENDARIO ---
router.get('/dias_inhabiles', AsistenciaController.obtenerDiasInhabiles);
router.post('/dias_inhabiles/agregar', AsistenciaController.agregarDiaInhabil);
router.post('/dias_inhabiles/quitar', AsistenciaController.quitarDiaInhabil);

// --- ACTIVIDADES / TAREAS ---
router.get('/actividades', AsistenciaController.obtenerActividades);
router.post('/actividades', AsistenciaController.crearActividad);
router.put('/actividades/:id', AsistenciaController.editarActividad);
router.delete('/actividades/:id', AsistenciaController.borrarActividad);
router.post('/actividades/marcar', AsistenciaController.marcarActividad);
router.get('/actividades/:id/entregas', AsistenciaController.obtenerEntregasActividad);
router.post('/actividades/toggle-entrega', AsistenciaController.toggleEntregaActividad);

module.exports = router;
