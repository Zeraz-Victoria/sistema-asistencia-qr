import UIKit
import PDFKit
import CoreImage

final class PDFReportService {
    static let shared = PDFReportService()
    
    private let ciContext = CIContext()
    
    private init() {}
    
    // Dimensiones estándar Carta (US Letter): 612 x 792 pt
    private let pageWidth: CGFloat = 612.0
    private let pageHeight: CGFloat = 792.0
    private let marginX: CGFloat = 36.0
    private let marginTop: CGFloat = 36.0
    private let marginBottom: CGFloat = 40.0
    
    private var contentWidth: CGFloat {
        pageWidth - (marginX * 2)
    }
    
    // MARK: - Generar PDF de Asistencia
    func generarPDFAsistencias(asistencias: [AsistenciaRegistro], filtro: String, fechaReporte: Date = Date()) -> URL? {
        let pdfMetaData: [CFString: Any] = [
            kCGPDFContextCreator: "Asistencia QR iOS",
            kCGPDFContextAuthor: "Control Escolar",
            kCGPDFContextTitle: "Reporte de Asistencia"
        ]
        
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData as [String: Any]
        
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        
        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "es_MX")
        dateFormatter.dateStyle = .full
        let fechaLarga = dateFormatter.string(from: fechaReporte).capitalized
        
        let timeFormatter = DateFormatter()
        timeFormatter.locale = Locale(identifier: "es_MX")
        timeFormatter.dateFormat = "HH:mm 'hrs'"
        let horaStr = timeFormatter.string(from: Date())
        
        let total = asistencias.count
        let presentes = asistencias.filter { $0.estado.lowercased() == "presente" }.count
        let retardos = asistencias.filter { $0.estado.lowercased() == "retardo" }.count
        let faltas = asistencias.filter { $0.estado.lowercased() == "falta" }.count
        
        let docenteInfo = AuthManager.shared.usuarioActual?.nombre ?? AuthManager.shared.usuarioActual?.email ?? "Control Escolar"
        
        let data = renderer.pdfData { context in
            var paginaActual = 1
            context.beginPage()
            
            // 1. Encabezado principal
            var currentY: CGFloat = marginTop
            currentY = dibujarEncabezado(
                titulo: "REPORTE DE ASISTENCIA DIARIA",
                subtitulo: "\(fechaLarga) • Generado: \(horaStr)",
                institucion: docenteInfo,
                en: context,
                startY: currentY
            )
            
            // 2. Tarjetas de métricas
            let metricas: [(titulo: String, valor: String, color: UIColor)] = [
                ("Total Registros", "\(total)", UIColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1.0)),
                ("A Tiempo", "\(presentes)", UIColor(red: 0.09, green: 0.63, blue: 0.34, alpha: 1.0)),
                ("Retardos", "\(retardos)", UIColor(red: 0.92, green: 0.47, blue: 0.08, alpha: 1.0)),
                ("Faltas", "\(faltas)", UIColor(red: 0.86, green: 0.20, blue: 0.20, alpha: 1.0))
            ]
            currentY = dibujarTarjetasMetricas(metricas: metricas, en: context, startY: currentY)
            
            // 3. Indicador de Filtro
            let filtroTexto: String
            switch filtro.lowercased() {
            case "presente": filtroTexto = "Filtro activo: Solo alumnos a tiempo"
            case "retardo": filtroTexto = "Filtro activo: Solo alumnos con retardo"
            default: filtroTexto = "Filtro activo: Todos los registros"
            }
            
