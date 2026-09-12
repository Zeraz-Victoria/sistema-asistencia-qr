const express = require('express');
const GestionController = require('../controllers/gestionController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Middleware para verificar rol de director
const directorOnly = (req, res, next) => {
  if (req.usuario.rol === 'maestro') {
    return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
  }
  next();
};

// --- RUTAS DE GRADOS ---
router.post('/grados', directorOnly, GestionController.crearGrado);
router.get('/grados', GestionController.obtenerGrados);
router.delete('/grados/:id', directorOnly, GestionController.eliminarGrado);

// --- RUTAS DE GRUPOS ---
router.post('/grupos', directorOnly, GestionController.crearGrupo);
router.get('/grupos', GestionController.obtenerGrupos);
router.delete('/grupos/:id', directorOnly, GestionController.eliminarGrupo);

// --- RUTAS DE MAESTROS ---
router.get('/maestros', directorOnly, GestionController.obtenerMaestros);
router.post('/maestros', directorOnly, GestionController.crearMaestro);
router.put('/maestros/:id', directorOnly, GestionController.actualizarMaestro);
router.delete('/maestros/:id', directorOnly, GestionController.eliminarMaestro);

// --- RUTAS DE CLASES ---
router.post('/clases', directorOnly, GestionController.crearClase);
router.post('/clases/rapida', directorOnly, GestionController.crearClaseRapida);
router.get('/clases', GestionController.obtenerClases);
router.delete('/clases/:id', directorOnly, GestionController.eliminarClase);

// --- RUTAS DE HORARIO ---
router.get('/horario', directorOnly, GestionController.obtenerHorario);
router.post('/horario', directorOnly, GestionController.actualizarHorario);

// --- RUTAS DE MATERIAS (Modelo Departamental) ---
router.get('/materias', GestionController.obtenerMaterias);
router.post('/materias', directorOnly, GestionController.crearMateria);
router.put('/materias/:id', directorOnly, GestionController.actualizarMateria);
router.delete('/materias/:id', directorOnly, GestionController.eliminarMateria);

// --- RUTAS DE HORARIOS DE CLASES ---
router.get('/clases/:clase_id/horarios', GestionController.obtenerHorariosClase);
router.post('/clases/:clase_id/horarios', directorOnly, GestionController.agregarHorarioClase);
router.delete('/clases/horarios/:id', directorOnly, GestionController.eliminarHorarioClase);

// --- RUTAS DE MATRICULA (Alumnos en Clases) ---
router.get('/clases/:clase_id/matricula', GestionController.obtenerMatriculaClase);
router.post('/clases/:clase_id/matricula', directorOnly, GestionController.matricularAlumno);
router.delete('/clases/:clase_id/matricula/:alumno_id', directorOnly, GestionController.desmatricularAlumno);

// --- CONFIGURACION MODELO DEPARTAMENTAL ---
router.get('/configuracion/modelo-departamental', GestionController.obtenerModeloDepartamental);
router.post('/configuracion/modelo-departamental', directorOnly, GestionController.actualizarModeloDepartamental);

module.exports = router;