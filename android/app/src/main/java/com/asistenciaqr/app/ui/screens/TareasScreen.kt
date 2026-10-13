package com.asistenciaqr.app.ui.screens

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.asistenciaqr.app.camera.QRCodeScannerView
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.*
import com.asistenciaqr.app.ui.theme.*
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

@Composable
fun TareasScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var actividades by remember { mutableStateOf<List<Actividad>>(emptyList()) }
    var actividadSeleccionadaId by remember { mutableStateOf<Int?>(null) }
    var entregas by remember { mutableStateOf<List<EntregaActividad>>(emptyList()) }
    var alumnos by remember { mutableStateOf<List<Alumno>>(emptyList()) }
    var clases by remember { mutableStateOf<List<ClaseGrupo>>(emptyList()) }

    var cargando by remember { mutableStateOf(true) }
    var mostrandoSelectorTareas by remember { mutableStateOf(false) }
    var mostrandoEscanearQR by remember { mutableStateOf(false) }
    var mostrandoNuevaTarea by remember { mutableStateOf(false) }
    var generandoPDF by remember { mutableStateOf(false) }

    fun descargarPdfTarea(act: Actividad) {
        if (generandoPDF) return
        generandoPDF = true
        Toast.makeText(context, "Generando PDF de la tarea...", Toast.LENGTH_SHORT).show()
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val cParam = if (act.claseId != null && act.claseId > 0) "&clase_id=${act.claseId}" else ""
                val endpoint = "reporte/pdf_tareas?actividad_id=${act.id}$cParam"
                val res = api.descargarPDF(endpoint)
                if (res.isSuccessful && res.body() != null) {
                    val file = File(context.cacheDir, "Reporte_Tarea_${act.id}.pdf")
                    withContext(Dispatchers.IO) {
                        val inputStream = res.body()!!.byteStream()
                        val outputStream = FileOutputStream(file)
                        inputStream.copyTo(outputStream)
                        outputStream.close()
                        inputStream.close()
                    }
                    val uri: Uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/pdf")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(Intent.createChooser(intent, "Reporte de Tarea"))
                } else {
                    Toast.makeText(context, "No se pudo generar el reporte", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                generandoPDF = false
            }
        }
    }

    val actividadActual = remember(actividades, actividadSeleccionadaId) {
        actividades.firstOrNull { it.id == actividadSeleccionadaId }
    }

    val alumnosParaTarea = remember(alumnos, actividadActual) {
        val cId = actividadActual?.claseId
        if (cId == null) alumnos
        else alumnos.filter { it.claseId == cId }
    }

    val entregasSet = remember(entregas) {
        entregas.map { it.alumnoId }.toSet()
    }

    val conteoEntregadas = remember(alumnosParaTarea, entregasSet) {
        alumnosParaTarea.count { entregasSet.contains(it.id) }
    }

    val porcentaje = remember(alumnosParaTarea, conteoEntregadas) {
        if (alumnosParaTarea.isEmpty()) 0f
        else conteoEntregadas.toFloat() / alumnosParaTarea.size.toFloat()
    }

    val nombreGrupo = remember(clases, actividadActual) {
        val cId = actividadActual?.claseId ?: return@remember "Toda la Escuela"
        clases.firstOrNull { it.id == cId }?.let {
            it.nombre ?: "${it.nombreGrado ?: it.grado ?: ""} ${it.nombreGrupo ?: it.grupo ?: ""}".trim()
        } ?: "Grupo #$cId"
    }

    fun cargarEntregas(actId: Int) {
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.obtenerEntregasActividad(actId)
                if (res.isSuccessful) entregas = res.body() ?: emptyList()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun cargarDatos() {
        coroutineScope.launch {
            cargando = true
            try {
                val api = RetrofitClient.getApiService(context)
                val resAct = api.obtenerActividades()
                if (resAct.isSuccessful) {
                    val lista = resAct.body() ?: emptyList()
                    actividades = lista
                    if (actividadSeleccionadaId == null && lista.isNotEmpty()) {
                        actividadSeleccionadaId = lista.first().id
                        cargarEntregas(lista.first().id)
                    }
                }
                val resAlu = api.obtenerAlumnos()
                if (resAlu.isSuccessful) alumnos = resAlu.body() ?: emptyList()

                val resClases = api.obtenerClases()
                if (resClases.isSuccessful) clases = resClases.body() ?: emptyList()
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                cargando = false
            }
        }
    }

    LaunchedEffect(Unit) {
        cargarDatos()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
    ) {
        // Barra Superior: Título y Botones de Acción
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, start = 16.dp, end = 16.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Tareas",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = IosTextPrimary,
                modifier = Modifier.weight(1f)
            )

            // Cápsula superior de botones de acción
            Surface(
                shape = CircleShape,
                color = IosCardWhite,
                modifier = Modifier
                    .height(42.dp)
                    .border(1.dp, IosBorder, CircleShape)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    if (actividadActual != null) {
                        IconButton(
                            onClick = { mostrandoEscanearQR = true },
                            modifier = Modifier.size(34.dp)
                        ) {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = "Escanear QR", tint = IosGreenDark, modifier = Modifier.size(19.dp))
                        }
                        IconButton(
                            onClick = { descargarPdfTarea(actividadActual) },
                            enabled = !generandoPDF,
                            modifier = Modifier.size(34.dp)
                        ) {
                            if (generandoPDF) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = IosGreenDark, strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.FileDownload, contentDescription = "PDF", tint = IosGreenDark, modifier = Modifier.size(19.dp))
                            }
                        }
                        IconButton(
                            onClick = {
                                coroutineScope.launch {
                                    val api = RetrofitClient.getApiService(context)
                                    api.borrarActividad(actividadActual.id)
                                    actividadSeleccionadaId = null
                                    cargarDatos()
                                    Toast.makeText(context, "Tarea eliminada", Toast.LENGTH_SHORT).show()
                                }
                            },
                            modifier = Modifier.size(34.dp)
                        ) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "Borrar", tint = IosRed, modifier = Modifier.size(19.dp))
                        }
                    }

                    // Botón "+" para crear nueva tarea (Destacado en círculo verde)
                    IconButton(
                        onClick = { mostrandoNuevaTarea = true },
                        modifier = Modifier
                            .size(34.dp)
                            .background(IosGreenDark.copy(alpha = 0.12f), CircleShape)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Nueva Tarea", tint = IosGreenDark, modifier = Modifier.size(22.dp))
                    }
                }
            }
        }

        // Selector de Tarea
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = IosCardWhite,
                modifier = Modifier
                    .clickable { mostrandoSelectorTareas = true }
                    .border(1.dp, IosBorder, RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = actividadActual?.titulo ?: "Seleccionar Tarea",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = IosGreenDark
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        imageVector = Icons.Default.UnfoldMore,
                        contentDescription = null,
                        tint = IosGreenDark,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // Badge de Grupo Asignado
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp, bottom = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = CircleShape,
                color = IosBlueLight,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.People, contentDescription = null, tint = IosBlue, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = nombreGrupo,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = IosBlue
                    )
                }
            }
        }

        // Barra de Progreso y Métricas
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 4.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "$conteoEntregadas de ${alumnosParaTarea.size} Alumnos",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = IosTextPrimary
                )
                Text(
                    text = "${(porcentaje * 100).toInt()}% Entregadas",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = IosBlue
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            LinearProgressIndicator(
                progress = { porcentaje },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = Color(0xFF10B981),
                trackColor = IosBorder
            )
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Lista de Alumnos con diseño iOS
        Surface(
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = IosCardWhite,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 100.dp)
            ) {
                items(alumnosParaTarea, key = { it.id }) { alumno ->
                    val entregada = entregasSet.contains(alumno.id)

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = alumno.nombreCompleto,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = IosTextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = alumno.obtenerGrupo(clases),
                                fontSize = 13.sp,
                                color = IosTextSecondary
                            )
                        }

                        // Cápsula de estado de entrega
                        Surface(
                            shape = CircleShape,
                            color = if (entregada) IosGreenBadgeBg else IosOrangeBadgeBg,
                            modifier = Modifier.clickable {
                                if (actividadActual != null) {
                                    coroutineScope.launch {
                                        val api = RetrofitClient.getApiService(context)
                                        api.toggleEntregaActividad(
                                            ToggleEntregaRequest(actividadId = actividadActual.id, alumnoId = alumno.id)
                                        )
                                        cargarEntregas(actividadActual.id)
                                    }
                                }
                            }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = if (entregada) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                    contentDescription = null,
                                    tint = if (entregada) IosGreenBadgeText else IosOrangeBadgeText,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (entregada) "Entregada" else "Pendiente",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (entregada) IosGreenBadgeText else IosOrangeBadgeText
                                )
                            }
                        }
                    }

                    HorizontalDivider(color = IosDivider, thickness = 1.dp)
                }
            }
        }
    }

    // Modal para seleccionar tarea
    if (mostrandoSelectorTareas) {
        AlertDialog(
            onDismissRequest = { mostrandoSelectorTareas = false },
            title = { Text("Seleccionar Tarea", fontWeight = FontWeight.Bold) },
            text = {
                LazyColumn {
                    items(actividades) { act ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    actividadSeleccionadaId = act.id
                                    cargarEntregas(act.id)
                                    mostrandoSelectorTareas = false
                                }
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(act.titulo, fontSize = 16.sp, color = IosTextPrimary)
                            if (act.id == actividadSeleccionadaId) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = IosGreenDark)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { mostrandoSelectorTareas = false }) {
                    Text("Cerrar", color = IosGreenDark)
                }
            },
            containerColor = IosCardWhite
        )
    }

    // Modal para CREAR NUEVA TAREA (idéntico al de iOS)
    if (mostrandoNuevaTarea) {
        NuevaTareaDialog(
            clases = clases,
            onDismiss = { mostrandoNuevaTarea = false },
            onTareaCreada = { nuevaActId ->
                mostrandoNuevaTarea = false
                cargarDatos()
                if (nuevaActId != null) {
                    actividadSeleccionadaId = nuevaActId
                    cargarEntregas(nuevaActId)
                }
            }
        )
    }

    // Escáner QR de Tarea en Modal Completo (Permanente, no se cierra hasta que el docente decida)
    if (mostrandoEscanearQR && actividadActual != null) {
        EscanearEntregaTareaDialog(
            actividad = actividadActual,
            alumnosParaTarea = alumnosParaTarea,
            todosLosAlumnos = alumnos,
            nombreGrupoTarea = nombreGrupo,
            entregasSet = entregasSet,
            onEntregaRegistrada = {
                cargarEntregas(actividadActual.id)
            },
            onDismiss = {
                mostrandoEscanearQR = false
            }
        )
    }
}