            let filtroAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                .foregroundColor: UIColor(red: 0.35, green: 0.40, blue: 0.48, alpha: 1.0)
            ]
            (filtroTexto as NSString).draw(at: CGPoint(x: marginX, y: currentY), withAttributes: filtroAttrs)
            currentY += 16
            
            // 4. Encabezado de la tabla de Asistencias
            let columnas: [(titulo: String, ancho: CGFloat, alineacion: NSTextAlignment)] = [
                ("#", 32, .center),
                ("Nombre del Alumno", 280, .left),
                ("Hora Registro", 110, .center),
                ("Estado", 118, .center)
            ]
            
            currentY = dibujarEncabezadoTabla(columnas: columnas, en: context, startY: currentY)
            
            // 5. Filas de alumnos
            let rowHeight: CGFloat = 24.0
            let maxContentY = pageHeight - marginBottom - 25.0
            
            for (index, item) in asistencias.enumerated() {
                if currentY + rowHeight > maxContentY {
                    // Dibujar pie de página de la página saliente
                    dibujarPieDePagina(pagina: paginaActual, en: context)
                    
                    // Iniciar nueva página
                    context.beginPage()
                    paginaActual += 1
                    currentY = marginTop
                    
                    // Encabezado compacto en siguientes páginas
                    currentY = dibujarEncabezadoCompacto(
                        titulo: "REPORTE DE ASISTENCIA DIARIA",
                        detalle: fechaLarga,
                        en: context,
                        startY: currentY
                    )
                    
                    currentY = dibujarEncabezadoTabla(columnas: columnas, en: context, startY: currentY)
                }
                
                // Fondo alternado
                let esPar = (index % 2 == 0)
                let rowRect = CGRect(x: marginX, y: currentY, width: contentWidth, height: rowHeight)
                if !esPar {
                    let bgPath = UIBezierPath(roundedRect: rowRect, cornerRadius: 4)
                    UIColor(red: 0.97, green: 0.98, blue: 0.99, alpha: 1.0).setFill()
                    bgPath.fill()
                }
                
                // Borde inferior sutil
                let linePath = UIBezierPath()
                linePath.move(to: CGPoint(x: marginX, y: currentY + rowHeight))
                linePath.addLine(to: CGPoint(x: marginX + contentWidth, y: currentY + rowHeight))
                UIColor(red: 0.92, green: 0.94, blue: 0.96, alpha: 1.0).setStroke()
                linePath.lineWidth = 0.5
                linePath.stroke()
                
                // #
                let numStr = "\(index + 1)"
                let numRect = CGRect(x: marginX, y: currentY + 5, width: 32, height: rowHeight - 6)
                let numAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.monospacedDigitSystemFont(ofSize: 9, weight: .regular),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                dibujarTextoCentrado(texto: numStr, en: numRect, attrs: numAttrs)
                
                // Nombre
                let nombre = item.nombre_completo ?? "Alumno #\(item.alumno_id)"
                let nomRect = CGRect(x: marginX + 36, y: currentY + 5, width: 275, height: rowHeight - 6)
                let nomAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                    .foregroundColor: UIColor(red: 0.08, green: 0.12, blue: 0.18, alpha: 1.0)
                ]
                (nombre as NSString).draw(in: nomRect, withAttributes: nomAttrs)
                
                // Hora
                let hora = item.horaOFecha
                let horaRect = CGRect(x: marginX + 312, y: currentY + 5, width: 110, height: rowHeight - 6)
                let horaAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.monospacedDigitSystemFont(ofSize: 9, weight: .regular),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                dibujarTextoCentrado(texto: hora, en: horaRect, attrs: horaAttrs)
                
                // Badge de Estado
                let estadoBadgeRect = CGRect(x: marginX + 430, y: currentY + 3.5, width: 90, height: 17)
                dibujarBadge(estado: item.estado, en: estadoBadgeRect)
                
                currentY += rowHeight
            }
            
            // Pie de página de la última página
            dibujarPieDePagina(pagina: paginaActual, en: context)
        }
        
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("Reporte_Asistencia_\(fechaSimple(Date())).pdf")
        do {
            try data.write(to: fileURL)
            return fileURL
        } catch {
            print("Error al guardar PDF de asistencia: \(error)")
            return nil
        }
    }
    
    // MARK: - Generar PDF de Tareas y Actividades
    func generarPDFTareas(
        actividad: Actividad,
        alumnos: [Alumno],
        entregasIds: Set<Int>,
        nombreGrupo: String?
    ) -> URL? {
        let pdfMetaData: [CFString: Any] = [
            kCGPDFContextCreator: "Asistencia QR iOS",
            kCGPDFContextAuthor: "Control Escolar",
            kCGPDFContextTitle: "Reporte de Tarea - \(actividad.titulo)"
        ]
        
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData as [String: Any]
        
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        
        let fechaActual = Date()
        let dateFormatter = DateFormatter()
        dateFormatter.locale = Locale(identifier: "es_MX")
        dateFormatter.dateStyle = .full
        let fechaLarga = dateFormatter.string(from: fechaActual).capitalized
        
        let total = alumnos.count
        let entregadas = alumnos.filter { entregasIds.contains($0.id) }.count
        let pendientes = total - entregadas
        let porcentaje = total > 0 ? Int((Double(entregadas) / Double(total)) * 100) : 0
        
        let docenteInfo = AuthManager.shared.usuarioActual?.nombre ?? AuthManager.shared.usuarioActual?.email ?? "Control Escolar"
        let grupoTexto = nombreGrupo ?? "Todos los Grupos"
        
        let data = renderer.pdfData { context in
            var paginaActual = 1
            context.beginPage()
            
            // 1. Encabezado principal
            var currentY: CGFloat = marginTop
            currentY = dibujarEncabezado(
                titulo: "REPORTE DE TAREA ESCOLAR",
                subtitulo: "Actividad: \(actividad.titulo) • Grupo: \(grupoTexto)",
                institucion: docenteInfo,
                en: context,
                startY: currentY
            )
            
            // Descripción de la tarea si existe
            if let desc = actividad.descripcion, !desc.trimmingCharacters(in: .whitespaces).isEmpty {
                let descAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 8.5, weight: .regular),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                let descRect = CGRect(x: marginX, y: currentY, width: contentWidth, height: 24)
                ("Instrucciones: \(desc)" as NSString).draw(in: descRect, withAttributes: descAttrs)
                currentY += 20
            }
            
            // 2. Tarjetas de métricas
            let metricas: [(titulo: String, valor: String, color: UIColor)] = [
                ("Total Alumnos", "\(total)", UIColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1.0)),
                ("Entregadas", "\(entregadas)", UIColor(red: 0.09, green: 0.63, blue: 0.34, alpha: 1.0)),
                ("Pendientes", "\(pendientes)", UIColor(red: 0.92, green: 0.47, blue: 0.08, alpha: 1.0)),
                ("Cumplimiento", "\(porcentaje)%", UIColor(red: 0.58, green: 0.20, blue: 0.86, alpha: 1.0))
            ]
            currentY = dibujarTarjetasMetricas(metricas: metricas, en: context, startY: currentY)
            
            // 3. Encabezado de la tabla de Tareas
            let columnas: [(titulo: String, ancho: CGFloat, alineacion: NSTextAlignment)] = [
                ("#", 32, .center),
                ("Nombre del Alumno", 260, .left),
                ("Grupo", 120, .left),
                ("Estatus de Entrega", 128, .center)
            ]
            
            currentY = dibujarEncabezadoTabla(columnas: columnas, en: context, startY: currentY)
            
            // 4. Filas de alumnos
            let rowHeight: CGFloat = 24.0
            let maxContentY = pageHeight - marginBottom - 25.0
            
            for (index, alumno) in alumnos.enumerated() {
                if currentY + rowHeight > maxContentY {
                    dibujarPieDePagina(pagina: paginaActual, en: context)
                    
                    context.beginPage()
                    paginaActual += 1
                    currentY = marginTop
                    
                    currentY = dibujarEncabezadoCompacto(
                        titulo: "REPORTE DE TAREA: \(actividad.titulo)",
                        detalle: "Grupo: \(grupoTexto) • \(fechaLarga)",
                        en: context,
                        startY: currentY
                    )
                    
                    currentY = dibujarEncabezadoTabla(columnas: columnas, en: context, startY: currentY)
                }
                
                let esPar = (index % 2 == 0)
                let rowRect = CGRect(x: marginX, y: currentY, width: contentWidth, height: rowHeight)
                if !esPar {
                    let bgPath = UIBezierPath(roundedRect: rowRect, cornerRadius: 4)
                    UIColor(red: 0.97, green: 0.98, blue: 0.99, alpha: 1.0).setFill()
                    bgPath.fill()
                }
                
                let linePath = UIBezierPath()
                linePath.move(to: CGPoint(x: marginX, y: currentY + rowHeight))
                linePath.addLine(to: CGPoint(x: marginX + contentWidth, y: currentY + rowHeight))
                UIColor(red: 0.92, green: 0.94, blue: 0.96, alpha: 1.0).setStroke()
                linePath.lineWidth = 0.5
                linePath.stroke()
                
                // #
                let numStr = "\(index + 1)"
                let numRect = CGRect(x: marginX, y: currentY + 5, width: 32, height: rowHeight - 6)
                let numAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.monospacedDigitSystemFont(ofSize: 9, weight: .regular),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                dibujarTextoCentrado(texto: numStr, en: numRect, attrs: numAttrs)
                
                // Nombre
                let nomRect = CGRect(x: marginX + 36, y: currentY + 5, width: 255, height: rowHeight - 6)
                let nomAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                    .foregroundColor: UIColor(red: 0.08, green: 0.12, blue: 0.18, alpha: 1.0)
                ]
                (alumno.nombre_completo as NSString).draw(in: nomRect, withAttributes: nomAttrs)
                
                // Grupo
                let grupoFinal: String = {
                    let g = alumno.obtenerGrupo()
                    if g != "Sin grupo" { return g }
                    if let ng = nombreGrupo, ng != "Todos los Grupos" && !ng.isEmpty {
                        return ng
                    }
                    return "Sin grupo"
                }()
                let grupoRect = CGRect(x: marginX + 296, y: currentY + 5, width: 115, height: rowHeight - 6)
                let grupoAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 8.5, weight: .regular),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                (grupoFinal as NSString).draw(in: grupoRect, withAttributes: grupoAttrs)
                
                // Estatus de entrega
                let entregada = entregasIds.contains(alumno.id)
                let entregaRect = CGRect(x: marginX + 418, y: currentY + 3.5, width: 110, height: 17)
                dibujarBadgeTarea(entregada: entregada, en: entregaRect)
                
                currentY += rowHeight
            }
            
            dibujarPieDePagina(pagina: paginaActual, en: context)
        }
        
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("Reporte_Tarea_\(fechaSimple(Date())).pdf")
        do {
            try data.write(to: fileURL)
            return fileURL
        } catch {
            print("Error al guardar PDF de tarea: \(error)")
            return nil
        }
    }
    
    // MARK: - Generar PDF Mensual de Tareas Filtradas por Grupo
    func generarPDFReporteMensualTareas(
        mesTexto: String,
        nombreGrupo: String,
        nombreEscuela: String,
        nombreDocente: String,
        actividades: [Actividad],
        alumnos: [Alumno],
        entregasPorActividad: [Int: Set<Int>]
    ) -> URL? {
        let pdfMetaData: [CFString: Any] = [
            kCGPDFContextCreator: "Asistencia QR iOS",
            kCGPDFContextAuthor: nombreDocente,
            kCGPDFContextTitle: "Reporte de Tareas - \(nombreGrupo)"
        ]
        
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData as [String: Any]
        
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        
        let data = renderer.pdfData { context in
            var paginaActual = 1
            context.beginPage()
            
            var currentY: CGFloat = marginTop
            currentY = dibujarEncabezadoOficial(
                tipoReporte: "REPORTE DE TAREAS",
                nombreEscuela: nombreEscuela,
                nombreDocente: nombreDocente,
                nombreGrupo: nombreGrupo,
                mesTexto: mesTexto,
                en: context,
                startY: currentY
            )
            
            if actividades.isEmpty {
                let vacioAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 11, weight: .medium),
                    .foregroundColor: UIColor.secondaryLabel
                ]
                let rectVacio = CGRect(x: marginX, y: currentY + 40, width: contentWidth, height: 40)
                dibujarTextoCentrado(
                    texto: "No se encontraron tareas registradas para el grupo \(nombreGrupo) en \(mesTexto).",
                    en: rectVacio,
                    attrs: vacioAttrs
                )
            } else {
                let maxContentY = pageHeight - marginBottom - 40.0
                let rowHeight: CGFloat = 22.0
                
                let columnas: [(titulo: String, ancho: CGFloat, alineacion: NSTextAlignment)] = [
                    ("#", 32, .center),
                    ("Nombre del Alumno", 320, .left),
                    ("Estado de Entrega", 188, .center)
                ]
                
                for act in actividades {
                    let entregadosSet = entregasPorActividad[act.id] ?? []
                    let totalAlu = alumnos.count
                    let entregados = alumnos.filter { entregadosSet.contains($0.id) }.count
                    let pendientes = totalAlu - entregados
                    
                    if currentY + 80 > maxContentY {
                        dibujarPieDePagina(pagina: paginaActual, en: context)
                        context.beginPage()
                        paginaActual += 1
                        currentY = marginTop
                        
                        currentY = dibujarEncabezadoOficial(
                            tipoReporte: "REPORTE DE TAREAS",
                            nombreEscuela: nombreEscuela,
                            nombreDocente: nombreDocente,
                            nombreGrupo: nombreGrupo,
                            mesTexto: mesTexto,
                            en: context,
                            startY: currentY
                        )
                    }
                    
                    // Tarjeta de la Tarea
                    let tareaCardRect = CGRect(x: marginX, y: currentY, width: contentWidth, height: 32)
                    let tareaCardPath = UIBezierPath(roundedRect: tareaCardRect, cornerRadius: 6)
                    UIColor(red: 0.94, green: 0.96, blue: 0.98, alpha: 1.0).setFill()
                    tareaCardPath.fill()
                    
                    let actTituloAttrs: [NSAttributedString.Key: Any] = [
                        .font: UIFont.systemFont(ofSize: 10.5, weight: .bold),
                        .foregroundColor: UIColor(red: 0.08, green: 0.12, blue: 0.18, alpha: 1.0)
                    ]
                    ("TAREA: \(act.titulo.uppercased())" as NSString).draw(
                        at: CGPoint(x: marginX + 10, y: currentY + 8),
                        withAttributes: actTituloAttrs
                    )
                    
                    // Resumen badges a la derecha
                    let badgeEntregadas = "Entregadas: \(entregados)"
                    let badgePendientes = "Pendientes: \(pendientes)"
                    let badgeAttrs: [NSAttributedString.Key: Any] = [
                        .font: UIFont.systemFont(ofSize: 8.5, weight: .bold),
                        .foregroundColor: UIColor(red: 0.09, green: 0.55, blue: 0.32, alpha: 1.0)
                    ]
                    let badgePendAttrs: [NSAttributedString.Key: Any] = [
                        .font: UIFont.systemFont(ofSize: 8.5, weight: .bold),
                        .foregroundColor: UIColor(red: 0.85, green: 0.20, blue: 0.20, alpha: 1.0)
                    ]
                    (badgeEntregadas as NSString).draw(
                        at: CGPoint(x: marginX + contentWidth - 190, y: currentY + 9),
                        withAttributes: badgeAttrs
                    )
                    (badgePendientes as NSString).draw(
                        at: CGPoint(x: marginX + contentWidth - 95, y: currentY + 9),
                        withAttributes: badgePendAttrs
                    )
                    
                    currentY += 38
                    
                    // Encabezado de tabla
                    currentY = dibujarEncabezadoTabla(columnas: columnas, en: context, startY: currentY)
                    
                    // Filas de alumnos
                    for (alIndex, alumno) in alumnos.enumerated() {
                        if currentY + rowHeight > maxContentY {
                            dibujarPieDePagina(pagina: paginaActual, en: context)
                            context.beginPage()
                            paginaActual += 1
                            currentY = marginTop
                            
                            currentY = dibujarEncabezadoCompacto(
                                titulo: "REPORTE DE TAREAS - \(act.titulo)",
                                detalle: "Grupo: \(nombreGrupo) • Mes: \(mesTexto)",
                                en: context,
                                startY: currentY
                            )
                            currentY = dibujarEncabezadoTabla(columnas: columnas, en: context, startY: currentY)
                        }
                        
                        let esPar = (alIndex % 2 == 0)
                        if !esPar {
                            let rowRect = CGRect(x: marginX, y: currentY, width: contentWidth, height: rowHeight)
                            UIColor(red: 0.98, green: 0.99, blue: 0.99, alpha: 1.0).setFill()
                            UIRectFill(rowRect)
                        }
                        
                        let line = UIBezierPath()
                        line.move(to: CGPoint(x: marginX, y: currentY + rowHeight))
                        line.addLine(to: CGPoint(x: marginX + contentWidth, y: currentY + rowHeight))
                        UIColor(red: 0.92, green: 0.94, blue: 0.96, alpha: 1.0).setStroke()
                        line.lineWidth = 0.5
                        line.stroke()
                        
                        let numAttrs: [NSAttributedString.Key: Any] = [
                            .font: UIFont.monospacedDigitSystemFont(ofSize: 8.5, weight: .regular),
                            .foregroundColor: UIColor.secondaryLabel
                        ]
                        dibujarTextoCentrado(texto: "\(alIndex + 1)", en: CGRect(x: marginX, y: currentY + 4, width: 32, height: 14), attrs: numAttrs)
                        
                        let nomAttrs: [NSAttributedString.Key: Any] = [
                            .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
                            .foregroundColor: UIColor(red: 0.08, green: 0.12, blue: 0.18, alpha: 1.0)
                        ]
                        (alumno.nombre_completo as NSString).draw(
                            in: CGRect(x: marginX + 36, y: currentY + 4, width: 310, height: 14),
                            withAttributes: nomAttrs
                        )
                        
                        let fueEntregada = entregadosSet.contains(alumno.id)
                        let badgeRect = CGRect(x: marginX + 370, y: currentY + 2.5, width: 140, height: 16)
                        dibujarBadgeTarea(entregada: fueEntregada, en: badgeRect)
                        
                        currentY += rowHeight
                    }
                    
                    currentY += 16
                }
            }
            
            dibujarPieDePagina(pagina: paginaActual, en: context)
        }
        
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("Reporte_Tareas_\(fechaSimple(Date())).pdf")
        do {
            try data.write(to: fileURL)
            return fileURL
        } catch {
            print("Error al guardar PDF mensual de tareas: \(error)")
            return nil
        }
    }
    
    // MARK: - Encabezado Oficial Limpio (Reporte de Tareas / Asistencia)
    private func dibujarEncabezadoOficial(
        tipoReporte: String,
        nombreEscuela: String,
        nombreDocente: String,
        nombreGrupo: String,
        mesTexto: String,
        en context: UIGraphicsPDFRendererContext,
        startY: CGFloat
    ) -> CGFloat {
        var y = startY
        
        let headerHeight: CGFloat = 68.0
        let headerRect = CGRect(x: marginX, y: y, width: contentWidth, height: headerHeight)
        let headerPath = UIBezierPath(roundedRect: headerRect, cornerRadius: 8.0)
        UIColor(red: 0.02, green: 0.37, blue: 0.27, alpha: 1.0).setFill()
        headerPath.fill()
        
        // 1. Nombre de la escuela
        let escAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 14, weight: .heavy),
            .foregroundColor: UIColor.white
        ]
        (nombreEscuela.uppercased() as NSString).draw(
            at: CGPoint(x: marginX + 16, y: y + 12),
            withAttributes: escAttrs
        )
        
        // 2. Tipo de reporte (Reporte de Tareas / Reporte de Asistencia)
        let tipoAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 11, weight: .bold),
            .foregroundColor: UIColor(red: 0.82, green: 0.98, blue: 0.88, alpha: 1.0)
        ]
        (tipoReporte.uppercased() as NSString).draw(
            at: CGPoint(x: marginX + 16, y: y + 32),
            withAttributes: tipoAttrs
        )
        
        // 3. Subtítulo con Docente, Grupo y Mes
        let metaAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .medium),
            .foregroundColor: UIColor.white.withAlphaComponent(0.9)
        ]
        let infoStr = "Docente: \(nombreDocente)   •   Grupo: \(nombreGrupo)   •   Mes: \(mesTexto)"
        (infoStr as NSString).draw(
            at: CGPoint(x: marginX + 16, y: y + 49),
            withAttributes: metaAttrs
        )
        
        y += headerHeight + 16
        return y
    }
    
    // MARK: - Generar PDF de Todas las Credenciales (Gafetes para Imprimir)
    func generarPDFTodasLasCredenciales(alumnos: [Alumno], clases: [ClaseGrupo] = [], nombreEscuela: String? = nil) -> URL? {
        guard !alumnos.isEmpty else { return nil }
        
        let pdfMetaData: [CFString: Any] = [
            kCGPDFContextCreator: "Asistencia QR iOS",
            kCGPDFContextAuthor: nombreEscuela ?? "Control Escolar",
            kCGPDFContextTitle: "Credenciales de Alumnos"
        ]
        
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = pdfMetaData as [String: Any]
        
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect, format: format)
        
        // Layout grid: 2 columnas x 4 filas = 8 credenciales por hoja Carta
        let cardWidth: CGFloat = 260.0
        let cardHeight: CGFloat = 160.0
        let startX: CGFloat = 36.0
        let colSpacing: CGFloat = 20.0
        let startY: CGFloat = 38.0
        let rowSpacing: CGFloat = 18.0
        let credencialesPorPagina = 8
        
        let data = renderer.pdfData { context in
            var paginaActual = 1
            context.beginPage()
            
            for (index, alumno) in alumnos.enumerated() {
                let indexEnPagina = index % credencialesPorPagina
                
                // Si llenamos la página, pasar a la siguiente
                if index > 0 && indexEnPagina == 0 {
                    dibujarPieDePagina(pagina: paginaActual, en: context)
                    paginaActual += 1
                    context.beginPage()
                }
                
                let col = indexEnPagina % 2
                let row = indexEnPagina / 2
                
                let cardX = startX + CGFloat(col) * (cardWidth + colSpacing)
                let cardY = startY + CGFloat(row) * (cardHeight + rowSpacing)
                let cardRect = CGRect(x: cardX, y: cardY, width: cardWidth, height: cardHeight)
                
                dibujarCredencialIndividual(
                    alumno: alumno,
                    clases: clases,
                    en: cardRect,
                    nombreEscuela: nombreEscuela,
                    context: context
                )
            }
            
            // Pie de página de la última
            dibujarPieDePagina(pagina: paginaActual, en: context)
        }
        
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("Credenciales_Alumnos_\(fechaSimple(Date())).pdf")
        do {
            try data.write(to: fileURL)
            return fileURL
        } catch {
            print("Error al guardar PDF de credenciales: \(error)")
            return nil
        }
    }
    
    private func dibujarCredencialIndividual(
        alumno: Alumno,
        clases: [ClaseGrupo] = [],
        en rect: CGRect,
        nombreEscuela: String?,
        context: UIGraphicsPDFRendererContext
    ) {
        let cgContext = context.cgContext
        cgContext.saveGState()
        
        let cornerRadius: CGFloat = 8.0
        let cardPath = UIBezierPath(roundedRect: rect, cornerRadius: cornerRadius)
        
        // 1. Fondo blanco de la tarjeta
        UIColor.white.setFill()
        cardPath.fill()
        
        // 2. Encabezado Verde Oscuro
        let headerHeight: CGFloat = 26.0
        let headerRect = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: headerHeight)
        let headerPath = UIBezierPath(
            roundedRect: headerRect,
            byRoundingCorners: [.topLeft, .topRight],
            cornerRadii: CGSize(width: cornerRadius, height: cornerRadius)
        )
        let verdeOscuro = UIColor(red: 0.02, green: 0.37, blue: 0.27, alpha: 1.0)
        verdeOscuro.setFill()
        headerPath.fill()
        
        // Texto encabezado izquierda: "CREDENCIAL DE ALUMNO"
        let tituloHeader = "CREDENCIAL DE ALUMNO"
        let tituloAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8.5, weight: .heavy),
            .foregroundColor: UIColor.white
        ]
        (tituloHeader as NSString).draw(at: CGPoint(x: rect.minX + 10, y: rect.minY + 7), withAttributes: tituloAttrs)
        
        // Tag derecha: "QR ASISTENCIA"
        let tagTexto = "QR ASISTENCIA"
        let tagAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5, weight: .bold),
            .foregroundColor: UIColor.white
        ]
        let tagSize = (tagTexto as NSString).size(withAttributes: tagAttrs)
        let tagRect = CGRect(
            x: rect.maxX - tagSize.width - 16,
            y: rect.minY + 5.5,
            width: tagSize.width + 8,
            height: 15
        )
        let tagPath = UIBezierPath(roundedRect: tagRect, cornerRadius: 3)
        UIColor.white.withAlphaComponent(0.22).setFill()
        tagPath.fill()
        (tagTexto as NSString).draw(at: CGPoint(x: tagRect.minX + 4, y: tagRect.minY + 2.5), withAttributes: tagAttrs)
        
        // 3. Código QR
        let qrValor = alumno.codigo_qr ?? alumno.nfc_uid ?? "ALU-\(alumno.id)"
        let qrSize: CGFloat = 78.0
        let qrRect = CGRect(x: rect.minX + 12, y: rect.minY + 36, width: qrSize, height: qrSize)
        
        if let qrImg = generarImagenQR(texto: qrValor) {
            qrImg.draw(in: qrRect)
            
            // Borde sutil del QR
            let qrBorder = UIBezierPath(roundedRect: qrRect.insetBy(dx: -2, dy: -2), cornerRadius: 4)
            UIColor(red: 0.88, green: 0.90, blue: 0.92, alpha: 1.0).setStroke()
            qrBorder.lineWidth = 0.8
            qrBorder.stroke()
        }
        
        // 4. Datos del Alumno (Columna derecha)
        let infoX = rect.minX + 100
        let infoWidth = rect.width - 108
        var infoY = rect.minY + 36
        
        // Nombre del Alumno
        let nombreAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 11, weight: .bold),
            .foregroundColor: UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        ]
        let nombreRect = CGRect(x: infoX, y: infoY, width: infoWidth, height: 28)
        (alumno.nombre_completo as NSString).draw(in: nombreRect, withAttributes: nombreAttrs)
        infoY += 30
        
        // Grupo
        let nombreGrupo = alumno.obtenerGrupo(clases: clases)
        
        let grupoPrefijoAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .bold),
            .foregroundColor: UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)
        ]
        let grupoValorAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel
        ]
        
        let grupoStr = NSMutableAttributedString(string: "Grupo: ", attributes: grupoPrefijoAttrs)
        grupoStr.append(NSAttributedString(string: nombreGrupo, attributes: grupoValorAttrs))
        grupoStr.draw(at: CGPoint(x: infoX, y: infoY))
        infoY += 16
        
        // Badge de Código QR / Matrícula
        let codeAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.monospacedSystemFont(ofSize: 8.5, weight: .semibold),
            .foregroundColor: verdeOscuro
        ]
        let codeSize = (qrValor as NSString).size(withAttributes: codeAttrs)
        let codeRect = CGRect(x: infoX, y: infoY, width: min(infoWidth, codeSize.width + 10), height: 16)
        let codePath = UIBezierPath(roundedRect: codeRect, cornerRadius: 4)
        
        let verdeClaro = UIColor(red: 0.92, green: 0.99, blue: 0.96, alpha: 1.0)
        let verdeBorde = UIColor(red: 0.65, green: 0.95, blue: 0.82, alpha: 1.0)
        verdeClaro.setFill()
        codePath.fill()
        verdeBorde.setStroke()
        codePath.lineWidth = 0.8
        codePath.stroke()
        
        (qrValor as NSString).draw(at: CGPoint(x: infoX + 5, y: infoY + 2.5), withAttributes: codeAttrs)
        infoY += 22
        
        // Escuela / Sistema
        if let esc = nombreEscuela, !esc.isEmpty {
            let escAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 7.5, weight: .medium),
                .foregroundColor: UIColor.secondaryLabel
            ]
            (esc as NSString).draw(in: CGRect(x: infoX, y: infoY, width: infoWidth, height: 12), withAttributes: escAttrs)
        }
        
        // 5. Borde exterior de la tarjeta
        UIColor(red: 0.82, green: 0.85, blue: 0.88, alpha: 1.0).setStroke()
        cardPath.lineWidth = 1.0
        cardPath.stroke()
        
        cgContext.restoreGState()
    }
    
    private func generarImagenQR(texto: String) -> UIImage? {
        guard let data = texto.data(using: .utf8) else { return nil }
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let ciImage = filter.outputImage else { return nil }
        
        let transform = CGAffineTransform(scaleX: 5, y: 5)
        let scaledCIImage = ciImage.transformed(by: transform)
        guard let cgImage = ciContext.createCGImage(scaledCIImage, from: scaledCIImage.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
    
    // MARK: - Componentes de Dibujo
    private func dibujarEncabezado(
        titulo: String,
        subtitulo: String,
        institucion: String,
        en context: UIGraphicsPDFRendererContext,
        startY: CGFloat
    ) -> CGFloat {
        var y = startY
        
        // Franja superior de marca
        let stripeRect = CGRect(x: marginX, y: y, width: contentWidth, height: 3)
        let stripePath = UIBezierPath(roundedRect: stripeRect, cornerRadius: 1.5)
        UIColor(red: 0.09, green: 0.55, blue: 0.32, alpha: 1.0).setFill()
        stripePath.fill()
        y += 10
        
        // Eyebrow
        let eyebrowAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .heavy),
            .foregroundColor: UIColor(red: 0.09, green: 0.55, blue: 0.32, alpha: 1.0)
        ]
        ("SISTEMA DE ASISTENCIA QR • CONTROL ESCOLAR" as NSString).draw(
            at: CGPoint(x: marginX, y: y),
            withAttributes: eyebrowAttrs
        )
        
        // Institución / Docente a la derecha
        let instAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8.5, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel
        ]
        let instSize = (institucion as NSString).size(withAttributes: instAttrs)
        (institucion as NSString).draw(
            at: CGPoint(x: marginX + contentWidth - instSize.width, y: y),
            withAttributes: instAttrs
        )
        y += 14
        
        // Título Principal
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 16, weight: .bold),
            .foregroundColor: UIColor(red: 0.08, green: 0.12, blue: 0.18, alpha: 1.0)
        ]
        (titulo as NSString).draw(at: CGPoint(x: marginX, y: y), withAttributes: titleAttrs)
        y += 20
        
        // Subtítulo
        let subAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9.5, weight: .regular),
            .foregroundColor: UIColor(red: 0.35, green: 0.40, blue: 0.48, alpha: 1.0)
        ]
        (subtitulo as NSString).draw(at: CGPoint(x: marginX, y: y), withAttributes: subAttrs)
        y += 18
        
        // Línea divisoria
        let divider = UIBezierPath()
        divider.move(to: CGPoint(x: marginX, y: y))
        divider.addLine(to: CGPoint(x: marginX + contentWidth, y: y))
        UIColor(red: 0.88, green: 0.91, blue: 0.94, alpha: 1.0).setStroke()
        divider.lineWidth = 1
        divider.stroke()
        y += 12
        
        return y
    }
    
    private func dibujarEncabezadoCompacto(
        titulo: String,
        detalle: String,
        en context: UIGraphicsPDFRendererContext,
        startY: CGFloat
    ) -> CGFloat {
        var y = startY
        
        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 10, weight: .bold),
            .foregroundColor: UIColor(red: 0.08, green: 0.12, blue: 0.18, alpha: 1.0)
        ]
        (titulo as NSString).draw(at: CGPoint(x: marginX, y: y), withAttributes: titleAttrs)
        
        let detAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8.5, weight: .regular),
            .foregroundColor: UIColor.secondaryLabel
        ]
        let detSize = (detalle as NSString).size(withAttributes: detAttrs)
        (detalle as NSString).draw(
            at: CGPoint(x: marginX + contentWidth - detSize.width, y: y + 1),
            withAttributes: detAttrs
        )
        y += 16
        
        let divider = UIBezierPath()
        divider.move(to: CGPoint(x: marginX, y: y))
        divider.addLine(to: CGPoint(x: marginX + contentWidth, y: y))
        UIColor(red: 0.88, green: 0.91, blue: 0.94, alpha: 1.0).setStroke()
        divider.lineWidth = 0.8
        divider.stroke()
        y += 8
        
        return y
    }
    
    private func dibujarTarjetasMetricas(
        metricas: [(titulo: String, valor: String, color: UIColor)],
        en context: UIGraphicsPDFRendererContext,
        startY: CGFloat
    ) -> CGFloat {
        let totalCards = CGFloat(metricas.count)
        let spacing: CGFloat = 8.0
        let cardWidth = (contentWidth - (spacing * (totalCards - 1))) / totalCards
        let cardHeight: CGFloat = 46.0
        
        for (i, metrica) in metricas.enumerated() {
            let cardX = marginX + CGFloat(i) * (cardWidth + spacing)
            let cardRect = CGRect(x: cardX, y: startY, width: cardWidth, height: cardHeight)
            
            // Fondo
            let cardPath = UIBezierPath(roundedRect: cardRect, cornerRadius: 8)
            UIColor(red: 0.97, green: 0.98, blue: 0.99, alpha: 1.0).setFill()
            cardPath.fill()
            
            // Borde
            UIColor(red: 0.89, green: 0.92, blue: 0.95, alpha: 1.0).setStroke()
            cardPath.lineWidth = 1
            cardPath.stroke()
            
            // Valor grande
            let valorAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 15, weight: .bold),
                .foregroundColor: metrica.color
            ]
            let valorRect = CGRect(x: cardX + 8, y: startY + 7, width: cardWidth - 16, height: 18)
            (metrica.valor as NSString).draw(in: valorRect, withAttributes: valorAttrs)
            
            // Título pequeño
            let titAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
                .foregroundColor: UIColor.secondaryLabel
            ]
            let titRect = CGRect(x: cardX + 8, y: startY + 27, width: cardWidth - 16, height: 14)
            (metrica.titulo as NSString).draw(in: titRect, withAttributes: titAttrs)
        }
        
        return startY + cardHeight + 14
    }
    
    private func dibujarEncabezadoTabla(
        columnas: [(titulo: String, ancho: CGFloat, alineacion: NSTextAlignment)],
        en context: UIGraphicsPDFRendererContext,
        startY: CGFloat
    ) -> CGFloat {
        let headerHeight: CGFloat = 22.0
        let headerRect = CGRect(x: marginX, y: startY, width: contentWidth, height: headerHeight)
        
        // Fondo tabla
        let headerPath = UIBezierPath(roundedRect: headerRect, cornerRadius: 6)
        UIColor(red: 0.94, green: 0.96, blue: 0.98, alpha: 1.0).setFill()
        headerPath.fill()
        
        var currentX = marginX
        for col in columnas {
            let colRect = CGRect(x: currentX, y: startY + 5, width: col.ancho, height: headerHeight - 6)
            let colAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 8.5, weight: .bold),
                .foregroundColor: UIColor(red: 0.20, green: 0.25, blue: 0.33, alpha: 1.0)
            ]
            
            switch col.alineacion {
            case .center:
                dibujarTextoCentrado(texto: col.titulo, en: colRect, attrs: colAttrs)
            case .right:
                dibujarTextoDerecha(texto: col.titulo, en: colRect, attrs: colAttrs)
            default:
                (col.titulo as NSString).draw(at: CGPoint(x: currentX + 6, y: startY + 5), withAttributes: colAttrs)
            }
            
            currentX += col.ancho
        }
        
        return startY + headerHeight + 4
    }
    
    private func dibujarBadge(estado: String, en rect: CGRect) {
        let badgeColor: UIColor
        let badgeBg: UIColor
        let texto: String
        
        switch estado.lowercased() {
        case "presente":
            badgeColor = UIColor(red: 0.08, green: 0.53, blue: 0.28, alpha: 1.0)
            badgeBg = UIColor(red: 0.90, green: 0.97, blue: 0.92, alpha: 1.0)
            texto = "✓ Presente"
        case "retardo":
            badgeColor = UIColor(red: 0.82, green: 0.41, blue: 0.08, alpha: 1.0)
            badgeBg = UIColor(red: 0.99, green: 0.95, blue: 0.88, alpha: 1.0)
            texto = "⏰ Retardo"
        case "falta":
            badgeColor = UIColor(red: 0.82, green: 0.18, blue: 0.18, alpha: 1.0)
            badgeBg = UIColor(red: 0.99, green: 0.91, blue: 0.91, alpha: 1.0)
            texto = "✕ Falta"
        default:
            badgeColor = UIColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1.0)
            badgeBg = UIColor(red: 0.92, green: 0.95, blue: 0.99, alpha: 1.0)
            texto = estado.capitalized
        }
        
        let path = UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 2)
        badgeBg.setFill()
        path.fill()
        
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .bold),
            .foregroundColor: badgeColor
        ]
        dibujarTextoCentrado(texto: texto, en: rect, attrs: attrs)
    }
    
    private func dibujarBadgeTarea(entregada: Bool, en rect: CGRect) {
        let badgeColor: UIColor
        let badgeBg: UIColor
        let texto: String
        
        if entregada {
            badgeColor = UIColor(red: 0.08, green: 0.53, blue: 0.28, alpha: 1.0)
            badgeBg = UIColor(red: 0.90, green: 0.97, blue: 0.92, alpha: 1.0)
            texto = "✓ Entregada"
        } else {
            badgeColor = UIColor(red: 0.82, green: 0.41, blue: 0.08, alpha: 1.0)
            badgeBg = UIColor(red: 0.99, green: 0.95, blue: 0.88, alpha: 1.0)
            texto = "○ Pendiente"
        }
        
        let path = UIBezierPath(roundedRect: rect, cornerRadius: rect.height / 2)
        badgeBg.setFill()
        path.fill()
        
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 8, weight: .bold),
            .foregroundColor: badgeColor
        ]
        dibujarTextoCentrado(texto: texto, en: rect, attrs: attrs)
    }
    
    private func dibujarPieDePagina(pagina: Int, en context: UIGraphicsPDFRendererContext) {
        let footerY = pageHeight - marginBottom + 8
        
        let line = UIBezierPath()
        line.move(to: CGPoint(x: marginX, y: footerY - 6))
        line.addLine(to: CGPoint(x: marginX + contentWidth, y: footerY - 6))
        UIColor(red: 0.88, green: 0.91, blue: 0.94, alpha: 1.0).setStroke()
        line.lineWidth = 0.5
        line.stroke()
        
        let leftAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5, weight: .regular),
            .foregroundColor: UIColor.secondaryLabel
        ]
        ("Documento oficial generado con Asistencia QR" as NSString).draw(
            at: CGPoint(x: marginX, y: footerY),
            withAttributes: leftAttrs
        )
        
        let pageStr = "Página \(pagina)"
        let pageAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
            .foregroundColor: UIColor.secondaryLabel
        ]
        let pageSize = (pageStr as NSString).size(withAttributes: pageAttrs)
        (pageStr as NSString).draw(
            at: CGPoint(x: marginX + contentWidth - pageSize.width, y: footerY),
            withAttributes: pageAttrs
        )
    }
    
    // MARK: - Helpers de alineación de texto
    private func dibujarTextoCentrado(texto: String, en rect: CGRect, attrs: [NSAttributedString.Key: Any]) {
        let size = (texto as NSString).size(withAttributes: attrs)
        let x = rect.midX - (size.width / 2)
        let y = rect.midY - (size.height / 2)
        (texto as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
    }
    
    private func dibujarTextoDerecha(texto: String, en rect: CGRect, attrs: [NSAttributedString.Key: Any]) {
        let size = (texto as NSString).size(withAttributes: attrs)
        let x = rect.maxX - size.width - 4
        let y = rect.midY - (size.height / 2)
        (texto as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
    }
    
    private func fechaSimple(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyyMMdd_HHmm"
        return f.string(from: date)
    }
}
