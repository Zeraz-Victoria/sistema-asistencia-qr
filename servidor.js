/*
 * ==========================================================
 * ARCHIVO: servidor.js (Versión SaaS Estable - Refactorizado MVC)
 * ==========================================================
 */

const express = require('express');
const { setupDatabase } = require('./config/database.js');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// --- IMPORTACIONES ---
const authRoutes = require('./routes/auth.js');
const gestionRoutes = require('./routes/gestion.js');
const createSuperAdminRoutes = require('./routes/super_admin.js');
const reporteRoutes = require('./routes/reporte.routes.js');
const asistenciaRoutes = require('./routes/asistencia.routes.js');
const dashboardRoutes = require('./routes/dashboard.routes.js');
const portalRoutes = require('./routes/portal.routes.js');
const avisosRoutes = require('./routes/avisos.routes.js');
const pagosRoutes = require('./routes/pagos.js');

const app = express();
const port = process.env.PORT || 3001;
const path = require('path');
let db;

// ============================================================
// SEGURIDAD — Cabeceras HTTP (Helmet)
// ============================================================
app.use(helmet({
    contentSecurityPolicy: false, // Desactivado para no romper el frontend HTML inline
    crossOriginEmbedderPolicy: false
}));

// ============================================================
// SEGURIDAD — CORS restringido
// ============================================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3001', 'http://localhost:3002'];

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requests sin origin (Postman, mobile apps, webhooks de MercadoPago)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS bloqueado para origen: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
    credentials: true
}));

// ============================================================
// SEGURIDAD — Rate Limiting
// ============================================================

// Límite general: 200 req / 15 min por IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' }
});

// Límite estricto en login: 10 intentos / 15 min por IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo.' }
});

app.use(generalLimiter);

app.use(express.json());

const publicPath = path.resolve(__dirname, 'public');
console.log('Sirviendo estáticos desde:', publicPath);
app.use(express.static(publicPath));

app.get('/ping', (req, res) => res.send('pong'));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/', (req, res) => res.redirect('/login'));

// Rutas amigables para el frontend
app.get('/superadmin', (req, res) => res.sendFile('super_admin.html', { root: publicPath }));
app.get('/admin', (req, res) => res.sendFile('admin.html', { root: publicPath }));
app.get('/admin/panel', (req, res) => res.sendFile('panel_directivo.html', { root: publicPath }));
app.get('/login', (req, res) => res.sendFile('login.html', { root: publicPath }));
app.get('/kiosco', (req, res) => res.sendFile('kiosco.html', { root: publicPath }));
app.get('/portal', (req, res) => res.sendFile('portal.html', { root: publicPath }));

async function startServer() {
    try {
        db = await setupDatabase();
        console.log('DB Setup completado. Configurando rutas...');

        // Rutas Modulares
        // Rate limit estricto solo en login y registro
        app.use('/api/auth/login', loginLimiter);
        app.use('/api/auth/login-nfc', loginLimiter);
        app.use('/api/auth/login-qr', loginLimiter);

        app.use('/api/auth', authRoutes);
        app.use('/api/superadmin', createSuperAdminRoutes(db));
        app.use('/api/gestion', gestionRoutes);
        app.use('/api/reporte', reporteRoutes);
        app.use('/api/dashboard', dashboardRoutes);
        app.use('/api/portal', portalRoutes);
        app.use('/api/avisos', avisosRoutes);
        app.use('/api/pagos', pagosRoutes);
        app.use('/api', asistenciaRoutes);

        // ============================================================
        // SEGURIDAD — Manejador de errores global (debe ir AL FINAL)
        // ============================================================
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => {
            // Loguear el error completo en servidor, pero no exponerlo al cliente
            console.error(`[Error Global] ${req.method} ${req.originalUrl} →`, err.message);
            if (err.message && err.message.startsWith('CORS bloqueado')) {
                return res.status(403).json({ error: 'Origen no permitido.' });
            }
            const status = err.status || err.statusCode || 500;
            res.status(status).json({
                error: process.env.NODE_ENV === 'production'
                    ? 'Error interno del servidor.'
                    : err.message
            });
        });

        console.log('Iniciando servidor express...');
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor SaaS activo en puerto ${port}`);
            console.log(`✅ Helmet activado`);
            console.log(`✅ Rate limiting activado (login: 10/15min, general: 200/15min)`);
            console.log(`✅ CORS restringido a: ${allowedOrigins.join(', ')}`);
        });
    } catch (error) { console.error("Error fatal:", error.message); process.exit(1); }
}
startServer();
