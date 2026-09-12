# Walkthrough: Modelo Departamental / Por Asignatura y Horarios

Se ha implementado con éxito la funcionalidad de **Modelo Departamental por Asignaturas** para escuelas secundarias técnicas o generales. Este cambio permite a los docentes rotar por materias y grupos a lo largo del día y registrar asistencia por materia utilizando horarios de clase programados, mientras que mantiene compatibilidad total con el modelo tradicional existente.

---

## Cambios Realizados

### 1. Base de Datos (`config/database.js`)
* **SQLite & PostgreSQL:**
  * Nueva columna `modelo_departamental` (`INTEGER` DEFAULT `0`) en `Configuracion` para activar/desactivar la modalidad de materias.
  * Nueva tabla `Materias` para almacenar el catálogo de asignaturas.
  * Nueva columna `materia_id` en `Clases` para asociar clases con asignaturas.
  * Nueva tabla `Horarios_Clases` para definir los días y horas en que se imparte cada clase.
  * Nueva tabla intermedia `Alumnos_Clases` (Matrícula) para relacionar alumnos con múltiples clases.
  * Nueva columna `clase_id` en `Asistencias` para rastrear a qué clase pertenece el pase de lista.
  * **Migraciones seguras:** Se diseñó una migración en SQLite usando una tabla temporal para cambiar la estructura de `Clases` sin corromper claves foráneas en otras tablas, y se alteró el constraint de unicidad en Postgres de forma dinámica.
  * **Fix de Fechas SQLite:** Se corrigió un desajuste en SQLite donde las fechas eran guardadas como números de milisegundos lo cual rompía la prevención de doble escaneo; ahora se guardan consistentemente como cadenas ISO.

### 2. Capa de Servicios (`services/asistenciaService.js` & `services/gestionService.js`)
* **`asistenciaService.js`:**
  * Ajustes en `marcarAsistencia` para comprobar la zona horaria (`America/Mexico_City`) y validar si hay una clase programada en el horario actual para el docente.
  * Validación de matrícula del alumno (`Alumnos_Clases`) en la clase activa.
  * Prevención de doble escaneo por clase/materia en el mismo día.
  * Nuevo método `obtenerClaseActivaDocente` para determinar qué clase corresponde según la hora del sistema.
* **`gestionService.js`:**
  * Métodos CRUD para administrar `Materias`, `Horarios_Clases`, `Alumnos_Clases` y el interruptor de modelo departamental.
  * Ajuste en la creación y borrado en cascada de Clases para limpiar horarios, matrículas y asistencias correspondientes.

### 3. Rutas y Controladores
* **`routes/gestion.js` & `controllers/gestionController.js`:**
  * Agregadas rutas y controladores para gestionar materias, horarios por clase, matrícula de alumnos y configuraciones de modelo.
* **`routes/asistencia.routes.js` & `controllers/asistenciaController.js`:**
  * Nueva ruta GET `/api/clase-activa` para consultar la materia correspondiente del docente en el quiosco.

### 4. Interfaz de Usuario
* **Panel de Administración (`public/admin.html`):**
  * Agregado switch para activar el Modelo Departamental en el panel de configuración de horarios.
  * Sección interactiva para crear y eliminar **Materias / Asignaturas** en la columna izquierda académica.
  * Selector de Materia condicional en el formulario de creación de clases.
  * Dos modales nuevos en la tabla de Clases Activas:
    1. **Horarios de Clase:** Agrega o quita rangos de horas y días de la semana para impartir la materia.
    2. **Matrícula:** Permite inscribir y remover alumnos de la clase para validar su acceso.
* **Quiosco (`public/kiosco.html`):**
  * Al iniciar sesión el docente, se consulta dinámicamente si tiene una clase activa.
  * Se muestra un banner contextualizado: `"Clase: [Materia] ([Grado] [Grupo])"` con el horario de clase, informando de inmediato a qué clase se está tomando asistencia.

---

## Verificación de Pruebas

Se creó el script de pruebas automatizadas `verify_departmental.js` que valida el flujo departamental simulando todas las reglas de negocio de asistencia:

```bash
node verify_departmental.js
```

### Resultados de la Prueba:
```
--- INICIANDO PRUEBAS DEL MODELO DEPARTAMENTAL ---
Conectando con la base de datos SQLite (Modo Local Demo)...
Migrando tabla Clases en SQLite para Modelo Departamental...
✅ Migración de Clases completada en SQLite.
✅ Base de datos configurada para Local SQLite DEMO.
Limpiando datos de pruebas anteriores...
Creando escuela y configurando Modelo Departamental...
Creando Grados y Grupos...
Creando Materia...
Creando Docente...
Creando Clase/Curso...
Creando Alumnos...
Configurando horario activo para clase 1: Día 4, 12:43:00 - 13:43:00

--- EJECUTANDO VALIDACIONES ---
[Test 1 - Clase Activa] Encontrada: true
Marcando asistencia de Alumno Matriculado...
[Test 2 - Alumno Matriculado] Resultado: success - ¡Bienvenido a Materia Test Math, Alumno Test Matriculado! (Retardo <= 10m)
Intentando marcar asistencia duplicada...
[Test 3 - Marcado Duplicado] Resultado: warning - Ya registrado hoy en Materia Test Math (retardo)
Marcando asistencia de Alumno NO Matriculado...
[Test 4 - Alumno NO Matriculado] Error capturado correctamente: El alumno Alumno Test NO Matriculado no está matriculado en la clase de Materia Test Math.
Removiendo horario de la clase...
Marcando asistencia sin horario programado...
[Test 5 - Sin Horario] Error capturado correctamente: No tienes ninguna materia/clase programada en este horario.

Limpiando base de datos...

✅ ¡TODAS LAS PRUEBAS DEL MODELO DEPARTAMENTAL PASARON CON ÉXITO!
```

Adicionalmente, se corrieron las pruebas de suscripciones y lógicas tradicionales, las cuales pasaron exitosamente (100% de éxito).
