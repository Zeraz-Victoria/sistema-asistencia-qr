import SwiftUI

enum SheetAlumnosActiva: Identifiable {
    case credencialIndividual(Alumno)
    case nuevoAlumno
    case gestionarGrupos
    case previewTodasCredenciales(URL)
    
    var id: String {
        switch self {
        case .credencialIndividual(let a): return "qr_\(a.id)"
        case .nuevoAlumno: return "nuevo"
        case .gestionarGrupos: return "grupos"
        case .previewTodasCredenciales(let u): return "pdf_\(u.path)"
        }
    }
}

struct AlumnosView: View {
    @State private var alumnos: [Alumno] = []
    @State private var clases: [ClaseGrupo] = []
    @State private var cargando: Bool = true
    @State private var textoBusqueda: String = ""
    @State private var filtroClaseId: Int? = nil // nil = todas
    
    // Control unificado de Sheets
    @State private var sheetActiva: SheetAlumnosActiva? = nil
    @State private var mostrandoPreviewCredenciales: Bool = false
    @State private var generandoPDFCredenciales: Bool = false
    @State private var alertaSinAlumnos: Bool = false
    
    @State private var mostrarCrearGrupo: Bool = false
    @State private var nuevoGrado: String = ""
    @State private var nuevoGrupo: String = ""
    @State private var mensajeError: String? = nil
    
