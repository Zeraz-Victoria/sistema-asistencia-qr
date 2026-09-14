const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const Usuario = require('../models/Usuario');
const Institucion = require('../models/Institucion');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'docente_saas_default_secret_key_2026';

class AuthService {
    static async login(email, password) {
        const usuario = await Usuario.findByEmail(email);

        if (!usuario) {
            throw new Error('Credenciales incorrectas.');
        }

        // VERIFICACIÓN SAAS CRÍTICA (Prepago y Suscripción)
        const subStatus = await Institucion.checkSubscriptionStatus(usuario.institucion_id);
        if (subStatus && subStatus.status === 'suspendido') {
            throw new Error('Su cuenta está suspendida por falta de pago. Contacte a soporte.');
        }

        const institucion = await Institucion.findById(usuario.institucion_id);

        const esPasswordCorrecta = await bcrypt.compare(password, usuario.password_hash);
        if (!esPasswordCorrecta) {
            throw new Error('Credenciales incorrectas.');
        }

        // Si es maestro o docente, buscar su clase principal
        let claseId = null;
        const clasesDocente = await db.all("SELECT id FROM Clases WHERE maestro_id = $1 OR institucion_id = $2", [usuario.id, usuario.institucion_id]);
        if (clasesDocente && clasesDocente.length > 0) {
            claseId = clasesDocente[0].id;
        }

        const payload = {
            id: usuario.id,
            rol: usuario.rol,
            email: usuario.email,
            nombre_completo: usuario.nombre_completo,
            institucion_id: usuario.institucion_id,
            clase_id: claseId,
            codigo_qr: usuario.codigo_qr || usuario.nfc_uid
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

        return {
            message: 'Login exitoso.',
            token: token,
            usuario: payload,
            nombre_escuela: institucion ? institucion.nombre : 'Aula Docente'
        };
    }

    static async registrarDocente({ nombre_completo, email, password, nombre_escuela, telefono, device_fingerprint, ip_registro }) {
        if (!nombre_completo || !email || !password) {
            throw new Error('Faltan datos obligatorios (nombre, correo y contraseña).');
        }

        // 1. Verificación Anti-Abuso (evita crear múltiples cuentas de prueba en el mismo dispositivo o IP)
        const controlAbuso = await Institucion.verificarAbusoPrueba(device_fingerprint, ip_registro);
        if (controlAbuso && controlAbuso.abuso) {
            const err = new Error(controlAbuso.mensaje || 'Ya se utilizó un periodo de prueba gratuita en este dispositivo.');
            err.code = 'PRUEBA_EXPIRADA_DISPOSITIVO';
            err.institucion_id = controlAbuso.institucion_id;
            throw err;
        }

        const emailLimpio = email.toLowerCase().trim();
        const existente = await Usuario.findByEmail(emailLimpio);
        if (existente) {
            throw new Error('Ya existe una cuenta registrada con este correo electrónico.');
        }

        // 2. Crear institución/aula del docente con 30 DÍAS DE PRUEBA
        const nombreInstitucion = (nombre_escuela && nombre_escuela.trim())
            ? nombre_escuela.trim()
            : `Aula ${nombre_completo.trim()}`;

        const isSQLite = !process.env.DATABASE_URL;
        let institucionId;
        if (isSQLite) {
            const resInst = await db.run(
                "INSERT INTO Instituciones (nombre, plan, estado, device_fingerprint, ip_registro, fecha_creacion, fecha_ultimo_pago) VALUES ($1, 'prueba_30d', 'activo', $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                [nombreInstitucion, device_fingerprint || null, ip_registro || null]
            );
            institucionId = resInst.lastID;
        } else {
            const resInst = await db.get(
                "INSERT INTO Instituciones (nombre, plan, estado, device_fingerprint, ip_registro, fecha_creacion, fecha_ultimo_pago) VALUES ($1, 'prueba_30d', 'activo', $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id",
                [nombreInstitucion, device_fingerprint || null, ip_registro || null]
            );
            institucionId = resInst.id;
        }

        // 2. Hash de contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Generar código QR único para el docente
        const qrDocente = 'DOC-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();

        // 4. Crear usuario docente con rol 'admin' (para tener control total de su aula)
        const usuarioAlias = emailLimpio.split('@')[0];
        let usuarioId;
        if (isSQLite) {
            const resUser = await db.run(
                `INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, usuario, codigo_qr, nfc_uid, institucion_id)
                 VALUES ($1, $2, 'admin', $3, $4, $5, $6, $7)`,
                [emailLimpio, passwordHash, nombre_completo.trim(), usuarioAlias, qrDocente, qrDocente, institucionId]
            );
            usuarioId = resUser.lastID;
        } else {
            const resUser = await db.get(
                `INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, usuario, codigo_qr, nfc_uid, institucion_id)
                 VALUES ($1, $2, 'admin', $3, $4, $5, $6, $7) RETURNING id`,
                [emailLimpio, passwordHash, nombre_completo.trim(), usuarioAlias, qrDocente, qrDocente, institucionId]
            );
            usuarioId = resUser.id;
        }

        // 5. Configuración inicial del aula
        try {
            await db.run(
                "INSERT INTO Configuracion (id, institucion_id, hora_entrada, hora_salida) VALUES ($1, $2, '07:30:00', '14:00:00')",
                [institucionId, institucionId]
            );
        } catch (e) {}

        // 6. Crear grado y grupo base (1° "A")
        let claseId = null;
        try {
            const resGrado = await db.run("INSERT INTO Grados (nombre_grado, institucion_id) VALUES ('1°', $1)", [institucionId]);
            const resGrupo = await db.run("INSERT INTO Grupos (nombre_grupo, institucion_id) VALUES ('A', $1)", [institucionId]);
            const gradoId = resGrado.lastID || 1;
            const grupoId = resGrupo.lastID || 1;
            const resClase = await db.run(
                "INSERT INTO Clases (grado_id, grupo_id, maestro_id, institucion_id) VALUES ($1, $2, $3, $4)",
                [gradoId, grupoId, usuarioId, institucionId]
            );
            claseId = resClase.lastID || null;
        } catch (e) {}

        // 7. Generar Token JWT
        const payload = {
            id: usuarioId,
            rol: 'admin',
            email: emailLimpio,
            nombre_completo: nombre_completo.trim(),
            institucion_id: institucionId,
            clase_id: claseId,
            codigo_qr: qrDocente
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

        return {
            message: '¡Bienvenido! Cuenta creada con éxito.',
            token,
            usuario: payload,
            nombre_escuela: nombreInstitucion
        };
    }

    static async loginNfc(nfcUid) {
        if (!nfcUid) throw new Error('No se recibió UID.');

        const usuario = await Usuario.findByNfc(nfcUid);

        if (!usuario || usuario.rol !== 'maestro') {
            // Note: Original logic checked for user AND role='maestro' in query.
            // If findByNfc returns a non-maestro, we should probably reject or handle it.
            // The original query was: SELECT * FROM Usuarios WHERE nfc_uid = $1 AND rol = 'maestro'
            // My model findByNfc is generic. So I check role here.
            if (!usuario) throw new Error('Tarjeta no reconocida.');
            if (usuario.rol !== 'maestro') throw new Error('Tarjeta no válida para este tipo de acceso.');
        }

        // VERIFICACIÓN SAAS CRÍTICA (Prepago y Suscripción)
        const subStatus = await Institucion.checkSubscriptionStatus(usuario.institucion_id);
        if (subStatus && subStatus.status === 'suspendido') {
            throw new Error('Servicio suspendido por falta de pago.');
        }

        const institucion = await Institucion.findById(usuario.institucion_id);

        // BUSCAR CLASE ASIGNADA (Para botón de reportes en kiosco)
        const configMod = await db.get("SELECT modelo_departamental FROM Configuracion WHERE institucion_id = $1", [usuario.institucion_id]);
        const isModeloDepartamental = configMod ? configMod.modelo_departamental === 1 : false;

        let claseId = null;
        if (isModeloDepartamental) {
            const AsistenciaService = require('./asistenciaService');
            const claseActiva = await AsistenciaService.obtenerClaseActivaDocente(usuario);
            claseId = claseActiva ? claseActiva.clase_id : null;
        } else {
            const clasesDocente = await db.all("SELECT id FROM Clases WHERE maestro_id = $1", [usuario.id]);
            claseId = clasesDocente.length === 1 ? clasesDocente[0].id : null;
        }

        const payload = {
            id: usuario.id,
            rol: usuario.rol,
            email: usuario.email,
            nombre_completo: usuario.nombre_completo,
            institucion_id: usuario.institucion_id,
            clase_id: claseId,
            modelo_departamental: isModeloDepartamental
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

        const resultado = {
            message: `Bienvenido, ${usuario.nombre_completo}.`,
            token: token,
            usuario: { ...payload, clase_id: claseId },
            nombre_escuela: institucion ? institucion.nombre : 'Escuela'
        };

        // --- REGISTRAR ASISTENCIA DEL MAESTRO (CLOCK-IN / CLOCK-OUT) ---
        try {
            const fechaActual = new Date(); // UTC or Server Time

            const isSQLite = !process.env.DATABASE_URL;
            const query = isSQLite
                ? "SELECT fecha_hora FROM Asistencias_Maestros WHERE maestro_id = $1 AND date(fecha_hora, 'localtime') = date('now', 'localtime') ORDER BY fecha_hora DESC LIMIT 1"
                : "SELECT fecha_hora FROM Asistencias_Maestros WHERE maestro_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE ORDER BY fecha_hora DESC LIMIT 1";

            // 1. Obtener último registro de HOY
            const ultimoRegistro = await db.get(query, [usuario.id]);

            let shouldInsert = false;
            let status = 'presente';

            if (!ultimoRegistro) {
                // --- PRIMER REGISTRO (ENTRADA) ---
                shouldInsert = true;

                // Entrada directa: siempre presente
                status = 'presente';
                console.log(`[Auth] Maestro ${usuario.nombre_completo}: Marcando ENTRADA (${status})`);

            } else {
                // --- REGISTROS SUBSECUENTES (SALIDA / ACTUALIZACIÓN) ---
                const lastTime = new Date(ultimoRegistro.fecha_hora);
                const diffMs = fechaActual - lastTime;
                const diffMins = diffMs / 1000 / 60;

                // Debounce de 10 minutos para evitar doble scaneo accidental
                if (diffMins > 10) {
                    shouldInsert = true;
                    // Status 'presente' para salidas, el sistema tomará la última hora como salida
                    status = 'presente';
                    console.log(`[Auth] Maestro ${usuario.nombre_completo}: Marcando SALIDA/ACTUALIZACIÓN (Diff: ${diffMins.toFixed(1)}m)`);
                } else {
                    console.log(`[Auth] Maestro ${usuario.nombre_completo}: Doble scan ignorado (< 10m)`);
                }
            }

            if (shouldInsert) {
                await db.run(
                    "INSERT INTO Asistencias_Maestros (maestro_id, fecha_hora, status, institucion_id) VALUES ($1, $2, $3, $4)",
                    [usuario.id, fechaActual.toISOString(), status, usuario.institucion_id]
                );
            }
        } catch (err) {
            console.error("Error registrando asistencia de maestro:", err);
        }

        return resultado;
    }

    static async crearEscuela(nombreEscuela, emailDirector, nombreDirector, passwordDirector) {
        if (!nombreEscuela || !emailDirector || !nombreDirector || !passwordDirector) {
            throw new Error('Todos los campos son obligatorios.');
        }

        // Verificar si el correo electrónico ya existe
        const usuarioExistente = await Usuario.findByEmail(emailDirector);
        if (usuarioExistente) {
            throw new Error('El correo electrónico ya está registrado.');
        }

        // Crear la nueva institución con plan 'basico' y estado 'activo'
        const escuelaRes = await db.run(
            "INSERT INTO Instituciones (nombre, plan, estado) VALUES ($1, 'basico', 'activo')",
            [nombreEscuela]
        );
        const nuevaEscuelaId = escuelaRes.lastID;

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(passwordDirector, salt);

        // Crear el usuario Director
        await db.run(
            "INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, institucion_id) VALUES ($1, $2, 'director', $3, $4)",
            [emailDirector, hash, nombreDirector, nuevaEscuelaId]
        );

        // Inicializar configuración
        const maxIdRes = await db.get("SELECT MAX(id) AS max_id FROM Configuracion");
        const nextId = (maxIdRes && maxIdRes.max_id ? maxIdRes.max_id : 0) + 1;
        await db.run(
            "INSERT INTO Configuracion (id, institucion_id, enviar_sms) VALUES ($1, $2, 1)",
            [nextId, nuevaEscuelaId]
        );

        return { status: 'ok', message: 'Escuela y usuario creados con éxito.' };
    }
}

module.exports = AuthService;
