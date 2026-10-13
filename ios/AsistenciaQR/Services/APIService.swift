import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case serverError(String)
    case unauthorized
    case decodingError
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "URL del servidor inválida."
        case .serverError(let msg): return msg
        case .unauthorized: return "Sesión expirada o credenciales incorrectas."
        case .decodingError: return "Error al procesar la respuesta del servidor."
        case .unknown: return "Error de red desconocido."
        }
    }
}

class APIService {
    static let shared = APIService()
    
    // MARK: - Generic Request
    func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: [String: Any]? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        guard let url = URL(string: "\(Config.apiBaseURL)/\(endpoint)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if requiresAuth, let token = AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown
        }
        
        if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
            if requiresAuth {
                DispatchQueue.main.async {
                    AuthManager.shared.cerrarSesion()
                }
            }
            throw APIError.unauthorized
        }
        
        if !(200...299).contains(httpResponse.statusCode) {
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errorMsg = errorJson["error"] as? String ?? errorJson["message"] as? String {
                throw APIError.serverError(errorMsg)
            }
            throw APIError.serverError("Error del servidor (código \(httpResponse.statusCode)).")
        }
        
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            print("Error decoding: \(error)")
            throw APIError.decodingError
        }
    }
    
    // MARK: - Auth Endpoints
    func login(email: String, password: String) async throws -> LoginResponse {
        return try await request(
            endpoint: "auth/login",
            method: "POST",
            body: ["email": email, "password": password],
            requiresAuth: false
        )
    }
    
    func registroDocente(nombre: String, escuela: String, email: String, password: String) async throws -> LoginResponse {
        return try await request(
            endpoint: "auth/registro-docente",
            method: "POST",
            body: [
                "nombre_completo": nombre,
                "nombre_escuela": escuela,
                "email": email,
                "password": password
            ],
            requiresAuth: false
        )
    }
    
    func obtenerEstadoLicencia() async throws -> LicenciaStatus {
        return try await request(endpoint: "auth/estado-licencia", method: "GET")
    }
    
    // MARK: - Asistencia Endpoints (Montados en /api)
    func marcarAsistencia(codigoQR: String) async throws -> MarcarAsistenciaResponse {
        return try await request(
            endpoint: "marcar",
            method: "POST",
            body: ["codigo_qr": codigoQR]
        )
    }
    
    func obtenerAsistencias(fecha: String? = nil) async throws -> [AsistenciaRegistro] {
        if let f = fecha, !f.isEmpty {
            return try await request(endpoint: "asistencias/hoy?fecha=\(f)", method: "GET")
        }
        return try await request(endpoint: "asistencias/hoy", method: "GET")
    }
    
    func obtenerAsistenciasHoy() async throws -> [AsistenciaRegistro] {
        return try await obtenerAsistencias(fecha: nil)
    }
    
    func marcarAsistenciaManual(alumnoId: Int, estado: String) async throws -> MarcarAsistenciaResponse {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let fechaHoy = formatter.string(from: Date())
        
        return try await request(
            endpoint: "asistencias/manual",
            method: "POST",
            body: [
                "alumno_id": alumnoId,
                "status": estado,
                "fecha": fechaHoy
            ]
        )
    }
    
    // MARK: - Alumnos Endpoints (Montados en /api)
    func obtenerAlumnos() async throws -> [Alumno] {
        return try await request(endpoint: "alumnos", method: "GET")
    }
    
    func registrarAlumno(nombre: String, codigoQR: String, claseId: Int, telefonoTutor: String = "") async throws -> SimpleResponse {
        return try await request(
            endpoint: "registrar",
            method: "POST",
            body: [
                "nombre_completo": nombre,
                "codigo_qr": codigoQR,
                "clase_id": claseId,
                "telefono_tutor": telefonoTutor
            ]
        )
    }
    
    func borrarAlumno(id: Int) async throws -> SimpleResponse {
        return try await request(
            endpoint: "alumnos/borrar",
            method: "POST",
            body: ["id": id]
        )
    }
    
    // MARK: - Clases / Grupos (Montados en /api/gestion)
    func obtenerClases() async throws -> [ClaseGrupo] {
        return try await request(endpoint: "gestion/clases", method: "GET")
    }
    
    func crearClaseRapida(grado: String, grupo: String) async throws -> SimpleResponse {
        let nombreClase = "\(grado) \(grupo)".trimmingCharacters(in: .whitespaces)
        return try await request(
            endpoint: "gestion/clases/rapida",
            method: "POST",
            body: [
                "nombre": nombreClase,
                "grado": grado,
                "grupo": grupo,
                "nombre_grado": grado,
                "nombre_grupo": grupo
            ]
        )
    }
    
    func eliminarClase(id: Int) async throws -> SimpleResponse {
        return try await request(
            endpoint: "gestion/clases/\(id)",
            method: "DELETE"
        )
    }
    
    // MARK: - Actividades / Tareas (Montados en /api)
    func obtenerActividades() async throws -> [Actividad] {
        return try await request(endpoint: "actividades", method: "GET")
    }
    
    func crearActividad(titulo: String, descripcion: String, claseId: Int?) async throws -> SimpleResponse {
        var body: [String: Any] = [
            "titulo": titulo,
            "descripcion": descripcion
        ]
        if let cid = claseId {
            body["clase_id"] = cid
        }
        return try await request(
            endpoint: "actividades",
            method: "POST",
            body: body
        )
    }
    
    func borrarActividad(id: Int) async throws -> SimpleResponse {
        return try await request(
            endpoint: "actividades/\(id)",
            method: "DELETE"
        )
    }
    
    func obtenerEntregasActividad(actividadId: Int) async throws -> [EntregaActividad] {
        return try await request(
            endpoint: "actividades/\(actividadId)/entregas",
            method: "GET"
        )
    }
    
    func toggleEntregaActividad(actividadId: Int, alumnoId: Int) async throws -> ToggleEntregaResponse {
        return try await request(
            endpoint: "actividades/toggle-entrega",
            method: "POST",
            body: [
                "actividad_id": actividadId,
                "alumno_id": alumnoId
            ]
        )
    }
    
    func marcarEntregaActividadConQR(codigoQR: String, actividadId: Int) async throws -> SimpleResponse {
        return try await request(
            endpoint: "actividades/marcar",
            method: "POST",
            body: [
                "codigo_qr": codigoQR,
                "uid": codigoQR,
                "actividad_id": actividadId
            ]
        )
    }
    
    // MARK: - Descarga de Reportes PDF
    func descargarPDF(endpoint: String) async throws -> Data {
        guard let url = URL(string: "\(Config.apiBaseURL)/\(endpoint)") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let msg = errorJson["error"] as? String {
                throw APIError.serverError(msg)
            }
            throw APIError.serverError("Error al generar el PDF del reporte.")
        }
        return data
    }
    
    func descargarReporteOficialPDF(endpoint: String, nombreArchivo: String) async throws -> URL {
        let pdfData = try await descargarPDF(endpoint: endpoint)
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(nombreArchivo)
        try pdfData.write(to: fileURL)
        return fileURL
    }
}
