package com.asistenciaqr.app.ui.screens

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.content.FileProvider
import com.asistenciaqr.app.data.api.RetrofitClient
import com.asistenciaqr.app.data.models.Alumno
import com.asistenciaqr.app.data.models.ClaseGrupo
import com.asistenciaqr.app.data.repository.AuthManager
import com.asistenciaqr.app.ui.theme.*
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

@Composable
fun AlumnosScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val usuario = authManager.usuario

    var alumnos by remember { mutableStateOf<List<Alumno>>(emptyList()) }
    var clases by remember { mutableStateOf<List<ClaseGrupo>>(emptyList()) }
    var cargando by remember { mutableStateOf(true) }

    var textoBusqueda by remember { mutableStateOf("") }
    var filtroClaseId by remember { mutableStateOf<Int?>(null) } // null = todas

    var alumnoSeleccionadoQR by remember { mutableStateOf<Alumno?>(null) }
    var alumnoAEditar by remember { mutableStateOf<Alumno?>(null) }
    var mostrandoMenuAcciones by remember { mutableStateOf(false) }

    var mostrandoNuevoAlumno by remember { mutableStateOf(false) }
    var mostrandoCrearGrupo by remember { mutableStateOf(false) }
    var mostrandoGestionarGrupos by remember { mutableStateOf(false) }
    var generandoPDF by remember { mutableStateOf(false) }

    fun cargarDatos() {
        coroutineScope.launch {
            cargando = true
            try {
                val api = RetrofitClient.getApiService(context)
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

    fun descargarCredencialesPDF() {
        val lista = if (filtroClaseId != null) {
            alumnos.filter { it.claseId == filtroClaseId }
        } else {
            alumnos
        }
        if (lista.isEmpty()) {
            Toast.makeText(context, "No hay alumnos para exportar credenciales", Toast.LENGTH_SHORT).show()
            return
        }

        generandoPDF = true
        coroutineScope.launch {
            try {
                val file = withContext(Dispatchers.IO) {
                    generarPdfCredenciales(
                        context = context,
                        alumnos = lista,
                        clases = clases,
                        nombreEscuela = usuario?.nombreEscuela ?: "AsistenciaQR"
                    )
                }
                generandoPDF = false
                abrirPDF(context, file)
            } catch (e: Exception) {
                generandoPDF = false
                Toast.makeText(context, "Error al generar credenciales: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val alumnosFiltrados = remember(alumnos, filtroClaseId, textoBusqueda) {
        var res = alumnos
        if (filtroClaseId != null) {
            res = res.filter { it.claseId == filtroClaseId }
        }
        if (textoBusqueda.isNotBlank()) {
            val q = textoBusqueda.trim().lowercase()
            res = res.filter {
                it.nombreCompleto.lowercase().contains(q) ||
                (it.codigoQr?.lowercase()?.contains(q) == true) ||
                it.obtenerGrupo(clases).lowercase().contains(q)
            }
        }
        res
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(IosBackground)
    ) {
        // Barra Superior: Botón Credenciales y Botón (+) con Menú Desplegable idéntico a iOS
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp, start = 20.dp, end = 20.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Botón Cápsula "Credenciales" (Verde Institucional)
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFFE8F8F2),
                modifier = Modifier
                    .clickable { descargarCredencialesPDF() }
                    .border(1.dp, Color(0xFFA7F3D0), RoundedCornerShape(10.dp))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Badge,
                        contentDescription = null,
                        tint = Color(0xFF046A38),
                        modifier = Modifier.size(17.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (generandoPDF) "Generando..." else "Credenciales",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF046A38)
                    )
                }
            }

            // Botón (+) Circular con Menú Desplegable
            Box {
                Surface(
                    shape = CircleShape,
                    color = IosCardWhite,
                    modifier = Modifier
                        .size(40.dp)
                        .border(1.dp, IosBorder, CircleShape)
                        .clickable { mostrandoMenuAcciones = true }
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Opciones",
                            tint = Color(0xFF046A38),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                DropdownMenu(
                    expanded = mostrandoMenuAcciones,
                    onDismissRequest = { mostrandoMenuAcciones = false },
                    modifier = Modifier.background(IosCardWhite)
                ) {
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Print, contentDescription = null, tint = IosGreenDark, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(12.dp))
                                Text("Descargar Todas las Credenciales (PDF)", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        },
                        onClick = {
                            mostrandoMenuAcciones = false
                            descargarCredencialesPDF()
                        }
                    )
                    HorizontalDivider(color = IosDivider)
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PersonAdd, contentDescription = null, tint = IosGreenDark, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(12.dp))
                                Text("Nuevo Alumno", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        },
                        onClick = {
                            mostrandoMenuAcciones = false
                            mostrandoNuevoAlumno = true
                        }
                    )
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PostAdd, contentDescription = null, tint = IosGreenDark, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(12.dp))
                                Text("Crear Grupo / Grado", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        },
                        onClick = {
                            mostrandoMenuAcciones = false
                            mostrandoCrearGrupo = true
                        }
                    )
                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.FolderSpecial, contentDescription = null, tint = IosGreenDark, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(12.dp))
                                Text("Gestionar / Eliminar Grupos", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            }
                        },
                        onClick = {
                            mostrandoMenuAcciones = false
                            mostrandoGestionarGrupos = true
                        }
                    )
                }
            }
        }

        // Título Grande: Alumnos
        Text(
            text = "Alumnos",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = IosTextPrimary,
            modifier = Modifier.padding(start = 20.dp, top = 4.dp, bottom = 10.dp)
        )

        // Filtro rápido de Grupos horizontal estilo cápsulas iOS
        if (clases.isNotEmpty()) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    val seleccionado = filtroClaseId == null
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (seleccionado) IosBlue else IosCardWhite,
                        modifier = Modifier
                            .clickable { filtroClaseId = null }
                            .border(1.dp, if (seleccionado) IosBlue else IosBorder, RoundedCornerShape(16.dp))
                    ) {
                        Text(
                            text = "Todos (${alumnos.size})",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (seleccionado) Color.White else IosTextPrimary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                        )
                    }
                }
                items(clases, key = { it.id }) { c ->
                    val seleccionado = filtroClaseId == c.id
                    val count = alumnos.count { it.claseId == c.id }
                    val nombreGrupo = c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} ${c.nombreGrupo ?: c.grupo ?: ""}".trim()
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (seleccionado) IosBlue else IosCardWhite,
                        modifier = Modifier
                            .clickable { filtroClaseId = c.id }
                            .border(1.dp, if (seleccionado) IosBlue else IosBorder, RoundedCornerShape(16.dp))
                    ) {
                        Text(
                            text = "$nombreGrupo ($count)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (seleccionado) Color.White else IosTextPrimary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
        }

        // Barra de Búsqueda
        OutlinedTextField(
            value = textoBusqueda,
            onValueChange = { textoBusqueda = it },
            placeholder = { Text("Buscar alumno...", color = IosTextSecondary, fontSize = 14.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = IosTextSecondary) },
            trailingIcon = {
                if (textoBusqueda.isNotBlank()) {
                    IconButton(onClick = { textoBusqueda = "" }) {
                        Icon(Icons.Default.Clear, contentDescription = "Limpiar", tint = IosTextSecondary)
                    }
                }
            },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = IosCardWhite,
                unfocusedContainerColor = IosCardWhite,
                focusedBorderColor = IosBlue,
                unfocusedBorderColor = IosBorder
            ),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 6.dp)
                .height(50.dp)
        )

        Spacer(modifier = Modifier.height(6.dp))

        // Lista de Alumnos en Tarjeta Blanca
        Surface(
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            color = IosCardWhite,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            if (cargando) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = IosGreenDark)
                }
            } else if (alumnosFiltrados.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PersonSearch,
                        contentDescription = null,
                        tint = IosTextSecondary,
                        modifier = Modifier.size(56.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = if (textoBusqueda.isNotBlank()) "Sin resultados" else "Sin Alumnos Registrados",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = IosTextPrimary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (textoBusqueda.isNotBlank()) "No se encontraron alumnos para '$textoBusqueda'" else "Presiona el botón (+) arriba para registrar nuevos alumnos.",
                        fontSize = 13.sp,
                        color = IosTextSecondary
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 120.dp)
                ) {
                    items(alumnosFiltrados, key = { it.id }) { alumno ->
                        val iniciales = remember(alumno.nombreCompleto) {
                            val partes = alumno.nombreCompleto.trim().split(" ")
                            if (partes.size >= 2) {
                                "${partes[0].take(1)}${partes[1].take(1)}".uppercase()
                            } else {
                                alumno.nombreCompleto.take(2).uppercase()
                            }
                        }

                        val grupoTexto = remember(alumno, clases) {
                            alumno.obtenerGrupo(clases)
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Avatar con Iniciales (Clickable para editar)
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFEBF5FF),
                                modifier = Modifier
                                    .size(44.dp)
                                    .clickable { alumnoAEditar = alumno }
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = iniciales,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = IosBlue
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(14.dp))

                            // Nombre y Grupo (Clickable para editar)
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { alumnoAEditar = alumno }
                            ) {
                                Text(
                                    text = alumno.nombreCompleto,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = IosTextPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = grupoTexto,
                                        fontSize = 13.sp,
                                        color = IosTextSecondary
                                    )
                                    if (!alumno.codigoQr.isNullOrBlank()) {
                                        Text(
                                            text = " • ${alumno.codigoQr}",
                                            fontSize = 11.sp,
                                            color = Color(0xFF94A3B8)
                                        )
                                    }
                                }
                            }

                            // Botón Editar Alumno (Lápiz)
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFF1F5F9),
                                modifier = Modifier
                                    .size(38.dp)
                                    .clickable { alumnoAEditar = alumno }
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Editar Alumno",
                                        tint = Color(0xFF475569),
                                        modifier = Modifier.size(19.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            // Botón QR individual
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFF1F5F9),
                                modifier = Modifier
                                    .size(38.dp)
                                    .clickable { alumnoSeleccionadoQR = alumno }
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.QrCode,
                                        contentDescription = "Ver QR",
                                        tint = IosBlue,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }

                        HorizontalDivider(color = IosDivider, thickness = 1.dp)
                    }
                }
            }
        }
    }

    // Modal: Ver Credencial QR Individual
    if (alumnoSeleccionadoQR != null) {
        val alu = alumnoSeleccionadoQR!!
        val qrCode = alu.codigoQr ?: "ALUM-${alu.id}"
        val qrBitmap = remember(qrCode) { generarQRBitmap(qrCode, 240) }

        Dialog(onDismissRequest = { alumnoSeleccionadoQR = null }) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = IosCardWhite,
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = "Credencial de Alumno", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = IosTextPrimary)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = alu.nombreCompleto, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = IosBlue)
                    Text(text = alu.obtenerGrupo(clases), fontSize = 13.sp, color = IosTextSecondary)

                    Spacer(modifier = Modifier.height(16.dp))

                    if (qrBitmap != null) {
                        androidx.compose.foundation.Image(
                            bitmap = qrBitmap.asImageBitmap(),
                            contentDescription = "Código QR",
                            modifier = Modifier.size(200.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Text(text = qrCode, fontSize = 12.sp, color = IosTextSecondary)

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = { alumnoSeleccionadoQR = null },
                        colors = ButtonDefaults.buttonColors(containerColor = IosGreenDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Cerrar", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // Modal: Nuevo Alumno
    if (mostrandoNuevoAlumno) {
        DialogNuevoAlumno(
            clases = clases,
            onDismiss = { mostrandoNuevoAlumno = false },
            onGuardado = {
                mostrandoNuevoAlumno = false
                cargarDatos()
            }
        )
    }

    // Modal: Crear Grupo / Grado
    if (mostrandoCrearGrupo) {
        DialogCrearGrupo(
            onDismiss = { mostrandoCrearGrupo = false },
            onGuardado = {
                mostrandoCrearGrupo = false
                cargarDatos()
            }
        )
    }

    // Modal: Gestionar / Eliminar Grupos
    if (mostrandoGestionarGrupos) {
        DialogGestionarGrupos(
            clases = clases,
            alumnos = alumnos,
            onDismiss = { mostrandoGestionarGrupos = false },
            onActualizado = {
                cargarDatos()
            }
        )
    }

    // Modal: Editar Alumno (Modificar nombre o eliminar)
    if (alumnoAEditar != null) {
        DialogEditarAlumno(
            alumno = alumnoAEditar!!,
            clases = clases,
            onDismiss = { alumnoAEditar = null },
            onGuardado = {
                alumnoAEditar = null
                cargarDatos()
            },
            onEliminado = {
                alumnoAEditar = null
                cargarDatos()
            }
        )
    }
}

@Composable
fun DialogNuevoAlumno(
    clases: List<ClaseGrupo>,
    onDismiss: () -> Unit,
    onGuardado: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var nombreCompleto by remember { mutableStateOf("") }
    var claseSeleccionadaId by remember { mutableStateOf(clases.firstOrNull()?.id) }
    var codigoQR by remember { mutableStateOf("ALUM-" + UUID.randomUUID().toString().replace("-", "").take(8).uppercase()) }
    var telefonoTutor by remember { mutableStateOf("") }
    var guardando by remember { mutableStateOf(false) }
    var errorMensaje by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(text = "Nuevo Alumno", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = IosTextPrimary)

                if (errorMensaje != null) {
                    Text(text = errorMensaje ?: "", color = IosRed, fontSize = 13.sp)
                }

                OutlinedTextField(
                    value = nombreCompleto,
                    onValueChange = { nombreCompleto = it; errorMensaje = null },
                    label = { Text("Nombre Completo") },
                    placeholder = { Text("Ej. Juan Pérez López") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                // Selector de Grupo
                if (clases.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    val grupoNombreActual = clases.firstOrNull { it.id == claseSeleccionadaId }?.let {
                        it.nombre ?: "${it.nombreGrado ?: it.grado ?: ""} ${it.nombreGrupo ?: it.grupo ?: ""}".trim()
                    } ?: "Seleccionar Grupo"

                    Box {
                        OutlinedTextField(
                            value = grupoNombreActual,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Grupo / Grado") },
                            trailingIcon = {
                                IconButton(onClick = { expanded = true }) {
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().clickable { expanded = true }
                        )

                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                            modifier = Modifier.background(IosCardWhite)
                        ) {
                            clases.forEach { c ->
                                val nom = c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} ${c.nombreGrupo ?: c.grupo ?: ""}".trim()
                                DropdownMenuItem(
                                    text = { Text(nom) },
                                    onClick = {
                                        claseSeleccionadaId = c.id
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                } else {
                    Text(text = "⚠️ No hay grupos creados. Primero crea un grupo.", color = Color(0xFFD97706), fontSize = 13.sp)
                }

                // Código QR con botón de regenerar
                OutlinedTextField(
                    value = codigoQR,
                    onValueChange = { codigoQR = it },
                    label = { Text("Código QR Identificador") },
                    trailingIcon = {
                        IconButton(onClick = {
                            codigoQR = "ALUM-" + UUID.randomUUID().toString().replace("-", "").take(8).uppercase()
                        }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Regenerar", tint = IosGreenDark)
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = telefonoTutor,
                    onValueChange = { telefonoTutor = it },
                    label = { Text("Teléfono Tutor (Opcional)") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar", color = IosTextSecondary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (nombreCompleto.isBlank()) {
                                errorMensaje = "Ingresa el nombre del alumno."
                                return@Button
                            }
                            if (claseSeleccionadaId == null) {
                                errorMensaje = "Selecciona un grupo para el alumno."
                                return@Button
                            }
                            guardando = true
                            errorMensaje = null

                            coroutineScope.launch {
                                try {
                                    val api = RetrofitClient.getApiService(context)
                                    val res = api.registrarAlumno(
                                        mapOf(
                                            "nombre_completo" to nombreCompleto.trim(),
                                            "codigo_qr" to codigoQR.trim(),
                                            "clase_id" to (claseSeleccionadaId ?: 0),
                                            "telefono_tutor" to telefonoTutor.trim()
                                        )
                                    )
                                    if (res.isSuccessful) {
                                        Toast.makeText(context, "Alumno registrado", Toast.LENGTH_SHORT).show()
                                        onGuardado()
                                    } else {
                                        errorMensaje = "Error al registrar alumno (${res.code()})"
                                    }
                                } catch (e: Exception) {
                                    errorMensaje = "Error: ${e.localizedMessage}"
                                } finally {
                                    guardando = false
                                }
                            }
                        },
                        enabled = !guardando,
                        colors = ButtonDefaults.buttonColors(containerColor = IosGreenDark),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (guardando) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                        } else {
                            Text("Guardar", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DialogCrearGrupo(
    onDismiss: () -> Unit,
    onGuardado: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var grado by remember { mutableStateOf("1°") }
    var grupo by remember { mutableStateOf("A") }
    var guardando by remember { mutableStateOf(false) }
    var errorMensaje by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(text = "Crear Grupo / Grado", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = IosTextPrimary)

                if (errorMensaje != null) {
                    Text(text = errorMensaje ?: "", color = IosRed, fontSize = 13.sp)
                }

                OutlinedTextField(
                    value = grado,
                    onValueChange = { grado = it; errorMensaje = null },
                    label = { Text("Grado") },
                    placeholder = { Text("Ej. 1°, 2°, 3°") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = grupo,
                    onValueChange = { grupo = it; errorMensaje = null },
                    label = { Text("Grupo") },
                    placeholder = { Text("Ej. A, B, C") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar", color = IosTextSecondary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (grado.isBlank() || grupo.isBlank()) {
                                errorMensaje = "Completa grado y grupo."
                                return@Button
                            }
                            guardando = true
                            errorMensaje = null

                            coroutineScope.launch {
                                try {
                                    val api = RetrofitClient.getApiService(context)
                                    val nombreClase = "${grado.trim()} ${grupo.trim()}".trim()
                                    val res = api.crearClaseRapida(
                                        mapOf(
                                            "nombre" to nombreClase,
                                            "grado" to grado.trim(),
                                            "grupo" to grupo.trim(),
                                            "nombre_grado" to grado.trim(),
                                            "nombre_grupo" to grupo.trim()
                                        )
                                    )
                                    if (res.isSuccessful) {
                                        Toast.makeText(context, "Grupo creado exitosamente", Toast.LENGTH_SHORT).show()
                                        onGuardado()
                                    } else {
                                        errorMensaje = "Error al crear grupo (${res.code()})"
                                    }
                                } catch (e: Exception) {
                                    errorMensaje = "Error: ${e.localizedMessage}"
                                } finally {
                                    guardando = false
                                }
                            }
                        },
                        enabled = !guardando,
                        colors = ButtonDefaults.buttonColors(containerColor = IosGreenDark),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (guardando) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                        } else {
                            Text("Crear", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DialogGestionarGrupos(
    clases: List<ClaseGrupo>,
    alumnos: List<Alumno>,
    onDismiss: () -> Unit,
    onActualizado: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var clasesLocales by remember { mutableStateOf(clases) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(text = "Gestionar / Eliminar Grupos", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = IosTextPrimary)

                if (clasesLocales.isEmpty()) {
                    Text(text = "No hay grupos registrados.", color = IosTextSecondary, fontSize = 14.sp)
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().heightIn(max = 300.dp)
                    ) {
                        items(clasesLocales, key = { it.id }) { c ->
                            val count = alumnos.count { it.claseId == c.id }
                            val nombre = c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} ${c.nombreGrupo ?: c.grupo ?: ""}".trim()

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(text = nombre, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = IosTextPrimary)
                                    Text(text = "$count alumnos inscritos", fontSize = 12.sp, color = IosTextSecondary)
                                }

                                IconButton(
                                    onClick = {
                                        coroutineScope.launch {
                                            try {
                                                val api = RetrofitClient.getApiService(context)
                                                val res = api.eliminarClase(c.id)
                                                if (res.isSuccessful) {
                                                    clasesLocales = clasesLocales.filter { it.id != c.id }
                                                    Toast.makeText(context, "Grupo eliminado", Toast.LENGTH_SHORT).show()
                                                    onActualizado()
                                                }
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                ) {
                                    Icon(Icons.Default.Delete, contentDescription = "Eliminar", tint = IosRed)
                                }
                            }
                            HorizontalDivider(color = IosDivider)
                        }
                    }
                }

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = IosGreenDark),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Cerrar", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// Generador nativo de PDF para Credenciales Escolares
fun generarPdfCredenciales(
    context: Context,
    alumnos: List<Alumno>,
    clases: List<ClaseGrupo>,
    nombreEscuela: String
): File {
    val pdfDocument = PdfDocument()
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    // Formato Carta: 612 x 792 pt
    val pageWidth = 612
    val pageHeight = 792

    val cardWidth = 260f
    val cardHeight = 160f
    val marginX = 36f
    val marginY = 40f
    val colGap = 20f
    val rowGap = 20f

    val chunks = alumnos.chunked(8)
    chunks.forEachIndexed { pageIndex, alumnosPagina ->
        val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageIndex + 1).create()
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas

        canvas.drawColor(android.graphics.Color.WHITE)

        alumnosPagina.forEachIndexed { index, alumno ->
            val col = index % 2
            val row = index / 2
            val left = marginX + col * (cardWidth + colGap)
            val top = marginY + row * (cardHeight + rowGap)
            val right = left + cardWidth
            val bottom = top + cardHeight

            // Borde tarjeta
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 1.5f
            paint.color = android.graphics.Color.parseColor("#A7F3D0")
            canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, paint)

            // Banner superior verde institucional
            paint.style = Paint.Style.FILL
            paint.color = android.graphics.Color.parseColor("#065F46")
            canvas.drawRoundRect(left, top, right, top + 34f, 12f, 12f, paint)
            canvas.drawRect(left, top + 16f, right, top + 34f, paint)

            // Nombre de Escuela en Banner
            textPaint.color = android.graphics.Color.WHITE
            textPaint.textSize = 10f
            textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            val escText = if (nombreEscuela.isNotBlank()) nombreEscuela.uppercase() else "CREDENCIAL ESCOLAR"
            canvas.drawText(escText.take(34), left + 10f, top + 22f, textPaint)

            // Bitmap QR
            val qrCode = alumno.codigoQr ?: "ALUM-${alumno.id}"
            val qrBitmap = generarQRBitmap(qrCode, 110)
            if (qrBitmap != null) {
                canvas.drawBitmap(qrBitmap, left + 12f, top + 42f, paint)
            }

            // Datos del Alumno
            textPaint.color = android.graphics.Color.parseColor("#1E293B")
            textPaint.textSize = 12f
            textPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            canvas.drawText(alumno.nombreCompleto.take(20), left + 130f, top + 64f, textPaint)

            textPaint.color = android.graphics.Color.parseColor("#059669")
            textPaint.textSize = 10f
            val grupoStr = alumno.obtenerGrupo(clases)
            canvas.drawText("Grupo: $grupoStr", left + 130f, top + 84f, textPaint)

            textPaint.color = android.graphics.Color.parseColor("#64748B")
            textPaint.textSize = 8.5f
            textPaint.typeface = Typeface.MONOSPACE
            canvas.drawText("ID: $qrCode", left + 130f, top + 104f, textPaint)
        }

        pdfDocument.finishPage(page)
    }

    val outputFile = File(context.cacheDir, "credenciales_alumnos.pdf")
    val fos = FileOutputStream(outputFile)
    pdfDocument.writeTo(fos)
    fos.close()
    pdfDocument.close()
    return outputFile
}

fun generarQRBitmap(texto: String, size: Int = 120): Bitmap? {
    return try {
        val bitMatrix = QRCodeWriter().encode(
            texto,
            BarcodeFormat.QR_CODE,
            size,
            size
        )
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bmp.setPixel(x, y, if (bitMatrix.get(x, y)) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            }
        }
        bmp
    } catch (e: Exception) {
        null
    }
}

fun abrirPDF(context: Context, file: File) {
    try {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "Abriendo selector para compartir PDF...", Toast.LENGTH_SHORT).show()
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(shareIntent, "Credenciales PDF"))
    }
}

// Modal para Editar Alumno (Modificar Nombre, Grupo, Teléfono o Borrar Alumno)
@Composable
fun DialogEditarAlumno(
    alumno: Alumno,
    clases: List<ClaseGrupo>,
    onDismiss: () -> Unit,
    onGuardado: () -> Unit,
    onEliminado: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var nombreCompleto by remember { mutableStateOf(alumno.nombreCompleto) }
    var claseSeleccionadaId by remember { mutableStateOf(alumno.claseId) }
    var telefonoTutor by remember { mutableStateOf(alumno.telefonoTutor ?: "") }
    var guardando by remember { mutableStateOf(false) }
    var mostrandoConfirmacionBorrar by remember { mutableStateOf(false) }
    var errorMensaje by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = IosCardWhite,
            modifier = Modifier.fillMaxWidth().padding(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Editar Alumno", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = IosTextPrimary)
                    if (!alumno.codigoQr.isNullOrBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFFF1F5F9)
                        ) {
                            Text(
                                text = alumno.codigoQr,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF64748B),
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                if (errorMensaje != null) {
                    Text(text = errorMensaje ?: "", color = IosRed, fontSize = 13.sp)
                }

                OutlinedTextField(
                    value = nombreCompleto,
                    onValueChange = { nombreCompleto = it; errorMensaje = null },
                    label = { Text("Nombre Completo") },
                    placeholder = { Text("Ej. Juan Pérez López") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                // Selector de Grupo / Grado
                if (clases.isNotEmpty()) {
                    var expanded by remember { mutableStateOf(false) }
                    val grupoNombreActual = clases.firstOrNull { it.id == claseSeleccionadaId }?.let {
                        it.nombre ?: "${it.nombreGrado ?: it.grado ?: ""} ${it.nombreGrupo ?: it.grupo ?: ""}".trim()
                    } ?: "Sin grupo asignado"

                    Box {
                        OutlinedTextField(
                            value = grupoNombreActual,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Grupo / Grado") },
                            trailingIcon = {
                                IconButton(onClick = { expanded = true }) {
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().clickable { expanded = true }
                        )

                        DropdownMenu(
                            expanded = expanded,
                            onDismissRequest = { expanded = false },
                            modifier = Modifier.background(IosCardWhite)
                        ) {
                            clases.forEach { c ->
                                val nom = c.nombre ?: "${c.nombreGrado ?: c.grado ?: ""} ${c.nombreGrupo ?: c.grupo ?: ""}".trim()
                                DropdownMenuItem(
                                    text = { Text(nom) },
                                    onClick = {
                                        claseSeleccionadaId = c.id
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = telefonoTutor,
                    onValueChange = { telefonoTutor = it },
                    label = { Text("Teléfono Tutor (Opcional)") },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                // Botón Borrar Alumno en cápsula roja
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFFEE2E2),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { mostrandoConfirmacionBorrar = true }
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 12.dp, horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.DeleteOutline,
                            contentDescription = "Eliminar",
                            tint = IosRed,
                            modifier = Modifier.size(19.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Eliminar Alumno",
                            color = IosRed,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }

                // Botones Cancelar y Guardar Cambios
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar", color = IosTextSecondary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (nombreCompleto.isBlank()) {
                                errorMensaje = "El nombre no puede estar vacío."
                                return@Button
                            }
                            guardando = true
                            errorMensaje = null

                            coroutineScope.launch {
                                try {
                                    val api = RetrofitClient.getApiService(context)
                                    val body = mutableMapOf<String, Any?>()
                                    body["nombre_completo"] = nombreCompleto.trim()
                                    body["telefono_tutor"] = telefonoTutor.trim().ifEmpty { null }
                                    if (claseSeleccionadaId != null) {
                                        body["clase_id"] = claseSeleccionadaId
                                    }

                                    val res = api.actualizarAlumno(alumno.id, body)
                                    if (res.isSuccessful) {
                                        Toast.makeText(context, "¡Alumno modificado con éxito!", Toast.LENGTH_SHORT).show()
                                        onGuardado()
                                    } else {
                                        errorMensaje = "No se pudo actualizar el alumno."
                                    }
                                } catch (e: Exception) {
                                    errorMensaje = "Error: ${e.localizedMessage}"
                                } finally {
                                    guardando = false
                                }
                            }
                        },
                        enabled = !guardando,
                        colors = ButtonDefaults.buttonColors(containerColor = IosGreenDark),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = if (guardando) "Guardando..." else "Guardar Cambios",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    // Diálogo de Confirmación para Borrar Alumno
    if (mostrandoConfirmacionBorrar) {
        AlertDialog(
            onDismissRequest = { mostrandoConfirmacionBorrar = false },
            title = { Text("¿Eliminar Alumno?", fontWeight = FontWeight.Bold) },
            text = {
                Text("¿Estás seguro de que deseas eliminar a \"${alumno.nombreCompleto}\"? Esta acción borrará al alumno y sus registros.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        mostrandoConfirmacionBorrar = false
                        coroutineScope.launch {
                            try {
                                val api = RetrofitClient.getApiService(context)
                                val res = api.borrarAlumno(mapOf("id" to alumno.id))
                                if (res.isSuccessful) {
                                    Toast.makeText(context, "Alumno eliminado", Toast.LENGTH_SHORT).show()
                                    onEliminado()
                                } else {
                                    Toast.makeText(context, "No se pudo eliminar el alumno", Toast.LENGTH_SHORT).show()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                ) {
                    Text("Eliminar", color = IosRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { mostrandoConfirmacionBorrar = false }) {
                    Text("Cancelar", color = IosTextSecondary)
                }
            },
            containerColor = IosCardWhite
        )
    }
}

