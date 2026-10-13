import SwiftUI
import UIKit

struct ReportesView: View {
    @ObservedObject var authManager = AuthManager.shared
    
    // Estado de Clases y Selección
    @State private var clases: [ClaseGrupo] = []
    @State private var claseSeleccionadaId: Int? = nil
    @State private var cargandoClases: Bool = true
    
    // Periodo (Mes y Año)
    @State private var fechaPeriodo: Date = Date()
    @State private var mostrarSelectorMes: Bool = false
    
    // Licencia / Escuela Info
    @State private var licencia: LicenciaStatus? = nil
    
    // Estados de Descarga
    @State private var descargandoAsistencia: Bool = false
    @State private var descargandoTareas: Bool = false
    @State private var mensajeFeedback: String? = nil
    @State private var esExitoFeedback: Bool = true
    
    // Share Sheet Nativo
    @State private var urlParaCompartir: URL? = nil
    @State private var mostrarShareSheet: Bool = false
    
    // Paleta de colores oficial de la Web
    private let verdeFondo = Color(red: 0.02, green: 0.35, blue: 0.25)
    private let verdeBoton = Color(red: 0.02, green: 0.37, blue: 0.27)
    private let azulBoton = Color(red: 0.01, green: 0.52, blue: 0.78)
    
    // Formato mes y año en español
    var textoMesYAno: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_MX")
        formatter.dateFormat = "MMMM 'de' yyyy"
        return formatter.string(from: fechaPeriodo).lowercased()
    }
    
    // Parámetro mes para el backend (YYYY-MM)
    var parametroMesBackend: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: fechaPeriodo)
    }
    
    var nombreClaseSeleccionada: String {
        guard let cId = claseSeleccionadaId, let match = clases.first(where: { $0.id == cId }) else {
            return "-- Seleccionar Clase --"
        }
        if let nom = match.nombre, !nom.isEmpty {
            return nom
        }
        let g = match.nombre_grado ?? match.grado ?? ""
        let gr = match.nombre_grupo ?? match.grupo ?? ""
        return "\(g) \"\(gr)\"".trimmingCharacters(in: .whitespaces)
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Tarjeta Principal: "Descarga de Reportes Oficiales"
                    VStack(alignment: .leading, spacing: 18) {
                        // Título de la tarjeta
                        HStack(spacing: 8) {
                            Image(systemName: "newspaper.fill")
                                .font(.title3)
                                .foregroundColor(Color(red: 0.02, green: 0.37, blue: 0.27))
                            
                            Text("Descarga de Reportes Oficiales")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundColor(Color(red: 0.06, green: 0.09, blue: 0.16))
                        }
                        
                        // Campo: Periodo (Mes y Año)
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Periodo (Mes y Año)")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.12, green: 0.16, blue: 0.24))
                                
                                Button {
                                    mostrarSelectorMes = true
                                } label: {
                                    Text(textoMesYAno)
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundColor(Color(red: 0.12, green: 0.16, blue: 0.24))
                                        .frame(maxWidth: .infinity, alignment: .center)
                                        .frame(height: 48)
                                        .background(Color.white)
                                        .cornerRadius(10)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .stroke(Color.gray.opacity(0.28), lineWidth: 1)
                                        )
                                }
                            }
                            
                            // Campo: Clase / Grupo
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Clase / Grupo")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(Color(red: 0.12, green: 0.16, blue: 0.24))
                                
                                Menu {
                                    ForEach(clases) { c in
                                        let nom = c.nombre ?? "\(c.nombre_grado ?? c.grado ?? "") \"\(c.nombre_grupo ?? c.grupo ?? "")\"".trimmingCharacters(in: .whitespaces)
                                        Button {
                                            claseSeleccionadaId = c.id
                                            mensajeFeedback = nil
                                        } label: {
                                            HStack {
                                                Text(nom)
                                                if claseSeleccionadaId == c.id {
                                                    Image(systemName: "checkmark")
                                                }
                                            }
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Text(nombreClaseSeleccionada)
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundColor(claseSeleccionadaId == nil ? .secondary : Color(red: 0.12, green: 0.16, blue: 0.24))
                                        
                                        Spacer()
                                        
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    .padding(.horizontal, 14)
                                    .frame(height: 48)
                                    .background(Color.white)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color.gray.opacity(0.28), lineWidth: 1)
                                    )
                                }
                            }
                            
                            // Botones de Descarga
                            VStack(spacing: 12) {
                                // Botón 1: Reporte de Asistencia (PDF)
                                Button {
                                    descargarAsistenciaPDF()
                                } label: {
                                    HStack(spacing: 10) {
                                        if descargandoAsistencia {
                                            ProgressView()
                                                .tint(.white)
                                            Text("Generando PDF...")
                                                .fontWeight(.bold)
                                        } else {
                                            Image(systemName: "doc.text.fill")
                                                .font(.headline)
                                            Text("Reporte de Asistencia (PDF)")
                                                .font(.system(size: 15, weight: .bold))
                                        }
                                    }
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 50)
                                    .background(verdeBoton)
                                    .cornerRadius(12)
                                    .shadow(color: Color.black.opacity(0.06), radius: 6, y: 3)
                                }
                                .disabled(descargandoAsistencia || descargandoTareas)
                                
                                // Botón 2: Reporte de Tareas (PDF)
                                Button {
                                    descargarTareasPDF()
                                } label: {
                                    HStack(spacing: 10) {
                                        if descargandoTareas {
                                            ProgressView()
                                                .tint(.white)
                                            Text("Generando PDF...")
                                                .fontWeight(.bold)
                                        } else {
                                            Image(systemName: "checkmark.seal.fill")
                                                .font(.headline)
                                            Text("Reporte de Tareas (PDF)")
                                                .font(.system(size: 15, weight: .bold))
                                        }
                                    }
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 50)
                                    .background(azulBoton)
                                    .cornerRadius(12)
                                    .shadow(color: Color.black.opacity(0.06), radius: 6, y: 3)
                                }
                                .disabled(descargandoAsistencia || descargandoTareas)
                            }
                            .padding(.top, 4)
                            
                            // Banner de Feedback (Exacto al de la web)
                            if let fb = mensajeFeedback {
                                HStack(spacing: 10) {
                                    Image(systemName: esExitoFeedback ? "checkmark.square.fill" : "exclamationmark.triangle.fill")
                                        .font(.headline)
                                        .foregroundColor(esExitoFeedback ? Color(red: 0.09, green: 0.55, blue: 0.32) : .red)
                                    
                                    Text(fb)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(esExitoFeedback ? Color(red: 0.09, green: 0.55, blue: 0.32) : .red)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(esExitoFeedback ? Color(red: 0.88, green: 0.98, blue: 0.92) : Color(red: 0.99, green: 0.92, blue: 0.92))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(esExitoFeedback ? Color(red: 0.53, green: 0.92, blue: 0.67) : Color.red.opacity(0.3), lineWidth: 1)
                                )
                                .cornerRadius(10)
                                .transition(.opacity)
                            }
                        }
                        .padding(20)
                        .background(Color.white)
                        .cornerRadius(20)
                        .shadow(color: Color.black.opacity(0.08), radius: 12, y: 4)
                        .padding(.horizontal, 16)
                        .padding(.top, 16)
                    }
                    .padding(.bottom, 24)
                }
                .background(Color(UIColor.systemGroupedBackground))
                .navigationTitle("Reportes")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $mostrarShareSheet) {
                if let url = urlParaCompartir {
                    ShareActivitySheet(items: [url])
                }
            }
            .sheet(isPresented: $mostrarSelectorMes) {
                SelectorMesSheet(fechaSeleccionada: $fechaPeriodo) {
                    mensajeFeedback = nil
                }
            }
            .task {
                cargarDatosIniciales()
            }
            .refreshable {
                cargarDatosIniciales()
            }
        }
    }
    
    // MARK: - Cargar Grupos y Licencia
    private func cargarDatosIniciales() {
        Task {
            do {
                async let reqClases = APIService.shared.obtenerClases()
                async let reqLic = APIService.shared.obtenerEstadoLicencia()
                
                let (cls, lic) = try await (reqClases, reqLic)
                
                await MainActor.run {
                    self.clases = cls
                    self.licencia = lic
                    if self.claseSeleccionadaId == nil, let primera = cls.first {
                        self.claseSeleccionadaId = primera.id
                    }
                    self.cargandoClases = false
                }
            } catch {
                await MainActor.run {
                    self.cargandoClases = false
                }
            }
        }
    }
    
    // MARK: - Descargar Reporte de Asistencia (PDF)
    private func descargarAsistenciaPDF() {
        guard let claseId = claseSeleccionadaId else {
            mensajeFeedback = "Por favor selecciona una clase o grupo para generar el reporte."
            esExitoFeedback = false
            return
        }
        
        descargandoAsistencia = true
        mensajeFeedback = nil
        let mes = parametroMesBackend
        let nombreArchivo = "Reporte_Asistencia_\(mes).pdf"
        
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        Task {
            do {
                let url = try await APIService.shared.descargarReporteOficialPDF(
                    endpoint: "reporte/pdf_detallado?mes=\(mes)&clase_id=\(claseId)",
                    nombreArchivo: nombreArchivo
                )
                
                await MainActor.run {
                    self.descargandoAsistencia = false
                    self.esExitoFeedback = true
                    self.mensajeFeedback = "Reporte de asistencia descargado correctamente."
                    self.urlParaCompartir = url
                    self.mostrarShareSheet = true
                    
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                }
            } catch {
                await MainActor.run {
                    self.descargandoAsistencia = false
                    self.esExitoFeedback = false
                    self.mensajeFeedback = error.localizedDescription
                    
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.error)
                }
            }
        }
    }
    
    // MARK: - Descargar Reporte de Tareas (PDF)
    private func descargarTareasPDF() {
        guard let claseId = claseSeleccionadaId else {
            mensajeFeedback = "Por favor selecciona una clase o grupo para generar el reporte."
            esExitoFeedback = false
            return
        }
        
        descargandoTareas = true
        mensajeFeedback = nil
        let mes = parametroMesBackend
        
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        Task {
            do {
                // 1. Obtener actividades y alumnos
                async let reqAct = APIService.shared.obtenerActividades()
                async let reqAlu = APIService.shared.obtenerAlumnos()
                
                let (todasAct, todosAlu) = try await (reqAct, reqAlu)
                
                // 2. Alumnos de esta clase únicamente
                let alumnosGrupo = todosAlu.filter { $0.clase_id == claseId }
                
                // 3. Tareas: SOLO de este grupo o generales (sin mezclar otros grupos)
                let tareasGrupo = todasAct.filter { act in
                    let esDeEsteGrupo = (act.clase_id == claseId || act.clase_id == nil)
                    if let fecha = act.fecha_creacion, !fecha.isEmpty {
                        return esDeEsteGrupo && fecha.hasPrefix(mes)
                    }
                    return esDeEsteGrupo
                }
                
                // 4. Entregas registradas de cada tarea
                var entregasPorActividad: [Int: Set<Int>] = [:]
                for act in tareasGrupo {
                    if let entregas = try? await APIService.shared.obtenerEntregasActividad(actividadId: act.id) {
                        entregasPorActividad[act.id] = Set(entregas.map { $0.alumno_id })
                    } else {
                        entregasPorActividad[act.id] = []
                    }
                }
                
                // 5. Generar PDF con encabezado oficial limpio (sin leyendas NFC)
                let escuela = self.licencia?.nombreEscuela ?? "Mi Escuela"
                let docente = self.authManager.usuarioActual?.nombre ?? "Docente"
                let mesStr = self.textoMesYAno.capitalized
                
                guard let fileURL = PDFReportService.shared.generarPDFReporteMensualTareas(
                    mesTexto: mesStr,
                    nombreGrupo: self.nombreClaseSeleccionada,
                    nombreEscuela: escuela,
                    nombreDocente: docente,
                    actividades: tareasGrupo,
                    alumnos: alumnosGrupo,
                    entregasPorActividad: entregasPorActividad
                ) else {
                    throw APIError.serverError("No se pudo generar el documento PDF de tareas.")
                }
                
                await MainActor.run {
                    self.descargandoTareas = false
                    self.esExitoFeedback = true
                    self.mensajeFeedback = "Reporte de tareas descargado correctamente."
                    self.urlParaCompartir = fileURL
                    self.mostrarShareSheet = true
                    
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                }
            } catch {
                await MainActor.run {
                    self.descargandoTareas = false
                    self.esExitoFeedback = false
                    self.mensajeFeedback = error.localizedDescription
                    
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.error)
                }
            }
        }
    }
}

