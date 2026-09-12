const { db } = require('../config/database');

class AlumnoService {
    static async obtenerAlumnos(institucionId, maestroId = null) {
        const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

        const isSQLite = !process.env.DATABASE_URL;
        const subqueryClases = isSQLite
            ? `(SELECT group_concat(g.nombre_grado || ' ' || gr.nombre_grupo || COALESCE(' (' || m.nombre_materia || ')', ''), ', ') 
                FROM Alumnos_Clases ac 
                JOIN Clases c ON ac.clase_id = c.id 
                JOIN Grados g ON c.grado_id = g.id 
                JOIN Grupos gr ON c.grupo_id = gr.id 
                LEFT JOIN Materias m ON c.materia_id = m.id 
                WHERE ac.alumno_id = A.id)`
            : `(SELECT string_agg(g.nombre_grado || ' ' || gr.nombre_grupo || COALESCE(' (' || m.nombre_materia || ')', ''), ', ') 
                FROM Alumnos_Clases ac 
                JOIN Clases c ON ac.clase_id = c.id 
                JOIN Grados g ON c.grado_id = g.id 
                JOIN Grupos gr ON c.grupo_id = gr.id 
                LEFT JOIN Materias m ON c.materia_id = m.id 
                WHERE ac.alumno_id = A.id)`;

        const subqueryClaseIds = isSQLite
            ? `(SELECT group_concat(ac.clase_id, ',') FROM Alumnos_Clases ac WHERE ac.alumno_id = A.id)`
            : `(SELECT string_agg(ac.clase_id::text, ',') FROM Alumnos_Clases ac WHERE ac.alumno_id = A.id)`;

        let query = `
          SELECT A.id, A.nombre_completo, COALESCE(A.codigo_qr, A.nfc_uid) AS codigo_qr, A.nfc_uid, A.telefono_tutor, A.clase_id, G.nombre_grado, GR.nombre_grupo,
                 ${subqueryClases} AS clases_matriculadas,
                 ${subqueryClaseIds} AS clase_ids_str
          FROM Alumnos A
          LEFT JOIN Clases C ON A.clase_id = C.id
          LEFT JOIN Grados G ON C.grado_id = G.id
          LEFT JOIN Grupos GR ON C.grupo_id = GR.id
          WHERE A.institucion_id = $1
        `;
        const params = [institucionId];
        if (maestroId) {
            if (isModeloDepartamental) {
                query += ` AND A.id IN (
                    SELECT AC.alumno_id 
                    FROM Alumnos_Clases AC
                    JOIN Clases CL ON AC.clase_id = CL.id
                    WHERE CL.maestro_id = $2
                )`;
            } else {
                query += " AND C.maestro_id = $2";
            }
            params.push(maestroId);
        }
        query += " ORDER BY G.nombre_grado, GR.nombre_grupo, A.nombre_completo";
        return await db.all(query, params);
    }

    static async registrarAlumno(data, institucionId) {
        const { nombre_completo, nfc_uid, codigo_qr, telefono_tutor, clase_id, clase_ids } = data;

        const claseCheck = await db.get("SELECT id FROM Clases WHERE id = $1 AND institucion_id = $2", [clase_id, institucionId]);
        if (!claseCheck) throw new Error('Clase inválida.');

        // Auto-generar código QR único si no se proporcionó uno
        const qrGenerado = codigo_qr || nfc_uid || ('ALU-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase());
        const nfcValor = nfc_uid || qrGenerado;

        try {
            const res = await db.run(
                'INSERT INTO Alumnos (nombre_completo, nfc_uid, codigo_qr, telefono_tutor, clase_id, institucion_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [nombre_completo, nfcValor, qrGenerado, telefono_tutor, clase_id, institucionId]
            );

            // Si el modelo departamental está activo, registrar también en Alumnos_Clases
            const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [institucionId]);
            const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

            if (isModeloDepartamental) {
                const alumnoId = res.lastID;
                const ids = (clase_ids && Array.isArray(clase_ids)) ? clase_ids : [clase_id];
                for (const cid of ids) {
                    const cCheck = await db.get("SELECT id FROM Clases WHERE id = $1 AND institucion_id = $2", [cid, institucionId]);
                    if (cCheck) {
                        const isSQLite = !process.env.DATABASE_URL;
                        const sqlMat = isSQLite
                            ? "INSERT OR IGNORE INTO Alumnos_Clases (alumno_id, clase_id, institucion_id) VALUES ($1, $2, $3)"
                            : "INSERT INTO Alumnos_Clases (alumno_id, clase_id, institucion_id) VALUES ($1, $2, $3) ON CONFLICT (alumno_id, clase_id) DO NOTHING";
                        await db.run(sqlMat, [alumnoId, cid, institucionId]);
                    }
                }
            }
        } catch (error) {
            if (error.message.includes('unique') || error.message.includes('nfc_uid') || error.message.includes('codigo_qr')) {
                throw new Error('Ese código QR o identificador ya está registrado.');
            }
            throw error;
        }
    }

