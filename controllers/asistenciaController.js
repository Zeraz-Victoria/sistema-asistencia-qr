const AlumnoService = require('../services/alumnoService');
const AsistenciaService = require('../services/asistenciaService');

class AsistenciaController {
    // --- ALUMNOS ---
    static async obtenerAlumnos(req, res) {
        try {
            const usuario = req.usuario;
            const maestroId = usuario.rol === 'maestro' ? usuario.id : null;
            const result = await AlumnoService.obtenerAlumnos(usuario.institucion_id, maestroId);
            res.status(200).json(result);
        } catch (error) { 
            console.error('❌ Error en obtenerAlumnos:', error);
            res.status(500).json({ error: error.message || 'Error interno al obtener alumnos.' }); 
        }
    }

    static async registrarAlumno(req, res) {
        try {
            const { nombre_completo, nfc_uid, codigo_qr, telefono_tutor, clase_id, clase_ids } = req.body;
            let finalClaseId = clase_id;
            if (clase_ids && Array.isArray(clase_ids) && clase_ids.length > 0) {
                finalClaseId = clase_ids[0];
            }

            if (!nombre_completo || !finalClaseId) {
                return res.status(400).json({ error: 'Faltan datos obligatorios (nombre y clase/grupo).' });
            }

            await AlumnoService.registrarAlumno({
                nombre_completo,
                nfc_uid,
                codigo_qr,
                telefono_tutor: telefono_tutor || 'Sin teléfono',
                clase_id: finalClaseId,
                clase_ids
            }, req.usuario.institucion_id);

            res.status(201).json({ status: 'ok' });
        } catch (error) {
            if (error.message === 'Clase inválida.') return res.status(400).json({ error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    static async borrarAlumno(req, res) {
        try {
            const { id } = req.body;
            await AlumnoService.borrarAlumno(id, req.usuario.institucion_id);
            res.status(200).json({ status: 'ok' });
        } catch (error) {
            if (error.message === 'No permitido') return res.status(403).json({ error: error.message });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async actualizarAlumno(req, res) {
        try {
            const { id } = req.params;
            const { nombre_completo, nfc_uid, telefono_tutor, clase_id, clase_ids } = req.body;
            let finalClaseId = clase_id;
            if (clase_ids && Array.isArray(clase_ids) && clase_ids.length > 0) {
                finalClaseId = clase_ids[0];
            }

            await AlumnoService.actualizarAlumno(id, { nombre_completo, nfc_uid, telefono_tutor, clase_id: finalClaseId, clase_ids }, req.usuario.institucion_id);
            res.status(200).json({ status: 'ok', message: 'Alumno actualizado' });
        } catch (error) {
            if (error.message === 'Clase inválida.' || error.message.includes('tarjeta')) return res.status(400).json({ error: error.message });
            if (error.message === 'No permitido o no encontrado.') return res.status(404).json({ error: error.message });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- ASISTENCIA ---
    static async marcar(req, res) {
        try {
            const uid = req.body.codigo_qr || req.body.uid || req.body.nfc_uid;
            const result = await AsistenciaService.marcarAsistencia(uid, req.usuario);
            if (result.status === 'warning') return res.status(200).json(result);
            return res.status(201).json(result);
        } catch (error) {
            const msg = error.message;
            if (msg === 'No UID') return res.status(400).json({ status: 'error', message: 'No se recibió código QR.' });
            return res.status(400).json({ status: 'error', message: msg });
        }
    }

    static async sync(req, res) {
        try {
            const { scans } = req.body; // Array de { uid, timestamp }
            if (!scans || !Array.isArray(scans)) return res.status(400).json({ error: 'Formato inválido' });

            const result = await AsistenciaService.syncAsistencia(scans, req.usuario);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Error en sincronización' });
        }
    }

    static async justificar(req, res) {
        try {
            const { alumno_id, motivo } = req.body;
            if (!alumno_id || !motivo) return res.status(400).json({ error: 'Faltan datos' });

            const result = await AsistenciaService.justificarAsistencia(alumno_id, motivo, req.usuario);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // --- CALENDARIO ---
    static async obtenerDiasInhabiles(req, res) {
        try {
            const result = await AsistenciaService.obtenerDiasInhabiles(req.usuario.institucion_id, req.query.mes);
            res.json(result);
        } catch (e) { res.status(500).json({ error: 'Error al obtener días' }); }
    }

    static async agregarDiaInhabil(req, res) {
        try {
            await AsistenciaService.agregarDiaInhabil(req.usuario.institucion_id, req.body.fecha, req.body.motivo);
            res.status(201).json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: 'Error al guardar día' }); }
    }

    static async quitarDiaInhabil(req, res) {
        try {
            await AsistenciaService.quitarDiaInhabil(req.usuario.institucion_id, req.body.fecha);
            res.status(200).json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: 'Error al borrar día' }); }
    }

    // --- ACTIVIDADES / TAREAS ---
    static async obtenerActividades(req, res) {
        try {
            const { clase_id } = req.query;
            const result = await AsistenciaService.obtenerActividades(req.usuario.institucion_id, clase_id || null);
            res.status(200).json(result);
        } catch (e) { res.status(500).json({ error: 'Error al obtener actividades.' }); }
    }

    static async crearActividad(req, res) {
        try {
            const { titulo, descripcion, clase_id } = req.body;
            const result = await AsistenciaService.crearActividad(titulo, descripcion, req.usuario.institucion_id, clase_id || null);
            res.status(201).json({ status: 'ok', id: result.lastID, message: 'Actividad creada con éxito.' });
        } catch (e) { res.status(400).json({ error: e.message }); }
    }

    static async editarActividad(req, res) {
        try {
            const { id } = req.params;
            const { titulo, descripcion } = req.body;
            await AsistenciaService.editarActividad(id, titulo, descripcion, req.usuario.institucion_id);
            res.status(200).json({ status: 'ok', message: 'Actividad actualizada con éxito.' });
        } catch (e) { res.status(400).json({ error: e.message }); }
    }

    static async borrarActividad(req, res) {
        try {
            const { id } = req.params;
            await AsistenciaService.borrarActividad(id, req.usuario.institucion_id);
            res.status(200).json({ status: 'ok' });
        } catch (e) { res.status(500).json({ error: 'Error al eliminar actividad.' }); }
    }

    static async marcarActividad(req, res) {
        try {
            const uid = req.body.codigo_qr || req.body.uid || req.body.nfc_uid;
            const { actividad_id, alumno_id } = req.body;
            const result = await AsistenciaService.marcarEntregaActividad(uid, actividad_id, req.usuario, alumno_id);
            if (result.status === 'warning') return res.status(200).json(result);
            return res.status(201).json(result);
        } catch (error) {
            res.status(400).json({ status: 'error', message: error.message });
        }
    }

    static async obtenerEntregasActividad(req, res) {
        try {
            const { id } = req.params;
            const entregas = await AsistenciaService.obtenerEntregasActividad(id, req.usuario.institucion_id);
            res.json(entregas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async toggleEntregaActividad(req, res) {
        try {
            const { actividad_id, alumno_id } = req.body;
            if (!actividad_id || !alumno_id) return res.status(400).json({ error: 'Faltan datos.' });
            const result = await AsistenciaService.toggleEntregaActividad(actividad_id, alumno_id, req.usuario.institucion_id);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async obtenerAsistenciasHoy(req, res) {
        try {
            const { fecha } = req.query;
            const asistencias = await AsistenciaService.obtenerAsistenciasHoy(req.usuario.institucion_id, fecha);
            res.json(asistencias);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async registrarAsistenciaManual(req, res) {
        try {
            const { alumno_id, status, fecha, justificacion } = req.body;
            if (!alumno_id || !status) return res.status(400).json({ error: 'Faltan alumno_id o status.' });
            const result = await AsistenciaService.registrarAsistenciaManual(alumno_id, status, req.usuario.institucion_id, fecha, justificacion);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async obtenerClaseActiva(req, res) {
        try {
            const result = await AsistenciaService.obtenerClaseActivaDocente(req.usuario);
            if (result) {
                res.status(200).json({ clase_activa: true, ...result });
            } else {
                res.status(200).json({ clase_activa: false });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

}

module.exports = AsistenciaController;
