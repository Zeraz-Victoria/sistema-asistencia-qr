import SwiftUI

struct MainTabView: View {
    @State private var tabSeleccionado: Int = 0
    @State private var licencia: LicenciaStatus? = nil
    @State private var bannerDescartado: Bool = false
    
    var diasRestantes: Int {
        licencia?.diasRestantes ?? licencia?.daysLeft ?? 30
    }
    
    var mostrarBanner: Bool {
        guard !bannerDescartado, let lic = licencia else { return false }
        if lic.status == "suspendido" || lic.expiredTrial == true { return false }
        if lic.isTrial == true && diasRestantes <= 3 && diasRestantes >= 1 { return true }
        if lic.plan == "anual" && diasRestantes <= 15 && diasRestantes >= 1 { return true }
        return false
    }
    
    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $tabSeleccionado) {
                KioscoView()
                    .tabItem {
                        Label("Pase Lista", systemImage: "list.clipboard.fill")
                    }
                    .tag(0)
                
                TareasView()
                    .tabItem {
                        Label("Tareas", systemImage: "book.closed.fill")
                    }
                    .tag(1)
                
                AlumnosView()
                    .tabItem {
                        Label("Alumnos", systemImage: "person.2.fill")
                    }
                    .tag(2)
                
                ReportesView()
                    .tabItem {
                        Label("Reportes", systemImage: "doc.text.fill")
                    }
                    .tag(3)
                
                AjustesView()
                    .tabItem {
                        Label("Ajustes", systemImage: "gearshape.fill")
                    }
                    .tag(4)
            }
            .tint(Color(red: 0.02, green: 0.35, blue: 0.25))
            
            // Banner Flotante de Aviso Previo
            if mostrarBanner {
                bannerAvisoLicencia
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .task {
            do {
                licencia = try await APIService.shared.obtenerEstadoLicencia()
            } catch {}
        }
    }
    
    private var bannerAvisoLicencia: some View {
        let esUrgente = diasRestantes <= 2
        let esVitalicio = (licencia?.plan == "vitalicio")
        let tipoTexto = esVitalicio ? "Licencia Vitalicia ($99 MXN)" : "Suscripción Anual ($99 MXN / año)"
        let diasTexto = diasRestantes == 1 ? "1 día restante" : "\(diasRestantes) días restantes"
        
        return HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(esUrgente ? .red : .orange)
                .font(.title3)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(licencia?.plan == "anual" ? "Suscripción por Vencer" : "Prueba por Finalizar")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(esUrgente ? .red : .primary)
                    
                    Text(diasTexto)
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(esUrgente ? Color.red : Color.orange)
                        .foregroundColor(.white)
                        .cornerRadius(6)
                }
                
                Text("Toca para activar por WhatsApp (\(tipoTexto)).")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button {
                withAnimation { bannerDescartado = true }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(6)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(uiColor: .systemBackground))
                .shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 3)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(esUrgente ? Color.red.opacity(0.4) : Color.orange.opacity(0.4), lineWidth: 1.5)
                )
        )
        .onTapGesture {
            let escuela = licencia?.nombreEscuela ?? "Mi Escuela"
            let user = AuthManager.shared.usuarioActual
            let nombre = user?.nombre ?? user?.email ?? "Docente"
            let email = user?.email ?? ""
            let planMsg = esVitalicio ? "$99 MXN pago único" : "Suscripción Anual $99 MXN / año"
            let msg = "Hola, mi periodo de prueba de AsistenciaQR está por vencer (\(diasTexto)) y quiero activar mi cuenta (\(planMsg)).\n\n🏫 Escuela: \(escuela)\n👤 Docente: \(nombre)\n📧 Correo/Usuario: \(email)"
            if let enc = msg.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
               let url = URL(string: "https://wa.me/522723303963?text=\(enc)") {
                UIApplication.shared.open(url)
            }
        }
    }
}

// MARK: - Módulo de Tareas y Actividades
enum SheetTareaActiva: Identifiable {
    case nuevaTarea
    case escanearQR(Actividad)
    case previewPDF(URL, String)
    
