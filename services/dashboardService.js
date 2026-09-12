const { db } = require('../config/database');

class DashboardService {
    static async getStats(institucion_id) {
        // 1. Total Alumnos
        const totalAlumnos = await db.get(
            "SELECT COUNT(*) as count FROM Alumnos WHERE institucion_id = $1",
            [institucion_id]
        );

        // 2. Total Maestros
        const totalMaestros = await db.get(
            "SELECT COUNT(*) as count FROM Usuarios WHERE rol = 'maestro' AND institucion_id = $1",
            [institucion_id]
        );

        // 3. Asistencia Hoy
        const isSQLite = !process.env.DATABASE_URL;
        const queryAsistencia = isSQLite
            ? "SELECT COUNT(DISTINCT alumno_id) as count FROM Asistencias WHERE institucion_id = $1 AND date(fecha_hora, 'localtime') = date('now', 'localtime')"
            : "SELECT COUNT(DISTINCT alumno_id) as count FROM Asistencias WHERE institucion_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE";

        const asistenciaHoy = await db.get(queryAsistencia, [institucion_id]);

        // 4. Total Grupos
        const totalGrupos = await db.get(
            "SELECT COUNT(*) as count FROM Grupos WHERE institucion_id = $1",
            [institucion_id]
        );

        const alumnosCount = parseInt(totalAlumnos.count) || 0;
        const asistenciaCount = parseInt(asistenciaHoy.count) || 0;

        // Evitar división por cero
        const porcentaje = alumnosCount > 0 ? Math.round((asistenciaCount / alumnosCount) * 100) : 0;

        // 5. Visitas Portal Hoy
        // Fecha actual en string simple YYYY-MM-DD
        const today = new Date();
        const fechaStr = today.toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).split(' ')[0];

        const visitas = await db.get(
            "SELECT contador FROM Visitas_Portal WHERE institucion_id = $1 AND fecha = $2",
            [institucion_id, fechaStr]
        );

        return {
            total_alumnos: alumnosCount,
            total_maestros: parseInt(totalMaestros.count) || 0,
            asistencia_hoy: asistenciaCount,
            total_grupos: parseInt(totalGrupos.count) || 0,
            porcentaje_asistencia: porcentaje,
            visitas_portal: visitas ? visitas.contador : 0
        };
    }
}

module.exports = DashboardService;
