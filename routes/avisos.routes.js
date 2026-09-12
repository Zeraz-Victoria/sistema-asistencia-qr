const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// Middleware para verificar sesión de admin
const checkAdminSession = (req, res, next) => {
    // Asumimos que la sesión se maneja en el frontend o hay un header, 
    // pero para este MVP SaaS, el institucion_id viene en el body o query si no hay auth completa.
    // Sin embargo, idealmente deberíamos validar el usuario.
    // Por simplicidad y consistencia con reportes, permitimos pasar institucion_id
    // pero validaremos que venga.
    const { institucion_id } = req.query;
    if (!institucion_id && req.method === 'GET') {
        return res.status(400).json({ error: 'Institucion ID requerido' });
    }
    next();
};

// GET: Obtener avisos (Para el panel de admin)
router.get('/', async (req, res) => {
    try {
        const { institucion_id } = req.query;
        if (!institucion_id) return res.status(400).json({ error: 'Falta institucion_id' });

        const avisos = await db.all(
            `SELECT * FROM Avisos WHERE institucion_id = ? ORDER BY fecha_creacion DESC`,
            [institucion_id]
        );
        res.json(avisos);
    } catch (error) {
        console.error('Error obteniendo avisos:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST: Crear nuevo aviso
router.post('/', async (req, res) => {
    try {
        const { institucion_id, titulo, mensaje } = req.body;

        if (!institucion_id || !titulo || !mensaje) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        await db.run(
            `INSERT INTO Avisos (institucion_id, titulo, mensaje) VALUES (?, ?, ?)`,
            [institucion_id, titulo, mensaje]
        );

        res.json({ success: true, message: 'Aviso creado correctamente' });
    } catch (error) {
        console.error('Error creando aviso:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// DELETE: Eliminar aviso
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // En un escenario real, validaríamos que el aviso pertenezca a la institución del usuario
        await db.run(`DELETE FROM Avisos WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando aviso:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