    var id: String {
        switch self {
        case .nuevaTarea: return "nueva"
        case .escanearQR(let act): return "escanear_\(act.id)"
        case .previewPDF(let url, let tit): return "pdf_\(url.path)_\(tit)"
        }
    }
}

struct TareasView: View {
    @State private var actividades: [Actividad] = []
    @State private var alumnos: [Alumno] = []
    @State private var clases: [ClaseGrupo] = []
    @State private var entregasIds: Set<Int> = [] // alumno_ids con entrega
    
    @State private var actividadSeleccionadaId: Int? = nil
    @State private var cargando: Bool = true
    @State private var sheetActiva: SheetTareaActiva? = nil
    @State private var mostrarAlertaBorrarTarea: Bool = false
    
    var actividadActual: Actividad? {
        actividades.first { $0.id == actividadSeleccionadaId }
    }
    
    var alumnosParaTarea: [Alumno] {
        guard let act = actividadActual, let cId = act.clase_id else {
            return alumnos
        }
        return alumnos.filter { alu in
            if alu.clase_id == cId { return true }
            if let idsStr = alu.clase_ids_str {
                let ids = idsStr.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
                if ids.contains(cId) { return true }
            }
            return false
        }
    }
    
    var nombreGrupoAsignado: String {
        guard let act = actividadActual, let cId = act.clase_id else {
            return "Toda la Escuela"
        }
        if let match = clases.first(where: { $0.id == cId }) {
            return match.nombre ?? "\(match.nombre_grado ?? match.grado ?? "") \(match.nombre_grupo ?? match.grupo ?? "")".trimmingCharacters(in: .whitespaces)
        }
        return "Grupo #\(cId)"
    }
    
    var conteoEntregadas: Int {
        alumnosParaTarea.filter { entregasIds.contains($0.id) }.count
    }
    
