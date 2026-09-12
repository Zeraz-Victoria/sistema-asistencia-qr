const ReporteService = require('../services/reporteService');

class ReporteController {
    // Helper para Header Moderno
    static drawHeader(doc, title, subInfo) {
        // Banner Azul
        doc.rect(0, 0, doc.page.width, 80).fill('#4f46e5');

        // Título Escuela / Reporte
        doc.fontSize(20).fillColor('white')
            .text(subInfo.nombre_institucion || 'Sistema de Asistencia', 50, 25);

        doc.fontSize(10).fillColor('#e0e7ff')
            .text(title.toUpperCase(), 50, 50);

        // Info Box (floating card style below banner)
        const boxY = 90;
        doc.fillColor('black');

        doc.font('Helvetica-Bold').fontSize(10).text('Docente:', 50, boxY);
        doc.font('Helvetica').text(subInfo.nombre_maestro || 'Sin Asignar', 100, boxY);

        doc.font('Helvetica-Bold').text('Grado/Grupo:', 300, boxY);
        doc.font('Helvetica').text(`${subInfo.nombre_grado || ''} "${subInfo.nombre_grupo || ''}"`, 380, boxY);

        doc.font('Helvetica-Bold').text('Mes:', 500, boxY);
        doc.font('Helvetica').text(subInfo.mes, 540, boxY);

        return boxY + 40; // New Y start
    }



