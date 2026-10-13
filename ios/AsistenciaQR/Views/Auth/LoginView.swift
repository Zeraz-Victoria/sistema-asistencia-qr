import SwiftUI

struct LoginView: View {
    @ObservedObject var authManager = AuthManager.shared
    
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var cargando: Bool = false
    @State private var mensajeError: String? = nil
    @State private var mostrarRegistroDocente: Bool = false
    
    // Verde institucional coincidente con la versión Web
    private let verdeInstitucional = Color(red: 0.02, green: 0.42, blue: 0.28)
    private let verdeClaro = Color(red: 0.05, green: 0.60, blue: 0.40)
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(UIColor.systemGroupedBackground)
                    .ignoresSafeArea()
                
                VStack(spacing: 28) {
                    Spacer()
                    
                    // Logo y Título
                    VStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(LinearGradient(
                                    colors: [verdeClaro, verdeInstitucional],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .frame(width: 88, height: 88)
                                .shadow(color: verdeInstitucional.opacity(0.3), radius: 12, y: 6)
                            
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 44))
                                .foregroundColor(.white)
                        }
                        
                        Text("AsistenciaQR")
                            .font(.title)
                            .fontWeight(.bold)
                    }
                    
                    // Formulario de Credenciales
                    VStack(spacing: 16) {
                        HStack {
                            Image(systemName: "envelope.fill")
                                .foregroundColor(.secondary)
                                .frame(width: 24)
                            TextField("Correo o usuario", text: $email)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .keyboardType(.emailAddress)
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemGroupedBackground))
                        .cornerRadius(14)
                        
                        HStack {
                            Image(systemName: "lock.fill")
                                .foregroundColor(.secondary)
                                .frame(width: 24)
                            SecureField("Contraseña", text: $password)
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemGroupedBackground))
                        .cornerRadius(14)
                        
                        if let error = mensajeError {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        
                        Button {
                            iniciarSesion()
                        } label: {
                            HStack {
                                if cargando {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Iniciar Sesión")
                                        .fontWeight(.bold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(
                                LinearGradient(
                                    colors: [verdeClaro, verdeInstitucional],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundColor(.white)
                            .cornerRadius(14)
                            .shadow(color: verdeInstitucional.opacity(0.3), radius: 8, y: 4)
                        }
                        .disabled(email.isEmpty || password.isEmpty || cargando)
                        
                        // Enlace para crear cuenta
                        Button {
                            mostrarRegistroDocente = true
                        } label: {
                            Text("Crear Cuenta")
                                .fontWeight(.bold)
                                .foregroundColor(verdeInstitucional)
                                .font(.subheadline)
                                .padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 24)
                    
                    Spacer()
                }
            }
            .sheet(isPresented: $mostrarRegistroDocente) {
                RegistroDocenteSheet()
            }
        }
    }
    
    private func iniciarSesion() {
        guard !email.isEmpty, !password.isEmpty else { return }
        cargando = true
        mensajeError = nil
        
        let haptic = UIImpactFeedbackGenerator(style: .medium)
        haptic.impactOccurred()
        
        Task {
            do {
                let res = try await APIService.shared.login(
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password
                )
                
                await MainActor.run {
                    authManager.guardarSesion(token: res.token, usuario: res.usuario)
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                    cargando = false
                }
            } catch {
                await MainActor.run {
                    mensajeError = error.localizedDescription
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.error)
                    cargando = false
                }
            }
        }
    }
}

// MARK: - Sheet de Registro de Docente (30 Días de Prueba)
struct RegistroDocenteSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    @State private var nombreDocente: String = ""
    @State private var nombreEscuela: String = ""
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    
    @State private var registrando: Bool = false
    @State private var errorMensaje: String? = nil
    
    private let verdeInstitucional = Color(red: 0.02, green: 0.42, blue: 0.28)
    private let verdeClaro = Color(red: 0.05, green: 0.60, blue: 0.40)
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Comienza tu prueba gratis")
                            .font(.headline)
                        Text("Obtén 30 días de acceso total sin costo para registrar y controlar la asistencia de tus alumnos.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                
                Section("Tus Datos") {
                    TextField("Tu nombre completo", text: $nombreDocente)
                        .autocorrectionDisabled()
                    
                    TextField("Nombre de tu Escuela o Aula", text: $nombreEscuela)
                        .autocorrectionDisabled()
                }
                
                Section("Credenciales de Acceso") {
                    TextField("Correo electrónico", text: $email)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Contraseña", text: $password)
                    SecureField("Confirmar contraseña", text: $confirmPassword)
                }
                
                if let err = errorMensaje {
                    Section {
                        Text(err)
                            .foregroundColor(.red)
                            .font(.footnote)
                    }
                }
                
                Section {
                    Button {
                        registrarCuenta()
                    } label: {
                        HStack {
                            Spacer()
                            if registrando {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Comenzar Prueba de 30 Días")
                                    .fontWeight(.bold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(nombreDocente.isEmpty || email.isEmpty || password.isEmpty || registrando)
                    .listRowBackground(verdeInstitucional)
                    .foregroundColor(.white)
                }
            }
            .navigationTitle("Registro Docente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }
    
    private func registrarCuenta() {
        if password != confirmPassword {
            errorMensaje = "Las contraseñas no coinciden."
            return
        }
        
        registrando = true
        errorMensaje = nil
        
        Task {
            do {
                let res = try await APIService.shared.registroDocente(
                    nombre: nombreDocente.trimmingCharacters(in: .whitespaces),
                    escuela: nombreEscuela.trimmingCharacters(in: .whitespaces),
                    email: email.trimmingCharacters(in: .whitespaces),
                    password: password
                )
                
                await MainActor.run {
                    AuthManager.shared.guardarSesion(token: res.token, usuario: res.usuario)
                    let notif = UINotificationFeedbackGenerator()
                    notif.notificationOccurred(.success)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMensaje = error.localizedDescription
                    registrando = false
                }
            }
        }
    }
}