    var porcentajeEntregas: Double {
        guard !alumnosParaTarea.isEmpty else { return 0.0 }
        return Double(conteoEntregadas) / Double(alumnosParaTarea.count)
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if cargando {
                    ProgressView("Cargando tareas...")
                        .frame(maxHeight: .infinity)
                } else if actividades.isEmpty {
                    ContentUnavailableView(
                        "Sin Tareas Creadas",
                        systemImage: "checklist",
                        description: Text("Presiona el botón + arriba para crear tu primera tarea o actividad escolar.")
                    )
                } else {
                    // Selector de Tarea Activa
                    VStack(spacing: 10) {
                        Picker("Tarea", selection: $actividadSeleccionadaId) {
                            ForEach(actividades) { act in
                                Text(act.titulo).tag(act.id as Int?)
                            }
                        }
                        .pickerStyle(.menu)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color(UIColor.secondarySystemGroupedBackground))
                        .cornerRadius(12)
                        .padding(.horizontal, 16)
                        .padding(.top, 10)
                        .onChange(of: actividadSeleccionadaId) { _, nuevoId in
                            if let id = nuevoId {
                                cargarEntregas(actividadId: id)
                            }
                        }
                        
                        // Badge que indica a qué grupo está asignada
                        HStack(spacing: 6) {
                            Image(systemName: actividadActual?.clase_id != nil ? "person.2.fill" : "globe")
                                .font(.caption2)
                            Text(actividadActual?.clase_id != nil ? nombreGrupoAsignado : "Toda la Escuela")
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(actividadActual?.clase_id != nil ? Color.blue.opacity(0.12) : Color.purple.opacity(0.12))
                        .foregroundColor(actividadActual?.clase_id != nil ? .blue : .purple)
                        .clipShape(Capsule())
                        
                        // Barra de progreso y métrica
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("\(conteoEntregadas) de \(alumnosParaTarea.count) Alumnos")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                
                                Spacer()
                                
                                Text("\(Int(porcentajeEntregas * 100))% Entregadas")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.blue)
                            }
                            
                            ProgressView(value: porcentajeEntregas)
                                .tint(.green)
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 10)
                    }
                    .background(Color(UIColor.systemGroupedBackground))
                    
                    // Lista de Alumnos y estado de entrega
                    List {
                        ForEach(alumnosParaTarea) { alumno in
                            let entregada = entregasIds.contains(alumno.id)
                            
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(alumno.nombre_completo)
                                        .font(.headline)
                                    
                                    let grupoTexto: String = {
                                        let g = alumno.obtenerGrupo(clases: clases)
                                        if g != "Sin grupo" { return g }
                                        if actividadActual?.clase_id != nil {
                                            return nombreGrupoAsignado
                                        }
                                        return "Sin grupo"
                                    }()
                                    Text(grupoTexto)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                // Estado de la tarea
                                Button {
                                    toggleEntrega(alumnoId: alumno.id)
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: entregada ? "checkmark.circle.fill" : "circle")
                                        Text(entregada ? "Entregada" : "Pendiente")
                                            .fontWeight(.bold)
                                    }
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(entregada ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
                                    .foregroundColor(entregada ? .green : .orange)
                                    .clipShape(Capsule())
                                }
                                .buttonStyle(.borderless)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Tareas y Actividades")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: 14) {
                        if let act = actividadActual {
                            Button {
                                sheetActiva = .escanearQR(act)
                            } label: {
                                Image(systemName: "qrcode.viewfinder")
                            }
                            
                            Button {
                                exportarTareaPDF()
                            } label: {
                                Image(systemName: "arrow.down.doc.fill")
                            }
                            
                            Button(role: .destructive) {
                                mostrarAlertaBorrarTarea = true
                            } label: {
                                Image(systemName: "trash")
                                    .foregroundColor(.red)
                            }
                        }
                        
                        Button {
                            sheetActiva = .nuevaTarea
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
            .sheet(item: $sheetActiva) { sheet in
                switch sheet {
                case .nuevaTarea:
                    NuevaTareaSheet(clases: clases) {
                        cargarDatos()
                    }
                case .escanearQR(let act):
                    EscanearEntregaTareaSheet(
                        actividad: act,
                        alumnosPermitidos: alumnosParaTarea,
                        todosLosAlumnos: alumnos,
                        nombreGrupoTarea: nombreGrupoAsignado
                    ) {
                        cargarEntregas(actividadId: act.id)
                    }
                case .previewPDF(let url, let titulo):
                    PDFPreviewView(pdfURL: url, titulo: titulo)
                }
            }
            .alert("¿Eliminar Tarea?", isPresented: $mostrarAlertaBorrarTarea) {
                Button("Cancelar", role: .cancel) {}
                Button("Eliminar", role: .destructive) {
                    eliminarTareaActual()
                }
            } message: {
                Text("Se borrará la tarea \"\(actividadActual?.titulo ?? "")\" y todas sus entregas registradas.")
            }
            .refreshable {
                await cargarDatosAsync()
            }
            .task {
                cargarDatos()
            }
        }
    }
    
    private func exportarTareaPDF() {
        guard let act = actividadActual else { return }
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        let nombreGrupo: String? = {
            if let cid = act.clase_id, let match = clases.first(where: { $0.id == cid }) {
                return match.nombre ?? "\(match.nombre_grado ?? match.grado ?? "") \(match.nombre_grupo ?? match.grupo ?? "")".trimmingCharacters(in: .whitespaces)
            }
            return "Todos los Grupos"
        }()
        
        if let url = PDFReportService.shared.generarPDFTareas(
            actividad: act,
            alumnos: alumnosParaTarea,
            entregasIds: entregasIds,
            nombreGrupo: nombreGrupo
        ) {
            self.sheetActiva = .previewPDF(url, "Reporte de Tarea - \(act.titulo)")
        }
    }
    
    private func eliminarTareaActual() {
        guard let act = actividadActual else { return }
        Task {
            do {
                _ = try await APIService.shared.borrarActividad(id: act.id)
                await MainActor.run {
                    let haptic = UINotificationFeedbackGenerator()
                    haptic.notificationOccurred(.success)
                    actividades.removeAll { $0.id == act.id }
                    actividadSeleccionadaId = actividades.first?.id
                    if let id = actividadSeleccionadaId {
                        cargarEntregas(actividadId: id)
                    }
                }
            } catch {
                print("Error borrando actividad: \(error)")
            }
        }
    }
    
    private func cargarDatos() {
        Task {
            await cargarDatosAsync()
        }
    }
    
    private func cargarDatosAsync() async {
        do {
            async let listaAct = APIService.shared.obtenerActividades()
            async let listaAlu = APIService.shared.obtenerAlumnos()
            async let listaCla = APIService.shared.obtenerClases()
            
            let (acts, alus, clas) = try await (listaAct, listaAlu, listaCla)
            
            await MainActor.run {
                self.actividades = acts
                self.alumnos = alus
                self.clases = clas
                if self.actividadSeleccionadaId == nil, let primera = acts.first {
                    self.actividadSeleccionadaId = primera.id
                }
                self.cargando = false
            }
            
            if let actId = actividadSeleccionadaId {
                cargarEntregas(actividadId: actId)
            }
        } catch {
            await MainActor.run {
                self.cargando = false
            }
        }
    }
    
    private func cargarEntregas(actividadId: Int) {
        Task {
            do {
                let entregas = try await APIService.shared.obtenerEntregasActividad(actividadId: actividadId)
                await MainActor.run {
                    self.entregasIds = Set(entregas.map { $0.alumno_id })
                }
            } catch {
                print("Error al cargar entregas: \(error)")
            }
        }
    }
    
    private func toggleEntrega(alumnoId: Int) {
        guard let actId = actividadSeleccionadaId else { return }
        
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        Task {
            do {
                let res = try await APIService.shared.toggleEntregaActividad(actividadId: actId, alumnoId: alumnoId)
                await MainActor.run {
                    if res.entregado == true {
                        self.entregasIds.insert(alumnoId)
                    } else {
                        self.entregasIds.remove(alumnoId)
                    }
                }
            } catch {
                print("Error toggle entrega: \(error)")
            }
        }
    }
}

