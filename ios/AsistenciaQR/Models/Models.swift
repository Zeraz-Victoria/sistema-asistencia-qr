import Foundation

// MARK: - Usuario y Auth
struct Usuario: Codable, Identifiable {
    let id: Int
    let email: String
    let rol: String
    let institucion_id: Int
    let nombre: String?
}

struct LoginResponse: Codable {
    let token: String
    let usuario: Usuario
}

// MARK: - Estado de Licencia / Suscripción
struct LicenciaStatus: Codable {
    let status: String?
    let plan: String?
    let diasRestantes: Int?
    let daysLeft: Int?
    let isTrial: Bool?
    let expiredTrial: Bool?
    let message: String?
    let nombreEscuela: String?
    let tipoLicencia: String?
    let modalidad: String?
}

// MARK: - Alumno
struct Alumno: Codable, Identifiable {
    let id: Int
    let nombre_completo: String
    let codigo_qr: String?
    let nfc_uid: String?
    let telefono_tutor: String?
    let clase_id: Int?
    let nombre_clase: String?
    let grado: String?
    let grupo: String?
    let nombre_grado: String?
    let nombre_grupo: String?
    let clases_matriculadas: String?
    let clase_ids_str: String?
    
    /// Devuelve el grado y grupo del alumno buscando en todas las fuentes disponibles
    func obtenerGrupo(clases: [ClaseGrupo] = []) -> String {
        // 1. Nombre de clase explícito
        if let nc = nombre_clase?.trimmingCharacters(in: .whitespaces), !nc.isEmpty {
            return nc
        }
        
        // 2. Grado y Grupo combinados (de nombre_grado/nombre_grupo o grado/grupo)
        let ng = (nombre_grado ?? grado ?? "").trimmingCharacters(in: .whitespaces)
        let ngr = (nombre_grupo ?? grupo ?? "").trimmingCharacters(in: .whitespaces)
        let comb = "\(ng) \(ngr)".trimmingCharacters(in: .whitespaces)
        if !comb.isEmpty {
            return comb
        }
        
        // 3. Subconsulta de clases matriculadas (ej. "3 A" o "3 A (Matemáticas)")
        if let cm = clases_matriculadas?.trimmingCharacters(in: .whitespaces), !cm.isEmpty {
            let partes = cm.components(separatedBy: ",")
            if let primera = partes.first?.trimmingCharacters(in: .whitespaces), !primera.isEmpty {
                if let idx = primera.firstIndex(of: "(") {
                    let limpio = String(primera[..<idx]).trimmingCharacters(in: .whitespaces)
                    if !limpio.isEmpty { return limpio }
                }
                return primera
            }
            return cm
        }
        
        // 4. Búsqueda por clase_id en la lista de clases
        if let cid = clase_id, let match = clases.first(where: { $0.id == cid }) {
            let g = "\(match.nombre_grado ?? match.grado ?? "") \(match.nombre_grupo ?? match.grupo ?? "")".trimmingCharacters(in: .whitespaces)
            if !g.isEmpty { return g }
            if let nom = match.nombre, !nom.isEmpty { return nom }
        }
        
        // 5. Búsqueda por clase_ids_str en la lista de clases
        if let idsStr = clase_ids_str {
            let ids = idsStr.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
            for id in ids {
                if let match = clases.first(where: { $0.id == id }) {
                    let g = "\(match.nombre_grado ?? match.grado ?? "") \(match.nombre_grupo ?? match.grupo ?? "")".trimmingCharacters(in: .whitespaces)
                    if !g.isEmpty { return g }
                    if let nom = match.nombre, !nom.isEmpty { return nom }
                }
            }
        }
        
        return "Sin grupo"
    }
}

// MARK: - Asistencia y Escaneo
struct MarcarAsistenciaResponse: Codable {
    let status: String // "ok", "success", "warning", "error"
    let message: String?
    let tipo: String? // "entrada", "salida"
    let hora: String?
    let alumno: AlumnoInfo?
    
    struct AlumnoInfo: Codable {
        let id: Int?
        let nombre: String?
        let grupo: String?
    }
}

// MARK: - Registro Diario de Asistencia
struct AsistenciaRegistro: Codable, Identifiable {
    let id: Int
    let alumno_id: Int
    let nombre_completo: String?
    let fecha: String?
    let fecha_hora: String?
    let hora_entrada: String?
    let hora_salida: String?
    let status: String?
    let justificacion: String?
    let codigo_qr: String?
    
    var estado: String {
        status ?? "presente"
    }
    
    var horaOFecha: String {
        if let h = hora_entrada, !h.isEmpty { return h }
        if let fh = fecha_hora, !fh.isEmpty {
            if fh.contains("T") {
                let parts = fh.components(separatedBy: "T")
                if parts.count > 1 { return String(parts[1].prefix(5)) }
            } else if fh.contains(" ") {
                let parts = fh.components(separatedBy: " ")
                if parts.count > 1 { return String(parts[1].prefix(5)) }
            }
            return fh
        }
        return fecha ?? "--:--"
    }
}

// MARK: - Grupo / Clase
struct ClaseGrupo: Codable, Identifiable {
    let id: Int
    let nombre: String?
    let nombre_grado: String?
    let nombre_grupo: String?
    let grado: String?
    let grupo: String?
}

// MARK: - Actividades / Tareas
struct Actividad: Codable, Identifiable {
    let id: Int
    let titulo: String
    let descripcion: String?
    let clase_id: Int?
    let fecha_creacion: String?
}

struct EntregaActividad: Codable, Identifiable {
    var id: Int { alumno_id }
    let alumno_id: Int
    let actividad_id: Int?
    let fecha_entrega: String?
}

struct ToggleEntregaResponse: Codable {
    let status: String?
    let entregado: Bool?
    let message: String?
}

// MARK: - Respuesta Genérica del Servidor
struct SimpleResponse: Codable {
    let status: String?
    let message: String?
    let id: Int?
    let error: String?
}
