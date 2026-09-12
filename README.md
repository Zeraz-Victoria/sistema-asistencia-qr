# 🏫 Sistema de Asistencia QR — AsistenciaQR

Sistema SaaS multi-escuela para control de asistencia de alumnos y docentes mediante código QR y NFC.

## Características

- ✅ Registro de asistencia por QR y NFC
- ✅ Multi-escuela (multi-tenancy) con aislamiento por institución
- ✅ Panel de directivo, admin y super-admin
- ✅ Reportes PDF de asistencia
- ✅ Portal de padres de familia
- ✅ Avisos y actividades
- ✅ Suscripciones con período de prueba (7 días) + Licencia Vitalicia
- ✅ Pagos con Mercado Pago (tarjeta + OXXO)
- ✅ SMS de notificación con Twilio

---

## 🚀 Instalación en servidor propio (Linux)

### 1. Requisitos previos

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (gestor de procesos)
sudo npm install -g pm2

# (Opcional) PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

### 2. Clonar el repositorio

```bash
git clone https://github.com/adrianvira/sistema-asistencia-qr.git
cd sistema-asistencia-qr
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
nano .env   # Edita con tus valores reales
```

Variables obligatorias a cambiar:
- `JWT_SECRET` → genera con: `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`
- `SUPER_ADMIN_KEY` → genera con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ALLOWED_ORIGINS` → tu IP o dominio, ej: `http://192.168.1.100:3001`

### 5. (Opcional) Configurar PostgreSQL

```bash
sudo -u postgres psql
CREATE DATABASE asistencia_db;
CREATE USER asistencia_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE asistencia_db TO asistencia_user;
\q
```

Luego en tu `.env`:
```
DATABASE_URL=postgresql://asistencia_user:tu_password_seguro@localhost:5432/asistencia_db
```

### 6. Iniciar con PM2

```bash
# Iniciar
pm2 start servidor.js --name "asistencia-qr"

# Ver logs en tiempo real
pm2 logs asistencia-qr

# Configurar inicio automático al reiniciar el servidor
pm2 startup
pm2 save
```

### 7. (Opcional) Nginx como proxy reverso

```nginx
server {
    listen 80;
    server_name tu-ip-o-dominio;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔐 Seguridad implementada

- Helmet (cabeceras HTTP seguras)
- Rate limiting (login: 10 intentos/15min)
- CORS restringido a orígenes configurados
- JWT con clave de 512 bits
- Rutas de admin protegidas con `SUPER_ADMIN_KEY`
- Multi-tenancy estricto (alumnos aislados por institución)

---

## 📁 Estructura del proyecto

```
├── config/         # Configuración de base de datos
├── controllers/    # Lógica de cada módulo
├── middleware/     # Autenticación JWT
├── models/         # Modelos de datos
├── public/         # Frontend HTML/CSS/JS
├── routes/         # Definición de rutas API
├── services/       # Lógica de negocio
├── servidor.js     # Punto de entrada
└── .env.example    # Plantilla de configuración
```

---

## 🛠️ Comandos útiles

```bash
pm2 status                    # Ver estado del proceso
pm2 restart asistencia-qr     # Reiniciar
pm2 logs asistencia-qr        # Ver logs
pm2 monit                     # Monitor en tiempo real
```
