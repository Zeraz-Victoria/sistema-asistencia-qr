import SwiftUI
import AudioToolbox
import AVFoundation

struct KioscoView: View {
    @State private var procesando: Bool = false
    @State private var ultimoResultado: MarcarAsistenciaResponse? = nil
    @State private var mensajeAlerta: String? = nil
    @State private var mostrarBanner: Bool = false
    @State private var mostrarModalManual: Bool = false
    @State private var linternaEncendida: Bool = false
    
    // Lista de alumnos para el modo manual
    @State private var alumnos: [Alumno] = []
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Cámara a pantalla completa
                QRCodeScannerView { codigoQR in
                    procesarEscaneo(codigo: codigoQR)
                }
                .ignoresSafeArea(edges: .top)
                
                // Marco visor de escaneo
                VStack {
                    Spacer()
                    
                    RoundedRectangle(cornerRadius: 24)
                        .strokeBorder(
                            LinearGradient(
                                colors: [.blue.opacity(0.8), .cyan.opacity(0.8)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3
                        )
                        .frame(width: 260, height: 260)
                        .background(Color.black.opacity(0.05))
                        .overlay(
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 40))
                                .foregroundColor(.white.opacity(0.4))
                        )
                    
                    Spacer()
                }
                
                // Banner flotante superior al registrar asistencia (Animación Apple Spring)
                VStack {
                    if mostrarBanner, let res = ultimoResultado {
                        ResultadoCard(resultado: res)
                            .transition(.move(edge: .top).combined(with: .opacity))
                            .padding(.top, 8)
                            .padding(.horizontal, 16)
                    }
                    
                    Spacer()
                }
            }
            .navigationBarHidden(true)
        }
    }
    
    private func procesarEscaneo(codigo: String) {
        guard !procesando else { return }
        procesando = true
        
        let impact = UIImpactFeedbackGenerator(style: .rigid)
        impact.prepare()
        impact.impactOccurred()
        
        Task {
            do {
                let respuesta = try await APIService.shared.marcarAsistencia(codigoQR: codigo)
                
                await MainActor.run {
                    self.ultimoResultado = respuesta
                    
                    // Sonido y háptico de éxito
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                    AudioServicesPlaySystemSound(1054) // Sonido 'pop' nativo de iOS
                    
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        self.mostrarBanner = true
                    }
                    
                    // Ocultar el banner tras 1.0 segundo
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            self.mostrarBanner = false
                        }
                        self.procesando = false
                    }
                }
            } catch {
                await MainActor.run {
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.error)
                    AudioServicesPlaySystemSound(1053)
                    
                    self.ultimoResultado = MarcarAsistenciaResponse(
                        status: "error",
                        message: error.localizedDescription,
                        tipo: nil,
                        hora: nil,
                        alumno: nil
                    )
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        self.mostrarBanner = true
                    }
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        withAnimation { self.mostrarBanner = false }
                        self.procesando = false
                    }
                }
            }
        }
    }
    
    private func alternarLinterna() {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else { return }
        do {
            try device.lockForConfiguration()
            device.torchMode = linternaEncendida ? .off : .on
            linternaEncendida.toggle()
            device.unlockForConfiguration()
        } catch {
            print("Error con la linterna: \(error)")
        }
    }
}

// Tarjeta flotante de resultado
struct ResultadoCard: View {
    let resultado: MarcarAsistenciaResponse
    
    var esExito: Bool {
        resultado.status == "ok" || resultado.status == "success"
    }
    
    var colorTema: Color {
        if esExito { return .green }
        if resultado.status == "warning" { return .orange }
        return .red
    }
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: esExito ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 36))
                .foregroundColor(colorTema)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(resultado.alumno?.nombre ?? (esExito ? "Asistencia Registrada" : "Aviso"))
                    .font(.headline)
                    .foregroundColor(.primary)
                
                HStack(spacing: 8) {
                    if let tipo = resultado.tipo {
                        Text(tipo.uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(colorTema.opacity(0.15))
                            .foregroundColor(colorTema)
                            .clipShape(Capsule())
                    }
                    
                    if let hora = resultado.hora {
                        Text(hora)
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundColor(.secondary)
                    }
                    
                    if let msg = resultado.message {
                        Text(msg)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: Color.black.opacity(0.15), radius: 10, y: 5)
    }
}

// Modal de Pase Manual para cuando olvidan el QR
struct PaseManualSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var busqueda: String = ""
    @State private var alumnos: [Alumno] = []
    @State private var cargando: Bool = true
    @State private var mensajeExito: String? = nil
    
    var alumnosFiltrados: [Alumno] {
        if busqueda.isEmpty { return alumnos }
        return alumnos.filter { $0.nombre_completo.localizedCaseInsensitiveContains(busqueda) }
    }
    
    var body: some View {
        NavigationStack {
            Group {
                if cargando {
                    ProgressView("Cargando lista de alumnos...")
                } else {
                    List(alumnosFiltrados) { alumno in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(alumno.nombre_completo)
                                    .font(.headline)
                                Text(alumno.obtenerGrupo())
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            Button("Presente") {
                                marcarPresente(alumno: alumno)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)
                            .controlSize(.small)
                        }
                    }
                    .searchable(text: $busqueda, prompt: "Buscar por nombre...")
                }
            }
            .navigationTitle("Registro Manual")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
            .task {
                do {
                    alumnos = try await APIService.shared.obtenerAlumnos()
                    cargando = false
                } catch {
                    cargando = false
                }
            }
        }
    }
    
    private func marcarPresente(alumno: Alumno) {
        Task {
            do {
                _ = try await APIService.shared.marcarAsistenciaManual(alumnoId: alumno.id, estado: "presente")
                let haptic = UINotificationFeedbackGenerator()
                haptic.notificationOccurred(.success)
                dismiss()
            } catch {
                print("Error al marcar manual: \(error)")
            }
        }
    }
}
