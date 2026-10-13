# Asistencia QR - App para Android

Esta es la versión nativa para Android de **Asistencia QR**, construida con **Kotlin**, **Jetpack Compose**, **CameraX** y **Google ML Kit**.

---

## 🚀 Características
- **Escáner QR Ultra-rápido**: Utiliza Google ML Kit con detección continua a 60 FPS y freno de seguridad de 1 segundo para no saturar el servidor.
- **Pase de Lista en Vivo**: Marca asistencia, registra retardos/faltas y muestra el conteo en tiempo real.
- **Control de Tareas**: Registro de entrega de actividades mediante QR o switch manual.
- **Directorio de Alumnos**: Búsqueda por nombre o matrícula y visualización de credenciales.
- **Modo Kiosco**: Pantalla completa autoservicio para colocar en atril o mesa escolar.
- **Exportación de Reportes PDF**: Generación y visualización directa de reportes oficiales.
- **Selector de Servidor Dinámico**: Permite cambiar la URL del backend en producción o local.

---

## 📦 Cómo generar el archivo APK (Distribución directa)

### Opción 1: Con Android Studio (Recomendada y más fácil)

1. Abre **Android Studio**.
2. Selecciona **Open** (Abrir) y elige la carpeta `sistema-asistencia-qr/android`.
3. Espera unos segundos a que termine la sincronización de Gradle.
4. En el menú superior, ve a:
   ```
   Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)
   ```
5. Cuando termine, te aparecerá una notificación abajo a la derecha diciendo **"APK(s) generated successfully"**.
6. Haz clic en **locate** y verás el archivo `app-debug.apk` listo para enviar.

---

### Opción 2: Desde la Terminal

Dentro de la carpeta `android`:
```bash
./gradlew assembleDebug
```
El archivo APK se generará en:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📲 Cómo instalar el APK en cualquier teléfono Android

1. Envía el archivo `.apk` a tu celular o al de los maestros (por **WhatsApp**, **Telegram**, **Google Drive** o súbelo a tu servidor web).
2. Toca el archivo descargado en el teléfono Android.
3. Si el sistema muestra el aviso de seguridad:
   * Pulsa en **Ajustes / Configuración**.
   * Activa el interruptor **"Permitir desde esta fuente"** (o instalar apps desconocidas).
4. Pulsa **Instalar**.
5. ¡Listo! Abre la app, concede el permiso de cámara e inicia sesión con tu usuario docente.