// Modal Nueva Tarea (Réplica exacta de iOS Screenshot 2)
@Composable
fun NuevaTareaDialog(
    clases: List<ClaseGrupo>,
    onDismiss: () -> Unit,
    onTareaCreada: (Int?) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var titulo by remember { mutableStateOf("") }
    var descripcion by remember { mutableStateOf("") }
    var claseIdSeleccionada by remember { mutableStateOf<Int?>(null) }
    var guardando by remember { mutableStateOf(false) }
    var mostrandoSelectorGrupo by remember { mutableStateOf(false) }

    val nombreGrupoTexto = remember(clases, claseIdSeleccionada) {
        if (claseIdSeleccionada == null) "Todas las clases"
        else {
            val c = clases.firstOrNull { it.id == claseIdSeleccionada }
            c?.nombre ?: "${c?.nombreGrado ?: c?.grado ?: ""} \"${c?.nombreGrupo ?: c?.grupo ?: ""}\"".trim()
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = IosBackground,
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.92f)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                // Barra Superior: Cancelar | Nueva Tarea | Guardar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Botón Cancelar (Cápsula blanca con borde)
                    Surface(
                        shape = CircleShape,
                        color = IosCardWhite,
                        modifier = Modifier
                            .border(1.dp, IosBorder, CircleShape)
                            .clickable { onDismiss() }
                    ) {
                        Text(
                            text = "Cancelar",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF046A38),
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }

                    // Título Central
                    Text(
                        text = "Nueva Tarea",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = IosTextPrimary
                    )

                    // Botón Guardar (Cápsula blanca con borde)
                    val puedeGuardar = titulo.trim().isNotBlank() && !guardando
                    Surface(
                        shape = CircleShape,
                        color = IosCardWhite,
                        modifier = Modifier
                            .border(1.dp, IosBorder, CircleShape)
                            .clickable(enabled = puedeGuardar) {
                                guardando = true
                                coroutineScope.launch {
                                    try {
                                        val api = RetrofitClient.getApiService(context)
                                        val res = api.crearActividad(
                                            CrearActividadRequest(
                                                titulo = titulo.trim(),
                                                descripcion = descripcion.trim().ifEmpty { null },
                                                claseId = claseIdSeleccionada
                                            )
                                        )
                                        if (res.isSuccessful) {
                                            val nuevaId = res.body()?.id
                                            Toast.makeText(context, "¡Tarea creada con éxito!", Toast.LENGTH_SHORT).show()
                                            onTareaCreada(nuevaId)
                                        } else {
                                            Toast.makeText(context, "No se pudo crear la tarea", Toast.LENGTH_SHORT).show()
                                        }
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                                    } finally {
                                        guardando = false
                                    }
                                }
                            }
                    ) {
                        Text(
                            text = if (guardando) "..." else "Guardar",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = if (puedeGuardar) Color(0xFF046A38) else Color(0xFF94A3B8),
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // SECCIÓN 1: Información de la Tarea
                Text(
                    text = "Información de la Tarea",
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
                        BasicTextField(
                            value = titulo,
                            onValueChange = { titulo = it },
                            textStyle = TextStyle(fontSize = 16.sp, color = IosTextPrimary),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 14.dp),
                            decorationBox = { innerTextField ->
                                if (titulo.isEmpty()) {
                                    Text("Título de la tarea o actividad", fontSize = 16.sp, color = Color(0xFF94A3B8))
                                }
                                innerTextField()
                            }
                        )

                        HorizontalDivider(color = IosDivider, thickness = 1.dp)

                        BasicTextField(
                            value = descripcion,
                            onValueChange = { descripcion = it },
                            textStyle = TextStyle(fontSize = 16.sp, color = IosTextPrimary),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 14.dp),
                            decorationBox = { innerTextField ->
                                if (descripcion.isEmpty()) {
                                    Text("Descripción o instrucciones (opcional)", fontSize = 16.sp, color = Color(0xFF94A3B8))
                                }
                                innerTextField()
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // SECCIÓN 2: Asignar a Grupo
                Text(
                    text = "Asignar a Grupo",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF64748B),
                    modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                )

                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = IosCardWhite,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { mostrandoSelectorGrupo = true }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Grupo",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            color = IosTextPrimary
                        )

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = nombreGrupoTexto,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF046A38)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = Icons.Default.UnfoldMore,
                                contentDescription = null,
                                tint = Color(0xFF046A38),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }
    }

    if (mostrandoSelectorGrupo) {
        AlertDialog(
            onDismissRequest = { mostrandoSelectorGrupo = false },
            title = { Text("Asignar a Grupo", fontWeight = FontWeight.Bold) },
            text = {
                LazyColumn {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    claseIdSeleccionada = null
                                    mostrandoSelectorGrupo = false
                                }
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Todas las clases", fontSize = 16.sp, color = IosTextPrimary)
                            if (claseIdSeleccionada == null) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = IosGreenDark)
                            }
                        }
                        HorizontalDivider(color = IosDivider)
                    }

                    items(clases) { c ->
                        val nom = c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} \"${c.nombreGrupo ?: c.grupo ?: ""}\"".trim()
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    claseIdSeleccionada = c.id
                                    mostrandoSelectorGrupo = false
                                }
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(nom, fontSize = 16.sp, color = IosTextPrimary)
                            if (claseIdSeleccionada == c.id) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = IosGreenDark)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { mostrandoSelectorGrupo = false }) {
                    Text("Cerrar", color = IosGreenDark)
                }
            },
            containerColor = IosCardWhite
        )
    }
}

