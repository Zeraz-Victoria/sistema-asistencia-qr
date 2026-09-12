const { db } = require('../config/database');

class AsistenciaService {
    static async marcarAsistencia(uid, usuario, fechaOffline = null) {
        if (!uid) throw new Error('No UID');

        // Buscar el alumno con detalles de escuela y clase
        const alumnoQuery = `
            SELECT a.*, i.nombre as nombre_escuela, g.nombre_grado, gr.nombre_grupo 
            FROM Alumnos a 
            LEFT JOIN Instituciones i ON a.institucion_id = i.id 
            LEFT JOIN Clases c ON a.clase_id = c.id 
            LEFT JOIN Grados g ON c.grado_id = g.id 
            LEFT JOIN Grupos gr ON c.grupo_id = gr.id 
            WHERE UPPER(TRIM(COALESCE(a.codigo_qr, a.nfc_uid))) = UPPER(TRIM($1))
               OR UPPER(REPLACE(REPLACE(REPLACE(COALESCE(a.codigo_qr, a.nfc_uid), ':', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE($1, ':', ''), '-', ''), ' ', ''))
        `;
        const alumno = await db.get(alumnoQuery, [uid]);

        if (!alumno) {
            // Verificar si pertenece a un Maestro/Usuario
            const userQuery = `
                SELECT u.nombre_completo, u.rol, i.nombre as nombre_escuela 
                FROM Usuarios u 
                LEFT JOIN Instituciones i ON u.institucion_id = i.id 
                WHERE UPPER(TRIM(COALESCE(u.codigo_qr, u.nfc_uid))) = UPPER(TRIM($1))
                   OR UPPER(REPLACE(REPLACE(REPLACE(COALESCE(u.codigo_qr, u.nfc_uid), ':', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE($1, ':', ''), '-', ''), ' ', ''))
            `;
            const otherUser = await db.get(userQuery, [uid]);
            if (otherUser) {
                throw new Error(`Este código pertenece al ${otherUser.rol === 'maestro' ? 'docente' : otherUser.rol} ${otherUser.nombre_completo}.`);
            }
            throw new Error(`Código QR no registrado: ${uid}`);
        }

        if (alumno.institucion_id !== usuario.institucion_id) {
            throw new Error(`Esta tarjeta pertenece al alumno ${alumno.nombre_completo} de otra escuela (${alumno.nombre_escuela || 'Principal'}).`);
        }

        // Consultar configuración del Modelo Departamental
        const configEscuela = await db.get("SELECT modelo_departamental, hora_entrada FROM Configuracion WHERE institucion_id = $1", [usuario.institucion_id]);
        const modeloDepartamental = configEscuela ? configEscuela.modelo_departamental === 1 : false;

        const dateObj = fechaOffline ? new Date(fechaOffline) : new Date();
        const dateCDMX = new Date(dateObj.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
        const isSQLite = !process.env.DATABASE_URL;

        if (modeloDepartamental) {
            // --- MODO DEPARTAMENTAL POR ASIGNATURA ---
            if (usuario.rol !== 'maestro') {
                throw new Error("El pase de lista por materia requiere que un docente tenga sesión activa.");
            }

            const day = dateCDMX.getDay();
            const diaSemana = day === 0 ? 7 : day;
            const hours = String(dateCDMX.getHours()).padStart(2, '0');
            const minutes = String(dateCDMX.getMinutes()).padStart(2, '0');
            const seconds = String(dateCDMX.getSeconds()).padStart(2, '0');
            const horaActual = `${hours}:${minutes}:${seconds}`;

            let query;
            if (isSQLite) {
                query = `
                    SELECT c.id as clase_id, m.nombre_materia, g.nombre_grado, gr.nombre_grupo, h.hora_inicio, h.hora_fin
                    FROM Clases c
                    JOIN Horarios_Clases h ON c.id = h.clase_id
                    JOIN Materias m ON c.materia_id = m.id
                    JOIN Grados g ON c.grado_id = g.id
                    JOIN Grupos gr ON c.grupo_id = gr.id
                    WHERE c.maestro_id = $1
                      AND h.dia_semana = $2
                      AND time($3) BETWEEN time(h.hora_inicio, '-10 minutes') AND time(h.hora_fin)
                    ORDER BY 
                      CASE 
                        WHEN time($3) >= time(h.hora_inicio) AND time($3) <= time(h.hora_fin) THEN 1 
                        ELSE 2 
                      END ASC,
                      h.hora_inicio ASC
                `;
            } else {
                query = `
                    SELECT c.id as clase_id, m.nombre_materia, g.nombre_grado, gr.nombre_grupo, h.hora_inicio, h.hora_fin
                    FROM Clases c
                    JOIN Horarios_Clases h ON c.id = h.clase_id
                    JOIN Materias m ON c.materia_id = m.id
                    JOIN Grados g ON c.grado_id = g.id
                    JOIN Grupos gr ON c.grupo_id = gr.id
                    WHERE c.maestro_id = $1
                      AND h.dia_semana = $2
                      AND $3::time BETWEEN (h.hora_inicio - INTERVAL '10 minutes') AND h.hora_fin
                    ORDER BY 
                      CASE 
                        WHEN $3::time >= h.hora_inicio AND $3::time <= h.hora_fin THEN 1 
                        ELSE 2 
                      END ASC,
                      h.hora_inicio ASC
                `;
            }

            const activeClasses = await db.all(query, [usuario.id, diaSemana, horaActual]);
            if (!activeClasses || activeClasses.length === 0) {
                throw new Error("No tienes ninguna materia/clase programada en este horario.");
            }

            // Filtrar las clases del bloque actual (simultáneas si hay Telesecundaria / Multigrado)
            const currentBlockClasses = activeClasses.filter(c =>
                c.hora_inicio === activeClasses[0].hora_inicio &&
                c.hora_fin === activeClasses[0].hora_fin
            );

            // Validar si el alumno está matriculado en alguna de las clases activas
            let matchedClass = null;
            for (const cls of currentBlockClasses) {
                const matriculado = await db.get(
                    "SELECT 1 FROM Alumnos_Clases WHERE alumno_id = $1 AND clase_id = $2",
                    [alumno.id, cls.clase_id]
                );
                if (matriculado) {
                    matchedClass = cls;
                    break;
                }
            }

            if (!matchedClass) {
                if (currentBlockClasses.length === 1) {
                    throw new Error(`El alumno ${alumno.nombre_completo} no está matriculado en la clase de ${currentBlockClasses[0].nombre_materia}.`);
                } else {
                    const gruposTxt = currentBlockClasses.map(c => `${c.nombre_grado} "${c.nombre_grupo}"`).join(' / ');
                    throw new Error(`El alumno ${alumno.nombre_completo} no está matriculado en las clases activas (${gruposTxt}).`);
                }
            }

            const activeClass = matchedClass;

            // Validar si ya registró asistencia hoy en esta clase
            const queryHoy = isSQLite
                ? "SELECT * FROM Asistencias WHERE alumno_id = $1 AND clase_id = $2 AND date(fecha_hora, 'localtime') = date($3, 'localtime')"
                : "SELECT * FROM Asistencias WHERE alumno_id = $1 AND clase_id = $2 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = DATE($3 AT TIME ZONE 'America/Mexico_City')";
            const registroHoy = await db.get(queryHoy, [alumno.id, activeClass.clase_id, dateObj.toISOString()]);
            if (registroHoy) return { status: 'warning', message: `Ya registrado hoy en ${activeClass.nombre_materia} (${registroHoy.status || 'presente'})` };

            // Calcular retardo según hora_inicio de la clase:
            // Tolerancia de 10 min: diff <= 10 es 'presente' (verde / success)
            // Posterior a 10 min: diff > 10 es 'retardo' (amarillo / warning)
            // 'falta' solo aplica si el alumno NO asiste
            let status = 'presente';
            let responseStatus = 'success';
            let mensajeExtra = '';
            if (activeClass.hora_inicio) {
                const horaActualMinutos = dateCDMX.getHours() * 60 + dateCDMX.getMinutes();
                const [h, m] = activeClass.hora_inicio.split(':').map(Number);
                const minutosInicio = h * 60 + m;
                const diff = horaActualMinutos - minutosInicio;
                if (diff > 10) {
                    status = 'retardo';
                    responseStatus = 'warning';
                    mensajeExtra = ' (Retardo)';
                } else {
                    status = 'presente';
                    responseStatus = 'success';
                    mensajeExtra = '';
                }
            }

            await db.run('INSERT INTO Asistencias (alumno_id, fecha_hora, institucion_id, status, clase_id) VALUES ($1, $2, $3, $4, $5)',
                [alumno.id, dateObj.toISOString(), usuario.institucion_id, status, activeClass.clase_id]);

            return { 
                status: responseStatus, 
                message: `¡Bienvenido a ${activeClass.nombre_materia}, ${alumno.nombre_completo}!${mensajeExtra}`,
                asistencia_status: status
            };

        } else {
            // --- MODO TRADICIONAL (Comportamiento actual) ---
            if (usuario.rol === 'maestro') {
                const claseDelMaestro = await db.get("SELECT id FROM Clases WHERE maestro_id = $1 AND id = $2", [usuario.id, alumno.clase_id]);
                if (!claseDelMaestro) {
                    throw new Error(`El alumno ${alumno.nombre_completo} es de ${alumno.nombre_grado || ''} "${alumno.nombre_grupo || ''}", no pertenece a tu clase.`);
                }
            }

            const queryHoy = isSQLite
                ? "SELECT * FROM Asistencias WHERE alumno_id = $1 AND date(fecha_hora, 'localtime') = date($2, 'localtime')"
                : "SELECT * FROM Asistencias WHERE alumno_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = DATE($2 AT TIME ZONE 'America/Mexico_City')";

            const registroHoy = await db.get(queryHoy, [alumno.id, dateObj.toISOString()]);
            if (registroHoy) return { status: 'warning', message: `Ya registrado hoy (${registroHoy.status || 'presente'})` };

            let status = 'presente';
            let responseStatus = 'success';
            let mensajeExtra = '';

            if (configEscuela && configEscuela.hora_entrada) {
                const horaActualMinutos = dateCDMX.getHours() * 60 + dateCDMX.getMinutes();
                const [h, m] = configEscuela.hora_entrada.split(':').map(Number);
                const minutosEntrada = h * 60 + m;
                const diff = horaActualMinutos - minutosEntrada;
                if (diff > 10) {
                    status = 'retardo';
                    responseStatus = 'warning';
                    mensajeExtra = ' (Retardo)';
                } else {
                    status = 'presente';
                    responseStatus = 'success';
                    mensajeExtra = '';
                }
            }

            await db.run('INSERT INTO Asistencias (alumno_id, fecha_hora, institucion_id, status) VALUES ($1, $2, $3, $4)',
                [alumno.id, dateObj.toISOString(), usuario.institucion_id, status]);

            return { 
                status: responseStatus, 
                message: `¡Bienvenido, ${alumno.nombre_completo}!${mensajeExtra}`,
                asistencia_status: status 
            };
        }
    }

    // --- SYNC & JUSTIFICACION ---
    static async syncAsistencia(scans, usuario) {
        // scans es array de { uid, timestamp }
        const resultados = { success: 0, failed: 0, errors: [] };
        const isSQLite = !process.env.DATABASE_URL;

        for (const scan of scans) {
            try {
                // 1. Verificar si el UID pertenece a un maestro
                const maestro = await db.get(
                    "SELECT id, nombre_completo, institucion_id FROM Usuarios WHERE nfc_uid = $1 AND rol = 'maestro'",
                    [scan.uid]
                );

                if (maestro) {
                    // Sincronizar salida del docente
                    const fechaActual = new Date(scan.timestamp);
                    const qUltimo = isSQLite
                        ? "SELECT fecha_hora FROM Asistencias_Maestros WHERE maestro_id = $1 AND date(fecha_hora, 'localtime') = date($2, 'localtime') ORDER BY fecha_hora DESC LIMIT 1"
                        : "SELECT fecha_hora FROM Asistencias_Maestros WHERE maestro_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = DATE($2 AT TIME ZONE 'America/Mexico_City') ORDER BY fecha_hora DESC LIMIT 1";

                    const ultimoRegistro = await db.get(qUltimo, [maestro.id, fechaActual.toISOString()]);

                    let shouldInsert = false;
                    let status = 'presente';

                    if (!ultimoRegistro) {
                        shouldInsert = true;
                        // Calcular entrada tarde si es primer registro
                        const config = await db.get("SELECT hora_entrada FROM Configuracion WHERE institucion_id = $1", [maestro.institucion_id]);
                        if (config && config.hora_entrada) {
                            const fechaCDMX = new Date(fechaActual.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
                            const horaActual = fechaCDMX.getHours() * 60 + fechaCDMX.getMinutes();
                            const [h, m] = config.hora_entrada.split(':').map(Number);
                            const minutosEntrada = h * 60 + m;
                            const diff = horaActual - minutosEntrada;
                            if (diff > 10) status = 'retardo';
                            else status = 'presente';
                        }
                    } else {
                        const lastTime = new Date(ultimoRegistro.fecha_hora);
                        const diffMins = (fechaActual - lastTime) / 1000 / 60;
                        if (diffMins > 10) {
                            shouldInsert = true;
                        }
                    }

                    if (shouldInsert) {
                        await db.run(
                            "INSERT INTO Asistencias_Maestros (maestro_id, fecha_hora, status, institucion_id) VALUES ($1, $2, $3, $4)",
                            [maestro.id, fechaActual.toISOString(), status, maestro.institucion_id]
                        );
                    }
                    resultados.success++;
                } else {
                    // Enviamos timestamp offline para que se calcule el retardo/falta correctamente
                    await AsistenciaService.marcarAsistencia(scan.uid, usuario, scan.timestamp);
                    resultados.success++;
                }
            } catch (error) {
                resultados.failed++;
                resultados.errors.push({ uid: scan.uid, error: error.message });
            }
        }
        return resultados;
    }

    static async justificarAsistencia(alumnoId, motivo, usuario) {
        // Busca asistencia de HOY (o debería ser una fecha específica? asumimos HOY por simplicidad del kiosco)
        // O mejor, buscamos la ÚLTIMA asistencia del día

        // 1. Verificar que sea alumno de la inst
        const alumno = await db.get('SELECT * FROM Alumnos WHERE id = $1 AND institucion_id = $2', [alumnoId, usuario.institucion_id]);
        if (!alumno) throw new Error('Alumno no encontrado');

        const isSQLite = !process.env.DATABASE_URL;
        const queryHoy = isSQLite
            ? "SELECT id FROM Asistencias WHERE alumno_id = $1 AND date(fecha_hora, 'localtime') = date('now', 'localtime')"
            : "SELECT id FROM Asistencias WHERE alumno_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE";

        // 2. Buscar asistencia de hoy
        const asistencia = await db.get(queryHoy, [alumnoId]);

        if (!asistencia) {
            // Si no hay asistencia hoy, creamos una "Justificada" directa?
            // "justificar una inasistencia" implica que NO vino o llegó tarde.
            // Si no vino, no hay registro. Creamos uno con status 'justificada'.
            await db.run('INSERT INTO Asistencias (alumno_id, fecha_hora, institucion_id, status, justificacion) VALUES ($1, $2, $3, $4, $5)',
                [alumnoId, new Date().toISOString(), usuario.institucion_id, 'justificada', motivo]);
        } else {
            // Si YA vino (ej. falta por retardo, o retardo), actualizamos a 'justificada'
            await db.run('UPDATE Asistencias SET status = $1, justificacion = $2 WHERE id = $3',
                ['justificada', motivo, asistencia.id]);
        }

        return { status: 'ok', message: 'Asistencia justificada correctamente' };
    }

    // --- CALENDARIO ---
    static async obtenerDiasInhabiles(institucionId, mes) {
        const q = mes ?
            "SELECT fecha, motivo FROM Dias_Inhabiles WHERE institucion_id = $1 AND to_char(fecha, 'YYYY-MM') = $2" :
            "SELECT fecha, motivo FROM Dias_Inhabiles WHERE institucion_id = $1";

        const params = mes ? [institucionId, mes] : [institucionId];
        const rows = await db.all(q, params);
        // Retornamos el objeto completo { fecha, motivo }
        return rows.map(r => ({ fecha: r.fecha.toISOString().split('T')[0], motivo: r.motivo }));
    }

    static async agregarDiaInhabil(institucionId, fecha, motivo) {
        await db.run(
            "INSERT INTO Dias_Inhabiles (fecha, institucion_id, motivo) VALUES ($1, $2, $3) ON CONFLICT (fecha, institucion_id) DO UPDATE SET motivo = $3",
            [fecha, institucionId, motivo || null]
        );
    }

    static async quitarDiaInhabil(institucionId, fecha) {
        await db.run(
            "DELETE FROM Dias_Inhabiles WHERE fecha = $1 AND institucion_id = $2",
            [fecha, institucionId]
        );
    }

    // --- ACTIVIDADES / TAREAS ---
    static async obtenerActividades(institucionId, claseId = null) {
        if (claseId) {
            return await db.all('SELECT * FROM Actividades WHERE institucion_id = $1 AND (clase_id = $2 OR clase_id IS NULL) ORDER BY fecha_creacion DESC', [institucionId, claseId]);
        }
        return await db.all('SELECT * FROM Actividades WHERE institucion_id = $1 ORDER BY fecha_creacion DESC', [institucionId]);
    }

    static async crearActividad(titulo, descripcion, institucionId, claseId = null) {
        if (!titulo) throw new Error('El título de la actividad es requerido.');
        const res = await db.run('INSERT INTO Actividades (titulo, descripcion, institucion_id, clase_id) VALUES ($1, $2, $3, $4)', [titulo, descripcion || '', institucionId, claseId]);
        return res;
    }

    static async editarActividad(actividadId, titulo, descripcion, institucionId) {
        if (!titulo || !titulo.trim()) throw new Error('El título de la actividad es requerido.');
        return await db.run(
            'UPDATE Actividades SET titulo = $1, descripcion = $2 WHERE id = $3 AND institucion_id = $4',
            [titulo.trim(), descripcion || '', actividadId, institucionId]
        );
    }

    static async borrarActividad(actividadId, institucionId) {
        return await db.run('DELETE FROM Actividades WHERE id = $1 AND institucion_id = $2', [actividadId, institucionId]);
    }

    static async marcarEntregaActividad(uid, actividadId, usuario, alumnoId = null) {
        if (!uid && !alumnoId) throw new Error('No se recibió código QR ni alumno.');
        if (!actividadId) throw new Error('Por favor selecciona una tarea/actividad.');

        let alumno;
        if (alumnoId) {
            alumno = await db.get("SELECT * FROM Alumnos WHERE id = $1", [alumnoId]);
        } else {
            alumno = await db.get(`
                SELECT * FROM Alumnos 
                WHERE UPPER(TRIM(COALESCE(codigo_qr, nfc_uid))) = UPPER(TRIM($1))
                   OR UPPER(REPLACE(REPLACE(REPLACE(COALESCE(codigo_qr, nfc_uid), ':', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE($1, ':', ''), '-', ''), ' ', ''))
            `, [uid]);
        }
        if (!alumno) throw new Error('Alumno no encontrado.');

        if (alumno.institucion_id !== usuario.institucion_id) throw new Error('Otra escuela.');

        if (usuario.rol === 'maestro') {
            const claseDelMaestro = await db.get("SELECT id FROM Clases WHERE maestro_id = $1 AND id = $2", [usuario.id, alumno.clase_id]);
            if (!claseDelMaestro) throw new Error('No es alumno tuyo.');
        }

        const actividad = await db.get("SELECT * FROM Actividades WHERE id = $1 AND institucion_id = $2", [actividadId, usuario.institucion_id]);
        if (!actividad) throw new Error('Actividad no encontrada.');

        // SI la actividad tiene clase_id (está asociada a un grupo/materia específico)
        if (actividad.clase_id) {
            const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [usuario.institucion_id]);
            const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

            if (isModeloDepartamental) {
                const matriculado = await db.get("SELECT 1 FROM Alumnos_Clases WHERE alumno_id = $1 AND clase_id = $2", [alumno.id, actividad.clase_id]);
                if (!matriculado) throw new Error('El alumno no está matriculado en la clase/materia de esta tarea.');
            } else {
                if (alumno.clase_id !== actividad.clase_id) throw new Error('El alumno no pertenece al grupo de esta tarea.');
            }
        }

        const entregaPrevia = await db.get("SELECT * FROM Entregas_Actividades WHERE actividad_id = $1 AND alumno_id = $2", [actividadId, alumno.id]);
        if (entregaPrevia) {
            return { status: 'warning', message: `⚠️ ${alumno.nombre_completo} ya entregó "${actividad.titulo}" anteriormente.` };
        }

        const fechaAhora = new Date().toISOString();
        await db.run('INSERT INTO Entregas_Actividades (actividad_id, alumno_id, fecha_hora, institucion_id) VALUES ($1, $2, $3, $4)',
            [actividadId, alumno.id, fechaAhora, usuario.institucion_id]);

        return { status: 'success', message: `✅ Tarea entregada: ${alumno.nombre_completo} - "${actividad.titulo}"` };
    }

    static async obtenerClaseActivaDocente(usuario) {
        if (!usuario || usuario.rol !== 'maestro') return null;

        // Verificar si la escuela tiene habilitado el modelo departamental
        const config = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [usuario.institucion_id]);
        if (!config || config.modelo_departamental !== 1) return null;

        const fechaCDMX = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
        const day = fechaCDMX.getDay();
        const diaSemana = day === 0 ? 7 : day;
        const hours = String(fechaCDMX.getHours()).padStart(2, '0');
        const minutes = String(fechaCDMX.getMinutes()).padStart(2, '0');
        const seconds = String(fechaCDMX.getSeconds()).padStart(2, '0');
        const horaActual = `${hours}:${minutes}:${seconds}`;

        const isSQLite = !process.env.DATABASE_URL;
        let query;
        if (isSQLite) {
            query = `
                SELECT c.id as clase_id, m.nombre_materia, g.nombre_grado, gr.nombre_grupo, h.hora_inicio, h.hora_fin
                FROM Clases c
                JOIN Horarios_Clases h ON c.id = h.clase_id
                JOIN Materias m ON c.materia_id = m.id
                JOIN Grados g ON c.grado_id = g.id
                JOIN Grupos gr ON c.grupo_id = gr.id
                WHERE c.maestro_id = $1
                  AND h.dia_semana = $2
                  AND time($3) BETWEEN time(h.hora_inicio, '-10 minutes') AND time(h.hora_fin)
                ORDER BY 
                  CASE 
                    WHEN time($3) >= time(h.hora_inicio) AND time($3) <= time(h.hora_fin) THEN 1 
                    ELSE 2 
                  END ASC,
                  h.hora_inicio ASC
            `;
        } else {
            query = `
                SELECT c.id as clase_id, m.nombre_materia, g.nombre_grado, gr.nombre_grupo, h.hora_inicio, h.hora_fin
                FROM Clases c
                JOIN Horarios_Clases h ON c.id = h.clase_id
                JOIN Materias m ON c.materia_id = m.id
                JOIN Grados g ON c.grado_id = g.id
                JOIN Grupos gr ON c.grupo_id = gr.id
                WHERE c.maestro_id = $1
                  AND h.dia_semana = $2
                  AND $3::time BETWEEN (h.hora_inicio - INTERVAL '10 minutes') AND h.hora_fin
                ORDER BY 
                  CASE 
                    WHEN $3::time >= h.hora_inicio AND $3::time <= h.hora_fin THEN 1 
                    ELSE 2 
                  END ASC,
                  h.hora_inicio ASC
            `;
        }

        const activeClasses = await db.all(query, [usuario.id, diaSemana, horaActual]);
        if (!activeClasses || activeClasses.length === 0) return null;

        // Si hay múltiples clases simultáneas (Telesecundaria / Multigrado), agruparlas
        const currentBlockClasses = activeClasses.filter(c =>
            c.hora_inicio === activeClasses[0].hora_inicio &&
            c.hora_fin === activeClasses[0].hora_fin
        );

        const nombresGrados = [...new Set(currentBlockClasses.map(c => c.nombre_grado))].join(' y ');
        const nombresGrupos = [...new Set(currentBlockClasses.map(c => c.nombre_grupo))].join(', ');

        return {
            clase_activa: true,
            clases: currentBlockClasses,
            clase_id: activeClasses[0].clase_id,
            nombre_materia: activeClasses[0].nombre_materia,
            nombre_grado: nombresGrados,
            nombre_grupo: nombresGrupos,
            hora_inicio: activeClasses[0].hora_inicio,
            hora_fin: activeClasses[0].hora_fin
        };
    }

