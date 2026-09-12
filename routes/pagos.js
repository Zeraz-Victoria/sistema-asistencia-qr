/*
 * ==========================================================
 * ARCHIVO: routes/pagos.js
 * MÓDULO: Pasarela de Pago Automatizada (Mercado Pago / OXXO / Tarjetas)
 * PRECIO: $99 MXN Licencia Vitalicia (configurable por .env)
 * ==========================================================
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { db } = require('../config/database');
const Institucion = require('../models/Institucion');
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
require('dotenv').config();


const PRECIO_LICENCIA = Number(process.env.PRECIO_LICENCIA_MXN || 99);

// Inicializar cliente Mercado Pago si existe token
function getMercadoPagoClient() {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token || token.includes('TU_ACCESS_TOKEN')) return null;
    return new MercadoPagoConfig({ accessToken: token });
}

// -------------------------------------------------------------
// 1. CREAR ORDEN DE PAGO (Autoservicio desde pantalla de Registro)
// -------------------------------------------------------------
router.post('/crear-orden', async (req, res) => {
    try {
        const { nombre_director, email_director, password_director, nombre_escuela, telefono } = req.body;

        if (!nombre_director || !email_director || !password_director) {
            return res.status(400).json({ error: 'Faltan datos obligatorios (nombre, correo y contraseña).' });
        }

        const emailClean = email_director.trim().toLowerCase();

        // 1. Verificar si ya existe usuario con este correo
        const usuarioExistente = await db.get("SELECT * FROM Usuarios WHERE LOWER(email) = $1", [emailClean]);
        let institucionId = null;

        if (usuarioExistente) {
            // Verificar estado de la institución existente
            const instExistente = await Institucion.findById(usuarioExistente.institucion_id);
            if (instExistente && instExistente.estado === 'activo') {
                return res.status(409).json({ error: 'Ya existe una cuenta activa con este correo. Por favor inicia sesión.' });
            }
            institucionId = usuarioExistente.institucion_id;
        } else {
            // 2. Crear Institución en estado pendiente_pago
            const escRes = await db.run(
                "INSERT INTO Instituciones (nombre, plan, estado, monto_pagado) VALUES ($1, 'vitalicio', 'pendiente_pago', $2)",
                [nombre_escuela || 'Mi Escuela', PRECIO_LICENCIA]
            );
            institucionId = escRes.lastID;

            // 3. Crear Usuario Docente/Director
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password_director, salt);
            const usuarioAlias = emailClean.split('@')[0];

            await db.run(
                "INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, usuario, institucion_id) VALUES ($1, $2, 'admin', $3, $4, $5)",
                [emailClean, hash, nombre_director, usuarioAlias, institucionId]
            );

            // Crear registro de configuración
            const maxIdRes = await db.get("SELECT MAX(id) AS max_id FROM Configuracion");
            const nextId = (maxIdRes && maxIdRes.max_id ? maxIdRes.max_id : 0) + 1;
            await db.run("INSERT INTO Configuracion (id, institucion_id, enviar_sms) VALUES ($1, $2, 1)", [nextId, institucionId]);
        }

        // 4. Determinar URL base de redirección
        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        const client = getMercadoPagoClient();

        if (client) {
            // Generar Checkout de Mercado Pago
            const preference = new Preference(client);
            const preferenceData = {
                items: [
                    {
                        id: `licencia-${institucionId}`,
                        title: 'AsistenciaQR - Licencia Vitalicia Completa',
                        description: 'Acceso de por vida sin mensualidades para control de asistencia y tareas con QR.',
                        quantity: 1,
                        unit_price: PRECIO_LICENCIA,
                        currency_id: 'MXN'
                    }
                ],
                payer: {
                    name: nombre_director,
                    email: emailClean
                },
                payment_methods: {
                    excluded_payment_types: [],
                    installments: 1
                },
                back_urls: {
                    success: `${baseUrl}/login.html?pago=aprobado&email=${encodeURIComponent(emailClean)}`,
                    failure: `${baseUrl}/login.html?pago=fallido&email=${encodeURIComponent(emailClean)}`,
                    pending: `${baseUrl}/login.html?pago=pendiente_oxxo&email=${encodeURIComponent(emailClean)}`
                },
                auto_return: 'approved',
                external_reference: String(institucionId),
                statement_descriptor: 'ASISTENCIAQR',
                notification_url: `${baseUrl}/api/pagos/webhook`
            };

            const mpResult = await preference.create({ body: preferenceData });

            return res.json({
                modo: 'mercadopago',
                init_point: mpResult.init_point,
                sandbox_init_point: mpResult.sandbox_init_point,
                institucion_id: institucionId,
                monto: PRECIO_LICENCIA
            });
        } else {
            // Modo Demostración / Sin Token de Mercado Pago configurado
            return res.json({
                modo: 'demo_simulacion',
                init_point: `/login.html?pago=simulacion&institucion_id=${institucionId}&email=${encodeURIComponent(emailClean)}`,
                institucion_id: institucionId,
                monto: PRECIO_LICENCIA,
                aviso: 'MERCADOPAGO_ACCESS_TOKEN no configurado en .env. Se usará simulación de prueba.'
            });
        }

    } catch (error) {
        console.error('Error en /api/pagos/crear-orden:', error);
        res.status(500).json({ error: error.message || 'Error al generar la orden de pago.' });
    }
});

// -------------------------------------------------------------
// 2. WEBHOOK OFICIAL DE MERCADO PAGO
// (Se dispara automáticamente al pagar con tarjeta o en OXXO)
// -------------------------------------------------------------
router.post('/webhook', async (req, res) => {
    try {
        const client = getMercadoPagoClient();
        const paymentId = req.query['data.id'] || req.body?.data?.id || req.query.id || req.body?.id;
        const topic = req.query.type || req.query.topic || req.body?.type;

        console.log(`[Webhook MercadoPago] Notificación recibida: topic=${topic}, id=${paymentId}`);

        if ((topic === 'payment' || req.query['data.id']) && paymentId && client) {
            const payment = new Payment(client);
            const pagoData = await payment.get({ id: paymentId });

            if (pagoData && pagoData.status === 'approved') {
                const institucionId = pagoData.external_reference;
                if (institucionId) {
                    await Institucion.activarPlanVitalicio(institucionId, {
                        monto: pagoData.transaction_amount || PRECIO_LICENCIA,
                        referencia: String(pagoData.id),
                        metodo: pagoData.payment_method_id || pagoData.payment_type_id || 'mercadopago'
                    });
                    console.log(`✅ [Webhook MercadoPago] Institución #${institucionId} activada exitosamente con Licencia Vitalicia.`);
                }
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error en /api/pagos/webhook:', error);
        res.status(200).send('OK'); // Responder 200 a MP para evitar reintentos infinitos
    }
});

// -------------------------------------------------------------
// 3. ACTIVACIÓN INMEDIATA POR SIMULACIÓN O SUPERADMIN
// SEGURIDAD: Requiere la SUPER_ADMIN_KEY en el header x-admin-key
// -------------------------------------------------------------
const requireSuperAdminKey = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    const masterKey = process.env.SUPER_ADMIN_KEY;
    if (!masterKey) {
        console.error('[Seguridad] SUPER_ADMIN_KEY no configurada en .env');
        return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
    }
    if (!key || key.trim() !== masterKey.trim()) {
        return res.status(403).json({ error: 'Acceso denegado. Clave de administrador inválida.' });
    }
    next();
};

router.post('/confirmar-simulacion', requireSuperAdminKey, async (req, res) => {
    try {
        const { institucion_id, email } = req.body;
        if (!institucion_id && !email) {
            return res.status(400).json({ error: 'Falta institucion_id o email' });
        }

        let id = institucion_id;
        if (!id && email) {
            const u = await db.get("SELECT institucion_id FROM Usuarios WHERE LOWER(email) = $1", [email.trim().toLowerCase()]);
            if (u) id = u.institucion_id;
        }

        if (!id) return res.status(404).json({ error: 'Institución no encontrada' });

        await Institucion.activarPlanVitalicio(id, {
            monto: PRECIO_LICENCIA,
            referencia: 'SIM-' + Date.now(),
            metodo: 'simulacion_prueba'
        });

        res.json({ status: 'ok', message: 'Licencia Vitalicia activada exitosamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------
// 4. CREAR ORDEN DE UPGRADE / DESBLOQUEO ($99 MXN)

// (Para cuentas en prueba activa o suspendidas por fin de prueba)
// -------------------------------------------------------------
router.post('/orden-upgrade', async (req, res) => {
    try {
        let institucionId = req.body.institucion_id;
        let email = req.body.email;
        let nombre = req.body.nombre;

        // Intentar obtener de token JWT si viene header
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded && decoded.institucion_id) {
                    institucionId = decoded.institucion_id;
                    if (!email) email = decoded.email;
                    if (!nombre) nombre = decoded.nombre_completo;
                }
            } catch (e) {}
        }

        if (!institucionId && email) {
            const u = await db.get("SELECT * FROM Usuarios WHERE LOWER(email) = $1", [email.trim().toLowerCase()]);
            if (u) {
                institucionId = u.institucion_id;
                if (!nombre) nombre = u.nombre_completo;
            }
        }

        if (!institucionId) {
            return res.status(400).json({ error: 'No se pudo identificar la institución.' });
        }

        const inst = await Institucion.findById(institucionId);
        if (!inst) {
            return res.status(404).json({ error: 'Institución no encontrada.' });
        }

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;

        const client = getMercadoPagoClient();
        if (client) {
            const preference = new Preference(client);
            const preferenceData = {
                items: [
                    {
                        id: `upgrade-licencia-${institucionId}`,
                        title: 'AsistenciaQR - Licencia Vitalicia Completa',
                        description: 'Activación de por vida del sistema escolar AsistenciaQR ($99 MXN pago único).',
                        quantity: 1,
                        unit_price: PRECIO_LICENCIA,
                        currency_id: 'MXN'
                    }
                ],
                payer: {
                    name: nombre || inst.nombre || 'Docente',
                    email: email || 'docente@asistenciaqr.com'
                },
                payment_methods: {
                    excluded_payment_types: [],
                    installments: 1
                },
                back_urls: {
                    success: `${baseUrl}/admin.html?pago=aprobado&institucion_id=${institucionId}`,
                    failure: `${baseUrl}/admin.html?pago=fallido&institucion_id=${institucionId}`,
                    pending: `${baseUrl}/admin.html?pago=pendiente_oxxo&institucion_id=${institucionId}`
                },
                auto_return: 'approved',
                external_reference: String(institucionId),
                statement_descriptor: 'ASISTENCIAQR',
                notification_url: `${baseUrl}/api/pagos/webhook`
            };

            const mpResult = await preference.create({ body: preferenceData });
            return res.json({
                modo: 'mercadopago',
                init_point: mpResult.init_point,
                sandbox_init_point: mpResult.sandbox_init_point,
                institucion_id: institucionId,
                monto: PRECIO_LICENCIA
            });
        } else {
            return res.json({
                modo: 'demo_simulacion',
                init_point: `/admin.html?pago=simulacion&institucion_id=${institucionId}`,
                institucion_id: institucionId,
                monto: PRECIO_LICENCIA,
                aviso: 'MERCADOPAGO_ACCESS_TOKEN no configurado en .env. Se usará simulación de prueba.'
            });
        }
    } catch (error) {
        console.error('Error en /api/pagos/orden-upgrade:', error);
        res.status(500).json({ error: error.message || 'Error al generar orden de pago.' });
    }
});

module.exports = router;

