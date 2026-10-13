package com.asistenciaqr.app.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val IosColorScheme = lightColorScheme(
    primary = IosGreenDark,
    secondary = IosBlue,
    background = IosBackground,
    surface = IosCardWhite,
    onPrimary = IosCardWhite,
    onSecondary = IosCardWhite,
    onBackground = IosTextPrimary,
    onSurface = IosTextPrimary
)

@Composable
fun AsistenciaQRTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = IosColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = IosBackground.toArgb()
            // Iconos oscuros en la barra de estado superior (batería, hora, wifi)
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = true
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