    // Helper para formato mes
    static formatMonthYear(mesStr) {
        // mesStr = "2026-01"
        const [y, m] = mesStr.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1);
        const monthName = date.toLocaleString('es-MX', { month: 'long' });
        return `${monthName.toUpperCase()} ${y}`;
    }

    static async obtenerDetalladoPdf(req, res) {
        console.log(">> INICIO DETALLADO PDF");
        try {
            const { mes, clase_id } = req.query;
            const { institucion_id } = req.usuario;

            console.log(`Params: mes=${mes}, clase=${clase_id}, inst=${institucion_id}`);

            // Validación Robusta
            if (!mes || !clase_id || clase_id === 'null' || clase_id === 'undefined') {
                return res.status(400).json({ error: 'Faltan datos: Mes o Clase no válidos.' });
            }
            if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: 'Formato de mes incorrecto' });

            // Generate Data
            console.log("Generando datos...");
            const { doc, enc, diasHeader, diasHabiles, alumnos, mapa, suspensiones } = await ReporteService.generarDetalladoPdf(mes, clase_id, institucion_id);
            console.log("Datos generados correctamente.");

            res.setHeader('Content-Type', 'application/pdf');

            const claseNombre = enc && enc.nombre_grado && enc.nombre_grupo 
                ? `${enc.nombre_grado}_${enc.nombre_grupo}`
                : '';
            const materiaNombre = enc && enc.nombre_materia
                ? `_${enc.nombre_materia}`
                : '';
            const rawFilename = `reporte_detallado_${mes}_${claseNombre}${materiaNombre}`;
            const safeFilename = rawFilename
                .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')
                .replace(/__+/g, '_')
                .replace(/^_|_$/g, '');

            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename || 'detallado_' + mes}.pdf"`);

            // Handle Stream Errors
            doc.on('error', (err) => {
                console.error("PDF Stream Error:", err);
                if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF en streaming' });
            });

            doc.pipe(res);

            // -- NEW DESIGN (Landscape) --
            // Robust Header Access
            const nombreInst = enc && enc.nombre_institucion ? enc.nombre_institucion : 'Sistema de Asistencia';
            const maestro = enc && enc.nombre_maestro ? enc.nombre_maestro : '-';
            const grado = enc && enc.nombre_grado ? enc.nombre_grado : '';
            const grupo = enc && enc.nombre_grupo ? enc.nombre_grupo : '';
            const mesTexto = ReporteController.formatMonthYear(mes);

            // Header adaptation for landscape
            doc.rect(0, 0, doc.page.width, 60).fill('#4f46e5');
            doc.fontSize(16).fillColor('white').text(nombreInst, 30, 15);
            doc.fontSize(10).fillColor('#e0e7ff').text(`REPORTE DETALLADO - ${mesTexto}`, 30, 40);

            // Info Line
            doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
            const infoMateria = enc && enc.nombre_materia ? `   |   Materia: ${enc.nombre_materia}` : '';
            doc.text(`Docente: ${maestro}   |   Grupo: ${grado} ${grupo}${infoMateria}`, 30, 75);

            const startX = 30;
            const colWidth = 18;
            let currentX = startX + 200; // More space for names

            // Table Header Row
            const tableY = 100;
            doc.rect(startX, tableY, doc.page.width - 60, 20).fill('#e5e7eb');

            doc.fillColor('black').fontSize(9).text('ALUMNO', startX + 10, tableY + 5);

            if (diasHeader && Array.isArray(diasHeader)) {
                diasHeader.forEach((d, i) => {
                    doc.text(d, currentX + (i * colWidth), tableY + 5, { width: colWidth, align: 'center' });
                });
            }

            let currentY = tableY + 20;
            let pageStartY = currentY; // Track start of rows for this page
            let lastGroup = '';

            // Helper to draw overlays for the current page
            const drawOverlays = (startY, endY) => {
                if (!suspensiones || suspensiones.size === 0) return;
                const height = endY - startY;
                if (height <= 0) return;

                diasHabiles.forEach((f, idx) => {
                    if (suspensiones.has(f)) {
                        const motivo = suspensiones.get(f);
                        const x = currentX + (idx * colWidth);
                        const centerX = x + (colWidth / 2);
                        const centerY = startY + (height / 2);

                        doc.save();
                        doc.translate(centerX + 3, centerY); // Center of the column column block
                        doc.rotate(-90);
                        doc.fillColor('#6b7280'); // Cool Gray 500
                        doc.fontSize(8).font('Helvetica-Bold');
                        // Calculate width based on height of column (since rotated)
                        doc.text(motivo.toUpperCase(), -(height / 2), 0, { width: height, align: 'center', ellipsis: true });
                        doc.restore();
                    }
                });
            };

            if (alumnos && Array.isArray(alumnos)) {
                alumnos.forEach((al, i) => {
                    if (currentY > 500) {
                        // Draw overlays for the finished page
                        drawOverlays(pageStartY, currentY);

                        doc.addPage({ layout: 'landscape' });
                        currentY = 50;
                        pageStartY = currentY; // Reset for new page
                    }

                    // Group Header
                    const currentGroup = `${al.nombre_grado} ${al.nombre_grupo}`;
                    if (currentGroup !== lastGroup) {
                        currentY += 5;
                        doc.font('Helvetica-Bold').fillColor('#4f46e5').fontSize(10)
                            .text(currentGroup, startX, currentY);
                        doc.moveTo(startX, currentY + 12).lineTo(doc.page.width - 30, currentY + 12).stroke('#4f46e5');
                        currentY += 15;
                        lastGroup = currentGroup;
                    }

                    // Zebra
                    if (i % 2 !== 0) doc.rect(startX, currentY, doc.page.width - 60, 16).fill('#f9fafb');

                    // Name
                    doc.fillColor('black').font('Helvetica').fontSize(9)
                        .text(al.nombre_completo, startX + 5, currentY + 3, { width: 190, ellipsis: true });

                    // Attendance Dots
                    const asisAlumno = mapa.get(al.id) || new Map();
                    if (diasHabiles && Array.isArray(diasHabiles)) {
                        diasHabiles.forEach((f, idx) => {
                            const x = currentX + (idx * colWidth);
                            const y = currentY + 4;

                            // Check Suspension
                            if (suspensiones && suspensiones.has(f)) {
                                // Draw Grey Background for this cell
                                doc.rect(x, currentY, colWidth, 16).fill('#f3f4f6');
                                return; // Skip drawing status dots
                            }

                            if (asisAlumno.has(f)) {
                                const status = asisAlumno.get(f);
                                if (status === 'presente') {
                                    // Green Dot
                                    doc.circle(x + 9, y + 4, 3).fill('#10b981');
                                } else if (status === 'retardo') {
                                    // Yellow Dot
                                    doc.circle(x + 9, y + 4, 3).fill('#f59e0b');
                                } else if (status === 'falta') {
                                    // Red Dot (Recorded Absence)
                                    doc.circle(x + 9, y + 4, 3).fill('#ef4444');
                                } else {
                                    // Fallback Green
                                    doc.circle(x + 9, y + 4, 3).fill('#10b981');
                                }
                            } else {
                                // Red Dot (No Record = Absence)
                                doc.circle(x + 9, y + 4, 2).fill('#ef4444');
                            }
                        });
                    }

                    currentY += 16;
                });
                // Draw overlays for the last page
                drawOverlays(pageStartY, currentY);
            }

            console.log("Finalizando documento PDF...");
            doc.end();
            console.log(">> FIN DETALLADO PDF (Enviado)");

        } catch (error) {
            console.error("CRITICAL ERROR PDF Detallado:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error generando PDF detallado: ' + error.message });
            } else {
                console.error("Error occurred after headers sent, connection likely corrupted.");
            }
        }
    }

    static async generarReporteDocentes(req, res) {
        try {
            const { mes } = req.query;
            const { institucion_id } = req.usuario;

            if (!mes) return res.status(400).json({ error: 'Faltan datos: mes' });

            // Generate Data
            const { maestros, mapa, diasHabiles, diasHeader, suspensiones, nombreInstitucion } = await ReporteService.generarReporteDocenteData(mes, institucion_id);

            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ layout: 'landscape', margin: 30 });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_docente_${mes}.pdf"`);

            doc.pipe(res);

            // -- NEW DESIGN (Landscape Matrix) --
            const mesTexto = ReporteController.formatMonthYear(mes);
            const nombreInst = nombreInstitucion || 'Sistema de Asistencia';

            // Header
            doc.rect(0, 0, doc.page.width, 60).fill('#4f46e5');
            doc.fontSize(16).fillColor('white').text(nombreInst, 30, 15);
            doc.fontSize(10).fillColor('#e0e7ff').text(`REPORTE ASISTENCIA DOCENTE - ${mesTexto}`, 30, 40);

            // Table Setup
            const startX = 30;
            // Calculations for column width: (PageWidth - StartX - NameWidth) / Days
            const nameWidth = 200;
            const availableWidth = doc.page.width - startX - 30 - nameWidth;
            const colWidth = Math.min(30, availableWidth / (diasHabiles.length || 1));
            // 30 is enough for "08:00" in small font

            let currentX = startX + nameWidth;

            // Table Header Row
            const tableY = 80;
            doc.rect(startX, tableY, doc.page.width - 60, 20).fill('#e5e7eb');

            doc.fillColor('black').fontSize(9).text('DOCENTE', startX + 10, tableY + 5);

            if (diasHeader && Array.isArray(diasHeader)) {
                diasHeader.forEach((d, i) => {
                    doc.text(d, currentX + (i * colWidth), tableY + 5, { width: colWidth, align: 'center' });
                });
            }

            let currentY = tableY + 20;
            let pageStartY = currentY;

            // Helper for overlays
            const drawOverlays = (startY, endY) => {
                if (!suspensiones || suspensiones.size === 0) return;
                const height = endY - startY;
                if (height <= 0) return;

                diasHabiles.forEach((f, idx) => {
                    if (suspensiones.has(f)) {
                        const motivo = suspensiones.get(f);
                        const x = currentX + (idx * colWidth);
                        const centerX = x + (colWidth / 2);
                        const centerY = startY + (height / 2);

                        doc.save();
                        doc.translate(centerX + 3, centerY);
                        doc.rotate(-90);
                        doc.fillColor('#6b7280');
                        doc.fontSize(8).font('Helvetica-Bold');
                        doc.text(motivo.toUpperCase(), -(height / 2), 0, { width: height, align: 'center', ellipsis: true });
                        doc.restore();
                    }
                });
            };

            if (maestros && Array.isArray(maestros)) {
                maestros.forEach((maestro, i) => {
                    if (currentY > 500) {
                        drawOverlays(pageStartY, currentY);
                        doc.addPage({ layout: 'landscape' });
                        currentY = 50;
                        pageStartY = currentY;
                    }

                    // Zebra striping
                    if (i % 2 !== 0) doc.rect(startX, currentY, doc.page.width - 60, 24).fill('#f9fafb');

                    // Name
                    doc.fillColor('black').font('Helvetica').fontSize(9)
                        .text(maestro.nombre_completo, startX + 5, currentY + 4, { width: nameWidth - 10, ellipsis: true });

                    // Attendance Cells
                    const asisMaestro = mapa.get(maestro.id) || new Map();
                    if (diasHabiles && Array.isArray(diasHabiles)) {
                        diasHabiles.forEach((f, idx) => {
                            const x = currentX + (idx * colWidth);
                            const y = currentY + 4;
                            const cellCenter = x + (colWidth / 2);

                            // Check Suspension
                            if (suspensiones && suspensiones.has(f)) {
                                doc.rect(x, currentY, colWidth, 24).fill('#f3f4f6');
                                return;
                            }

                            if (asisMaestro.has(f)) {
                                const record = asisMaestro.get(f);
                                const status = record.status;
                                const hora = record.hora || '--:--';
                                const horaSalida = record.horaSalida;

                                let color = '#000000';
                                if (status === 'presente') color = '#10b981'; // Green
                                else if (status === 'retardo') color = '#f59e0b'; // Amber
                                else if (status === 'falta') color = '#ef4444'; // Red (Usually absent doesn't have time, but if marked manually maybe)

                                // Draw Entry Time (Colored) - Top
                                doc.fillColor(color).fontSize(7).text(hora, x, y, { width: colWidth, align: 'center' });

                                // Draw Exit Time (Black/Grey) - Bottom
                                if (horaSalida) {
                                    doc.fillColor('#4b5563').fontSize(6).text(horaSalida, x, y + 9, { width: colWidth, align: 'center' });
                                }

                            } else {
                                // Absent (No record) -> Red Dot or "F"
                                doc.circle(cellCenter, y + 4, 2).fill('#ef4444');
                            }
                        });
                    }

                    currentY += 24; // Row height increased
                });
                drawOverlays(pageStartY, currentY);
            }

            doc.end();

        } catch (error) {
            console.error("Error reporte docente:", error);
            if (!res.headersSent) res.status(500).json({ error: 'Error generando reporte docente' });
        }
    }

    static async obtenerTareasPdf(req, res) {
        try {
            const { mes, actividad_id, clase_id } = req.query;
            const { institucion_id, id: usuario_id } = req.usuario;

            const doc = await ReporteService.generarTareasPdf(mes, actividad_id, institucion_id, clase_id, usuario_id);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="reporte_tareas_${mes || 'general'}.pdf"`);

            doc.pipe(res);
        } catch (error) {
            console.error('Error generando PDF de tareas:', error);
            if (!res.headersSent) res.status(500).json({ error: 'Error generando PDF de tareas' });
        }
    }
}

module.exports = ReporteController;
