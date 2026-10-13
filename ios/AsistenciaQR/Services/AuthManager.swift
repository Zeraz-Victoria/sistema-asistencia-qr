import Foundation
import Combine

class AuthManager: ObservableObject {
    static let shared = AuthManager()
    
    @Published var isAuthenticated: Bool = false
    @Published var usuarioActual: Usuario? = nil
    @Published var token: String? = nil
    
    private let tokenKey = "asistencia_jwt_token"
    private let userKey = "asistencia_usuario_actual"
    
    init() {
        cargarSesion()
    }
    
    func guardarSesion(token: String, usuario: Usuario) {
        self.token = token
        self.usuarioActual = usuario
        self.isAuthenticated = true
        
        UserDefaults.standard.set(token, forKey: tokenKey)
        if let userData = try? JSONEncoder().encode(usuario) {
            UserDefaults.standard.set(userData, forKey: userKey)
        }
    }
    
    func cargarSesion() {
        if let savedToken = UserDefaults.standard.string(forKey: tokenKey),
           let userData = UserDefaults.standard.data(forKey: userKey),
           let savedUser = try? JSONDecoder().decode(Usuario.self, from: userData) {
            self.token = savedToken
            self.usuarioActual = savedUser
            self.isAuthenticated = true
        } else {
            self.isAuthenticated = false
        }
    }
    
    func cerrarSesion() {
        self.token = nil
        self.usuarioActual = nil
        self.isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: userKey)
    }
}