    static async borrarAlumno(id, institucionId) {
        const alumno = await db.get("SELECT institucion_id FROM Alumnos WHERE id = $1", [id]);
        if (!alumno || alumno.institucion_id !== institucionId) throw new Error('No permitido');

        await db.run("DELETE FROM Asistencias WHERE alumno_id = $1", [id]);
        await db.run("DELETE FROM Alumnos_Clases WHERE alumno_id = $1", [id]);
        await db.run("DELETE FROM Alumnos WHERE id = $1", [id]);
    }

    static async actualizarAlumno(id, data, institucionId) {
        const { nombre_completo, nfc_uid, codigo_qr, telefono_tutor, clase_id, clase_ids } = data;

        // Verificación de pertenencia
        const alumno = await db.get("SELECT institucion_id FROM Alumnos WHERE id = $1", [id]);
        if (!alumno || alumno.institucion_id !== institucionId) throw new Error('No permitido o no encontrado.');

        // Verificación de clase
        if (clase_id) {
            const claseCheck = await db.get("SELECT id FROM Clases WHERE id = $1 AND institucion_id = $2", [clase_id, institucionId]);
            if (!claseCheck) throw new Error('Clase inválida.');
        }

        const qrVal = codigo_qr || nfc_uid || alumno.codigo_qr;
        const nfcVal = nfc_uid || codigo_qr || alumno.nfc_uid;

        try {
            await db.run(
                `UPDATE Alumnos 
                 SET nombre_completo = COALESCE($1, nombre_completo),
                     nfc_uid = COALESCE($2, nfc_uid),
                     codigo_qr = COALESCE($3, codigo_qr),
                     telefono_tutor = COALESCE($4, telefono_tutor),
                     clase_id = COALESCE($5, clase_id)
                 WHERE id = $6 AND institucion_id = $7`,
                [nombre_completo, nfcVal, qrVal, telefono_tutor, clase_id, id, institucionId]
            );

            // Si el modelo departamental está activo y se pasaron clase_ids, sincronizar matrícula
            const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [institucionId]);
            const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

            if (isModeloDepartamental && clase_ids && Array.isArray(clase_ids)) {
                // Eliminar matrícula anterior
                await db.run("DELETE FROM Alumnos_Clases WHERE alumno_id = $1 AND institucion_id = $2", [id, institucionId]);
                
                // Registrar nueva matrícula
                for (const cid of clase_ids) {
                    const cCheck = await db.get("SELECT id FROM Clases WHERE id = $1 AND institucion_id = $2", [cid, institucionId]);
                    if (cCheck) {
                        const isSQLite = !process.env.DATABASE_URL;
                        const sqlMat = isSQLite
                            ? "INSERT OR IGNORE INTO Alumnos_Clases (alumno_id, clase_id, institucion_id) VALUES ($1, $2, $3)"
                            : "INSERT INTO Alumnos_Clases (alumno_id, clase_id, institucion_id) VALUES ($1, $2, $3) ON CONFLICT (alumno_id, clase_id) DO NOTHING";
                        await db.run(sqlMat, [id, cid, institucionId]);
                    }
                }
            }
        } catch (error) {
            if (error.message.includes('unique') || error.message.includes('nfc_uid')) {
                throw new Error('Esa tarjeta NFC ya está en uso por otro alumno.');
            }
            throw error;
        }
    }
}

module.exports = AlumnoService;
