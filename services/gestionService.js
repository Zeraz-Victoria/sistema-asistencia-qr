const { db } = require('../config/database');
const bcrypt = require('bcrypt');

class GestionService {
    // --- GRADOS ---
    static async crearGrado(nombre, institucionId) {
        try {
            const res = await db.run(
                "INSERT INTO Grados (nombre_grado, institucion_id) VALUES ($1, $2)",
                [nombre, institucionId]
            );
            return { id: res.lastID, nombre };
        } catch (error) {
            if (error.message.includes('unique constraint') || error.message.includes('UNIQUE')) {
                throw new Error('Ese grado ya existe en tu escuela.');
            }
            throw error;
        }
    }

    static async obtenerGrados(institucionId) {
        return await db.all("SELECT * FROM Grados WHERE institucion_id = $1 ORDER BY id", [institucionId]);
    }

    static async eliminarGrado(id, institucionId) {
        // Encontrar clases de este grado
        const clases = await db.all("SELECT id FROM Clases WHERE grado_id = $1 AND institucion_id = $2", [id, institucionId]);

        for (const clase of clases) {
            await GestionService._borrarClaseCascada(clase.id, institucionId);
        }

        await db.run("DELETE FROM Grados WHERE id = $1 AND institucion_id = $2", [id, institucionId]);
    }

    // --- GRUPOS ---
    static async crearGrupo(nombre, institucionId) {
        try {
            const res = await db.run(
                "INSERT INTO Grupos (nombre_grupo, institucion_id) VALUES ($1, $2)",
                [nombre, institucionId]
            );
            return { id: res.lastID, nombre };
        } catch (error) {
            if (error.message.includes('unique constraint') || error.message.includes('UNIQUE')) {
                throw new Error('Ese grupo ya existe en tu escuela.');
            }
            throw error;
        }
    }

    static async obtenerGrupos(institucionId) {
        return await db.all("SELECT * FROM Grupos WHERE institucion_id = $1 ORDER BY nombre_grupo", [institucionId]);
    }

    static async eliminarGrupo(id, institucionId) {
        // Encontrar clases de este grupo
        const clases = await db.all("SELECT id FROM Clases WHERE grupo_id = $1 AND institucion_id = $2", [id, institucionId]);

        for (const clase of clases) {
            await GestionService._borrarClaseCascada(clase.id, institucionId);
        }

        await db.run("DELETE FROM Grupos WHERE id = $1 AND institucion_id = $2", [id, institucionId]);
    }

    // --- MAESTROS ---
    static async obtenerMaestros(institucionId) {
        return await db.all(
            "SELECT id, nombre_completo, email FROM Usuarios WHERE rol = 'maestro' AND institucion_id = $1",
            [institucionId]
        );
    }

    static async crearMaestro(data, institucionId) {
        const { nombre_completo, email, password, nfc_uid } = data;

        const finalEmail = email || `maestro_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@sistema.local`;
        const finalPassword = password || Math.random().toString(36).substr(2, 10);

        const existe = await db.get("SELECT id FROM Usuarios WHERE email = $1", [finalEmail]);
        if (existe) throw new Error('El email ya está registrado.');

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(finalPassword, salt);

        try {
            await db.run(
                "INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, nfc_uid, institucion_id) VALUES ($1, $2, 'maestro', $3, $4, $5)",
                [finalEmail, hash, nombre_completo, nfc_uid || null, institucionId]
            );
        } catch (error) {
            if (error.message.includes('unique') || error.message.includes('nfc_uid')) {
                throw new Error('Esa tarjeta NFC ya está en uso.');
            }
            throw error;
        }
    }

    static async actualizarMaestro(id, data, institucionId) {
        const { nombre_completo, email, password, nfc_uid } = data;

        // Verificar que el maestro existe y pertenece a la institución
        const maestro = await db.get("SELECT id FROM Usuarios WHERE id = $1 AND rol = 'maestro' AND institucion_id = $2", [id, institucionId]);
        if (!maestro) throw new Error('Maestro no encontrado.');

        // Verificar email duplicado (si se cambia)
        if (email) {
            const existe = await db.get("SELECT id FROM Usuarios WHERE email = $1 AND id != $2", [email, id]);
            if (existe) throw new Error('El email ya está uso por otro usuario.');
        }

        let query = "UPDATE Usuarios SET nombre_completo = COALESCE($1, nombre_completo), email = COALESCE($2, email), nfc_uid = COALESCE($3, nfc_uid)";
        const params = [nombre_completo, email, nfc_uid || null];
        let idx = 4;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            query += `, password_hash = $${idx}`;
            params.push(hash);
            idx++;
        }

