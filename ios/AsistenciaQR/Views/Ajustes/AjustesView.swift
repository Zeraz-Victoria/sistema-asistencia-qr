import SwiftUI

struct AjustesView: View {
    @ObservedObject var authManager = AuthManager.shared
    @State private var licencia: LicenciaStatus? = nil
    @State private var cargandoLicencia: Bool = true
    @State private var mostrarAlertaCerrarSesion: Bool = false
    
    var body: some View {
        NavigationStack {
            Form {
                // Perfil de Usuario
                Section("Cuenta Activa") {
                    if let user = authManager.usuarioActual {
                        LabeledContent("Correo", value: user.email)
                        LabeledContent("Usuario", value: user.nombre ?? user.email)
                        LabeledContent("Institución", value: licencia?.nombreEscuela ?? "Mi Escuela")
                    }
                }
                
                // Estado de Licencia / Suscripción
                Section("Estado de Licencia") {
                    if cargandoLicencia {
                        ProgressView("Consultando licencia...")
                    } else if let lic = licencia {
                        HStack {
                            Text("Plan")
                            Spacer()
                            Text(lic.plan ?? "VITALICIO")
                                .fontWeight(.semibold)
                                .foregroundColor(.blue)
                        }
                        
                        if let dias = lic.diasRestantes ?? lic.daysLeft {
                            HStack {
                                Text("Días Restantes")
                                Spacer()
                                Text("\(dias) días")
                                    .fontWeight(.bold)
                                    .foregroundColor(dias <= 5 ? .red : .green)
                            }
                        }
                    } else {
                        Text("No se pudo obtener el estado de la licencia.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Cerrar Sesión
                Section {
                    Button(role: .destructive) {
                        mostrarAlertaCerrarSesion = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Cerrar Sesión", systemImage: "rectangle.portrait.and.arrow.right")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Ajustes")
            .alert("Cerrar Sesión", isPresented: $mostrarAlertaCerrarSesion) {
                Button("Cancelar", role: .cancel) {}
                Button("Cerrar Sesión", role: .destructive) {
                    authManager.cerrarSesion()
                }
            } message: {
                Text("¿Estás seguro de que deseas salir de tu cuenta?")
            }
            .task {
                do {
                    licencia = try await APIService.shared.obtenerEstadoLicencia()
                    cargandoLicencia = false
                } catch {
                    cargandoLicencia = false
                }
            }
            .refreshable {
                do {
                    licencia = try await APIService.shared.obtenerEstadoLicencia()
                } catch {}
            }
        }
    }
}
