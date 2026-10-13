package com.asistenciaqr.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.asistenciaqr.app.data.repository.AuthManager
import com.asistenciaqr.app.ui.screens.LoginScreen
import com.asistenciaqr.app.ui.screens.MainScreen
import com.asistenciaqr.app.ui.theme.AsistenciaQRTheme
import com.asistenciaqr.app.ui.theme.IosBackground
import com.asistenciaqr.app.ui.theme.IosGreenDark
import com.asistenciaqr.app.ui.theme.IosTextPrimary
import com.asistenciaqr.app.ui.theme.IosTextSecondary

class MainActivity : ComponentActivity() {

    private val authManager by lazy { AuthManager.getInstance(this) }
    private var hasCameraPermission by mutableStateOf(false)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        hasCameraPermission = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCameraPermission) {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }

        setContent {
            AsistenciaQRTheme {
                var estaLogueado by remember { mutableStateOf(authManager.estaAutenticado) }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = IosBackground
                ) {
                    if (!hasCameraPermission) {
                        PermisoCamaraScreen {
                            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    } else if (estaLogueado) {
                        MainScreen(
                            onCerrarSesion = {
                                estaLogueado = false
                            }
                        )
                    } else {
                        LoginScreen(
                            onLoginSuccess = {
                                estaLogueado = true
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PermisoCamaraScreen(onSolicitarPermiso: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.CameraAlt,
            contentDescription = null,
            tint = Color(0xFF046A38),
            modifier = Modifier.size(72.dp)
        )

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = "Permiso de Cámara Requerido",
            color = IosTextPrimary,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = "La aplicación requiere acceso a la cámara para escanear las credenciales QR de los alumnos.",
            color = IosTextSecondary,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(28.dp))

        Button(
            onClick = onSolicitarPermiso,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF046A38))
        ) {
            Text("Conceder Permiso", color = Color.White)
        }
    }
}
