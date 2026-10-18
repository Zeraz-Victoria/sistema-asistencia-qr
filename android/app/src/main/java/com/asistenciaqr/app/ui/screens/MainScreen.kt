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
import androidx.compose.ui.graphics.Brush
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
    var bannerDescartado by remember { mutableStateOf(false) }

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

        // Banner Flotante de Aviso Previo (3 días antes de prueba / 15 días antes de anual)
        val diasRestantes = licencia?.diasRestantes ?: licencia?.daysLeft ?: 30
        val esPruebaPorVencer = (licencia?.isTrial == true && diasRestantes in 1..3)
        val esAnualPorVencer = (licencia?.plan == "anual" && diasRestantes in 1..15)
        val mostrarBannerAlerta = !licenciaExpirada && !bannerDescartado && (esPruebaPorVencer || esAnualPorVencer)

        if (mostrarBannerAlerta) {
            val esUrgente = diasRestantes <= 2
            val bgGradient = if (esUrgente) {
                Brush.horizontalGradient(listOf(Color(0xFFFEF2F2), Color(0xFFFEE2E2)))
            } else {
                Brush.horizontalGradient(listOf(Color(0xFFFFFBEB), Color(0xFFFEF3C7)))
            }
            val borderColor = if (esUrgente) Color(0xFFFCA5A5) else Color(0xFFFDE68A)
            val textColor = if (esUrgente) Color(0xFF991B1B) else Color(0xFF92400E)
            val iconColor = if (esUrgente) Color(0xFFDC2626) else Color(0xFFD97706)

            val esVitalicio = (licencia?.plan == "vitalicio")
            val tipoTexto = if (esVitalicio) "Licencia Vitalicia ($99 MXN)" else "Suscripción Anual ($99 MXN / año)"
            val tituloAlerta = if (esAnualPorVencer) "Suscripción por Vencer" else "Prueba por Finalizar"
            val diasTexto = if (diasRestantes == 1) "1 día restante" else "$diasRestantes días restantes"

            Surface(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .fillMaxWidth()
                    .shadow(8.dp, RoundedCornerShape(16.dp), spotColor = Color.Black.copy(alpha = 0.15f))
                    .border(1.5.dp, borderColor, RoundedCornerShape(16.dp))
                    .clickable {
                        val escuela = licencia?.nombreEscuela ?: usuario?.nombreEscuela ?: "Mi Escuela"
                        val nombre = usuario?.nombreParaMostrar ?: "Docente"
                        val email = usuario?.email ?: ""
                        val planMsg = if (esVitalicio) "$99 MXN pago único" else "Suscripción Anual $99 MXN / año"
                        val mensaje = "Hola, mi periodo de prueba de AsistenciaQR está por vencer ($diasTexto) y quiero activar mi cuenta ($planMsg).\n\n🏫 Escuela: $escuela\n👤 Docente: $nombre\n📧 Correo/Usuario: $email"
                        abrirWhatsApp(context, "522723303963", mensaje)
                    },
                shape = RoundedCornerShape(16.dp),
                color = Color.Transparent
            ) {
                Box(
                    modifier = Modifier
                        .background(bgGradient)
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = iconColor.copy(alpha = 0.15f),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = iconColor,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = tituloAlerta,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = textColor
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = iconColor
                                ) {
                                    Text(
                                        text = diasTexto,
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Toca aquí para asegurar tu cuenta por WhatsApp ($tipoTexto).",
                                fontSize = 11.sp,
                                color = textColor.copy(alpha = 0.9f),
                                lineHeight = 14.sp
                            )
                        }

                        IconButton(
                            onClick = { bannerDescartado = true },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Cerrar",
                                tint = textColor.copy(alpha = 0.6f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
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

                    val esVitalicio = (licencia?.plan == "vitalicio")
                    val descTexto = if (esVitalicio) {
                        "Tu periodo de prueba de 30 días ha concluido. Para continuar utilizando AsistenciaQR de por vida con tus alumnos, tareas y asistencias intactos, activa tu cuenta por un único pago de $99 MXN vía WhatsApp."
                    } else {
                        "Tu periodo de prueba de 30 días ha concluido. Para continuar utilizando AsistenciaQR durante 1 año con tus alumnos, tareas y asistencias intactos, activa tu Suscripción Anual ($99 MXN / año) vía WhatsApp."
                    }
                    val planMsg = if (esVitalicio) "$99 MXN pago único" else "Suscripción Anual $99 MXN / año"

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
                            text = if (esVitalicio) "Activar por WhatsApp ($99 MXN)" else "Activar por WhatsApp ($99 MXN / año)",
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
