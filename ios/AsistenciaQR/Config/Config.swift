import Foundation

enum Config {
    // URL base de tu servidor en producción
    static let defaultBaseURL = "https://qrasistencia.iaparamaestros.org/api"
    
    // Clave para guardar en UserDefaults si el usuario cambia el servidor
    static let serverURLKey = "custom_server_base_url"
    
    static var apiBaseURL: String {
        get {
            UserDefaults.standard.string(forKey: serverURLKey) ?? defaultBaseURL
        }
        set {
            UserDefaults.standard.set(newValue, forKey: serverURLKey)
        }
    }
}
