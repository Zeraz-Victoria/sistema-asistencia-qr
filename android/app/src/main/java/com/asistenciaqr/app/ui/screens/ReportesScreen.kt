package com.asistenciaqr.app.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.ClaseGrupo
import com.asistenciaqr.app.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ReportesScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var clases by remember { mutableStateOf<List<ClaseGrupo>>(emptyList()) }
    var claseSeleccionadaId by remember { mutableStateOf<Int?>(null) }
    var descargandoAsistencia by remember { mutableStateOf(false) }
    var descargandoTareas by remember { mutableStateOf(false) }

    var mostrandoSelectorClase by remember { mutableStateOf(false) }

    val periodoTexto = remember {
        val sdf = SimpleDateFormat("MMMM 'de' yyyy", Locale("es", "MX"))
        sdf.format(Date()).lowercase()
    }

    val parametroMes = remember {
        val sdf = SimpleDateFormat("yyyy-MM", Locale.US)
        sdf.format(Date())
    }

    val nombreClaseSeleccionada = remember(clases, claseSeleccionadaId) {
        val match = clases.firstOrNull { it.id == claseSeleccionadaId }
        if (match != null) {
            match.nombre ?: "${match.nombreGrado ?: match.grado ?: ""} \"${match.nombreGrupo ?: match.grupo ?: ""}\"".trim()
        } else if (clases.isNotEmpty()) {
            val c = clases.first()
            claseSeleccionadaId = c.id
            c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} \"${c.nombreGrupo ?: c.grupo ?: ""}\"".trim()
        } else {
            "-- Seleccionar Clase --"
        }
    }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.obtenerClases()
                if (res.isSuccessful) {
                    val lista = res.body() ?: emptyList()
                    clases = lista
                    if (lista.isNotEmpty() && claseSeleccionadaId == null) {
                        claseSeleccionadaId = lista.first().id
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun descargarYVisualizarPDF(endpoint: String, nombreArchivo: String, esAsistencia: Boolean) {
        coroutineScope.launch {
            if (esAsistencia) descargandoAsistencia = true else descargandoTareas = true
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.descargarPDF(endpoint)
                if (res.isSuccessful && res.body() != null) {
                    val file = File(context.cacheDir, nombreArchivo)
                    withContext(Dispatchers.IO) {
                        val inputStream = res.body()!!.byteStream()
                        val outputStream = FileOutputStream(file)
                        inputStream.copyTo(outputStream)
                        outputStream.close()
                        inputStream.close()
                    }

                    val uri: Uri = FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.provider",
                        file
                    )
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(intent, "Abrir Reporte Oficial"))
                } else {
                    Toast.makeText(context, "No se pudo generar el reporte", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                if (esAsistencia) descargandoAsistencia = false else descargandoTareas = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
            .padding(horizontal = 16.dp)
    ) {
        // Título Centrado idéntico a iOS
        Text(
            text = "Reportes",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = IosTextPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, bottom = 24.dp)
        )

        // Tarjeta Blanca Principal de Descarga de Reportes Oficiales
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)
            ) {
                // Encabezado de la Tarjeta con Icono Verde
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Article,
                        contentDescription = null,
                        tint = Color(0xFF0A5C36),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Descarga de Reportes Oficiales",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = IosTextPrimary
                    )
                }

                // Campo: Periodo (Mes y Año)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Periodo (Mes y Año)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1E293B)
                    )
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = IosCardWhite,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(10.dp))
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = periodoTexto,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF1E293B)
                            )
                        }
                    }
                }

                // Campo: Clase / Grupo
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Clase / Grupo",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1E293B)
                    )
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = IosCardWhite,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .border(1.dp, Color(0xFFCBD5E1), RoundedCornerShape(10.dp))
                            .clickable { mostrandoSelectorClase = true }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = nombreClaseSeleccionada,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF1E293B)
                            )
                            Icon(
                                imageVector = Icons.Default.UnfoldMore,
                                contentDescription = null,
                                tint = Color(0xFF64748B),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Botón 1: Reporte de Asistencia (PDF) - Verde Oscuro Oficial
                Button(
                    onClick = {
                        val cid = claseSeleccionadaId ?: 0
                        descargarYVisualizarPDF(
                            endpoint = "reporte/pdf_detallado?mes=$parametroMes&clase_id=$cid",
                            nombreArchivo = "Reporte_Asistencia_$parametroMes.pdf",
                            esAsistencia = true
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0A5C36)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    if (descargandoAsistencia) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Description, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Reporte de Asistencia (PDF)",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }

                // Botón 2: Reporte de Tareas (PDF) - Azul Oficial
                Button(
                    onClick = {
                        val cid = claseSeleccionadaId ?: 0
                        descargarYVisualizarPDF(
                            endpoint = "reporte/pdf_tareas?mes=$parametroMes&clase_id=$cid",
                            nombreArchivo = "Reporte_Tareas_$parametroMes.pdf",
                            esAsistencia = false
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF007AFF)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                ) {
                    if (descargandoTareas) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Verified, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Reporte de Tareas (PDF)",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }
        }
    }

    if (mostrandoSelectorClase) {
        AlertDialog(
            onDismissRequest = { mostrandoSelectorClase = false },
            title = { Text("Seleccionar Clase / Grupo", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    clases.forEach { c ->
                        val nom = c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} \"${c.nombreGrupo ?: c.grupo ?: ""}\"".trim()
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    claseSeleccionadaId = c.id
                                    mostrandoSelectorClase = false
                                }
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(nom, fontSize = 16.sp, color = IosTextPrimary)
                            if (claseSeleccionadaId == c.id) {
                                Icon(Icons.Default.Verified, contentDescription = null, tint = IosBlue)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { mostrandoSelectorClase = false }) {
                    Text("Cerrar", color = Color(0xFF0A5C36))
                }
            },
            containerColor = IosCardWhite
        )
    }
}