// MARK: - Sheet para Crear Nueva Tarea
struct NuevaTareaSheet: View {
    @Environment(\.dismiss) private var dismiss
    let clases: [ClaseGrupo]
    var onGuardada: () -> Void
    
    @State private var titulo: String = ""
    @State private var descripcion: String = ""
    @State private var claseId: Int? = nil // nil = todas las clases
    @State private var guardando: Bool = false
    @State private var errorMensaje: String? = nil
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Información de la Tarea") {
                    TextField("Título de la tarea o actividad", text: $titulo)
                    TextField("Descripción o instrucciones (opcional)", text: $descripcion)
                }
                
                Section("Asignar a Grupo") {
                    Picker("Grupo", selection: $claseId) {
                        Text("Todas las clases").tag(nil as Int?)
                        ForEach(clases) { c in
                            let nom = c.nombre ?? "\(c.nombre_grado ?? c.grado ?? "") \(c.nombre_grupo ?? c.grupo ?? "")"
                            Text(nom).tag(c.id as Int?)
                        }
                    }
                }
                
                if let err = errorMensaje {
                    Section {
                        Text(err)
                            .foregroundColor(.red)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("Nueva Tarea")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        guardar()
                    }
                    .disabled(titulo.trimmingCharacters(in: .whitespaces).isEmpty || guardando)
                }
            }
        }
    }
    
    private func guardar() {
        guardando = true
        errorMensaje = nil
        
        Task {
            do {
                _ = try await APIService.shared.crearActividad(
                    titulo: titulo.trimmingCharacters(in: .whitespaces),
                    descripcion: descripcion.trimmingCharacters(in: .whitespaces),
                    claseId: claseId
                )
                await MainActor.run {
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                    onGuardada()
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.errorMensaje = error.localizedDescription
                    self.guardando = false
                }
            }
        }
    }
}

// MARK: - Sheet para Escanear QR de Entrega de Tarea
struct EscanearEntregaTareaSheet: View {
    let actividad: Actividad
    let alumnosPermitidos: [Alumno]
    let todosLosAlumnos: [Alumno]
    let nombreGrupoTarea: String
    var onEntregaRegistrada: () -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var procesando: Bool = false
    @State private var mensajeBanner: String? = nil
    @State private var esExito: Bool = true
    @State private var ultimoCodigo: String = ""
    
