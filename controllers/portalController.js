const { db } = require('../config/database');

const PortalController = {

    // 1. Verificar Estado del Día (Si hay clases o no)
    // 1. Verificar Estado del Día (Si hay clases o no)
    verificarEstadoDia: async (req, res) => {
        try {
            const institucion_id = req.query.institucion_id || 1; // Default to 1

            // Allow date parameter or default to now
            let today;
            let fechaStr;

            if (req.query.fecha) {
                // Input: YYYY-MM-DD
                const [y, m, d] = req.query.fecha.split('-').map(Number);
                today = new Date(y, m - 1, d); // Local 00:00 - Good for getDay()
                fechaStr = req.query.fecha;    // Use input directly to avoid TZ shift
            } else {
                today = new Date();
                fechaStr = today.toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).split(' ')[0];
            }

            // 0. Registrar Visita (Analytics)
            try {
                // Upsert Counter
                await db.run(`
                    INSERT INTO Visitas_Portal (institucion_id, fecha, contador) 
                    VALUES ($1, $2, 1)
                    ON CONFLICT(institucion_id, fecha) 
                    DO UPDATE SET contador = Visitas_Portal.contador + 1
                `, [institucion_id, fechaStr]);
            } catch (e) { console.error("Error analytics:", e.message); }

            // A) Checar Fin de Semana
            const institucion = await db.get('SELECT nombre FROM Instituciones WHERE id = ?', [institucion_id]);
            const config = await db.get('SELECT clases_sabado, clases_domingo FROM Configuracion WHERE institucion_id = ?', [institucion_id]);
            
            const nombreEscuela = institucion ? institucion.nombre : 'Escuela';
            const admitirSabado = config ? config.clases_sabado : false;
            const admitirDomingo = config ? config.clases_domingo : false;

            const dayOfWeek = today.getDay(); // 0 = Dom, 6 = Sab
            const esSabado = (dayOfWeek === 6);
            const esDomingo = (dayOfWeek === 0);

            // Bloquear solo si es fin de semana Y no está habilitado en config
            const esFinDeSemanaNoHabilitado = (esSabado && !admitirSabado) || (esDomingo && !admitirDomingo);

            if (esFinDeSemanaNoHabilitado) {
                return res.json({
                    hay_clases: false,
                    motivo: "Fin de Semana",
                    tipo: "weekend",
                    nombre_escuela: nombreEscuela
                });
            }

            // B) Checar Día Inhábil de la Institución
            const diaInhabil = await db.get('SELECT * FROM Dias_Inhabiles WHERE fecha = ? AND institucion_id = ?', [fechaStr, institucion_id]);
            if (diaInhabil) {
                return res.json({
                    hay_clases: false,
                    motivo: diaInhabil.motivo || "Día Inhábil (Suspensión Programada)",
                    tipo: "holiday",
                    nombre_escuela: nombreEscuela
                });
            }

            // C) Si no, hay clases
            return res.json({
                hay_clases: true,
                nombre_escuela: nombreEscuela,
                admitir_sabado: admitirSabado,
                admitir_domingo: admitirDomingo
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error verificando estado del día' });
        }
    },

    // 2. Obtener Calendario Escolar (Días Inhábiles)
    obtenerCalendario: async (req, res) => {
        try {
            const institucion_id = req.query.institucion_id || 1;
            const dias = await db.all('SELECT fecha FROM Dias_Inhabiles WHERE institucion_id = ? ORDER BY fecha ASC', [institucion_id]);
            res.json(dias);
        } catch (error) {
            res.status(500).json({ error: 'Error obteniendo calendario' });
        }
    },

    // 3. Historial de Asistencia por NFC Del Alumno
    obtenerHistorialAlumno: async (req, res) => {
        const { nfc_uid } = req.params;
        try {
            const alumno = await db.get("SELECT id, nombre_completo, clase_id FROM Alumnos WHERE UPPER(REPLACE(REPLACE(REPLACE(nfc_uid, ':', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE($1, ':', ''), '-', ''), ' ', ''))", [nfc_uid]);

            if (!alumno) {
                return res.status(404).json({ error: 'Alumno no encontrado con ese NFC' });
            }

            // Obtener últimas 20 asistencias con materia/clase si aplica
            const historial = await db.all(`
                SELECT A.fecha_hora, A.status, A.justificacion, 
                       M.nombre_materia
                FROM Asistencias A
                LEFT JOIN Clases C ON A.clase_id = C.id
                LEFT JOIN Materias M ON C.materia_id = M.id
                WHERE A.alumno_id = ? 
                ORDER BY A.fecha_hora DESC 
                LIMIT 20
            `, [alumno.id]);

            res.json({
                alumno: alumno,
                historial: historial
            });

        } catch (error) {
            res.status(500).json({ error: 'Error consultando historial' });
        }
    },

    // 4. Panel de "Hora de Salida/Entrada" (Filtrado por Grado)
    obtenerEstadoGrados: async (req, res) => {
        try {
            const institucion_id = req.query.institucion_id || 1;

            // Esta lógica es aproximada. Muestra la última actividad de cada grado.
            // Agrupamos por grado y vemos la última asistencia registrada.

            const estadoGrados = await db.all(`
                SELECT 
                    g.nombre_grado,
                    COUNT(DISTINCT a.id) as total_alumnos,
                    MAX(ast.fecha_hora) as ultima_actividad_registrada
                FROM Grados g
                JOIN Clases c ON c.grado_id = g.id
                JOIN Alumnos a ON a.clase_id = c.id
                LEFT JOIN Asistencias ast ON ast.alumno_id = a.id 
                    AND DATE(ast.fecha_hora AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
                WHERE g.institucion_id = ? 
                GROUP BY g.id, g.nombre_grado
                ORDER BY g.nombre_grado
            `, [institucion_id]);

            // Añadir lógica de "Hora de Salida" basada en Config (si aplica)
            // O simplemente devolver los datos crudos para el front
            res.json(estadoGrados);

        } catch (error) {
            res.status(500).json({ error: 'Error obteniendo estado de grados' });
        }
    },

    // 5. Obtener Avisos Públicos
    obtenerAvisos: async (req, res) => {
        try {
            const institucion_id = req.query.institucion_id || 1;
            const avisos = await db.all(
                `SELECT * FROM Avisos WHERE institucion_id = ? ORDER BY fecha_creacion DESC`,
                [institucion_id]
            );
            res.json(avisos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error obteniendo avisos' });
        }
    }
};

module.exports = PortalController;
