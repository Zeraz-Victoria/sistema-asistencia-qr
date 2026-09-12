const express = require('express');
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// --- ESTADO DE LICENCIA / PRUEBA DOCENTE (PROTEGIDA) ---
router.get('/estado-licencia', authMiddleware, AuthController.estadoLicencia);

// --- RUTA DE LOGIN (POST /api/auth/login) ---
router.post('/login', AuthController.login);

// --- RUTA DE REGISTRO DE DOCENTE (PÚBLICA) ---
router.post('/registro-docente', AuthController.registroDocente);

// --- RUTA DE LOGIN NFC / QR (Para Maestros) ---
router.post('/login-nfc', AuthController.loginNfc);
router.post('/login-qr', AuthController.loginNfc);

// --- RUTA DE IDENTIFICACIÓN DE TARJETA / QR ---
router.post('/identificar-tarjeta', AuthController.identificarTarjeta);
router.post('/identificar-qr', AuthController.identificarTarjeta);

// --- RUTA DE REGISTRO DE NUEVA ESCUELA (PÚBLICA) ---
router.post('/crear-escuela', AuthController.crearEscuela);

module.exports = router;