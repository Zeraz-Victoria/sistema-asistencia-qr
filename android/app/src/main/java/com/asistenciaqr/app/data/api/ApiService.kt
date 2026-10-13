package com.asistenciaqr.app.data.api

import com.asistenciaqr.app.data.models.*
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // --- AUTH ---
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    @POST("auth/registro-docente")
    suspend fun registroDocente(@Body body: RegistroDocenteRequest): Response<RegistroDocenteResponse>

    @GET("auth/estado-licencia")
    suspend fun obtenerEstadoLicencia(): Response<LicenciaStatus>

    // --- ASISTENCIA ---
    @POST("marcar")
    suspend fun marcarAsistencia(@Body body: MarcarAsistenciaRequest): Response<MarcarAsistenciaResponse>

    @GET("asistencias/hoy")
    suspend fun obtenerAsistenciasHoy(@Query("fecha") fecha: String? = null): Response<List<AsistenciaRegistro>>

    @POST("asistencias/manual")
    suspend fun marcarAsistenciaManual(@Body body: AsistenciaManualRequest): Response<MarcarAsistenciaResponse>

    // --- ALUMNOS ---
    @GET("alumnos")
    suspend fun obtenerAlumnos(): Response<List<Alumno>>

    @POST("registrar")
    suspend fun registrarAlumno(@Body body: Map<String, @JvmSuppressWildcards Any>): Response<SimpleResponse>

    @POST("alumnos/borrar")
    suspend fun borrarAlumno(@Body body: Map<String, Int>): Response<SimpleResponse>

    @PUT("alumnos/{id}")
    suspend fun actualizarAlumno(@Path("id") id: Int, @Body body: Map<String, @JvmSuppressWildcards Any?>): Response<SimpleResponse>

    // --- CLASES ---
    @GET("gestion/clases")
    suspend fun obtenerClases(): Response<List<ClaseGrupo>>

    @POST("gestion/clases/rapida")
    suspend fun crearClaseRapida(@Body body: Map<String, String>): Response<SimpleResponse>

    @DELETE("gestion/clases/{id}")
    suspend fun eliminarClase(@Path("id") id: Int): Response<SimpleResponse>

    // --- ACTIVIDADES / TAREAS ---
    @GET("actividades")
    suspend fun obtenerActividades(): Response<List<Actividad>>

    @POST("actividades")
    suspend fun crearActividad(@Body body: CrearActividadRequest): Response<SimpleResponse>

    @GET("actividades/{id}/entregas")
    suspend fun obtenerEntregasActividad(@Path("id") id: Int): Response<List<EntregaActividad>>

    @DELETE("actividades/{id}")
    suspend fun borrarActividad(@Path("id") id: Int): Response<SimpleResponse>

    @POST("actividades/toggle-entrega")
    suspend fun toggleEntregaActividad(@Body body: ToggleEntregaRequest): Response<ToggleEntregaResponse>

    @POST("actividades/marcar")
    suspend fun marcarEntregaActividadConQR(@Body body: MarcarEntregaQRRequest): Response<SimpleResponse>

    // --- DESCARGA PDF ---
    @Streaming
    @GET
    suspend fun descargarPDF(@Url url: String): Response<ResponseBody>
}