    var body: some View {
        NavigationStack {
            ZStack {
                QRCodeScannerView { codigo in
                    guard !procesando, codigo != ultimoCodigo else { return }
                    procesarEscaneo(codigoQR: codigo)
                }
                .ignoresSafeArea(edges: .bottom)
                
                // Overlay con instrucciones y marco
                VStack {
                    VStack(spacing: 4) {
                        Text(actividad.titulo)
                            .font(.headline)
                            .foregroundColor(.white)
                            .lineLimit(1)
                        
                        Text("Grupo: \(nombreGrupoTarea)")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundColor(.white.opacity(0.85))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.2))
                            .clipShape(Capsule())
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial)
                    .cornerRadius(14)
                    .padding(.top, 16)
                    
                    Spacer()
                    
                    RoundedRectangle(cornerRadius: 24)
                        .strokeBorder(
                            LinearGradient(
                                colors: [.green, .mint],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3.5
                        )
                        .frame(width: 250, height: 250)
                        .background(Color.black.opacity(0.04))
                        .overlay(
                            Image(systemName: "checklist")
                                .font(.system(size: 40))
                                .foregroundColor(.white.opacity(0.35))
                        )
                    
                    Spacer()
                    
                    if let banner = mensajeBanner {
                        HStack(spacing: 8) {
                            Image(systemName: esExito ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            Text(banner)
                                .font(.subheadline)
                                .fontWeight(.bold)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(esExito ? Color.green : Color.orange)
                        .cornerRadius(14)
                        .shadow(radius: 6)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 24)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
            }
            .navigationTitle("Escanear Tarea")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Listo") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
    }
    
    private func procesarEscaneo(codigoQR: String) {
        guard !procesando else { return }
        procesando = true
        ultimoCodigo = codigoQR
        
        // Validación de pertenencia al grupo
        if let claseIdTarea = actividad.clase_id, claseIdTarea > 0 {
            if let alumnoEncontrado = todosLosAlumnos.first(where: { $0.codigo_qr == codigoQR }) {
                let pertenece = alumnosPermitidos.contains(where: { $0.id == alumnoEncontrado.id })
                if !pertenece {
                    let haptic = UINotificationFeedbackGenerator()
                    haptic.notificationOccurred(.warning)
                    
                    withAnimation(.spring()) {
                        self.esExito = false
                        self.mensajeBanner = "❌ \(alumnoEncontrado.nombre_completo) no pertenece a \(nombreGrupoTarea)."
                    }
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        withAnimation {
                            self.mensajeBanner = nil
                        }
                        self.procesando = false
                        self.ultimoCodigo = ""
                    }
                    return
                }
            }
        }
        
        Task {
            do {
                let res = try await APIService.shared.marcarEntregaActividadConQR(
                    codigoQR: codigoQR,
                    actividadId: actividad.id
                )
                
                await MainActor.run {
                    let haptic = UINotificationFeedbackGenerator()
                    let warning = (res.status == "warning")
                    haptic.notificationOccurred(warning ? .warning : .success)
                    
                    withAnimation(.spring()) {
                        self.esExito = (res.status == "success")
                        self.mensajeBanner = res.message ?? "Tarea entregada con éxito."
                    }
                    
                    onEntregaRegistrada()
                    
                    // Permitir escanear el siguiente alumno después de 1.0 segundo
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        withAnimation {
                            self.mensajeBanner = nil
                        }
                        self.procesando = false
                        self.ultimoCodigo = ""
                    }
                }
            } catch {
                await MainActor.run {
                    let haptic = UINotificationFeedbackGenerator()
                    haptic.notificationOccurred(.error)
                    
                    withAnimation(.spring()) {
                        self.esExito = false
                        self.mensajeBanner = error.localizedDescription
                    }
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        withAnimation {
                            self.mensajeBanner = nil
                        }
                        self.procesando = false
                        self.ultimoCodigo = ""
                    }
                }
            }
        }
    }
}
