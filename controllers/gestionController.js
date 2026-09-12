const GestionService = require('../services/gestionService');

class GestionController {
    // --- GRADOS ---
    static async crearGrado(req, res) {
        try {
            const { nombre_grado } = req.body;
            const { institucion_id } = req.usuario;
            const result = await GestionService.crearGrado(nombre_grado, institucion_id);
            res.status(201).json(result);
        } catch (error) {
            if (error.message.includes('ya existe')) return res.status(409).json({ error: error.message });
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async obtenerGrados(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerGrados(institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async eliminarGrado(req, res) {
        try {
            const { institucion_id } = req.usuario;
            await GestionService.eliminarGrado(req.params.id, institucion_id);
            res.status(200).json({ message: 'Grado eliminado.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    // --- GRUPOS ---
    static async crearGrupo(req, res) {
        try {
            const { nombre_grupo } = req.body;
            const { institucion_id } = req.usuario;
            const result = await GestionService.crearGrupo(nombre_grupo, institucion_id);
            res.status(201).json(result);
        } catch (error) {
            if (error.message.includes('ya existe')) return res.status(409).json({ error: error.message });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async obtenerGrupos(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerGrupos(institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async eliminarGrupo(req, res) {
        try {
            const { institucion_id } = req.usuario;
            await GestionService.eliminarGrupo(req.params.id, institucion_id);
            res.status(200).json({ message: 'Grupo eliminado.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    // --- MAESTROS ---
    static async obtenerMaestros(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerMaestros(institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async crearMaestro(req, res) {
        try {
            const { nombre_completo } = req.body;
            const { institucion_id } = req.usuario;

            if (!nombre_completo) {
                return res.status(400).json({ error: 'Falta nombre completo del docente.' });
            }

            await GestionService.crearMaestro(req.body, institucion_id);
            res.status(201).json({ message: 'Maestro registrado.' });
        } catch (error) {
            if (error.message.includes('ya está registrado') || error.message.includes('ya está en uso')) return res.status(409).json({ error: error.message });
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async actualizarMaestro(req, res) {
        try {
            const { id } = req.params;
            const { institucion_id } = req.usuario;
            // Validar si hay datos
            if (Object.keys(req.body).length === 0) return res.status(400).json({ error: 'No hay datos para actualizar' });

            await GestionService.actualizarMaestro(id, req.body, institucion_id);
            res.status(200).json({ message: 'Datos actualizados correctamente.' });
        } catch (error) {
            if (error.message.includes('no encontrado')) return res.status(404).json({ error: error.message });
            if (error.message.includes('ya está uso') || error.message.includes('tarjeta')) return res.status(409).json({ error: error.message });
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async eliminarMaestro(req, res) {
        try {
            const { id } = req.params;
            const { institucion_id } = req.usuario;
            await GestionService.eliminarMaestro(id, institucion_id);
            res.status(200).json({ message: 'Maestro eliminado con éxito.' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- CLASES ---
    static async crearClase(req, res) {
        try {
            const { grado_id, grupo_id } = req.body;
            const { institucion_id } = req.usuario;

            if (!grado_id || !grupo_id) {
                return res.status(400).json({ error: 'Faltan grado_id o grupo_id.' });
            }

            const result = await GestionService.crearClase(req.body, institucion_id);
            res.status(201).json({ message: 'Clase creada con éxito', id: result.id });
        } catch (error) {
            if (error.message.includes('ya existe')) return res.status(409).json({ error: error.message });
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async crearClaseRapida(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.crearClaseRapida(req.body, institucion_id);
            res.status(201).json(result);
        } catch (error) {
            if (error.message.includes('obligatorio')) return res.status(400).json({ error: error.message });
            console.error(error);
            res.status(500).json({ error: error.message || 'Error al crear la clase.' });
        }
    }

    static async obtenerClases(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerClases(institucion_id);
            res.status(200).json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async eliminarClase(req, res) {
        try {
            const { institucion_id } = req.usuario;
            await GestionService.eliminarClase(req.params.id, institucion_id);
            res.status(200).json({ message: 'Clase eliminada.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    // --- HORARIOS ---
    static async obtenerHorario(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerHorario(institucion_id);
            res.status(200).json(result || {});
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async actualizarHorario(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const { hora_entrada, hora_salida, clases_sabado, clases_domingo } = req.body;
            await GestionService.actualizarHorario(institucion_id, hora_entrada, hora_salida, clases_sabado, clases_domingo);
            res.status(200).json({ message: 'Horario actualizado.' });
        } catch (error) {
            if (error.message.includes('Formato')) return res.status(400).json({ error: error.message });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- MATERIAS (Modelo Departamental) ---
    static async obtenerMaterias(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerMaterias(institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async crearMateria(req, res) {
        try {
            const { nombre_materia } = req.body;
            const { institucion_id } = req.usuario;
            if (!nombre_materia) return res.status(400).json({ error: 'Falta nombre_materia.' });
            const result = await GestionService.crearMateria(nombre_materia, institucion_id);
            res.status(201).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async actualizarMateria(req, res) {
        try {
            const { id } = req.params;
            const { nombre_materia } = req.body;
            const { institucion_id } = req.usuario;
            if (!nombre_materia) return res.status(400).json({ error: 'Falta nombre_materia.' });
            await GestionService.actualizarMateria(id, nombre_materia, institucion_id);
            res.status(200).json({ message: 'Materia actualizada.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async eliminarMateria(req, res) {
        try {
            const { id } = req.params;
            const { institucion_id } = req.usuario;
            await GestionService.eliminarMateria(id, institucion_id);
            res.status(200).json({ message: 'Materia eliminada.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    // --- HORARIOS DE CLASE ---
    static async obtenerHorariosClase(req, res) {
        try {
            const { clase_id } = req.params;
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerHorariosClase(clase_id, institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async agregarHorarioClase(req, res) {
        try {
            const { clase_id } = req.params;
            const { dia_semana, hora_inicio, hora_fin } = req.body;
            const { institucion_id } = req.usuario;
            if (!dia_semana || !hora_inicio || !hora_fin) {
                return res.status(400).json({ error: 'Faltan datos de horario (dia_semana, hora_inicio, hora_fin).' });
            }
            const result = await GestionService.agregarHorarioClase(clase_id, dia_semana, hora_inicio, hora_fin, institucion_id);
            res.status(201).json(result);
        } catch (error) {
            if (error.message.includes('Formato')) return res.status(400).json({ error: error.message });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async eliminarHorarioClase(req, res) {
        try {
            const { id } = req.params;
            const { institucion_id } = req.usuario;
            await GestionService.eliminarHorarioClase(id, institucion_id);
            res.status(200).json({ message: 'Horario de clase eliminado.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    // --- MATRÍCULA ---
    static async obtenerMatriculaClase(req, res) {
        try {
            const { clase_id } = req.params;
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerMatriculaClase(clase_id, institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async matricularAlumno(req, res) {
        try {
            const { clase_id } = req.params;
            const { alumno_id } = req.body;
            const { institucion_id } = req.usuario;
            if (!alumno_id) return res.status(400).json({ error: 'Falta alumno_id.' });
            await GestionService.matricularAlumno(clase_id, alumno_id, institucion_id);
            res.status(201).json({ message: 'Alumno matriculado.' });
        } catch (error) {
            if (error.message.includes('ya está matriculado')) return res.status(409).json({ error: error.message });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    static async desmatricularAlumno(req, res) {
        try {
            const { clase_id, alumno_id } = req.params;
            const { institucion_id } = req.usuario;
            await GestionService.desmatricularAlumno(clase_id, alumno_id, institucion_id);
            res.status(200).json({ message: 'Alumno desmatriculado de la clase.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    // --- CONFIGURACIÓN MODELO ---
    static async obtenerModeloDepartamental(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const result = await GestionService.obtenerModeloDepartamental(institucion_id);
            res.status(200).json(result);
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }

    static async actualizarModeloDepartamental(req, res) {
        try {
            const { institucion_id } = req.usuario;
            const { habilitado } = req.body;
            await GestionService.actualizarModeloDepartamental(institucion_id, habilitado);
            res.status(200).json({ message: 'Configuración de modelo actualizada.' });
        } catch (error) { res.status(500).json({ error: 'Error interno.' }); }
    }
}

module.exports = GestionController;
