package com.asistenciaqr.app.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.asistenciaqr.app.config.Config
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.LoginRequest
import com.asistenciaqr.app.data.models.RegistroDocenteRequest
import com.asistenciaqr.app.data.repository.AuthManager
import com.asistenciaqr.app.ui.theme.*
import kotlinx.coroutines.launch
import java.net.URLEncoder
import java.util.UUID

fun abrirWhatsApp(context: Context, telefono: String, mensaje: String) {
    try {
        val url = "https://wa.me/$telefono?text=${URLEncoder.encode(mensaje, "UTF-8")}"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "No se pudo abrir WhatsApp: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
    }
}

fun obtenerDeviceFingerprint(context: Context): String {
    val prefs = context.getSharedPreferences("asistencia_device_prefs", Context.MODE_PRIVATE)
    var fp = prefs.getString("device_fingerprint", null)
    if (fp.isNullOrBlank()) {
        val androidId = try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        } catch (e: Exception) {
            ""
        }
        val cleanId = androidId.trim()
        fp = if (cleanId.isNotBlank() && cleanId != "9774d56d682e549c") {
            "dev_and_$cleanId"
        } else {
            val randomStr = UUID.randomUUID().toString().replace("-", "").take(12)
            "dev_and_${randomStr}_${System.currentTimeMillis().toString(36)}"
        }
        prefs.edit().putString("device_fingerprint", fp).apply()
    }
    return fp
}

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var mostrarRegistroSheet by remember { mutableStateOf(false) }

    var mostrarDialogoServidor by remember { mutableStateOf(false) }
    var serverUrlInput by remember { mutableStateOf(Config.getApiBaseUrl(context)) }

    val adminWhatsApp = "522723303963"
    val verdeInstitucional = Color(0xFF056835)
    val verdeGradienteInicio = Color(0xFF0D9488)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Icono / Logo idéntico a iOS
            Box(
                modifier = Modifier
                    .size(92.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            listOf(verdeGradienteInicio, verdeInstitucional)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.QrCodeScanner,
                    contentDescription = "Logo QR",
                    tint = Color.White,
                    modifier = Modifier.size(46.dp)
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "AsistenciaQR",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = IosTextPrimary
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Tarjeta de Formulario Única Estilo iOS
            Surface(
                shape = RoundedCornerShape(22.dp),
                color = IosCardWhite,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (errorMessage != null) {
                        Surface(
                            color = IosRed.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage ?: "",
                                color = IosRed,
                                fontSize = 14.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    // Campo 1: Correo o usuario
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it; errorMessage = null },
                        placeholder = { Text("Correo o usuario", color = IosTextSecondary) },
                        leadingIcon = {
                            Icon(Icons.Default.MailOutline, contentDescription = null, tint = IosTextSecondary)
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = verdeInstitucional,
                            unfocusedBorderColor = IosBorder,
                            focusedTextColor = IosTextPrimary,
                            unfocusedTextColor = IosTextPrimary
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Campo 2: Contraseña
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; errorMessage = null },
                        placeholder = { Text("Contraseña", color = IosTextSecondary) },
                        leadingIcon = {
                            Icon(Icons.Default.Lock, contentDescription = null, tint = IosTextSecondary)
                        },
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = null,
                                    tint = IosTextSecondary
                                )
                            }
                        },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = verdeInstitucional,
                            unfocusedBorderColor = IosBorder,
                            focusedTextColor = IosTextPrimary,
                            unfocusedTextColor = IosTextPrimary
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Botón Iniciar Sesión
                    Button(
                        onClick = {
                            if (email.isBlank() || password.isBlank()) {
                                errorMessage = "Por favor ingresa correo y contraseña."
                                return@Button
                            }
                            isLoading = true
                            errorMessage = null

                            coroutineScope.launch {
                                try {
                                    val api = RetrofitClient.getApiService(context)
                                    val res = api.login(LoginRequest(email.trim(), password.trim()))
                                    if (res.isSuccessful && res.body() != null) {
                                        val body = res.body()!!
                                        authManager.guardarSesion(body.token, body.usuario)
                                        onLoginSuccess()
                                    } else {
                                        val errStr = res.errorBody()?.string() ?: ""
                                        if (res.code() == 402 || errStr.contains("suspendid", ignoreCase = true) || errStr.contains("expirad", ignoreCase = true)) {
                                            errorMessage = "Tu periodo de prueba ha finalizado. Puedes activar tu Suscripción Anual vía WhatsApp por $99 MXN al año."
                                        } else if (errStr.contains("credenciales", ignoreCase = true) || res.code() == 401) {
                                            errorMessage = "Correo o contraseña incorrectos."
                                        } else {
                                            errorMessage = "Error al iniciar sesión (${res.code()})."
                                        }
                                    }
                                } catch (e: Exception) {
                                    errorMessage = "Error de red: ${e.localizedMessage ?: "Verifica tu conexión."}"
                                } finally {
                                    isLoading = false
                                }
                            }
                        },
                        enabled = !isLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = verdeInstitucional),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                text = "Iniciar Sesión",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }

                    // Enlace abajo: "Crear Cuenta" (Idéntico a iPhone)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Crear Cuenta",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = verdeInstitucional,
                            modifier = Modifier
                                .clickable {
                                    mostrarRegistroSheet = true
                                }
                                .padding(8.dp)
                        )
                    }
                }
            }
        }

        // Configuración Servidor (Esquina superior derecha)
        IconButton(
            onClick = {
                serverUrlInput = Config.getApiBaseUrl(context)
                mostrarDialogoServidor = true
            },
            modifier = Modifier.align(Alignment.TopEnd)
        ) {
            Icon(Icons.Default.Settings, contentDescription = "Configuración", tint = IosTextSecondary)
        }
    }

    // Sheet / Modal de Registro Docente Estilo iOS
    if (mostrarRegistroSheet) {
        RegistroDocenteSheetModal(
            onDismiss = { mostrarRegistroSheet = false },
            onRegistroExitoso = {
                mostrarRegistroSheet = false
                onLoginSuccess()
            }
        )
    }

    if (mostrarDialogoServidor) {
        AlertDialog(
            onDismissRequest = { mostrarDialogoServidor = false },
            title = { Text("URL del Servidor", color = IosTextPrimary) },
            text = {
                Column {
                    Text(
                        text = "Ingresa la dirección base del backend SaaS:",
                        color = IosTextSecondary,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                    OutlinedTextField(
                        value = serverUrlInput,
                        onValueChange = { serverUrlInput = it },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = IosTextPrimary,
                            unfocusedTextColor = IosTextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        Config.setApiBaseUrl(context, serverUrlInput.trim())
                        RetrofitClient.invalidate()
                        mostrarDialogoServidor = false
                        Toast.makeText(context, "Servidor actualizado", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("Guardar", color = verdeInstitucional)
                }
            },
            dismissButton = {
                TextButton(onClick = { mostrarDialogoServidor = false }) {
                    Text("Cancelar", color = IosTextSecondary)
                }
            },
            containerColor = IosCardWhite
        )
    }
}

@Composable
fun RegistroDocenteSheetModal(
    onDismiss: () -> Unit,
    onRegistroExitoso: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val scrollState = rememberScrollState()

    var regNombre by remember { mutableStateOf("") }
    var regEscuela by remember { mutableStateOf("") }
    var regEmail by remember { mutableStateOf("") }
    var regPassword by remember { mutableStateOf("") }
    var regConfirmPassword by remember { mutableStateOf("") }

    var registrando by remember { mutableStateOf(false) }
    var errorMensaje by remember { mutableStateOf<String?>(null) }
    var bloqueoAbusoActivo by remember { mutableStateOf(false) }

    val adminWhatsApp = "522723303963"
    val verdeInstitucional = Color(0xFF056835)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            color = IosBackground,
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 40.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
            ) {
                // Barra superior del Sheet (Cancelar / Título)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar", color = IosBlue, fontSize = 16.sp)
                    }
                    Text(
                        text = "Registro Docente",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = IosTextPrimary
                    )
                    Spacer(modifier = Modifier.width(60.dp))
                }

                HorizontalDivider(color = IosDivider, thickness = 1.dp)

                // Contenido Scrolleable del Formulario
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Título y Subtítulo
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "Comienza tu prueba gratis",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = IosTextPrimary
                        )
                        Text(
                            text = "Obtén 30 días de acceso total sin costo para registrar y controlar la asistencia de tus alumnos.",
                            fontSize = 13.sp,
                            color = IosTextSecondary,
                            lineHeight = 18.sp
                        )
                    }

                    // Tarjeta Destacada de Beneficios (30 Días Gratis)
                    Surface(
                        color = Color(0xFFECFDF5),
                        border = BorderStroke(1.dp, Color(0xFFA7F3D0)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "✨ 30 Días de Prueba Gratis",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = Color(0xFF065F46)
                                )
                                Surface(
                                    color = Color(0xFF065F46),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = "Sin Tarjeta",
                                        color = Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "✓ Acceso completo a todas las funciones por 30 días\n✓ Después solo $99 MXN al año",
                                color = Color(0xFF047857),
                                fontSize = 13.sp,
                                lineHeight = 18.sp
                            )
                        }
                    }

                    // Si hay bloqueo anti-abuso de dispositivo
                    if (bloqueoAbusoActivo) {
                        Surface(
                            color = Color(0xFFFFFBEB),
                            border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "🔒 Periodo de Prueba Ya Utilizado",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = Color(0xFF92400E)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Este dispositivo ya utilizó sus 30 días de prueba gratuita. Para continuar usando AsistenciaQR, puedes activar tu Suscripción Anual por $99 MXN al año vía WhatsApp.",
                                    color = Color(0xFFB45309),
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Button(
                                    onClick = {
                                        val escuela = regEscuela.trim().ifBlank { "Mi Escuela" }
                                        val nombre = regNombre.trim().ifBlank { "Docente" }
                                        val mail = regEmail.trim()
                                        val mensaje = "Hola, mi periodo de prueba de AsistenciaQR ha finalizado y quiero activar mi cuenta ($99 MXN al año).\n\n*Escuela:* $escuela\n*Docente:* $nombre\n*Correo/Usuario:* $mail"
                                        abrirWhatsApp(context, adminWhatsApp, mensaje)
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.Chat,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Activar por WhatsApp ($99 MXN / año)",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }

                    if (errorMensaje != null) {
                        Surface(
                            color = IosRed.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMensaje ?: "",
                                color = IosRed,
                                fontSize = 14.sp,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    // Sección 1: Tus Datos
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = IosCardWhite,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(text = "TUS DATOS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64748B))

                            OutlinedTextField(
                                value = regNombre,
                                onValueChange = { regNombre = it; errorMensaje = null },
                                placeholder = { Text("Tu nombre completo") },
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = verdeInstitucional,
                                    unfocusedBorderColor = IosBorder,
                                    focusedTextColor = IosTextPrimary,
                                    unfocusedTextColor = IosTextPrimary
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = regEscuela,
                                onValueChange = { regEscuela = it; errorMensaje = null },
                                placeholder = { Text("Nombre de tu Escuela o Aula (Opcional)") },
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = verdeInstitucional,
                                    unfocusedBorderColor = IosBorder,
                                    focusedTextColor = IosTextPrimary,
                                    unfocusedTextColor = IosTextPrimary
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    // Sección 2: Credenciales de Acceso
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = IosCardWhite,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(text = "CREDENCIALES DE ACCESO", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF64748B))

                            OutlinedTextField(
                                value = regEmail,
                                onValueChange = { regEmail = it; errorMensaje = null },
                                placeholder = { Text("Correo electrónico") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = verdeInstitucional,
                                    unfocusedBorderColor = IosBorder,
                                    focusedTextColor = IosTextPrimary,
                                    unfocusedTextColor = IosTextPrimary
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = regPassword,
                                onValueChange = { regPassword = it; errorMensaje = null },
                                placeholder = { Text("Contraseña") },
                                singleLine = true,
                                visualTransformation = PasswordVisualTransformation(),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = verdeInstitucional,
                                    unfocusedBorderColor = IosBorder,
                                    focusedTextColor = IosTextPrimary,
                                    unfocusedTextColor = IosTextPrimary
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = regConfirmPassword,
                                onValueChange = { regConfirmPassword = it; errorMensaje = null },
                                placeholder = { Text("Confirmar contraseña") },
                                singleLine = true,
                                visualTransformation = PasswordVisualTransformation(),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = verdeInstitucional,
                                    unfocusedBorderColor = IosBorder,
                                    focusedTextColor = IosTextPrimary,
                                    unfocusedTextColor = IosTextPrimary
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    // Botón Comenzar Prueba de 30 Días
                    Button(
                        onClick = {
                            if (regNombre.isBlank() || regEmail.isBlank() || regPassword.isBlank()) {
                                errorMensaje = "Por favor completa tu nombre, correo y contraseña."
                                return@Button
                            }
                            if (regPassword != regConfirmPassword) {
                                errorMensaje = "Las contraseñas no coinciden."
                                return@Button
                            }
                            registrando = true
                            errorMensaje = null
                            bloqueoAbusoActivo = false

                            coroutineScope.launch {
                                try {
                                    val deviceFp = obtenerDeviceFingerprint(context)
                                    val api = RetrofitClient.getApiService(context)
                                    val res = api.registroDocente(
                                        RegistroDocenteRequest(
                                            nombreCompleto = regNombre.trim(),
                                            nombreEscuela = regEscuela.trim().takeIf { it.isNotBlank() },
                                            email = regEmail.trim(),
                                            password = regPassword.trim(),
                                            deviceFingerprint = deviceFp
                                        )
                                    )

                                    if (res.isSuccessful && res.body() != null) {
                                        val body = res.body()!!
                                        authManager.guardarSesion(body.token, body.usuario)
                                        Toast.makeText(context, "🎉 ¡Bienvenido! Prueba de 30 días activa", Toast.LENGTH_SHORT).show()
                                        onRegistroExitoso()
                                    } else {
                                        val errStr = res.errorBody()?.string() ?: ""
                                        if (res.code() == 403 || errStr.contains("abuso", ignoreCase = true) || errStr.contains("utilizó", ignoreCase = true) || errStr.contains("PRUEBA_EXPIRADA", ignoreCase = true)) {
                                            bloqueoAbusoActivo = true
                                            errorMensaje = "Este dispositivo ya utilizó sus 30 días de prueba gratuita."
                                        } else if (errStr.contains("Ya existe", ignoreCase = true) || res.code() == 409) {
                                            errorMensaje = "Ya existe una cuenta con este correo electrónico."
                                        } else {
                                            errorMensaje = "Error al crear cuenta: $errStr"
                                        }
                                    }
                                } catch (e: Exception) {
                                    errorMensaje = "Error de red: ${e.localizedMessage ?: "Verifica tu conexión."}"
                                } finally {
                                    registrando = false
                                }
                            }
                        },
                        enabled = !registrando,
                        colors = ButtonDefaults.buttonColors(containerColor = verdeInstitucional),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                    ) {
                        if (registrando) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Text(
                                text = "Comenzar Prueba de 30 Días",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}
