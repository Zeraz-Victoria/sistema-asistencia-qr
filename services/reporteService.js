const PDFDocument = require('pdfkit');
const { db } = require('../config/database');

class ReporteService {

    // Helper para obtener datos del encabezado (Maestro/Grado)
    static async obtenerDatosEncabezado(claseId, institucionId) {
        return await db.get(`
            SELECT G.nombre_grado, GR.nombre_grupo, U.nombre_completo as nombre_maestro, M.nombre_materia 
            FROM Clases C 
            JOIN Grados G ON C.grado_id = G.id 
            JOIN Grupos GR ON C.grupo_id = GR.id 
            LEFT JOIN Usuarios U ON C.maestro_id = U.id 
            LEFT JOIN Materias M ON C.materia_id = M.id
            WHERE C.id = $1 AND C.institucion_id = $2`,
            [claseId, institucionId]
        );
    }

    static async obtenerInstitucion(institucionId) {
        return await db.get("SELECT nombre FROM Instituciones WHERE id = $1", [institucionId]);
    }



    static async generarDetalladoPdf(mes, claseId, institucionId) {
        console.log(`[Service] Generando Detallado para ${mes}, Clase ${claseId}`);
        const enc = await this.obtenerDatosEncabezado(claseId, institucionId) || {};
        const inst = await this.obtenerInstitucion(institucionId);
        if (inst) enc.nombre_institucion = inst.nombre;

        const [yearStr, monthStr] = mes.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const diasDelMes = new Date(year, month, 0).getDate();

        // Calculate Range
        const startStr = `${mes}-01 00:00:00`;
        const nextMonthDate = new Date(year, month, 1);
        const endYear = nextMonthDate.getFullYear();
        const endMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
        const endStr = `${endYear}-${endMonth}-01 00:00:00`;

        console.log(`[Service] Rango de fechas: ${startStr} a ${endStr}`);

        // Días Inhábiles (Suspendidos)
        const diasOffRows = await db.all(`
            SELECT fecha, motivo FROM Dias_Inhabiles 
            WHERE institucion_id = $1 
            AND fecha >= $2::date AND fecha < $3::date
        `, [institucionId, startStr, endStr]);

        const suspensiones = new Map();
        diasOffRows.forEach(r => {
            const d = new Date(r.fecha);
            const key = isNaN(d.getTime()) ? r.fecha : d.toISOString().split('T')[0];
            suspensiones.set(key, r.motivo || 'SUSPENSIÓN');
        });

        // Obtener configuración de fines de semana
        const config = await db.get("SELECT clases_sabado, clases_domingo FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        const admitirSabado = config ? config.clases_sabado : false;
        const admitirDomingo = config ? config.clases_domingo : false;

        const diasHabiles = [];
        const diasHeader = [];
        for (let d = 1; d <= diasDelMes; d++) {
            const f = new Date(year, month - 1, d);
            const fStr = f.toLocaleDateString('sv-SE');

            const day = f.getDay();
            const esSabado = (day === 6);
            const esDomingo = (day === 0);

            // Incluir si no es fin de semana, O si es fin de semana pero está habilitado
            const esDiaLaboral = (!esSabado && !esDomingo) || (esSabado && admitirSabado) || (esDomingo && admitirDomingo);

            if (esDiaLaboral) {
                diasHabiles.push(fStr);
                diasHeader.push(d.toString());
            }
        }

        // Alumnos grouped & Asistencias query branching based on Model
        const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

        let queryAlumnos;
        let queryAsistencias;

        if (isModeloDepartamental) {
            queryAlumnos = `
                SELECT A.id, A.nombre_completo, G.nombre_grado, GR.nombre_grupo
                FROM Alumnos A
                JOIN Alumnos_Clases AC ON A.id = AC.alumno_id
                JOIN Clases C ON AC.clase_id = C.id
                JOIN Grados G ON C.grado_id = G.id
                JOIN Grupos GR ON C.grupo_id = GR.id
                WHERE AC.clase_id = $1 AND AC.institucion_id = $2
                ORDER BY G.nombre_grado, GR.nombre_grupo, A.nombre_completo`;

            const isSQLite = !process.env.DATABASE_URL;
            queryAsistencias = isSQLite
                ? `SELECT A.alumno_id, A.status, date(A.fecha_hora, 'localtime') as fecha 
                   FROM Asistencias A 
                   WHERE A.clase_id = $1 AND A.institucion_id = $2 
                   AND date(A.fecha_hora, 'localtime') >= date($3)
                   AND date(A.fecha_hora, 'localtime') < date($4)`
                : `SELECT A.alumno_id, A.status, DATE(A.fecha_hora AT TIME ZONE 'America/Mexico_City') as fecha 
                   FROM Asistencias A 
                   WHERE A.clase_id = $1 AND A.institucion_id = $2 
                   AND A.fecha_hora AT TIME ZONE 'America/Mexico_City' >= $3::timestamp
                   AND A.fecha_hora AT TIME ZONE 'America/Mexico_City' < $4::timestamp`;
        } else {
            queryAlumnos = `
                SELECT A.id, A.nombre_completo, G.nombre_grado, GR.nombre_grupo
                FROM Alumnos A
                JOIN Clases C ON A.clase_id = C.id
                JOIN Grados G ON C.grado_id = G.id
                JOIN Grupos GR ON C.grupo_id = GR.id
                WHERE A.clase_id = $1 AND A.institucion_id = $2
                ORDER BY G.nombre_grado, GR.nombre_grupo, A.nombre_completo`;

            const isSQLite = !process.env.DATABASE_URL;
            queryAsistencias = isSQLite
                ? `SELECT A.alumno_id, A.status, date(A.fecha_hora, 'localtime') as fecha 
                   FROM Asistencias A 
                   JOIN Alumnos AL ON A.alumno_id = AL.id 
                   WHERE AL.clase_id = $1 AND AL.institucion_id = $2 
                   AND date(A.fecha_hora, 'localtime') >= date($3)
                   AND date(A.fecha_hora, 'localtime') < date($4)`
                : `SELECT A.alumno_id, A.status, DATE(A.fecha_hora AT TIME ZONE 'America/Mexico_City') as fecha 
                   FROM Asistencias A 
                   JOIN Alumnos AL ON A.alumno_id = AL.id 
                   WHERE AL.clase_id = $1 AND AL.institucion_id = $2 
                   AND A.fecha_hora AT TIME ZONE 'America/Mexico_City' >= $3::timestamp
                   AND A.fecha_hora AT TIME ZONE 'America/Mexico_City' < $4::timestamp`;
        }

        const alumnos = await db.all(queryAlumnos, [claseId, institucionId]);
        console.log(`[Service] Alumnos encontrados: ${alumnos.length}`);

        const asistencias = await db.all(queryAsistencias, [claseId, institucionId, startStr, endStr]);
        console.log(`[Service] Registros de asistencia encontrados: ${asistencias.length}`);

        // Mapa: AlumnoID -> Map<FechaStr, Status>
        const mapa = new Map();
        for (const a of asistencias) {
            let f;
            if (a.fecha instanceof Date) {
                f = a.fecha.toISOString().split('T')[0];
            } else {
                const d = new Date(a.fecha);
                f = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : a.fecha;
            }
            if (!mapa.has(a.alumno_id)) mapa.set(a.alumno_id, new Map());
            // Guardamos el status. Si no hay, asumimos 'presente' por compatibilidad
            mapa.get(a.alumno_id).set(f, a.status || 'presente');
        }

        const doc = new PDFDocument({ layout: 'landscape', margin: 30 });

        // Let's add the content rendering here to ensure headers are respected
        // The controller might just pipe the doc, so we must add pages/content here.
        // Wait, normally controller calls this and just pipes. 
        // We should start the document content here. OR return data for controller.
        // The previous implementation returned { doc, ... } and didn't add much content *inside* the service 
        // except for generating the object. 
        // BUT, since we need to insert GROUP HEADERS in the TABLE, it's easier to verify 
        // if we control the rendering logic or pass structured data.
        // To strictly follow the "Fix" pattern without refactoring the Controller too much:
        // We will return the data `alumnos` which now has `nombre_grado` and `nombre_grupo`.
        // The CONTROLLER (or wherever `doc` is consumed) creates the table.
        // Let's check where the table is drawn. 
        // Ah, the previous code returned `{ doc, enc, diasHeader, diasHabiles, alumnos, mapa }`.
        // It implies the CONTROLLER draws the table. 

        // I need to check the controller to see who draws the PDF content.
        // Re-reading `reporteRoutes.js` (not visible but implied) or `reporteController`.
        // If the Service returns `doc`, it implies the Service *might* be responsible for drawing?
        // In `generarResumenPdf` I added drawing code. 
        // In `generarDetalladoPdf`, I see I returned `doc` but didn't write to it in the original code? 
        // Wait, looking at original code... `generarResumenPdf` line 34: `const doc = new PDFDocument... return { doc ... }` 
        // It didn't have drawing commands!
        // This means the CONTROLLER does the drawing.

        // STOP. If the controller does the drawing, altering the service to adding grouping *data* is fine,
        // but the drawing logic is in the CONTROLLER.
        // I must view the Controller to fix the drawing.

        // However, I just added drawing code to `generarResumenPdf` inside the Service in my proposed replacement.
        // This is a Service, it should probably return data. 
        // BUT `pdfkit` instances are streams. If I write to it here, it works.
        // If the Controller *also* writes to it, it might be messy.

        // Let's revert to seeing the Controller first.
        return { doc, enc, diasHeader, diasHabiles, alumnos, mapa, suspensiones };
    }

    static async generarCsv(claseId, institucionId) {
        const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

        const isSQLite = !process.env.DATABASE_URL;
        let sql;

        if (isModeloDepartamental) {
            if (isSQLite) {
                sql = `
                SELECT A.nombre_completo, G.nombre_grado, GR.nombre_grupo, 
                       date(S.fecha_hora, 'localtime') as fecha, 
                       time(S.fecha_hora, 'localtime') as hora 
                FROM Asistencias S 
                JOIN Alumnos A ON S.alumno_id = A.id 
                JOIN Clases C ON S.clase_id = C.id 
                JOIN Grados G ON C.grado_id = G.id 
                JOIN Grupos GR ON C.grupo_id = GR.id 
                WHERE C.id = $1 AND C.institucion_id = $2
                ORDER BY G.nombre_grado, GR.nombre_grupo, S.fecha_hora DESC`;
            } else {
                sql = `
                SELECT A.nombre_completo, G.nombre_grado, GR.nombre_grupo, 
                       to_char(S.fecha_hora AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') as fecha, 
                       to_char(S.fecha_hora AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS') as hora 
                FROM Asistencias S 
                JOIN Alumnos A ON S.alumno_id = A.id 
                JOIN Clases C ON S.clase_id = C.id 
                JOIN Grados G ON C.grado_id = G.id 
                JOIN Grupos GR ON C.grupo_id = GR.id 
                WHERE C.id = $1 AND C.institucion_id = $2
                ORDER BY G.nombre_grado, GR.nombre_grupo, S.fecha_hora DESC`;
            }
        } else {
            if (isSQLite) {
                sql = `
                SELECT A.nombre_completo, G.nombre_grado, GR.nombre_grupo, 
                       date(S.fecha_hora, 'localtime') as fecha, 
                       time(S.fecha_hora, 'localtime') as hora 
                FROM Asistencias S 
                JOIN Alumnos A ON S.alumno_id = A.id 
                JOIN Clases C ON A.clase_id = C.id 
                JOIN Grados G ON C.grado_id = G.id 
                JOIN Grupos GR ON C.grupo_id = GR.id 
                WHERE C.id = $1 AND C.institucion_id = $2
                ORDER BY G.nombre_grado, GR.nombre_grupo, S.fecha_hora DESC`;
            } else {
                sql = `
                SELECT A.nombre_completo, G.nombre_grado, GR.nombre_grupo, 
                       to_char(S.fecha_hora AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') as fecha, 
                       to_char(S.fecha_hora AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS') as hora 
                FROM Asistencias S 
                JOIN Alumnos A ON S.alumno_id = A.id 
                JOIN Clases C ON A.clase_id = C.id 
                JOIN Grados G ON C.grado_id = G.id 
                JOIN Grupos GR ON C.grupo_id = GR.id 
                WHERE C.id = $1 AND C.institucion_id = $2
                ORDER BY G.nombre_grado, GR.nombre_grupo, S.fecha_hora DESC`;
            }
        }

        const rows = await db.all(sql, [claseId, institucionId]);

        let csv = "Nombre,Grado,Grupo,Fecha,Hora\n";
        rows.forEach(r => { csv += `"${r.nombre_completo}",${r.nombre_grado},${r.nombre_grupo},${r.fecha},${r.hora}\n`; });

        return csv;
    }

    // --- REPORTE DOCENTE ---
    // --- REPORTE DOCENTE (DATA ONLY) ---
    static async generarReporteDocenteData(mes, institucionId) {
        console.log(`[Service] Generando Datos Reporte Docente para ${mes}`);

        const [yearStr, monthStr] = mes.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const diasDelMes = new Date(year, month, 0).getDate();

        const startStr = `${mes}-01 00:00:00`;
        const nextMonthDate = new Date(year, month, 1);
        const endMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
        const endYear = nextMonthDate.getFullYear();
        const endStr = `${endYear}-${endMonth}-01 00:00:00`;

        // 0. Determinar Días Hábiles del Mes (Header)
        // Similar logic to Student Report but for the whole institution context if needed
        // For Teacher Report, we often show ALL days or just M-F. Let's show Standard M-F + excludes.

        // Días Inhábiles
        // Días Inhábiles
        const diasOffRows = await db.all(`
            SELECT fecha, motivo FROM Dias_Inhabiles 
            WHERE institucion_id = $1 
            AND fecha >= $2::date AND fecha < $3::date
        `, [institucionId, startStr, endStr]);

        const suspensiones = new Map();
        diasOffRows.forEach(r => {
            const d = new Date(r.fecha);
            const key = isNaN(d.getTime()) ? r.fecha : d.toISOString().split('T')[0];
            suspensiones.set(key, r.motivo || 'SUSPENSIÓN');
        });

        // Obtener configuración de fines de semana
        const config = await db.get("SELECT clases_sabado, clases_domingo FROM Configuracion WHERE institucion_id = $1", [institucionId]);
        const admitirSabado = config ? config.clases_sabado : false;
        const admitirDomingo = config ? config.clases_domingo : false;

        const diasHabiles = [];
        const diasHeader = [];
        for (let d = 1; d <= diasDelMes; d++) {
            const f = new Date(year, month - 1, d);
            const fStr = f.toLocaleDateString('sv-SE');
            
            const day = f.getDay();
            const esSabado = (day === 6);
            const esDomingo = (day === 0);

            const esDiaLaboral = (!esSabado && !esDomingo) || (esSabado && admitirSabado) || (esDomingo && admitirDomingo);

            if (esDiaLaboral) {
                diasHabiles.push(fStr);
                diasHeader.push(d.toString());
            }
        }

        // 1. Obtener Maestros de la institución (Sorted by Grade/Group)
        // Teachers might have multiple classes suitable for sorting. We take the first one found or just sort by name if no class
        const maestros = await db.all(`
            SELECT DISTINCT U.id, U.nombre_completo, U.email, U.nfc_uid, 
                   MIN(G.nombre_grado) as grado_sort, MIN(GR.nombre_grupo) as grupo_sort
            FROM Usuarios U
            LEFT JOIN Clases C ON U.id = C.maestro_id
            LEFT JOIN Grados G ON C.grado_id = G.id
            LEFT JOIN Grupos GR ON C.grupo_id = GR.id
            WHERE U.rol = 'maestro' AND U.institucion_id = $1
            GROUP BY U.id, U.nombre_completo
            ORDER BY grado_sort NULLS LAST, grupo_sort NULLS LAST, U.nombre_completo
        `, [institucionId]);

        // 2. Obtener Asistencias de Maestros en el rango
        const asistencias = await db.all(`
            SELECT maestro_id, fecha_hora, status
            FROM Asistencias_Maestros
            WHERE institucion_id = $1
            AND fecha_hora >= $2::timestamptz AND fecha_hora < $3::timestamptz
            ORDER BY fecha_hora ASC
        `, [institucionId, startStr, endStr]);

        // 3. Procesar datos (mapear asistencias por maestro)
        // Map<MaestroID, Map<FechaStr, {status, horaEntrada, horaSalida}>>
        const mapa = new Map();

        // Helper Map to collect all times per day
        const tempMap = new Map(); // Key: MaestroID_Fecha, Value: Array<Date>

        asistencias.forEach(a => {
            const dObj = new Date(a.fecha_hora);
            const dateStr = dObj.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });

            const key = `${a.maestro_id}_${dateStr}`;
            if (!tempMap.has(key)) tempMap.set(key, []);
            tempMap.get(key).push({ dObj, status: a.status });
        });