    static async obtenerAsistenciasHoy(institucionId, fecha = null) {
        const isSQLite = !process.env.DATABASE_URL;
        const fechaFiltro = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const query = isSQLite
            ? `SELECT a.id, a.alumno_id, a.fecha_hora, a.status, a.justificacion, a.clase_id, al.nombre_completo, al.codigo_qr 
               FROM Asistencias a
               JOIN Alumnos al ON a.alumno_id = al.id
               WHERE a.institucion_id = $1 AND date(a.fecha_hora, 'localtime') = date($2)
               ORDER BY a.fecha_hora DESC`
            : `SELECT a.id, a.alumno_id, a.fecha_hora, a.status, a.justificacion, a.clase_id, al.nombre_completo, al.codigo_qr 
               FROM Asistencias a
               JOIN Alumnos al ON a.alumno_id = al.id
               WHERE a.institucion_id = $1 AND DATE(a.fecha_hora AT TIME ZONE 'America/Mexico_City') = DATE($2)
               ORDER BY a.fecha_hora DESC`;
        return await db.all(query, [institucionId, fechaFiltro]);
    }

    static async registrarAsistenciaManual(alumnoId, status, institucionId, fecha = null, justificacion = null) {
        const isSQLite = !process.env.DATABASE_URL;
        const fechaFiltro = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const alumno = await db.get("SELECT * FROM Alumnos WHERE id = $1 AND institucion_id = $2", [alumnoId, institucionId]);
        if (!alumno) throw new Error('Alumno no encontrado.');

        const queryHoy = isSQLite
            ? "SELECT * FROM Asistencias WHERE alumno_id = $1 AND date(fecha_hora, 'localtime') = date($2)"
            : "SELECT * FROM Asistencias WHERE alumno_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = DATE($2)";
        
        const existente = await db.get(queryHoy, [alumnoId, fechaFiltro]);
        if (existente) {
            await db.run("UPDATE Asistencias SET status = $1, justificacion = $2 WHERE id = $3", [status, justificacion, existente.id]);
            return { status: 'ok', message: `Asistencia actualizada a ${status}`, id: existente.id };
        } else {
            const fechaHora = fecha ? `${fecha}T12:00:00.000Z` : new Date().toISOString();
            const res = await db.run(
                "INSERT INTO Asistencias (alumno_id, fecha_hora, institucion_id, status, justificacion, clase_id) VALUES ($1, $2, $3, $4, $5, $6)",
                [alumnoId, fechaHora, institucionId, status, justificacion, alumno.clase_id]
            );
            return { status: 'ok', message: `Asistencia registrada como ${status}`, id: res.lastID };
        }
    }

