package com.asistenciaqr.app.ui.screens

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.animation.*
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.asistenciaqr.app.camera.QRCodeScannerView
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.MarcarAsistenciaRequest
import com.asistenciaqr.app.data.models.MarcarAsistenciaResponse
import com.asistenciaqr.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun AsistenciaScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var procesando by remember { mutableStateOf(false) }
    var ultimoResultado by remember { mutableStateOf<MarcarAsistenciaResponse?>(null) }
    var mostrarBanner by remember { mutableStateOf(false) }

    val toneGenerator = remember { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100) }
    val vibrator = remember {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            context.getSystemService(Vibrator::class.java)
        } else null
    }

    fun vibrarYSonar(exito: Boolean) {
        try {
            if (exito) {
                toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(100)
                }
            } else {
                toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
            }
        } catch (e: Exception) { }
    }

    fun procesarEscaneo(codigo: String) {
        if (procesando) return
        procesando = true

        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.marcarAsistencia(MarcarAsistenciaRequest(codigoQr = codigo, uid = codigo))
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    ultimoResultado = body
                    mostrarBanner = true
                    vibrarYSonar(body.status != "warning")

                    // Ocultar banner tras 2 segundos
                    delay(2000)
                    mostrarBanner = false
                    procesando = false
                } else {
                    ultimoResultado = MarcarAsistenciaResponse(
                        status = "error",
                        message = "Código QR no reconocido"
                    )
                    mostrarBanner = true
                    vibrarYSonar(false)
                    delay(2000)
                    mostrarBanner = false
                    procesando = false
                }
            } catch (e: Exception) {
                ultimoResultado = MarcarAsistenciaResponse(
                    status = "error",
                    message = "Error de conexión"
                )
                mostrarBanner = true
                vibrarYSonar(false)
                delay(2000)
                mostrarBanner = false
                procesando = false
            }
        }
    }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Cámara a pantalla completa
        QRCodeScannerView(
            modifier = Modifier.fillMaxSize(),
            onQrScanned = { qr ->
                procesarEscaneo(qr)
            }
        )

        // Marco visor de escaneo azul degradado idéntico a iOS
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .size(260.dp)
                .border(
                    width = 3.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color(0xFF007AFF).copy(alpha = 0.9f),
                            Color(0xFF00C7FF).copy(alpha = 0.9f)
                        )
                    ),
                    shape = RoundedCornerShape(24.dp)
                )
                .background(Color.Black.copy(alpha = 0.05f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.QrCodeScanner,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.4f),
                modifier = Modifier.size(46.dp)
            )
        }

        // Banner flotante superior con animación Apple Spring
        AnimatedVisibility(
            visible = mostrarBanner && ultimoResultado != null,
            enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(animationSpec = spring()),
            exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 48.dp, start = 16.dp, end = 16.dp)
        ) {
            val resultado = ultimoResultado!!
            val esExito = resultado.status != "error" && resultado.status != "warning"

            Surface(
                shape = RoundedCornerShape(18.dp),
                color = IosCardWhite,
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(16.dp, RoundedCornerShape(18.dp), spotColor = Color.Black.copy(alpha = 0.2f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (esExito) IosGreenBadgeBg else IosOrangeBadgeBg,
                        modifier = Modifier.size(44.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = if (esExito) Icons.Default.CheckCircle else Icons.Default.Warning,
                                contentDescription = null,
                                tint = if (esExito) IosGreenBadgeText else IosOrangeBadgeText,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = resultado.alumno?.nombre ?: "Asistencia Registrada",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = IosTextPrimary
                        )
                        Text(
                            text = resultado.message ?: "",
                            fontSize = 13.sp,
                            color = IosTextSecondary
                        )
                    }

                    if (!resultado.hora.isNullOrBlank()) {
                        Text(
                            text = resultado.hora,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = IosGreenDark
                        )
                    }
                }
            }
        }
    }
}
