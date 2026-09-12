const AuthService = require('../services/authService');
const Institucion = require('../models/Institucion');

class AuthController {
    static async login(req, res) {
        try {
            const email = req.body.email || req.body.usuario || req.body.identifier;
            const password = req.body.password;
            const result = await AuthService.login(email, password);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en /login:', error.message);
            if (error.message === 'Credenciales incorrectas.') {
                return res.status(401).json({ error: error.message });
            }
            if (error.message.includes('suspendida')) {
                return res.status(402).json({ error: error.message });
            }
            res.status(500).json({ error: error.message || 'Error interno del servidor.' });
        }
    }

    static async registroDocente(req, res) {
        try {
            const { nombre_completo, email, password, nombre_escuela, telefono, device_fingerprint } = req.body;
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || req.ip;

            const result = await AuthService.registrarDocente({ 
                nombre_completo, 
                email, 
                password, 
                nombre_escuela, 
                telefono, 
                device_fingerprint, 
                ip_registro: ip 
            });
            res.status(201).json(result);
        } catch (error) {
            console.error('Error en /registro-docente:', error.message);
            if (error.code === 'PRUEBA_EXPIRADA_DISPOSITIVO' || error.message.includes('utilizó un periodo de prueba')) {
                return res.status(403).json({ 
                    error: error.message, 
                    bloqueo_abuso: true, 
                    institucion_id: error.institucion_id 
                });
            }
            if (error.message.includes('Ya existe una cuenta')) {
                return res.status(409).json({ error: error.message });
            }
            if (error.message.includes('Faltan datos')) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: error.message || 'Error al crear cuenta de docente.' });
        }
    }

    static async estadoLicencia(req, res) {
        try {
            const institucionId = req.usuario.institucion_id;
            const subStatus = await Institucion.checkSubscriptionStatus(institucionId);
            const inst = await Institucion.findById(institucionId);
            res.json({
                status: subStatus ? subStatus.status : 'activo',
                daysLeft: subStatus ? subStatus.daysLeft : 0,
                plan: subStatus ? subStatus.plan : 'prueba_7d',
                isTrial: subStatus ? (subStatus.isTrial || subStatus.plan === 'prueba_7d') : false,
                expiredTrial: subStatus ? (subStatus.expiredTrial || false) : false,
                nombreEscuela: inst ? inst.nombre : 'Mi Aula',
                monto: Number(process.env.PRECIO_LICENCIA_MXN || 99)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async loginNfc(req, res) {
        try {
            const idDocente = req.body.codigo_qr || req.body.nfc_uid || req.body.uid;
            const result = await AuthService.loginNfc(idDocente);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en /login-nfc / login-qr:', error.message);
            if (error.message === 'Tarjeta no reconocida.' || error.message.includes('no reconocida') || error.message.includes('no válida')) {
                return res.status(401).json({ error: error.message || 'Credencial QR no reconocida.' });
            }
            if (error.message.includes('suspendido')) {
                return res.status(402).json({ error: error.message });
            }
            if (error.message === 'No se recibió UID.') {
                return res.status(400).json({ error: 'No se recibió código QR.' });
            }
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async identificarTarjeta(req, res) {
        try {
            const { nfc_uid } = req.body;
            const result = await AuthService.identificarTarjeta(nfc_uid);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en /identificar-tarjeta:', error.message);
            res.status(500).json({ error: error.message || 'Error al identificar la tarjeta.' });
        }
    }

    static async crearEscuela(req, res) {
        try {
            const { nombre_escuela, email_director, nombre_director, password_director } = req.body;
            const result = await AuthService.crearEscuela(nombre_escuela, email_director, nombre_director, password_director);
            res.status(201).json(result);
        } catch (error) {
            console.error('Error en /crear-escuela:', error.message);
            if (error.message === 'Todos los campos son obligatorios.') {
                return res.status(400).json({ error: error.message });
            }
            if (error.message === 'El correo electrónico ya está registrado.') {
                return res.status(409).json({ error: error.message });
            }
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
}

module.exports = AuthController;
