import SwiftUI

struct NuevoAlumnoView: View {
    @Environment(\.dismiss) private var dismiss
    var onGuardado: () -> Void
    
    @State private var nombreCompleto: String = ""
    @State private var codigoQR: String = ""
    @State private var claseSeleccionadaId: Int? = nil
    
    @State private var clases: [ClaseGrupo] = []
    @State private var cargandoClases: Bool = true
    @State private var guardando: Bool = false
    @State private var errorMensaje: String? = nil
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Datos del Alumno") {
                    TextField("Nombre Completo", text: $nombreCompleto)
                        .autocorrectionDisabled()
                }
                
                Section("Asignación de Grupo") {
                    if cargandoClases {
                        ProgressView("Cargando grupos...")
                    } else {
                        if !clases.isEmpty {
                            Picker("Grupo / Clase", selection: $claseSeleccionadaId) {
                                Text("Seleccionar grupo").tag(nil as Int?)
                                ForEach(clases) { clase in
                                    Text(clase.nombre ?? "\(clase.nombre_grado ?? clase.grado ?? "") \(clase.nombre_grupo ?? clase.grupo ?? "")")
                                        .tag(clase.id as Int?)
                                }
                            }
                        } else {
                            Text("No hay grupos registrados")
                                .foregroundColor(.secondary)
                                .font(.subheadline)
                        }
                    }
                }
                
                Section("Código QR") {
                    HStack {
                        TextField("Código Identificador", text: $codigoQR)
                            .fontDesign(.monospaced)
                            .autocorrectionDisabled()
                        
                        Button("Generar") {
                            generarCodigoAleatorio()
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                    Text("Puedes ingresar su matrícula o presionar Generar para crear uno único automáticamente.")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                if let error = errorMensaje {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("Nuevo Alumno")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        guardarAlumno()
                    }
                    .disabled(nombreCompleto.trimmingCharacters(in: .whitespaces).isEmpty || claseSeleccionadaId == nil || guardando)
                }
            }
            .task {
                cargarClases()
                if codigoQR.isEmpty {
                    generarCodigoAleatorio()
                }
            }
        }
    }
    
    private func generarCodigoAleatorio() {
        let letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        let randomStr = String((0..<8).map { _ in letras.randomElement()! })
        codigoQR = "ALUM-\(randomStr)"
    }
    
    private func cargarClases() {
        Task {
            do {
                clases = try await APIService.shared.obtenerClases()
                if let primera = clases.first {
                    claseSeleccionadaId = primera.id
                }
                cargandoClases = false
            } catch {
                cargandoClases = false
            }
        }
    }
    
    private func guardarAlumno() {
        guard let claseId = claseSeleccionadaId else { return }
        guardando = true
        errorMensaje = nil
        
        Task {
            do {
                _ = try await APIService.shared.registrarAlumno(
                    nombre: nombreCompleto.trimmingCharacters(in: .whitespaces),
                    codigoQR: codigoQR.trimmingCharacters(in: .whitespaces),
                    claseId: claseId
                )
                
                await MainActor.run {
                    let haptic = UINotificationFeedbackGenerator()
                    haptic.notificationOccurred(.success)
                    onGuardado()
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMensaje = error.localizedDescription
                    guardando = false
                }
            }
        }
    }
}
