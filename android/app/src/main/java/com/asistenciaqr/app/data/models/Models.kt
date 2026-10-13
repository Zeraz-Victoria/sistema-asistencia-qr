package com.asistenciaqr.app.data.models

import com.google.gson.annotations.SerializedName

// MARK: - Usuario y Auth
data class Usuario(
    val id: Int,
    val email: String,
    val rol: String,
    @SerializedName("institucion_id") val institucionId: Int,
    val nombre: String? = null,
    @SerializedName("nombre_completo") val nombreCompleto: String? = null,
    val usuario: String? = null,
    @SerializedName("codigo_qr") val codigoQr: String? = null,
    @SerializedName("clase_id") val claseId: Int? = null,
    @SerializedName("nombre_escuela") val nombreEscuela: String? = null
) {
    val nombreParaMostrar: String
        get() = nombreCompleto?.takeIf { it.isNotBlank() }
            ?: nombre?.takeIf { it.isNotBlank() }
            ?: usuario?.takeIf { it.isNotBlank() }
            ?: email
}

data class LoginResponse(
    val token: String,
    val usuario: Usuario,
    @SerializedName("nombre_escuela") val nombreEscuela: String? = null
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegistroDocenteRequest(
    @SerializedName("nombre_completo") val nombreCompleto: String,
    @SerializedName("nombre_escuela") val nombreEscuela: String? = null,
    val email: String,
    val password: String,
    val telefono: String? = null,
    @SerializedName("device_fingerprint") val deviceFingerprint: String? = null
)

data class RegistroDocenteResponse(
    val message: String? = null,
    val token: String,
    val usuario: Usuario,
    @SerializedName("nombre_escuela") val nombreEscuela: String? = null
)

// MARK: - Estado de Licencia
data class LicenciaStatus(
    val status: String? = null,
    val plan: String? = null,
    val diasRestantes: Int? = null,
    val daysLeft: Int? = null,
    val isTrial: Boolean? = null,
    val expiredTrial: Boolean? = null,
    val message: String? = null,
    val nombreEscuela: String? = null,
    val monto: Int? = 99,
    val tipoLicencia: String? = null,
    val modalidad: String? = null
)

// MARK: - Alumno
data class Alumno(
    val id: Int,
    @SerializedName("nombre_completo") val nombreCompleto: String,
    @SerializedName("codigo_qr") val codigoQr: String? = null,
    @SerializedName("nfc_uid") val nfcUid: String? = null,
    @SerializedName("telefono_tutor") val telefonoTutor: String? = null,
    @SerializedName("clase_id") val claseId: Int? = null,
    @SerializedName("nombre_clase") val nombreClase: String? = null,
    val grado: String? = null,
    val grupo: String? = null,
    @SerializedName("nombre_grado") val nombreGrado: String? = null,
    @SerializedName("nombre_grupo") val nombreGrupo: String? = null,
    @SerializedName("clases_matriculadas") val clasesMatriculadas: String? = null,
    @SerializedName("clase_ids_str") val claseIdsStr: String? = null
) {
    fun obtenerGrupo(clases: List<ClaseGrupo> = emptyList()): String {
        if (!nombreClase.isNullOrBlank()) return nombreClase
        val ng = (nombreGrado ?: grado ?: "").trim()
        val ngr = (nombreGrupo ?: grupo ?: "").trim()
        val comb = "$ng $ngr".trim()
        if (comb.isNotBlank()) return comb
        if (!clasesMatriculadas.isNullOrBlank()) {
            val primera = clasesMatriculadas.split(",").firstOrNull()?.trim() ?: ""
            if (primera.isNotBlank()) {
                val idx = primera.indexOf("(")
                return if (idx != -1) primera.substring(0, idx).trim() else primera
            }
        }
        if (claseId != null) {
            val match = clases.firstOrNull { it.id == claseId }
            if (match != null) {
                val g = "${match.nombreGrado ?: match.grado ?: ""} ${match.nombreGrupo ?: match.grupo ?: ""}".trim()
                if (g.isNotBlank()) return g
                if (!match.nombre.isNullOrBlank()) return match.nombre
            }
        }
        return "Sin grupo"
    }
}

// MARK: - Asistencia y Escaneo
data class MarcarAsistenciaRequest(
    @SerializedName("codigo_qr") val codigoQr: String? = null,
    val uid: String? = null
)

data class MarcarAsistenciaResponse(
    val status: String,
    val message: String? = null,
    val tipo: String? = null,
    val hora: String? = null,
    val alumno: AlumnoInfo? = null
)

data class AlumnoInfo(
    val id: Int? = null,
    val nombre: String? = null,
    val grupo: String? = null
)

data class AsistenciaManualRequest(
    @SerializedName("alumno_id") val alumnoId: Int,
    val status: String,
    val fecha: String
)

// MARK: - Registro Diario de Asistencia
data class AsistenciaRegistro(
    val id: Int,
    @SerializedName("alumno_id") val alumnoId: Int,
    @SerializedName("nombre_completo") val nombreCompleto: String? = null,
    val fecha: String? = null,
    @SerializedName("fecha_hora") val fechaHora: String? = null,
    @SerializedName("hora_entrada") val horaEntrada: String? = null,
    @SerializedName("hora_salida") val horaSalida: String? = null,
    val status: String? = null,
    val justificacion: String? = null,
    @SerializedName("codigo_qr") val codigoQr: String? = null
) {
    val estado: String get() = status ?: "presente"
    val horaOFecha: String
        get() {
            if (!horaEntrada.isNullOrBlank()) return horaEntrada
            if (!fechaHora.isNullOrBlank()) {
                if (fechaHora.contains("T")) {
                    val parts = fechaHora.split("T")
                    if (parts.size > 1) return parts[1].take(5)
                } else if (fechaHora.contains(" ")) {
                    val parts = fechaHora.split(" ")
                    if (parts.size > 1) return parts[1].take(5)
                }
                return fechaHora
            }
            return fecha ?: "--:--"
        }
}

// MARK: - Clase / Grupo
data class ClaseGrupo(
    val id: Int,
    val nombre: String? = null,
    @SerializedName("nombre_grado") val nombreGrado: String? = null,
    @SerializedName("nombre_grupo") val nombreGrupo: String? = null,
    val grado: String? = null,
    val grupo: String? = null
)

// MARK: - Actividades / Tareas
data class Actividad(
    val id: Int,
    val titulo: String,
    val descripcion: String? = null,
    @SerializedName("clase_id") val claseId: Int? = null,
    @SerializedName("fecha_creacion") val fechaCreacion: String? = null
)

data class CrearActividadRequest(
    val titulo: String,
    val descripcion: String? = null,
    @SerializedName("clase_id") val claseId: Int? = null
)

data class EntregaActividad(
    @SerializedName("alumno_id") val alumnoId: Int,
    @SerializedName("actividad_id") val actividadId: Int? = null,
    @SerializedName("fecha_entrega") val fechaEntrega: String? = null
)

data class ToggleEntregaRequest(
    @SerializedName("actividad_id") val actividadId: Int,
    @SerializedName("alumno_id") val alumnoId: Int
)

data class ToggleEntregaResponse(
    val status: String? = null,
    val entregado: Boolean? = null,
    val message: String? = null
)

data class MarcarEntregaQRRequest(
    @SerializedName("codigo_qr") val codigoQr: String,
    val uid: String,
    @SerializedName("actividad_id") val actividadId: Int
)

// MARK: - Respuestas Genéricas
data class SimpleResponse(
    val status: String? = null,
    val message: String? = null,
    val id: Int? = null,
    val error: String? = null
)