// Escáner Continuo de Tareas (Réplica de iOS EscanearEntregaTareaSheet)
// La cámara NO se cierra tras escanear; valida grupo y duplicados con feedback sonoro y visual.
@Composable
fun EscanearEntregaTareaDialog(
    actividad: Actividad,
    alumnosParaTarea: List<Alumno>,
    todosLosAlumnos: List<Alumno>,
    nombreGrupoTarea: String,
    entregasSet: Set<Int>,
    onEntregaRegistrada: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var procesando by remember { mutableStateOf(false) }
    var ultimoCodigo by remember { mutableStateOf("") }
    var mensajeBanner by remember { mutableStateOf<String?>(null) }
    var tipoBanner by remember { mutableStateOf("success") } // "success", "warning", "error"

    val toneGenerator = remember {
        try { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100) } catch (e: Exception) { null }
    }
    val vibrator = remember {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            context.getSystemService(Vibrator::class.java)
        } else null
    }

    fun vibrarYSonar(exito: Boolean) {
        try {
            if (exito) {
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(100)
                }
            } else {
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 80, 80, 80), -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(150)
                }
            }
        } catch (e: Exception) { }
    }

    fun procesarEscaneo(qrRaw: String) {
        val code = qrRaw.trim()
        if (code.isBlank() || procesando || code == ultimoCodigo) return
        procesando = true
        ultimoCodigo = code

        // 1. Buscar alumno en la base local para validaciones inmediatas
        val alumnoEncontrado = todosLosAlumnos.firstOrNull {
            it.codigoQr?.trim().equals(code, ignoreCase = true) ||
            it.nfcUid?.trim().equals(code, ignoreCase = true)
        }

        // 2. Validación de Grupo: ¿Pertenece este alumno al grupo de esta tarea?
        if (actividad.claseId != null && actividad.claseId > 0 && alumnoEncontrado != null) {
            val pertenece = alumnosParaTarea.any { it.id == alumnoEncontrado.id }
            if (!pertenece) {
                tipoBanner = "error"
                mensajeBanner = "❌ ${alumnoEncontrado.nombreCompleto ?: "Este alumno"} no pertenece a este grupo."
                vibrarYSonar(false)
                coroutineScope.launch {
                    delay(2000)
                    mensajeBanner = null
                    procesando = false
                    ultimoCodigo = ""
                }
                return
            }
        }

        // 3. Validación de Duplicado: ¿Ya entregó esta tarea anteriormente?
        if (alumnoEncontrado != null && entregasSet.contains(alumnoEncontrado.id)) {
            tipoBanner = "warning"
            mensajeBanner = "⚠️ ${alumnoEncontrado.nombreCompleto ?: "El alumno"} ya registró esta tarea."
            vibrarYSonar(false)
            coroutineScope.launch {
                delay(2000)
                mensajeBanner = null
                procesando = false
                ultimoCodigo = ""
            }
            return
        }

        // 4. Registro en el Servidor (la cámara NO se cierra)
        coroutineScope.launch {
            try {
                val api = RetrofitClient.getApiService(context)
                val res = api.marcarEntregaActividadConQR(
                    MarcarEntregaQRRequest(codigoQr = code, uid = code, actividadId = actividad.id)
                )
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    if (body.status == "warning") {
                        tipoBanner = "warning"
                        mensajeBanner = body.message ?: "⚠️ El alumno ya registró esta tarea."
                        vibrarYSonar(false)
                    } else {
                        tipoBanner = "success"
                        mensajeBanner = body.message ?: "✅ Tarea entregada con éxito"
                        vibrarYSonar(true)
                        onEntregaRegistrada()
                    }
                } else {
                    val errorJson = res.errorBody()?.string()
                    val errorMsg = try {
                        val obj = JSONObject(errorJson ?: "")
                        obj.optString("message", obj.optString("error", "Este alumno no pertenece a este grupo."))
                    } catch (e: Exception) {
                        "Este alumno no pertenece a este grupo."
                    }
                    tipoBanner = "error"
                    mensajeBanner = "❌ $errorMsg"
                    vibrarYSonar(false)
                }
            } catch (e: Exception) {
                tipoBanner = "error"
                mensajeBanner = "❌ Error: ${e.localizedMessage ?: "No se pudo conectar"}"
                vibrarYSonar(false)
            } finally {
                delay(2000)
                mensajeBanner = null
                procesando = false
                ultimoCodigo = ""
            }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
        ) {
            // Cámara a pantalla completa: Permanece activa continuamente
            QRCodeScannerView(
                modifier = Modifier.fillMaxSize(),
                onQrScanned = { qr ->
                    procesarEscaneo(qr)
                }
            )

            // Barra Superior Flotante: Botón "Listo" e Información de Tarea
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 44.dp, start = 16.dp, end = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.55f),
                    modifier = Modifier.clickable { onDismiss() }
                ) {
                    Text(
                        text = "Listo",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp)
                    )
                }

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color.Black.copy(alpha = 0.55f),
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = actividad.titulo,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1
                        )
                        Text(
                            text = "Grupo: $nombreGrupoTarea",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                }
            }

            // Marco visor de escaneo con gradiente verde estilo iOS
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(260.dp)
                    .border(
                        width = 3.dp,
                        brush = Brush.linearGradient(
                            colors = listOf(
                                Color(0xFF34C759),
                                Color(0xFF30D158)
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
                    tint = Color.White.copy(alpha = 0.35f),
                    modifier = Modifier.size(54.dp)
                )
            }

            // Banner flotante de retroalimentación (Éxito, Ya registrado, o No pertenece)
            AnimatedVisibility(
                visible = mensajeBanner != null,
                enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 20.dp, vertical = 36.dp)
            ) {
                val bg = when (tipoBanner) {
                    "warning" -> Color(0xFFF59E0B) // Ámbar/Naranja
                    "error" -> Color(0xFFDC2626)   // Rojo
                    else -> Color(0xFF16A34A)      // Verde
                }
                val icon = when (tipoBanner) {
                    "warning" -> Icons.Default.Warning
                    "error" -> Icons.Default.Close
                    else -> Icons.Default.CheckCircle
                }

                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = bg,
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = mensajeBanner ?: "",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            lineHeight = 19.sp
                        )
                    }
                }
            }
        }
    }
}
