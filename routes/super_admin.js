/*
 * ==========================================================
 * ARCHIVO: routes/super_admin.js (Versión Estable)
 * ==========================================================
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
require('dotenv').config();

const Institucion = require('../models/Institucion');

const requireMasterKey = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    const masterKey = process.env.SUPER_ADMIN_KEY || 'admin123';

    if (!key || key.trim() !== masterKey.trim()) return res.status(403).json({ error: 'Acceso Denegado.' });

    next();

};

function createSuperAdminRoutes(db) {
    router.use(requireMasterKey);

    // 1. LISTAR
    router.get('/escuelas', async (req, res) => {
        try {
            const sql = `
                SELECT 
                    I.*, 
                    COALESCE(MAX(CASE WHEN U.rol = 'director' THEN U.email END), MAX(U.email)) as email_director, 
                    COALESCE(MAX(CASE WHEN U.rol = 'director' THEN U.nombre_completo END), MAX(U.nombre_completo)) as nombre_director 
                FROM Instituciones I 
                LEFT JOIN Usuarios U ON I.id = U.institucion_id
                GROUP BY I.id
                ORDER BY I.id DESC
            `;
            const escuelas = await db.all(sql);
            const escuelasConEstado = await Promise.all(escuelas.map(async (esc) => {
                const subStatus = await Institucion.checkSubscriptionStatus(esc.id);
                return {
                    ...esc,
                    dias_restantes: subStatus ? subStatus.daysLeft : 0,
                    sub_status: subStatus ? subStatus.status : esc.estado,
                    sub_warning: subStatus ? !!subStatus.warning : false,
                    is_trial: subStatus ? !!subStatus.isTrial : false
                };
            }));
            res.json(escuelasConEstado);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // 2. CREAR
    router.post('/nueva-escuela', async (req, res) => {
        try {
            const { nombre_escuela, plan, email_director, nombre_director, password_director } = req.body;
            if (!nombre_escuela || !email_director || !password_director) return res.status(400).json({ error: 'Faltan datos.' });

            const escuelaRes = await db.run("INSERT INTO Instituciones (nombre, plan, estado) VALUES ($1, $2, 'activo')", [nombre_escuela, plan || 'basico']);
            const nuevaEscuelaId = escuelaRes.lastID;

            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password_director, salt);

            await db.run("INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, institucion_id) VALUES ($1, $2, 'director', $3, $4)", [email_director, hash, nombre_director, nuevaEscuelaId]);
            
            const maxIdRes = await db.get("SELECT MAX(id) AS max_id FROM Configuracion");
            const nextId = (maxIdRes && maxIdRes.max_id ? maxIdRes.max_id : 0) + 1;
            await db.run("INSERT INTO Configuracion (id, institucion_id, enviar_sms) VALUES ($1, $2, 1)", [nextId, nuevaEscuelaId]);

            res.status(201).json({ status: 'ok' });
        } catch (error) {
            if (error.message.includes('unique')) return res.status(409).json({ error: 'El email ya existe.' });
            res.status(500).json({ error: error.message });
        }
    });

    // 3. ESTADO
    router.put('/escuelas/:id/estado', async (req, res) => {
        try {
            const { estado } = req.body;
            if (estado === 'activo') {
                const isSQLite = !process.env.DATABASE_URL;
                const query = isSQLite
                    ? "UPDATE Instituciones SET estado = $1, fecha_ultimo_pago = datetime('now', 'localtime') WHERE id = $2"
                    : "UPDATE Instituciones SET estado = $1, fecha_ultimo_pago = NOW() WHERE id = $2";
                await db.run(query, [estado, req.params.id]);
            } else {
                await db.run("UPDATE Instituciones SET estado = $1 WHERE id = $2", [estado, req.params.id]);
            }
            res.json({ status: 'ok' });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // 3.5 EDITAR NOMBRE
    router.put('/escuelas/:id/nombre', async (req, res) => {
        try {
            const { nombre } = req.body;
            if (!nombre) return res.status(400).json({ error: 'Faltan datos.' });
            await db.run("UPDATE Instituciones SET nombre = $1 WHERE id = $2", [nombre, req.params.id]);
            res.json({ status: 'ok' });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // 3.7 EDITAR PLAN (Reactiva y reinicia ciclo de cobro)
    router.put('/escuelas/:id/plan', async (req, res) => {
        try {
            const { plan } = req.body;
            if (!plan) return res.status(400).json({ error: 'Faltan datos.' });
            const isSQLite = !process.env.DATABASE_URL;
            const query = isSQLite
                ? "UPDATE Instituciones SET plan = $1, estado = 'activo', fecha_ultimo_pago = datetime('now', 'localtime') WHERE id = $2"
                : "UPDATE Instituciones SET plan = $1, estado = 'activo', fecha_ultimo_pago = NOW() WHERE id = $2";
            await db.run(query, [plan, req.params.id]);
            res.json({ status: 'ok' });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // 3.8 RENOVAR CICLO (+30 días / Reactivación)
    router.put('/escuelas/:id/renovar', async (req, res) => {
        try {
            const isSQLite = !process.env.DATABASE_URL;
            const query = isSQLite
                ? "UPDATE Instituciones SET estado = 'activo', fecha_ultimo_pago = datetime('now', 'localtime') WHERE id = $1"
                : "UPDATE Instituciones SET estado = 'activo', fecha_ultimo_pago = NOW() WHERE id = $1";
            await db.run(query, [req.params.id]);
            res.json({ status: 'ok', message: 'Ciclo renovado exitosamente.' });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // 4. BORRAR
    router.delete('/escuelas/:id', async (req, res) => {
        try {
            const id = req.params.id;
            // Borrado en cascada manual
            const tablas = ['Dias_Inhabiles', 'Configuracion', 'Asistencias', 'Alumnos', 'Clases', 'Grupos', 'Grados', 'Usuarios'];
            for (let t of tablas) await db.run(`DELETE FROM ${t} WHERE institucion_id = $1`, [id]);
            await db.run("DELETE FROM Instituciones WHERE id = $1", [id]);
            res.json({ status: 'ok' });
        } catch (error) { res.status(500).json({ error: 'Error al borrar.' }); }
    });

    return router;
}

module.exports = createSuperAdminRoutes;