    var alumnosFiltrados: [Alumno] {
        var res = alumnos
        
        if let fId = filtroClaseId {
            res = res.filter { alu in
                if alu.clase_id == fId { return true }
                if let idsStr = alu.clase_ids_str {
                    let ids = idsStr.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
                    if ids.contains(fId) { return true }
                }
                return false
            }
        }
        
        if !textoBusqueda.isEmpty {
            res = res.filter {
                $0.nombre_completo.localizedCaseInsensitiveContains(textoBusqueda) ||
                $0.obtenerGrupo(clases: clases).localizedCaseInsensitiveContains(textoBusqueda) ||
                ($0.codigo_qr?.localizedCaseInsensitiveContains(textoBusqueda) ?? false)
            }
        }
        
        return res
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filtro rápido de Grupo horizontal
                if !clases.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            Button {
                                filtroClaseId = nil
                            } label: {
                                Text("Todos (\(alumnos.count))")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(filtroClaseId == nil ? Color.blue : Color(UIColor.secondarySystemGroupedBackground))
                                    .foregroundColor(filtroClaseId == nil ? .white : .primary)
                                    .clipShape(Capsule())
                            }
                            
                            ForEach(clases) { c in
                                let nombreGrupo = c.nombre ?? "\(c.nombre_grado ?? c.grado ?? "") \(c.nombre_grupo ?? c.grupo ?? "")".trimmingCharacters(in: .whitespaces)
                                let totalEnGrupo = alumnos.filter { alu in
                                    if alu.clase_id == c.id { return true }
                                    if let idsStr = alu.clase_ids_str {
                                        let ids = idsStr.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
                                        if ids.contains(c.id) { return true }
                                    }
                                    return false
                                }.count
                                
                                Button {
                                    filtroClaseId = c.id
                                } label: {
                                    Text("\(nombreGrupo) (\(totalEnGrupo))")
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(filtroClaseId == c.id ? Color.blue : Color(UIColor.secondarySystemGroupedBackground))
                                        .foregroundColor(filtroClaseId == c.id ? .white : .primary)
                                        .clipShape(Capsule())
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                    .background(Color(UIColor.systemGroupedBackground))
                }
                
                Group {
                    if cargando {
                        ProgressView("Cargando alumnos...")
                            .frame(maxHeight: .infinity)
                    } else if alumnos.isEmpty {
                        ContentUnavailableView(
                            "Sin Alumnos Registrados",
                            systemImage: "person.crop.circle.badge.plus",
                            description: Text("Presiona el botón + para registrar alumnos o crear tus grupos.")
                        )
                    } else {
                        List {
                            ForEach(alumnosFiltrados) { alumno in
                                AlumnoFilaView(alumno: alumno, clases: clases) {
                                    sheetActiva = .credencialIndividual(alumno)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        eliminarAlumno(alumno: alumno)
                                    } label: {
                                        Label("Eliminar", systemImage: "trash")
                                    }
                                }
                            }
                        }
                        .searchable(text: $textoBusqueda, prompt: "Buscar alumno...")
                    }
                }
            }
            .navigationTitle("Alumnos")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        descargarTodasLasCredenciales()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "person.text.rectangle.fill")
                            Text("Credenciales")
                                .font(.system(size: 13, weight: .bold))
                        }
                        .foregroundColor(Color(red: 0.02, green: 0.37, blue: 0.27))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color(red: 0.92, green: 0.99, blue: 0.96))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(red: 0.65, green: 0.95, blue: 0.82), lineWidth: 1)
                        )
                        .cornerRadius(8)
                    }
                    .disabled(generandoPDFCredenciales || alumnos.isEmpty)
                }
                
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            descargarTodasLasCredenciales()
                        } label: {
                            Label("Descargar Todas las Credenciales (PDF)", systemImage: "printer.fill")
                        }
                        
                        Divider()
                        
                        Button {
                            sheetActiva = .nuevoAlumno
                        } label: {
                            Label("Nuevo Alumno", systemImage: "person.badge.plus")
                        }
                        
                        Button {
                            mostrarCrearGrupo = true
                        } label: {
                            Label("Crear Grupo / Grado", systemImage: "plus.rectangle.on.rectangle")
                        }
                        
                        Button {
                            sheetActiva = .gestionarGrupos
                        } label: {
                            Label("Gestionar / Eliminar Grupos", systemImage: "folder.badge.gearshape")
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .overlay {
                if generandoPDFCredenciales {
                    ZStack {
                        Color.black.opacity(0.3).ignoresSafeArea()
                        VStack(spacing: 12) {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(1.2)
                            Text("Generando credenciales...")
                                .font(.subheadline)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        }
                        .padding(24)
                        .background(Color(red: 0.02, green: 0.37, blue: 0.27))
                        .cornerRadius(16)
                        .shadow(radius: 10)
                    }
                }
            }
            .sheet(item: $sheetActiva) { sheet in
                switch sheet {
                case .credencialIndividual(let alumno):
                    CredencialQRView(alumno: alumno, clases: clases)
                case .nuevoAlumno:
                    NuevoAlumnoView {
                        cargarDatos()
                    }
                case .gestionarGrupos:
                    GestionarGruposSheet(clases: clases, alumnos: alumnos) {
                        cargarDatos()
                    }
                case .previewTodasCredenciales(let url):
                    PDFPreviewView(pdfURL: url, titulo: "Credenciales de Alumnos")
                }
            }
            .alert("Sin Alumnos", isPresented: $alertaSinAlumnos) {
                Button("Aceptar", role: .cancel) {}
            } message: {
                Text("No hay alumnos registrados para generar credenciales.")
            }
            .alert("Crear Grupo / Grado", isPresented: $mostrarCrearGrupo) {
                TextField("Grado (ej: 1°, 2°, 3°)", text: $nuevoGrado)
                TextField("Grupo (ej: A, B, C)", text: $nuevoGrupo)
                Button("Cancelar", role: .cancel) {
                    nuevoGrado = ""
                    nuevoGrupo = ""
                }
                Button("Crear") {
                    crearGrupo()
                }
            } message: {
                Text("Ingresa el grado y grupo para dar de alta en tu escuela.")
            }
            .refreshable {
                await cargarDatosAsync()
            }
            .task {
                cargarDatos()
            }
        }
    }
    
    // MARK: - Descargar Todas las Credenciales en PDF
    private func descargarTodasLasCredenciales() {
        let lista = alumnosFiltrados.isEmpty ? alumnos : alumnosFiltrados
        guard !lista.isEmpty else {
            alertaSinAlumnos = true
            return
        }
        
        generandoPDFCredenciales = true
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        let clasesDisponibles = self.clases
        DispatchQueue.global(qos: .userInitiated).async {
            let nombreEscuela = AuthManager.shared.usuarioActual?.nombre
            if let url = PDFReportService.shared.generarPDFTodasLasCredenciales(
                alumnos: lista,
                clases: clasesDisponibles,
                nombreEscuela: nombreEscuela
            ) {
                DispatchQueue.main.async {
                    self.generandoPDFCredenciales = false
                    self.sheetActiva = .previewTodasCredenciales(url)
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                }
            } else {
                DispatchQueue.main.async {
                    self.generandoPDFCredenciales = false
                    self.mensajeError = "No se pudieron generar las credenciales."
                }
            }
        }
    }
    
    private func crearGrupo() {
        guard !nuevoGrado.isEmpty, !nuevoGrupo.isEmpty else { return }
        Task {
            do {
                _ = try await APIService.shared.crearClaseRapida(
                    grado: nuevoGrado.trimmingCharacters(in: .whitespaces),
                    grupo: nuevoGrupo.trimmingCharacters(in: .whitespaces)
                )
                let haptic = UINotificationFeedbackGenerator()
                haptic.notificationOccurred(.success)
                await cargarDatosAsync()
                nuevoGrado = ""
                nuevoGrupo = ""
            } catch {
                print("Error creando grupo: \(error)")
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
            async let listaAlumnos = APIService.shared.obtenerAlumnos()
            async let listaClases = APIService.shared.obtenerClases()
            
            let (alums, cls) = try await (listaAlumnos, listaClases)
            
            await MainActor.run {
                self.alumnos = alums
                self.clases = cls
                self.cargando = false
            }
        } catch {
            await MainActor.run {
                self.cargando = false
                self.mensajeError = error.localizedDescription
            }
        }
    }
    
    private func eliminarAlumno(alumno: Alumno) {
        Task {
            do {
                _ = try await APIService.shared.borrarAlumno(id: alumno.id)
                await MainActor.run {
                    alumnos.removeAll { $0.id == alumno.id }
                }
            } catch {
                print("Error al borrar alumno: \(error)")
            }
        }
    }
}

