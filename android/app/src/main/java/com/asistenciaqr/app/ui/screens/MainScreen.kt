package com.asistenciaqr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.LicenciaStatus
import com.asistenciaqr.app.data.repository.AuthManager
import com.asistenciaqr.app.ui.theme.*
import kotlinx.coroutines.launch

enum class BottomTab(val title: String, val icon: ImageVector) {
    PASE_LISTA("Pase Lista", Icons.Default.ContentPaste),
    TAREAS("Tareas", Icons.Default.Book),
    ALUMNOS("Alumnos", Icons.Default.People),
    REPORTES("Reportes", Icons.Default.Description),
    AJUSTES("Ajustes", Icons.Default.Settings)
}

@Composable
fun MainScreen(
    onCerrarSesion: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val usuario = authManager.usuario

    var selectedTab by remember { mutableStateOf(BottomTab.PASE_LISTA) }
    var licencia by remember { mutableStateOf<LicenciaStatus?>(null) }
    var licenciaExpirada by remember { mutableStateOf(false) }

    // Verificación proactiva de licencia (anti-bypass de prueba)
    LaunchedEffect(Unit) {
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.obtenerEstadoLicencia()
                if (res.isSuccessful && res.body() != null) {
                    val lic = res.body()!!
                    licencia = lic
                    if (lic.expiredTrial == true || lic.status == "suspendido" || (lic.isTrial == true && (lic.daysLeft ?: 1) <= 0)) {
                        licenciaExpirada = true
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
    ) {
        // Contenido de la pantalla seleccionada
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            when (selectedTab) {
                BottomTab.PASE_LISTA -> AsistenciaScreen()
                BottomTab.TAREAS -> TareasScreen()
                BottomTab.ALUMNOS -> AlumnosScreen()
                BottomTab.REPORTES -> ReportesScreen()
                BottomTab.AJUSTES -> AjustesScreen(onCerrarSesion = onCerrarSesion)
            }
        }

        // Barra de Navegación Flotante Estilo Cápsula iOS
        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(horizontal = 16.dp, vertical = 16.dp)
                .fillMaxWidth()
                .height(68.dp)
                .shadow(elevation = 12.dp, shape = CircleShape, spotColor = Color.Black.copy(alpha = 0.15f))
                .border(1.dp, Color.Black.copy(alpha = 0.06f), CircleShape),
            shape = CircleShape,
            color = IosCardWhite
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 6.dp),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BottomTab.entries.forEach { tab ->
                    val isSelected = selectedTab == tab
                    val interactionSource = remember { MutableInteractionSource() }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp)
                            .clip(RoundedCornerShape(28.dp))
                            .background(if (isSelected) IosTabActiveBg else Color.Transparent)
                            .clickable(
                                interactionSource = interactionSource,
                                indication = null
                            ) { selectedTab = tab },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.title,
                                tint = if (isSelected) IosTabActiveTint else IosTabInactiveTint,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = tab.title,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (isSelected) IosTabActiveTint else IosTabInactiveTint
                            )
                        }
                    }
                }
            }
        }
    }

    // Modal de Bloqueo Infranqueable por Licencia de Prueba Expirada
    if (licenciaExpirada) {
        Dialog(
            onDismissRequest = { /* No se puede descartar */ },
            properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
        ) {
            Surface(
                shape = RoundedCornerShape(28.dp),
                color = IosCardWhite,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFFFEF3C7),
                        modifier = Modifier.size(72.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = Color(0xFFD97706),
                                modifier = Modifier.size(36.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Prueba de 30 Días Finalizada",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = IosTextPrimary,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    val esAnual = (licencia?.tipoLicencia == "anual" || licencia?.plan == "anual")
                    val descTexto = if (esAnual) {
                        "Tu periodo de prueba de 30 días ha concluido. Para continuar utilizando AsistenciaQR durante 1 año con tus alumnos, tareas y asistencias intactos, activa tu Suscripción Anual ($99 MXN / año) vía WhatsApp."
                    } else {
                        "Tu periodo de prueba de 30 días ha concluido. Para continuar utilizando AsistenciaQR de por vida con tus alumnos, tareas y asistencias intactos, activa tu cuenta por un único pago de $99 MXN vía WhatsApp."
                    }
                    val planMsg = if (esAnual) "Suscripción Anual $99 MXN / año" else "$99 MXN pago único"

                    Text(
                        text = descTexto,
                        fontSize = 14.sp,
                        color = IosTextSecondary,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            val escuela = licencia?.nombreEscuela ?: usuario?.nombreEscuela ?: "Mi Escuela"
                            val nombre = usuario?.nombreParaMostrar ?: "Docente"
                            val email = usuario?.email ?: ""
                            val mensaje = "Hola, mi periodo de prueba de AsistenciaQR ha finalizado y quiero activar mi cuenta ($planMsg).\n\n🏫 Escuela: $escuela\n👤 Docente: $nombre\n📧 Correo/Usuario: $email"
                            abrirWhatsApp(context, "522723303963", mensaje)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Chat,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (esAnual) "Activar por WhatsApp ($99 MXN / año)" else "Activar por WhatsApp ($99 MXN)",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    TextButton(
                        onClick = {
                            authManager.cerrarSesion()
                            onCerrarSesion()
                        }
                    ) {
                        Text(
                            text = "Cerrar Sesión",
                            color = IosRed,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}