    static async obtenerEntregasActividad(actividadId, institucionId) {
        return await db.all(`
            SELECT ea.id, ea.alumno_id, ea.fecha_hora, al.nombre_completo, al.codigo_qr
            FROM Entregas_Actividades ea
            JOIN Alumnos al ON ea.alumno_id = al.id
            WHERE ea.actividad_id = $1 AND ea.institucion_id = $2
            ORDER BY ea.fecha_hora DESC
        `, [actividadId, institucionId]);
    }

    static async toggleEntregaActividad(actividadId, alumnoId, institucionId) {
        const entrega = await db.get("SELECT * FROM Entregas_Actividades WHERE actividad_id = $1 AND alumno_id = $2 AND institucion_id = $3", [actividadId, alumnoId, institucionId]);
        if (entrega) {
            await db.run("DELETE FROM Entregas_Actividades WHERE id = $1", [entrega.id]);
            return { status: 'ok', entregado: false, message: 'Entrega desmarcada' };
        } else {
            const fechaAhora = new Date().toISOString();
            await db.run("INSERT INTO Entregas_Actividades (actividad_id, alumno_id, fecha_hora, institucion_id) VALUES ($1, $2, $3, $4)", [actividadId, alumnoId, fechaAhora, institucionId]);
            return { status: 'ok', entregado: true, message: 'Tarea marcada como entregada' };
        }
    }

}

module.exports = AsistenciaService;