// Sub-vista modular para optimizar compilación en Swift
struct AlumnoFilaView: View {
    let alumno: Alumno
    var clases: [ClaseGrupo] = []
    var onVerQR: () -> Void
    
    var nombreClaseTexto: String {
        alumno.obtenerGrupo(clases: clases)
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.blue.opacity(0.12))
                .frame(width: 44, height: 44)
                .overlay(
                    Text(iniciales(nombre: alumno.nombre_completo))
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                )
            
            VStack(alignment: .leading, spacing: 3) {
                Text(alumno.nombre_completo)
                    .font(.headline)
                
                HStack(spacing: 6) {
                    Text(nombreClaseTexto)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if let qr = alumno.codigo_qr {
                        Text("• \(qr)")
                            .font(.caption2)
                            .monospacedDigit()
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
            
            Button {
                onVerQR()
            } label: {
                Image(systemName: "qrcode")
                    .font(.title3)
                    .foregroundColor(.blue)
                    .padding(8)
                    .background(Color.blue.opacity(0.08))
                    .clipShape(Circle())
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 2)
    }
    
    private func iniciales(nombre: String) -> String {
        let partes = nombre.split(separator: " ")
        if partes.count >= 2 {
            return "\(partes[0].prefix(1))\(partes[1].prefix(1))".uppercased()
        }
        return String(nombre.prefix(2)).uppercased()
    }
}

// MARK: - Sheet para Gestionar y Eliminar Grupos
struct GestionarGruposSheet: View {
    @Environment(\.dismiss) private var dismiss
    let clases: [ClaseGrupo]
    let alumnos: [Alumno]
    var onActualizado: () -> Void
    
    @State private var grupoAEliminar: ClaseGrupo? = nil
    @State private var eliminando: Bool = false
    @State private var errorMensaje: String? = nil
    
    var body: some View {
        NavigationStack {
            List {
                if clases.isEmpty {
                    ContentUnavailableView(
                        "Sin Grupos Creados",
                        systemImage: "folder",
                        description: Text("Crea tu primer grupo usando el botón + en Alumnos.")
                    )
                } else {
                    Section {
                        ForEach(clases) { c in
                            let nom = c.nombre ?? "\(c.nombre_grado ?? c.grado ?? "") \(c.nombre_grupo ?? c.grupo ?? "")".trimmingCharacters(in: .whitespaces)
                            let totalEnGrupo = alumnos.filter { $0.clase_id == c.id }.count
                            
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(nom)
                                        .font(.headline)
                                    
                                    Text("\(totalEnGrupo) alumnos en este grupo")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Button(role: .destructive) {
                                    grupoAEliminar = c
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.subheadline)
                                        .foregroundColor(.red)
                                        .padding(8)
                                        .background(Color.red.opacity(0.1))
                                        .clipShape(Circle())
                                }
                                .buttonStyle(.borderless)
                            }
                            .padding(.vertical, 4)
                        }
                    } header: {
                        Text("Grupos Registrados")
                    } footer: {
                        Text("Al eliminar un grupo, los alumnos asociados quedarán sin grupo asignado.")
                    }
                }
            }
            .navigationTitle("Gestionar Grupos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
            .alert("¿Eliminar Grupo?", isPresented: Binding(
                get: { grupoAEliminar != nil },
                set: { if !$0 { grupoAEliminar = nil } }
            )) {
                Button("Cancelar", role: .cancel) { grupoAEliminar = nil }
                Button("Eliminar", role: .destructive) {
                    if let g = grupoAEliminar {
                        eliminarGrupo(g)
                    }
                }
            } message: {
                if let g = grupoAEliminar {
                    let nom = g.nombre ?? "\(g.nombre_grado ?? g.grado ?? "") \(g.nombre_grupo ?? g.grupo ?? "")"
                    Text("¿Estás seguro de que deseas eliminar el grupo \"\(nom)\"?")
                }
            }
        }
    }
    
    private func eliminarGrupo(_ g: ClaseGrupo) {
        eliminando = true
        Task {
            do {
                _ = try await APIService.shared.eliminarClase(id: g.id)
                await MainActor.run {
                    let haptic = UINotificationFeedbackGenerator()
                    haptic.notificationOccurred(.success)
                    grupoAEliminar = nil
                    eliminando = false
                    onActualizado()
                }
            } catch {
                await MainActor.run {
                    self.errorMensaje = error.localizedDescription
                    self.eliminando = false
                }
            }
        }
    }
}
