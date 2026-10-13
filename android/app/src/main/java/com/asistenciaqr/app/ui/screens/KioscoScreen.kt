package com.asistenciaqr.app.ui.screens

import android.media.AudioManager
import android.media.ToneGenerator
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.asistenciaqr.app.camera.QRCodeScannerView
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.MarcarAsistenciaRequest
import com.asistenciaqr.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun KioscoScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var ultimoMensaje by remember { mutableStateOf("Coloca tu código QR frente a la cámara") }
    var alumnoRegistrado by remember { mutableStateOf<String?>(null) }
    var esExito by remember { mutableStateOf(false) }

    val toneGenerator = remember { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100) }

    fun procesarQR(codigo: String) {
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.marcarAsistencia(MarcarAsistenciaRequest(codigoQr = codigo, uid = codigo))
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    ultimoMensaje = body.message ?: "¡Asistencia registrada!"
                    alumnoRegistrado = body.alumno?.nombre ?: "Alumno"
                    esExito = true
                    toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                } else {
                    ultimoMensaje = "Código no reconocido"
                    alumnoRegistrado = null
                    esExito = false
                    toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
                }
            } catch (e: Exception) {
                ultimoMensaje = "Error de conexión"
                alumnoRegistrado = null
                esExito = false
            }

            delay(3500)
            ultimoMensaje = "Coloca tu código QR frente a la cámara"
            alumnoRegistrado = null
            esExito = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(top = 16.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = IosBlueLight,
                modifier = Modifier.size(56.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.School,
                        contentDescription = null,
                        tint = IosBlue,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Modo Kiosco Escolar",
                fontSize = 24.sp,
                color = IosTextPrimary,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Registro automático de entrada y salida",
                fontSize = 14.sp,
                color = IosTextSecondary
            )
        }

        Box(
            modifier = Modifier
                .size(300.dp)
                .padding(vertical = 12.dp)
        ) {
            QRCodeScannerView(
                modifier = Modifier.fillMaxSize(),
                onQrScanned = { qr -> procesarQR(qr) }
            )
        }

        Surface(
            shape = RoundedCornerShape(18.dp),
            color = if (esExito) IosGreenBadgeBg else IosCardWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 70.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (esExito) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = IosGreenBadgeText,
                        modifier = Modifier.size(36.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                }

                Text(
                    text = ultimoMensaje,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (esExito) IosGreenBadgeText else IosTextPrimary,
                    textAlign = TextAlign.Center
                )

                if (alumnoRegistrado != null) {
                    Text(
                        text = alumnoRegistrado!!,
                        fontSize = 14.sp,
                        color = IosTextSecondary,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
