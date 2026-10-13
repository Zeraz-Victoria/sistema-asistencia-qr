package com.asistenciaqr.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.LicenciaStatus
import com.asistenciaqr.app.data.repository.AuthManager
import com.asistenciaqr.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun AjustesScreen(
    onCerrarSesion: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val usuario = authManager.usuario

    var licencia by remember { mutableStateOf<LicenciaStatus?>(null) }
    var mostrandoConfirmacionCerrarSesion by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.obtenerEstadoLicencia()
                if (res.isSuccessful) licencia = res.body()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(bottom = 120.dp)
    ) {
        // Título Grande: Ajustes
        Text(
            text = "Ajustes",
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            color = IosTextPrimary,
            modifier = Modifier.padding(top = 24.dp, bottom = 20.dp)
        )

        // SECCIÓN: Cuenta Activa
        Text(
            text = "Cuenta Activa",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF64748B),
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
        )

        Surface(
            shape = RoundedCornerShape(20.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                FilaDetalle(
                    label = "Correo",
                    valor = usuario?.email ?: "Docente"
                )
                HorizontalDivider(color = IosDivider, thickness = 1.dp)
                FilaDetalle(
                    label = "Usuario",
                    valor = usuario?.nombreParaMostrar ?: usuario?.email ?: "Docente"
                )
                HorizontalDivider(color = IosDivider, thickness = 1.dp)
                FilaDetalle(
                    label = "Institución",
                    valor = licencia?.nombreEscuela ?: usuario?.nombreEscuela ?: "Mi Escuela"
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // SECCIÓN: Estado de Licencia
        Text(
            text = "Estado de Licencia",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF64748B),
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
        )

        Surface(
            shape = RoundedCornerShape(20.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Plan",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = IosTextPrimary
                    )
                    val esVitalicio = licencia?.plan == "vitalicio"
                    val esAnual = licencia?.plan == "anual"
                    val planTitulo = when {
                        esVitalicio -> "Vitalicio (Pago Único)"
                        esAnual -> "Suscripción Anual"
                        else -> (licencia?.plan ?: "Prueba 30 Días")
                    }
                    Text(
                        text = planTitulo,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (esVitalicio || esAnual) Color(0xFF059669) else IosBlue
                    )
                }

                HorizontalDivider(color = IosDivider, thickness = 1.dp)

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Días Restantes",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = IosTextPrimary
                    )
                    val dias = licencia?.diasRestantes ?: licencia?.daysLeft ?: 30
                    val esVitalicio = licencia?.plan == "vitalicio"
                    Text(
                        text = if (esVitalicio) "Ilimitados" else "$dias días",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (esVitalicio || dias > 7) Color(0xFF10B981) else IosRed
                    )
                }

                if (licencia?.plan != "vitalicio" && (licencia?.isTrial == true || licencia?.status == "suspendido" || licencia?.plan == null)) {
                    HorizontalDivider(color = IosDivider, thickness = 1.dp)
                    val esDestinoAnual = (licencia?.tipoLicencia == "anual")
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 14.dp)
                    ) {
                        Text(
                            text = if (esDestinoAnual) "✨ Suscripción Anual ($99 MXN / año)" else "✨ Acceso Vitalicio Permanente",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF065F46)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (esDestinoAnual) {
                                "Conserva todos tus datos y reportes activos durante 1 año por solo $99 MXN."
                            } else {
                                "Conserva todos tus datos y reportes sin límite por un único pago de $99 MXN."
                            },
                            fontSize = 13.sp,
                            color = Color(0xFF64748B),
                            lineHeight = 18.sp
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = {
                                val escuela = licencia?.nombreEscuela ?: usuario?.nombreEscuela ?: "Mi Escuela"
                                val nombre = usuario?.nombreParaMostrar ?: "Docente"
                                val email = usuario?.email ?: ""
                                val planTexto = if (esDestinoAnual) "Suscripción Anual $99 MXN / año" else "$99 MXN pago único"
                                val mensaje = "Hola, quiero activar mi cuenta de AsistenciaQR ($planTexto).\n\n🏫 Escuela: $escuela\n👤 Docente: $nombre\n📧 Correo/Usuario: $email"
                                abrirWhatsApp(context, "522723303963", mensaje)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = if (esDestinoAnual) "Activar por WhatsApp ($99 MXN / año)" else "Activar por WhatsApp ($99 MXN)",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(28.dp))

        // SECCIÓN: Botón Cerrar Sesión
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = IosCardWhite,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .clickable { mostrandoConfirmacionCerrarSesion = true }
        ) {
            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                    contentDescription = null,
                    tint = IosRed,
                    modifier = Modifier.size(22.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Cerrar Sesión",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = IosRed
                )
            }
        }
    }

    if (mostrandoConfirmacionCerrarSesion) {
        AlertDialog(
            onDismissRequest = { mostrandoConfirmacionCerrarSesion = false },
            title = { Text("Cerrar Sesión", fontWeight = FontWeight.Bold) },
            text = { Text("¿Estás seguro de que deseas salir de tu cuenta docente?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        authManager.cerrarSesion()
                        mostrandoConfirmacionCerrarSesion = false
                        onCerrarSesion()
                    }
                ) {
                    Text("Cerrar Sesión", color = IosRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { mostrandoConfirmacionCerrarSesion = false }) {
                    Text("Cancelar", color = Color(0xFF64748B))
                }
            },
            containerColor = IosCardWhite
        )
    }
}

@Composable
private fun FilaDetalle(label: String, valor: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = IosTextPrimary
        )
        Text(
            text = valor,
            fontSize = 16.sp,
            color = Color(0xFF64748B)
        )
    }
}
