/*
 * ==========================================================
 * ARCHIVO: middleware/auth.js (v6.0 - SaaS Strict Mode)
 * PROPÓSITO: El "guardia" que protege nuestras rutas y valida la Escuela.
 * ==========================================================
 */
const jwt = require('jsonwebtoken');
const Institucion = require('../models/Institucion');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado. No se proporcionó token.' });
    }

    // 1. Verifica la firma del token
    const payload = jwt.verify(token, JWT_SECRET);

    // 2. VALIDACIÓN SAAS CRÍTICA
    // Si el token es válido pero NO tiene institucion_id (es un token viejo), lo rechazamos.
    if (!payload.institucion_id) {
        return res.status(403).json({ 
            error: 'Su sesión es antigua. Por favor, cierre sesión y vuelva a entrar para actualizar sus credenciales.' 
        });
    }

    // 3. Adjunta los datos del usuario a la petición
    // Ahora req.usuario siempre tendrá: { id, rol, email, institucion_id }
    req.usuario = payload;

    // 4. VERIFICACIÓN DE SUSCRIPCIÓN (PREPAGO / PRUEBA 7 DÍAS)
    // Se exceptúan endpoints de estado y de pagos para que la cuenta suspendida pueda consultar su estado y pagar su activación.
    const isExempt = req.path === '/sub-status' || 
                     req.originalUrl === '/api/sub-status' || 
                     req.originalUrl.includes('/estado-licencia') ||
                     req.originalUrl.includes('/api/pagos');

    if (!isExempt) {
        const subStatus = await Institucion.checkSubscriptionStatus(payload.institucion_id);
        if (subStatus && subStatus.status === 'suspendido') {
            return res.status(402).json({ 
                error: 'cuenta_suspendida', 
                message: subStatus.expiredTrial 
                    ? 'Tu periodo de prueba de 7 días ha finalizado. Activa tu Licencia Vitalicia ($99 MXN) para continuar usando el sistema.'
                    : 'Cuenta suspendida por falta de pago.',
                expiredTrial: subStatus.expiredTrial || false,
                isTrial: subStatus.isTrial || false,
                plan: subStatus.plan,
                institucion_id: payload.institucion_id
            });
        }
    }


    next();

  } catch (error) {
    console.error('Error de autenticación:', error.message);
    res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

module.exports = authMiddleware;