        // Resolve Min/Max
        tempMap.forEach((records, key) => {
            const [maestroId, dateStr] = key.split('_');
            const mId = parseInt(maestroId, 10);

            // Min Time = Entry
            // Max Time = Exit (only if different from Entry)

            // Sort just in case records came mixed (though DB ordered ASC)
            records.sort((a, b) => a.dObj - b.dObj);

            const entryRecord = records[0];
            const exitRecord = records.length > 1 ? records[records.length - 1] : null;

            const formatTime = (date) => date.toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City', hour12: false
            });

            const horaEntrada = formatTime(entryRecord.dObj);
            const horaSalida = exitRecord ? formatTime(exitRecord.dObj) : null;

            if (!mapa.has(mId)) mapa.set(mId, new Map());
            mapa.get(mId).set(dateStr, {
                status: entryRecord.status, // Status from entry usually
                hora: horaEntrada,
                horaSalida: (horaSalida && horaSalida !== horaEntrada) ? horaSalida : null
            });
        });

        const institucion = await this.obtenerInstitucion(institucionId);
        const nombreInstitucion = institucion ? institucion.nombre : 'Sistema de Asistencia';

        return { maestros, mapa, diasHabiles, diasHeader, suspensiones, nombreInstitucion };
    }

    // --- REPORTE PDF DE ENTREGAS DE TAREAS ---
    static async generarTareasPdf(mes, actividadId, institucionId, claseId = null, usuarioId = null) {
        const inst = await this.obtenerInstitucion(institucionId);
        const nombreInstitucion = inst ? inst.nombre : 'Sistema de Asistencia';

        // 1. Obtener Actividades registradas
        let queryActividades = `
            SELECT id, titulo, descripcion, fecha_creacion 
            FROM Actividades 
            WHERE institucion_id = $1
        `;
        const paramsAct = [institucionId];

        if (actividadId && actividadId !== 'all') {
            paramsAct.push(actividadId);
            queryActividades += ` AND id = $${paramsAct.length}`;
        }

        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const startStr = `${mes}-01 00:00:00`;
            const [yStr, mStr] = mes.split('-');
            const nextM = new Date(parseInt(yStr, 10), parseInt(mStr, 10), 1);
            const endStr = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
            paramsAct.push(startStr, endStr);
            queryActividades += ` AND fecha_creacion >= $${paramsAct.length - 1}::timestamp AND fecha_creacion < $${paramsAct.length}::timestamp`;
        }

        queryActividades += ` ORDER BY fecha_creacion DESC`;
        const actividades = await db.all(queryActividades, paramsAct);

        // 2. Obtener Lista Completa de Alumnos (filtrada por claseId o por maestro si aplica)
        let queryAlumnos = `
            SELECT A.id, A.nombre_completo, G.nombre_grado, GR.nombre_grupo, C.id as clase_id
            FROM Alumnos A
            JOIN Clases C ON A.clase_id = C.id
            JOIN Grados G ON C.grado_id = G.id
            JOIN Grupos GR ON C.grupo_id = GR.id
            WHERE A.institucion_id = $1
        `;
        const paramsAlu = [institucionId];

        if (claseId && claseId !== 'null' && claseId !== 'undefined') {
            paramsAlu.push(claseId);
            queryAlumnos += ` AND C.id = $${paramsAlu.length}`;
        } else if (usuarioId) {
            const maestroClase = await db.get(`SELECT id FROM Clases WHERE maestro_id = $1 AND institucion_id = $2`, [usuarioId, institucionId]);
            if (maestroClase) {
                paramsAlu.push(maestroClase.id);
                queryAlumnos += ` AND C.id = $${paramsAlu.length}`;
            }
        }

        queryAlumnos += ` ORDER BY G.nombre_grado, GR.nombre_grupo, A.nombre_completo`;
        const alumnos = await db.all(queryAlumnos, paramsAlu);

        // 3. Obtener todas las entregas registradas
        const queryEntregas = `
            SELECT actividad_id, alumno_id, fecha_hora 
            FROM Entregas_Actividades 
            WHERE institucion_id = $1
        `;
        const entregasRows = await db.all(queryEntregas, [institucionId]);

        // Mapa de entregas: Key -> `${actividad_id}_${alumno_id}` Value -> fecha_hora
        const entregasMap = new Map();
        entregasRows.forEach(e => {
            entregasMap.set(`${e.actividad_id}_${e.alumno_id}`, e.fecha_hora);
        });

        // 4. Crear Documento PDF
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'LETTER', margin: 40 });

        // Encabezado Visual Elegante
        doc.rect(0, 0, doc.page.width, 85).fill('#4f46e5');
        doc.fill('#ffffff').fontSize(16).font('Helvetica-Bold').text(nombreInstitucion.toUpperCase(), 40, 22);
        doc.fontSize(12).font('Helvetica').text('REPORTE DE CUMPLIMIENTO DE TAREAS Y ACTIVIDADES (NFC)', 40, 48);

        const fechaEmision = new Date().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City'
        });

        doc.fill('#1e293b').fontSize(9).font('Helvetica').text(`Fecha de emisión: ${fechaEmision}`, 40, 100);
        doc.text(`Total Alumnos en Lista: ${alumnos.length}`, 380, 100, { align: 'right' });

        let y = 120;

        if (actividades.length === 0) {
            y += 20;
            doc.fill('#64748b').fontSize(10).font('Helvetica-Oblique').text('No se encontraron actividades registradas en este periodo.', 40, y, { align: 'center' });
        } else {
            actividades.forEach((act) => {
                // Calcular estadísticas para esta actividad
                let entregadosCount = 0;
                alumnos.forEach(al => {
                    if (entregasMap.has(`${act.id}_${al.id}`)) entregadosCount++;
                });
                const noEntregadosCount = alumnos.length - entregadosCount;

                // Verificar espacio necesario en página para bloque de actividad + cabecera
                if (y > doc.page.height - 140) {
                    doc.addPage();
                    y = 40;
                }

                // Tarjeta / Encabezado de Actividad
                doc.rect(40, y, doc.page.width - 80, 36).fill('#f1f5f9');
                doc.fill('#1e293b').fontSize(11).font('Helvetica-Bold').text(`TAREA: ${act.titulo.toUpperCase()}`, 50, y + 8);
                if (act.descripcion) {
                    doc.fill('#64748b').fontSize(8.5).font('Helvetica').text(act.descripcion, 50, y + 22, { width: 320, ellipsis: true });
                }

                // Badges de resumen
                const badgeX = doc.page.width - 240;
                doc.rect(badgeX, y + 8, 90, 20).fill('#dcfce7'); // Verde pastel
                doc.fill('#15803d').fontSize(8).font('Helvetica-Bold').text(`Entregados: ${entregadosCount}`, badgeX, y + 14, { width: 90, align: 'center' });

                doc.rect(badgeX + 96, y + 8, 90, 20).fill('#fee2e2'); // Rojo pastel
                doc.fill('#b91c1c').fontSize(8).font('Helvetica-Bold').text(`Pendientes: ${noEntregadosCount}`, badgeX + 96, y + 14, { width: 90, align: 'center' });

                y += 42;

                // Cabecera de Tabla
                doc.rect(40, y, doc.page.width - 80, 20).fill('#334155');
                doc.fill('#ffffff').fontSize(8).font('Helvetica-Bold');
                doc.text('#', 48, y + 5, { width: 25 });
                doc.text('ALUMNO', 75, y + 5, { width: 190 });
                doc.text('GRUPO', 270, y + 5, { width: 70 });
                doc.text('ESTADO', 345, y + 5, { width: 80, align: 'center' });
                doc.text('FECHA Y HORA DE ENTREGA', 430, y + 5, { width: 130, align: 'right' });

                y += 20;

                if (alumnos.length === 0) {
                    doc.fill('#64748b').fontSize(9).font('Helvetica-Oblique').text('No hay alumnos registrados en el grupo.', 50, y + 6);
                    y += 20;
                } else {
                    alumnos.forEach((al, index) => {
                        if (y > doc.page.height - 50) {
                            doc.addPage();
                            y = 40;
                            doc.rect(40, y, doc.page.width - 80, 20).fill('#334155');
                            doc.fill('#ffffff').fontSize(8).font('Helvetica-Bold');
                            doc.text('#', 48, y + 5, { width: 25 });
                            doc.text('ALUMNO', 75, y + 5, { width: 190 });
                            doc.text('GRUPO', 270, y + 5, { width: 70 });
                            doc.text('ESTADO', 345, y + 5, { width: 80, align: 'center' });
                            doc.text('FECHA Y HORA DE ENTREGA', 430, y + 5, { width: 130, align: 'right' });
                            y += 20;
                        }

                        if (index % 2 === 1) {
                            doc.rect(40, y, doc.page.width - 80, 18).fill('#f8fafc');
                        }

                        const entregaKey = `${act.id}_${al.id}`;
                        const tieneEntrega = entregasMap.has(entregaKey);
                        const fechaEntregaRaw = tieneEntrega ? entregasMap.get(entregaKey) : null;

                        const fechaFmt = fechaEntregaRaw
                            ? new Date(fechaEntregaRaw).toLocaleString('es-MX', {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit', hour12: true,
                                timeZone: 'America/Mexico_City'
                            })
                            : '--';

                        const grupoTxt = `${al.nombre_grado || ''} "${al.nombre_grupo || ''}"`;

                        doc.fill('#334155').fontSize(8).font('Helvetica');
                        doc.text(String(index + 1), 48, y + 5, { width: 25 });
                        doc.font('Helvetica-Bold').text(al.nombre_completo, 75, y + 5, { width: 190, lineBreak: false });
                        doc.font('Helvetica').text(grupoTxt, 270, y + 5, { width: 70, lineBreak: false });

                        if (tieneEntrega) {
                            doc.fill('#16a34a').font('Helvetica-Bold').text('ENTREGADO', 345, y + 5, { width: 80, align: 'center' });
                            doc.fill('#15803d').font('Helvetica').text(fechaFmt, 430, y + 5, { width: 130, align: 'right' });
                        } else {
                            doc.fill('#dc2626').font('Helvetica-Bold').text('NO ENTREGADO', 345, y + 5, { width: 80, align: 'center' });
                            doc.fill('#94a3b8').font('Helvetica').text('--', 430, y + 5, { width: 130, align: 'right' });
                        }

                        y += 18;
                    });
                }

                y += 15;
            });
        }

        doc.end();
        return doc;
    }
}

module.exports = ReporteService;
