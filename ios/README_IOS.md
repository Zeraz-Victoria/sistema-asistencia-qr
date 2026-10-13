# App Nativa iOS (SwiftUI) — Asistencia QR

Esta carpeta contiene la aplicación nativa para iPhone desarrollada 100% en **SwiftUI** con **AVFoundation** y **URLSession**.

Se conecta directamente al backend en producción (en Render o tu servidor) utilizando la misma base de datos, los mismos usuarios y los mismos tokens JWT.

---

### Módulos Incluidos

1. **Autenticación (`Views/Auth/`):**
   - Inicio de sesión con correo y contraseña existentes en la base de datos.
   - Manejo seguro de JWT y persistencia de sesión.
2. **Kiosco de Escaneo (`Views/Kiosco/` y `Views/Camera/`):**
   - Escáner de códigos QR en tiempo real con la cámara del iPhone (`AVFoundation`).
   - Feedback háptico instantáneo (`UIImpactFeedbackGenerator` y `UINotificationFeedbackGenerator`).
   - Tarjetas flotantes animadas con *Spring Physics* de Apple.
   - Modo de pase manual con buscador si el alumno no lleva su credencial.
3. **Gestión de Alumnos (`Views/Alumnos/`):**
   - Listado de alumnos con barra de búsqueda rápida (`.searchable`).
   - Generación de credenciales digitales en pantalla con su código QR nativo (`CoreImage`).
   - Opción nativa de compartir o imprimir el QR.
   - Registro de nuevos alumnos.
4. **Reportes y Dashboard (`Views/Reportes/`):**
   - Resumen del día: Asistencias a tiempo, Retardos, Total.
   - Listado detallado de asistencias de la fecha actual con actualización al deslizar (*pull-to-refresh*).
5. **Ajustes y Licencia (`Views/Ajustes/`):**
   - Consulta del estatus de la licencia / suscripción.
   - Configuración o cambio de la URL del servidor.
   - Cierre de sesión.

---

### Cómo abrirlo y compilarlo en Xcode

1. Abre **Xcode** en tu Mac.
2. Selecciona **Create New Project** -> Elige la plantilla **iOS > App** y haz clic en **Next**.
3. Configuración del proyecto:
   - **Product Name:** `AsistenciaQR`
   - **Interface:** `SwiftUI`
   - **Language:** `Swift`
4. Guarda el proyecto en tu carpeta de preferencia.
5. Arrastra la carpeta `ios/AsistenciaQR` dentro de tu proyecto en Xcode (marca *"Copy items if needed"* o selecciónalos directamente).
6. En el archivo `Config.swift`, actualiza `defaultBaseURL` con la URL HTTPS de tu servidor en producción:
   ```swift
   static let defaultBaseURL = "https://tu-sistema.onrender.com/api"
   ```
7. Conecta tu iPhone por cable o selecciona un simulador de iPhone y presiona **Play (Cmd + R)**.