// MARK: - Selector de Mes y Año
struct SelectorMesSheet: View {
    @Binding var fechaSeleccionada: Date
    var onConfirmado: () -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var mesSeleccionado: Int = Calendar.current.component(.month, from: Date())
    @State private var anoSeleccionado: Int = Calendar.current.component(.year, from: Date())
    
    private let meses = [
        (1, "Enero"), (2, "Febrero"), (3, "Marzo"), (4, "Abril"),
        (5, "Mayo"), (6, "Junio"), (7, "Julio"), (8, "Agosto"),
        (9, "Septiembre"), (10, "Octubre"), (11, "Noviembre"), (12, "Diciembre")
    ]
    
    private let anos = (2024...2030).map { $0 }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Selecciona el Periodo") {
                    Picker("Mes", selection: $mesSeleccionado) {
                        ForEach(meses, id: \.0) { m in
                            Text(m.1).tag(m.0)
                        }
                    }
                    
                    Picker("Año", selection: $anoSeleccionado) {
                        ForEach(anos, id: \.self) { a in
                            Text(String(a)).tag(a)
                        }
                    }
                }
            }
            .navigationTitle("Periodo de Reporte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Listo") {
                        var components = DateComponents()
                        components.year = anoSeleccionado
                        components.month = mesSeleccionado
                        components.day = 1
                        if let d = Calendar.current.date(from: components) {
                            fechaSeleccionada = d
                        }
                        onConfirmado()
                        dismiss()
                    }
                    .fontWeight(.bold)
                }
            }
            .onAppear {
                mesSeleccionado = Calendar.current.component(.month, from: fechaSeleccionada)
                anoSeleccionado = Calendar.current.component(.year, from: fechaSeleccionada)
            }
        }
    }
}

// MARK: - UIActivityViewController para Guardar en Archivos / Compartir en iOS
struct ShareActivitySheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        return controller
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