        query += ` WHERE id = $${idx} AND institucion_id = $${idx + 1}`;
        params.push(id, institucionId);

        try {
            await db.run(query, params);
        } catch (error) {
            if (error.message.includes('unique') || error.message.includes('nfc_uid')) {
                throw new Error('Esa tarjeta NFC ya está en uso.');
            }
            throw error;
        }
    }

    static async eliminarMaestro(id, institucionId) {
        // Des-asignamos clases
        await db.run(`
            UPDATE Clases 
            SET maestro_id = NULL 
            WHERE maestro_id = $1 AND institucion_id = $2`,
            [id, institucionId]
        );

        // Borramos al usuario
        await db.run(
            "DELETE FROM Usuarios WHERE id = $1 AND rol = 'maestro' AND institucion_id = $2",
            [id, institucionId]
        );
    }

    // --- CLASES ---
    // --- CLASES ---
    static async crearClase(data, institucionId) {
        const { grado_id, grupo_id, maestro_id, materia_id } = data;
        const maestroIdFinal = maestro_id || null;
        const materiaIdFinal = materia_id || null;

        try {
            const res = await db.run(
                "INSERT INTO Clases (grado_id, grupo_id, maestro_id, materia_id, institucion_id) VALUES ($1, $2, $3, $4, $5)",
                [grado_id, grupo_id, maestroIdFinal, materiaIdFinal, institucionId]
            );
            return { id: res.lastID };
        } catch (error) {
            if (error.message.includes('unique constraint') || error.message.includes('UNIQUE')) {
                throw new Error('Esa combinación de grado, grupo y materia ya existe en tu escuela.');
            }
            throw error;
        }
    }

    static async crearClaseRapida(data, institucionId) {
        let { nombre, grado, grupo, materia } = data;
        nombre = (nombre || '').trim();
        if (!nombre && !grado) throw new Error('El nombre de la clase o grado es obligatorio.');

        let nombreGrado = (grado || nombre).trim();
        let nombreGrupo = (grupo || 'A').trim();

        // Buscar o crear grado
        let g = await db.get("SELECT id FROM Grados WHERE UPPER(TRIM(nombre_grado)) = UPPER(TRIM($1)) AND institucion_id = $2", [nombreGrado, institucionId]);
        let gradoId = g ? g.id : null;
        if (!gradoId) {
            const rG = await db.run("INSERT INTO Grados (nombre_grado, institucion_id) VALUES ($1, $2)", [nombreGrado, institucionId]);
            gradoId = rG.lastID;
        }

        // Buscar o crear grupo
        let gr = await db.get("SELECT id FROM Grupos WHERE UPPER(TRIM(nombre_grupo)) = UPPER(TRIM($1)) AND institucion_id = $2", [nombreGrupo, institucionId]);
        let grupoId = gr ? gr.id : null;
        if (!grupoId) {
            const rGr = await db.run("INSERT INTO Grupos (nombre_grupo, institucion_id) VALUES ($1, $2)", [nombreGrupo, institucionId]);
            grupoId = rGr.lastID;
        }

        let materiaId = null;
        if (materia && materia.trim()) {
            let m = await db.get("SELECT id FROM Materias WHERE UPPER(TRIM(nombre_materia)) = UPPER(TRIM($1)) AND institucion_id = $2", [materia.trim(), institucionId]);
            if (m) materiaId = m.id;
            else {
                const rM = await db.run("INSERT INTO Materias (nombre_materia, institucion_id) VALUES ($1, $2)", [materia.trim(), institucionId]);
                materiaId = rM.lastID;
            }
        }

        const claseExistente = await db.get(
            "SELECT id FROM Clases WHERE grado_id = $1 AND grupo_id = $2 AND institucion_id = $3",
            [gradoId, grupoId, institucionId]
        );
        if (claseExistente) return { id: claseExistente.id, message: 'La clase ya existe' };

        const rClase = await db.run(
            "INSERT INTO Clases (grado_id, grupo_id, materia_id, institucion_id) VALUES ($1, $2, $3, $4)",
            [gradoId, grupoId, materiaId, institucionId]
        );
        return { id: rClase.lastID, message: 'Clase creada con éxito' };
    }

    static async obtenerClases(institucionId) {
        const isSQLite = !process.env.DATABASE_URL;
        const subqueryHorarios = isSQLite
            ? `(SELECT group_concat(
                (CASE dia_semana 
                  WHEN 1 THEN 'Lun' 
                  WHEN 2 THEN 'Mar' 
                  WHEN 3 THEN 'Mié' 
                  WHEN 4 THEN 'Jue' 
                  WHEN 5 THEN 'Vie' 
                  WHEN 6 THEN 'Sáb' 
                  WHEN 7 THEN 'Dom' 
                END) || ' ' || substr(hora_inicio, 1, 5) || '-' || substr(hora_fin, 1, 5), ', '
               ) FROM Horarios_Clases WHERE clase_id = C.id)`
            : `(SELECT string_agg(
                (CASE dia_semana 
                  WHEN 1 THEN 'Lun' 
                  WHEN 2 THEN 'Mar' 
                  WHEN 3 THEN 'Mié' 
                  WHEN 4 THEN 'Jue' 
                  WHEN 5 THEN 'Vie' 
                  WHEN 6 THEN 'Sáb' 
                  WHEN 7 THEN 'Dom' 
                END) || ' ' || substring(hora_inicio::text from 1 for 5) || '-' || substring(hora_fin::text from 1 for 5), ', '
               ) FROM Horarios_Clases WHERE clase_id = C.id)`;

        return await db.all(`
            SELECT 
              C.id, 
              G.nombre_grado, 
              GR.nombre_grupo, 
              U.nombre_completo as nombre_maestro,
              M.nombre_materia,
              ${subqueryHorarios} as horarios_str
            FROM Clases C
            JOIN Grados G ON C.grado_id = G.id
            JOIN Grupos GR ON C.grupo_id = GR.id
            LEFT JOIN Usuarios U ON C.maestro_id = U.id
            LEFT JOIN Materias M ON C.materia_id = M.id
            WHERE C.institucion_id = $1
            ORDER BY G.nombre_grado, GR.nombre_grupo, M.nombre_materia
        `, [institucionId]);
    }

    static async eliminarClase(id, institucionId) {
        await GestionService._borrarClaseCascada(id, institucionId);
    }

    // Helper auxiliar privado para borrar clases y sus dependencias
    static async _borrarClaseCascada(claseId, institucionId) {
        // Borrar horarios de la clase
        await db.run("DELETE FROM Horarios_Clases WHERE clase_id = $1 AND institucion_id = $2", [claseId, institucionId]);
        // Borrar matrícula departamental de la clase
        await db.run("DELETE FROM Alumnos_Clases WHERE clase_id = $1 AND institucion_id = $2", [claseId, institucionId]);
        // Desvincular asistencias asociadas a esta clase (preservando el historial de asistencias de los alumnos)
        await db.run("UPDATE Asistencias SET clase_id = NULL WHERE clase_id = $1 AND institucion_id = $2", [claseId, institucionId]);

        // Desvincular alumnos de la clase (¡NUNCA eliminar a los alumnos de la escuela al borrar una clase!)
        await db.run("UPDATE Alumnos SET clase_id = NULL WHERE clase_id = $1 AND institucion_id = $2", [claseId, institucionId]);

        // Borrar la clase
        await db.run("DELETE FROM Clases WHERE id = $1 AND institucion_id = $2", [claseId, institucionId]);
    }

    // --- HORARIOS ---
    static async asegurarConfiguracion(institucionId) {
        const config = await db.get("SELECT 1 FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        if (!config) {
            const maxIdRes = await db.get("SELECT MAX(id) AS max_id FROM Configuracion");
            const nextId = (maxIdRes && maxIdRes.max_id ? maxIdRes.max_id : 0) + 1;
            await db.run(
                "INSERT INTO Configuracion (id, institucion_id, enviar_sms) VALUES ($1, $2, 1)",
                [nextId, institucionId]
            );
        }
    }

    static async obtenerHorario(institucionId) {
        await this.asegurarConfiguracion(institucionId);
        return await db.get("SELECT hora_entrada, hora_salida, clases_sabado, clases_domingo FROM Configuracion WHERE institucion_id = $1", [institucionId]);
    }

    static async actualizarHorario(institucionId, entrada, salida, sabado, domingo) {
        // Validar formato básico HH:MM
        const regex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
        if ((entrada && !regex.test(entrada)) || (salida && !regex.test(salida))) {
            throw new Error("Formato de hora inválido (HH:MM)");
        }
        await this.asegurarConfiguracion(institucionId);
        await db.run(
            `UPDATE Configuracion SET 
                hora_entrada = COALESCE($1, hora_entrada), 
                hora_salida = COALESCE($2, hora_salida),
                clases_sabado = COALESCE($3, clases_sabado),
                clases_domingo = COALESCE($4, clases_domingo)
             WHERE institucion_id = $5`,
            [entrada, salida, sabado, domingo, institucionId]
        );
    }

    // --- MATERIAS (Modelo Departamental) ---
    static async obtenerMaterias(institucionId) {
        return await db.all("SELECT * FROM Materias WHERE institucion_id = $1 ORDER BY nombre_materia", [institucionId]);
    }

    static async crearMateria(nombre, institucionId) {
        const res = await db.run(
            "INSERT INTO Materias (nombre_materia, institucion_id) VALUES ($1, $2)",
            [nombre, institucionId]
        );
        return { id: res.lastID, nombre_materia: nombre };
    }

    static async actualizarMateria(id, nombre, institucionId) {
        await db.run(
            "UPDATE Materias SET nombre_materia = $1 WHERE id = $2 AND institucion_id = $3",
            [nombre, id, institucionId]
        );
    }

    static async eliminarMateria(id, institucionId) {
        // Des-asignar materia de las clases
        await db.run(
            "UPDATE Clases SET materia_id = NULL WHERE materia_id = $1 AND institucion_id = $2",
            [id, institucionId]
        );
        // Borrar materia
        await db.run(
            "DELETE FROM Materias WHERE id = $1 AND institucion_id = $2",
            [id, institucionId]
        );
    }

    // --- HORARIOS DE CADA CLASE ---
    static async obtenerHorariosClase(claseId, institucionId) {
        return await db.all(
            "SELECT * FROM Horarios_Clases WHERE clase_id = $1 AND institucion_id = $2 ORDER BY dia_semana, hora_inicio",
            [claseId, institucionId]
        );
    }

    static async agregarHorarioClase(claseId, diaSemana, horaInicio, horaFin, institucionId) {
        const regex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
        if (!regex.test(horaInicio) || !regex.test(horaFin)) {
            throw new Error("Formato de hora inválido (HH:MM)");
        }
        const res = await db.run(
            "INSERT INTO Horarios_Clases (clase_id, dia_semana, hora_inicio, hora_fin, institucion_id) VALUES ($1, $2, $3, $4, $5)",
            [claseId, diaSemana, horaInicio, horaFin, institucionId]
        );
        return { id: res.lastID, clase_id: claseId, dia_semana: diaSemana, hora_inicio: horaInicio, hora_fin: horaFin };
    }

    static async eliminarHorarioClase(id, institucionId) {
        await db.run(
            "DELETE FROM Horarios_Clases WHERE id = $1 AND institucion_id = $2",
            [id, institucionId]
        );
    }

    // --- MATRÍCULA DE ALUMNOS (Inscripciones a materias) ---
    static async obtenerMatriculaClase(claseId, institucionId) {
        return await db.all(`
            SELECT A.id, A.nombre_completo, A.nfc_uid
            FROM Alumnos_Clases AC
            JOIN Alumnos A ON AC.alumno_id = A.id
            WHERE AC.clase_id = $1 AND AC.institucion_id = $2
            ORDER BY A.nombre_completo
        `, [claseId, institucionId]);
    }

    static async matricularAlumno(claseId, alumnoId, institucionId) {
        try {
            await db.run(
                "INSERT INTO Alumnos_Clases (alumno_id, clase_id, institucion_id) VALUES ($1, $2, $3)",
                [alumnoId, claseId, institucionId]
            );
        } catch (error) {
            if (error.message.includes('unique') || error.message.includes('UNIQUE')) {
                throw new Error('El alumno ya está matriculado en esta clase.');
            }
            throw error;
        }
    }

    static async desmatricularAlumno(claseId, alumnoId, institucionId) {
        await db.run(
            "DELETE FROM Alumnos_Clases WHERE alumno_id = $1 AND clase_id = $2 AND institucion_id = $3",
            [alumnoId, claseId, institucionId]
        );
    }

    // --- CONFIGURACIÓN MODELO DEPARTAMENTAL ---
    static async obtenerModeloDepartamental(institucionId) {
        await this.asegurarConfiguracion(institucionId);
        const config = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        return { modelo_departamental: config ? config.modelo_departamental === 1 : false };
    }

    static async actualizarModeloDepartamental(institucionId, habilitado) {
        await this.asegurarConfiguracion(institucionId);
        const val = habilitado ? 1 : 0;
        await db.run(
            "UPDATE Configuracion SET modelo_departamental = $1 WHERE institucion_id = $2",
            [val, institucionId]
        );
    }
}

module.exports = GestionService;
