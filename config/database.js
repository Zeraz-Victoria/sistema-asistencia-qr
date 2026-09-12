/*
 * ==========================================================
 * ARCHIVO: database.js (Versión 7.0 - SaaS / SQLite Hybrid)
 * ==========================================================
 */

const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const isSQLite = !connectionString;

let db;
let sqlDb;
let pool;

if (isSQLite) {
  const dbPath = path.resolve(__dirname, '../asistencia_qr.sqlite');
  sqlDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error('Error abriendo SQLite:', err.message);
  });
  sqlDb.run('PRAGMA foreign_keys = ON;');
  sqlDb.run('PRAGMA journal_mode = WAL;');
  sqlDb.run('PRAGMA busy_timeout = 5000;');

  db = {
    all: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        sqlDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    get: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        sqlDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    },
    run: (sql, params = []) => {
      return new Promise((resolve, reject) => {
        const cleanSql = sql.replace(/RETURNING\s+id/gi, '');
        sqlDb.run(cleanSql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID });
        });
      });
    },
    exec: (sql) => {
      return new Promise((resolve, reject) => {
        sqlDb.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
} else {
  pool = new Pool({
    connectionString: connectionString,
    ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
  });

  db = {
    _translateSql: (sql) => {
      let i = 0;
      return sql.replace(/\?/g, () => `$${++i}`);
    },
    all: async (sql, params = []) => {
      try {
        const newSql = db._translateSql(sql);
        const res = await pool.query(newSql, params);
        return res.rows;
      } catch (err) {
        console.error('Error en db.all:', err.message, sql, params);
        throw err;
      }
    },
    get: async (sql, params = []) => {
      try {
        const newSql = db._translateSql(sql);
        const res = await pool.query(newSql, params);
        return res.rows[0];
      } catch (err) {
        console.error('Error en db.get:', err.message, sql, params);
        throw err;
      }
    },
    run: async (sql, params = []) => {
      try {
        const isAlumnosClases = sql.toLowerCase().includes('alumnos_clases');
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          if (!sql.trim().toUpperCase().includes('RETURNING') && !isAlumnosClases) {
            sql += ' RETURNING id';
          }
        }
        const newSql = db._translateSql(sql);
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          const res = await pool.query(newSql, params);
          if (res.rows[0] && res.rows[0].id !== undefined) {
            return { lastID: res.rows[0].id };
          }
          return { lastID: 0 };
        } else {
          await pool.query(newSql, params);
          return {};
        }
      } catch (err) {
        console.error('Error en db.run:', err.message, sql, params);
        throw err;
      }
    },
    exec: async (sql) => {
      try {
        await pool.query(sql);
      } catch (err) {
        console.error('Error en db.exec:', err.message, sql);
        throw err;
      }
    }
  };
}

/**
 * Función auxiliar para añadir columna institucion_id si no existe (PostgreSQL)
 */
async function agregarColumnaTenant(tabla) {
  try {
    await db.exec(`
      ALTER TABLE ${tabla} 
      ADD COLUMN IF NOT EXISTS institucion_id INTEGER DEFAULT 1;
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tabla}_tenant 
      ON ${tabla}(institucion_id);
    `);

    const fkName = `fk_${tabla.toLowerCase()}_institucion`;
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fkName}') THEN
          ALTER TABLE ${tabla} 
          ADD CONSTRAINT ${fkName} 
          FOREIGN KEY (institucion_id) REFERENCES Instituciones(id);
        END IF;
      END
      $$;
    `);

    console.log(`✅ SaaS: Columna institucion_id asegurada en ${tabla}`);
  } catch (error) {
    console.error(`❌ Error migrando ${tabla}:`, error.message);
  }
}

/**
 * Función principal de configuración
 */
async function setupDatabase() {
  if (isSQLite) {
    console.log('Conectando con la base de datos SQLite (Modo Local Demo)...');
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Instituciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            plan TEXT DEFAULT 'basico', 
            estado TEXT DEFAULT 'activo', 
            fecha_ultimo_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.run("INSERT OR IGNORE INTO Instituciones (id, nombre) VALUES (1, 'Institución Principal')");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL, 
            nombre_completo TEXT,
            nfc_uid TEXT UNIQUE,
            institucion_id INTEGER DEFAULT 1
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Grados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_grado TEXT NOT NULL,
            institucion_id INTEGER DEFAULT 1,
            UNIQUE(nombre_grado, institucion_id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Grupos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_grupo TEXT NOT NULL,
            institucion_id INTEGER DEFAULT 1,
            UNIQUE(nombre_grupo, institucion_id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Clases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grado_id INTEGER NOT NULL,
            grupo_id INTEGER NOT NULL,
            maestro_id INTEGER,
            institucion_id INTEGER DEFAULT 1,
            UNIQUE(grado_id, grupo_id, institucion_id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Alumnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_completo TEXT NOT NULL,
            nfc_uid TEXT,
            codigo_qr TEXT UNIQUE,
            telefono_tutor TEXT NOT NULL,
            clase_id INTEGER,
            institucion_id INTEGER DEFAULT 1
        );
    `);

    try { await db.exec(`ALTER TABLE Alumnos ADD COLUMN codigo_qr TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Usuarios ADD COLUMN codigo_qr TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Usuarios ADD COLUMN usuario TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN monto_pagado REAL DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN referencia_pago TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN metodo_pago TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN fecha_pago DATETIME;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN device_fingerprint TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN ip_registro TEXT;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Instituciones ADD COLUMN fecha_vencimiento_prueba DATETIME;`); } catch (e) {}

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER NOT NULL REFERENCES Alumnos(id) ON DELETE CASCADE,
            fecha_hora DATETIME NOT NULL,
            status TEXT DEFAULT 'presente',
            justificacion TEXT,
            institucion_id INTEGER DEFAULT 1
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Configuracion (
            id INTEGER PRIMARY KEY, 
            enviar_sms INTEGER NOT NULL DEFAULT 1,
            institucion_id INTEGER DEFAULT 1,
            hora_entrada TEXT DEFAULT '08:00:00',
            hora_salida TEXT DEFAULT '14:00:00',
            clases_sabado INTEGER DEFAULT 0,
            clases_domingo INTEGER DEFAULT 0
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Dias_Inhabiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            fecha DATE NOT NULL,
            institucion_id INTEGER DEFAULT 1,
            motivo TEXT,
            UNIQUE(fecha, institucion_id)
        );
    `);

    try {
        await db.exec("ALTER TABLE Instituciones ADD COLUMN fecha_ultimo_pago DATETIME;");
        await db.exec("UPDATE Instituciones SET fecha_ultimo_pago = COALESCE(fecha_creacion, datetime('now', 'localtime'));");
    } catch (e) {}
    try {
        await db.exec("ALTER TABLE Asistencias ADD COLUMN institucion_id INTEGER DEFAULT 1;");
    } catch (e) {}
    try {
        await db.exec("ALTER TABLE Dias_Inhabiles ADD COLUMN motivo TEXT;");
    } catch (e) {}
    try {
        await db.exec("ALTER TABLE Configuracion ADD COLUMN clases_sabado INTEGER DEFAULT 0;");
    } catch (e) {}
    try {
        await db.exec("ALTER TABLE Configuracion ADD COLUMN clases_domingo INTEGER DEFAULT 0;");
    } catch (e) {}

    await db.exec(`
          CREATE TABLE IF NOT EXISTS Asistencias_Maestros (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              maestro_id INTEGER NOT NULL REFERENCES Usuarios(id) ON DELETE CASCADE,
              fecha_hora DATETIME NOT NULL,
              status TEXT NOT NULL,
              institucion_id INTEGER DEFAULT 1
          );
      `);

    await db.exec(`
          CREATE TABLE IF NOT EXISTS Visitas_Portal (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             institucion_id INTEGER DEFAULT 1,
             fecha DATE NOT NULL,
             contador INTEGER DEFAULT 0,
             UNIQUE (institucion_id, fecha)
          );
      `);

    await db.exec(`
          CREATE TABLE IF NOT EXISTS Avisos (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             institucion_id INTEGER DEFAULT 1,
             titulo TEXT NOT NULL,
             mensaje TEXT NOT NULL,
             fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
          );
      `);

    // Crear tablas de Actividades y Entregas_Actividades en SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            institucion_id INTEGER DEFAULT 1 REFERENCES Instituciones(id) ON DELETE CASCADE,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            clase_id INTEGER REFERENCES Clases(id) ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Entregas_Actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actividad_id INTEGER NOT NULL REFERENCES Actividades(id) ON DELETE CASCADE,
            alumno_id INTEGER NOT NULL REFERENCES Alumnos(id) ON DELETE CASCADE,
            fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            institucion_id INTEGER DEFAULT 1 REFERENCES Instituciones(id) ON DELETE CASCADE,
            UNIQUE (actividad_id, alumno_id)
        );
    `);

    // Crear tabla Materias si no existe
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Materias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_materia TEXT NOT NULL,
            institucion_id INTEGER DEFAULT 1 REFERENCES Instituciones(id) ON DELETE CASCADE
        );
    `);

    // Crear tabla Horarios_Clases si no existe
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Horarios_Clases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clase_id INTEGER NOT NULL REFERENCES Clases(id) ON DELETE CASCADE,
            dia_semana INTEGER NOT NULL,
            hora_inicio TEXT NOT NULL,
            hora_fin TEXT NOT NULL,
            institucion_id INTEGER DEFAULT 1 REFERENCES Instituciones(id) ON DELETE CASCADE
        );
    `);

    // Crear tabla Alumnos_Clases si no existe
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Alumnos_Clases (
            alumno_id INTEGER NOT NULL REFERENCES Alumnos(id) ON DELETE CASCADE,
            clase_id INTEGER NOT NULL REFERENCES Clases(id) ON DELETE CASCADE,
            institucion_id INTEGER NOT NULL REFERENCES Instituciones(id) ON DELETE CASCADE,
            PRIMARY KEY (alumno_id, clase_id)
        );
    `);

    try {
        await db.exec("ALTER TABLE Configuracion ADD COLUMN modelo_departamental INTEGER DEFAULT 0;");
    } catch (e) {}
    try {
        await db.exec("ALTER TABLE Asistencias ADD COLUMN clase_id INTEGER REFERENCES Clases(id) ON DELETE SET NULL;");
    } catch (e) {}
    try {
        await db.exec("ALTER TABLE Actividades ADD COLUMN clase_id INTEGER REFERENCES Clases(id) ON DELETE CASCADE;");
    } catch (e) {}

    // Migración Modelo Departamental SQLite
    try {
        const tableInfo = await db.all("PRAGMA table_info(Clases)");
        const hasMateriaId = tableInfo.some(col => col.name === 'materia_id');
        
        if (!hasMateriaId) {
            console.log("Migrando tabla Clases en SQLite para Modelo Departamental...");
            await db.exec("PRAGMA foreign_keys = OFF;");
            await db.exec("BEGIN TRANSACTION;");
            
            // 1. Crear tabla temporal Clases_new
            await db.exec(`
                CREATE TABLE Clases_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    grado_id INTEGER NOT NULL,
                    grupo_id INTEGER NOT NULL,
                    maestro_id INTEGER,
                    institucion_id INTEGER DEFAULT 1,
                    materia_id INTEGER REFERENCES Materias(id) ON DELETE SET NULL,
                    UNIQUE(grado_id, grupo_id, materia_id, institucion_id)
                );
            `);
            
            // 2. Copiar datos si existe Clases
            try {
                await db.exec("INSERT INTO Clases_new (id, grado_id, grupo_id, maestro_id, institucion_id) SELECT id, grado_id, grupo_id, maestro_id, institucion_id FROM Clases;");
            } catch (e) {
                console.log("Nota: Clases no existía o no tenía datos, se omitió copia.");
            }
            
            // 3. Eliminar Clases vieja
            await db.exec("DROP TABLE IF EXISTS Clases;");
            
            // 4. Renombrar Clases_new a Clases
            await db.exec("ALTER TABLE Clases_new RENAME TO Clases;");
            
            await db.exec("COMMIT;");
            await db.exec("PRAGMA foreign_keys = ON;");
            console.log("✅ Migración de Clases completada en SQLite.");
        }
    } catch (err) {
        console.error("❌ Error al migrar la tabla Clases en SQLite:", err.message);
        try { await db.exec("ROLLBACK;"); } catch (e) {}
    }

    await db.run("INSERT OR IGNORE INTO Configuracion (id, enviar_sms, institucion_id) VALUES (1, 1, 1)");

    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    try {
      await db.run("INSERT INTO Usuarios (email, password_hash, rol, nombre_completo) VALUES ('admin@example.com', ?, 'superadmin', 'Admin Local') ON CONFLICT(email) DO NOTHING", [hash]);
      await db.run("INSERT INTO Usuarios (email, password_hash, rol, nombre_completo) VALUES ('maria.garcia@escuela.edu', ?, 'maestro', 'Maria Garcia') ON CONFLICT(email) DO NOTHING", [hash]);
    } catch (e) {}

    console.log('✅ Base de datos configurada para Local SQLite DEMO.');
    return db;
  } else {
    console.log('Conectando con la base de datos PostgreSQL (Modo SaaS)...');
    try {
      await pool.query('SELECT NOW()');
    } catch (err) {
      console.error('Error fatal al conectar con PostgreSQL:', err.message);
      throw err;
    }
    console.log('Conexión establecida.');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Instituciones (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            plan TEXT DEFAULT 'basico', 
            estado TEXT DEFAULT 'activo', 
            fecha_ultimo_pago TIMESTAMPTZ DEFAULT NOW(),
            fecha_creacion TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await db.run(
      "INSERT INTO Instituciones (id, nombre) VALUES (1, 'Institución Principal') ON CONFLICT (id) DO NOTHING"
    );

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Usuarios (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL, 
            nombre_completo TEXT,
            nfc_uid TEXT UNIQUE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Grados (
            id SERIAL PRIMARY KEY,
            nombre_grado TEXT NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Grupos (
            id SERIAL PRIMARY KEY,
            nombre_grupo TEXT NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Clases (
            id SERIAL PRIMARY KEY,
            grado_id INTEGER NOT NULL REFERENCES Grados(id),
            grupo_id INTEGER NOT NULL REFERENCES Grupos(id),
            maestro_id INTEGER REFERENCES Usuarios(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Alumnos (
            id SERIAL PRIMARY KEY,
            nombre_completo TEXT NOT NULL,
            nfc_uid TEXT, 
            codigo_qr TEXT UNIQUE,
            telefono_tutor TEXT NOT NULL,
            clase_id INTEGER REFERENCES Clases(id)
        );
    `);

    try { await db.exec(`ALTER TABLE Alumnos ADD COLUMN IF NOT EXISTS codigo_qr TEXT UNIQUE;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS codigo_qr TEXT UNIQUE;`); } catch (e) {}

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Asistencias (
            id SERIAL PRIMARY KEY,
            alumno_id INTEGER NOT NULL REFERENCES Alumnos(id),
            fecha_hora TIMESTAMPTZ NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Configuracion (
            id INTEGER PRIMARY KEY, 
            enviar_sms INTEGER NOT NULL DEFAULT 1
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Dias_Inhabiles (
            id SERIAL PRIMARY KEY, 
            fecha DATE NOT NULL
        );
    `);

    console.log('Verificando columnas de Horarios y Status...');

    try {
      await db.exec(`ALTER TABLE Instituciones ADD COLUMN IF NOT EXISTS fecha_ultimo_pago TIMESTAMPTZ DEFAULT NOW();`);
      console.log('✅ Columna fecha_ultimo_pago verificada en Instituciones.');
    } catch (err) {
      console.error('⚠️ Error alterando Instituciones (Postgres):', err.message);
    }

    try {
      await db.exec(`ALTER TABLE Asistencias ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'presente';`);
      await db.exec(`ALTER TABLE Asistencias ADD COLUMN IF NOT EXISTS justificacion TEXT;`);
      console.log('✅ Columnas status y justificacion verificadas en Asistencias.');
    } catch (err) {
      console.error('⚠️ Error alterando Asistencias:', err.message);
    }

    try {
      await db.exec(`ALTER TABLE Configuracion ADD COLUMN IF NOT EXISTS hora_entrada TIME DEFAULT '08:00:00';`);
      await db.exec(`ALTER TABLE Configuracion ADD COLUMN IF NOT EXISTS hora_salida TIME DEFAULT '14:00:00';`);
      await db.exec(`ALTER TABLE Configuracion ADD COLUMN IF NOT EXISTS clases_sabado BOOLEAN DEFAULT FALSE;`);
      await db.exec(`ALTER TABLE Configuracion ADD COLUMN IF NOT EXISTS clases_domingo BOOLEAN DEFAULT FALSE;`);
      console.log('✅ Columnas de Horario y Weekend verificadas en Configuracion.');
    } catch (err) {
      console.error('⚠️ Error alterando Configuracion:', err.message);
    }

    try {
      await db.exec(`
            CREATE TABLE IF NOT EXISTS Asistencias_Maestros (
                id SERIAL PRIMARY KEY,
                maestro_id INTEGER NOT NULL REFERENCES Usuarios(id),
                fecha_hora TIMESTAMPTZ NOT NULL,
                status TEXT NOT NULL, 
                institucion_id INTEGER REFERENCES Instituciones(id)
            );
        `);
      console.log('✅ Tabla Asistencias_Maestros verificada.');
    } catch (err) {
      console.error('⚠️ Error creando Asistencias_Maestros:', err.message);
    }

    try {
      await db.exec(`
            CREATE TABLE IF NOT EXISTS Visitas_Portal (
               id SERIAL PRIMARY KEY,
               institucion_id INTEGER REFERENCES Instituciones(id),
               fecha DATE NOT NULL,
               contador INTEGER DEFAULT 0,
               CONSTRAINT unique_visita_dia UNIQUE (institucion_id, fecha)
            );
        `);
      console.log('✅ Tabla Visitas_Portal verificada.');
    } catch (err) {
      console.error('⚠️ Error creando Visitas_Portal:', err.message);
    }

    try {
      await db.exec(`
            CREATE TABLE IF NOT EXISTS Avisos (
               id SERIAL PRIMARY KEY,
               institucion_id INTEGER REFERENCES Instituciones(id),
               titulo TEXT NOT NULL,
               mensaje TEXT NOT NULL,
               fecha_creacion TIMESTAMPTZ DEFAULT NOW()
            );
        `);
      console.log('✅ Tabla Avisos verificada.');
    } catch (err) {
      console.error('⚠️ Error creando Avisos:', err.message);
    }

    try {
      await db.exec(`
            CREATE TABLE IF NOT EXISTS Actividades (
               id SERIAL PRIMARY KEY,
               institucion_id INTEGER REFERENCES Instituciones(id),
               titulo TEXT NOT NULL,
               descripcion TEXT,
               fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
               clase_id INTEGER REFERENCES Clases(id) ON DELETE CASCADE
            );
        `);
      await db.exec(`
            CREATE TABLE IF NOT EXISTS Entregas_Actividades (
               id SERIAL PRIMARY KEY,
               actividad_id INTEGER NOT NULL REFERENCES Actividades(id) ON DELETE CASCADE,
               alumno_id INTEGER NOT NULL REFERENCES Alumnos(id) ON DELETE CASCADE,
               fecha_hora TIMESTAMPTZ DEFAULT NOW(),
               institucion_id INTEGER REFERENCES Instituciones(id),
               CONSTRAINT unique_entrega_alumno_actividad UNIQUE (actividad_id, alumno_id)
            );
        `);
      console.log('✅ Tablas Actividades y Entregas_Actividades verificadas.');
    } catch (err) {
      console.error('⚠️ Error creando tablas de Actividades:', err.message);
    }

    try {
      await db.exec(`
          CREATE TABLE IF NOT EXISTS Materias (
             id SERIAL PRIMARY KEY,
             nombre_materia TEXT NOT NULL,
             institucion_id INTEGER REFERENCES Instituciones(id) ON DELETE CASCADE
          );
      `);
      await db.exec(`
          CREATE TABLE IF NOT EXISTS Horarios_Clases (
             id SERIAL PRIMARY KEY,
             clase_id INTEGER NOT NULL REFERENCES Clases(id) ON DELETE CASCADE,
             dia_semana INTEGER NOT NULL,
             hora_inicio TIME NOT NULL,
             hora_fin TIME NOT NULL,
             institucion_id INTEGER REFERENCES Instituciones(id) ON DELETE CASCADE
          );
      `);
      await db.exec(`
          CREATE TABLE IF NOT EXISTS Alumnos_Clases (
             alumno_id INTEGER NOT NULL REFERENCES Alumnos(id) ON DELETE CASCADE,
             clase_id INTEGER NOT NULL REFERENCES Clases(id) ON DELETE CASCADE,
             institucion_id INTEGER NOT NULL REFERENCES Instituciones(id) ON DELETE CASCADE,
             PRIMARY KEY (alumno_id, clase_id)
          );
      `);
      console.log('✅ Tablas Materias, Horarios_Clases y Alumnos_Clases verificadas en Postgres.');
    } catch (err) {
      console.error('⚠️ Error creando tablas departamentales en Postgres:', err.message);
    }

    try {
      await db.exec("ALTER TABLE Configuracion ADD COLUMN IF NOT EXISTS modelo_departamental INTEGER DEFAULT 0;");
    } catch (e) {}
    try {
      await db.exec("ALTER TABLE Asistencias ADD COLUMN IF NOT EXISTS clase_id INTEGER REFERENCES Clases(id) ON DELETE SET NULL;");
    } catch (e) {}
    try {
      await db.exec("ALTER TABLE Clases ADD COLUMN IF NOT EXISTS materia_id INTEGER REFERENCES Materias(id) ON DELETE SET NULL;");
    } catch (e) {}
    try {
      await db.exec("ALTER TABLE Actividades ADD COLUMN IF NOT EXISTS clase_id INTEGER REFERENCES Clases(id) ON DELETE CASCADE;");
    } catch (e) {}
    try {
      await db.exec("ALTER TABLE Clases DROP CONSTRAINT IF EXISTS unique_clase_per_school;");
      await db.exec("ALTER TABLE Clases ADD CONSTRAINT unique_clase_per_school UNIQUE (grado_id, grupo_id, materia_id, institucion_id);");
      console.log("✅ SaaS: Constraint unique_clase_per_school actualizado en Clases.");
    } catch (e) {
      console.log("Nota: Error actualizando constraint en Clases: " + e.message);
    }

    const tablasParaMigrar = ['Dias_Inhabiles'];
    for (const tabla of tablasParaMigrar) {
      await agregarColumnaTenant(tabla);
    }

    console.log('Iniciando constraints...');
    try {
      await db.exec(`ALTER TABLE Grados DROP CONSTRAINT IF EXISTS grados_nombre_grado_key;`);
      await db.exec(`ALTER TABLE Grados DROP CONSTRAINT IF EXISTS unique_grado_per_school;`);
      await db.exec(`
            ALTER TABLE Grados 
            ADD CONSTRAINT unique_grado_per_school UNIQUE (nombre_grado, institucion_id);
        `);

      await db.exec(`ALTER TABLE Grupos DROP CONSTRAINT IF EXISTS grupos_nombre_grupo_key;`);
      await db.exec(`ALTER TABLE Grupos DROP CONSTRAINT IF EXISTS unique_grupo_per_school;`);
      await db.exec(`
            ALTER TABLE Grupos 
            ADD CONSTRAINT unique_grupo_per_school UNIQUE (nombre_grupo, institucion_id);
        `);

      await db.exec(`ALTER TABLE Clases DROP CONSTRAINT IF EXISTS clases_grado_id_grupo_id_key;`);
      await db.exec(`ALTER TABLE Clases DROP CONSTRAINT IF EXISTS unique_clase_per_school;`);
      await db.exec(`
            ALTER TABLE Clases 
            ADD CONSTRAINT unique_clase_per_school UNIQUE (grado_id, grupo_id, materia_id, institucion_id);
        `);

      await db.exec(`ALTER TABLE Dias_Inhabiles DROP CONSTRAINT IF EXISTS dias_inhabiles_fecha_key;`);
      await db.exec(`ALTER TABLE Dias_Inhabiles DROP CONSTRAINT IF EXISTS unique_dia_per_school;`);
      await db.exec(`
            ALTER TABLE Dias_Inhabiles 
            ADD CONSTRAINT unique_dia_per_school UNIQUE (fecha, institucion_id);
        `);

    } catch (err) {
      console.log('Nota: Ajuste de constraints UNIQUE (Grados/Grupos/Clases) omitido o ya aplicado.');
    }

    try {
      await db.exec(`ALTER TABLE Dias_Inhabiles DROP CONSTRAINT IF EXISTS dias_inhabiles_fecha_key;`);
      await db.exec(`ALTER TABLE Dias_Inhabiles DROP CONSTRAINT IF EXISTS unique_dia_per_school;`);
      await db.exec(`
            ALTER TABLE Dias_Inhabiles 
            ADD CONSTRAINT unique_dia_per_school UNIQUE (fecha, institucion_id);
        `);
      console.log('✅ Constraint Dias_Inhabiles aplicado.');
    } catch (err) {
      console.log('Nota: Constraint Dias_Inhabiles ya existe o error: ' + err.message);
    }

    try {
      await db.exec(`
          DO $$
          BEGIN
              IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asistencias_maestros_maestro_id_fkey') THEN
                  ALTER TABLE Asistencias_Maestros DROP CONSTRAINT asistencias_maestros_maestro_id_fkey;
              END IF;

              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_asistencias_maestros_cascade') THEN
                  ALTER TABLE Asistencias_Maestros
                  ADD CONSTRAINT fk_asistencias_maestros_cascade
                  FOREIGN KEY (maestro_id) REFERENCES Usuarios(id) ON DELETE CASCADE;
              END IF;
          END
          $$;
        `);
      console.log('✅ Constraint ON DELETE CASCADE aplicado a Asistencias_Maestros.');
    } catch (err) {
      console.log('Nota: Error aplicando Cascade Delete: ' + err.message);
    }

    console.log('Constraints finalizados.');

    console.log('Insertando config inicial...');
    await db.run(
      "INSERT INTO Configuracion (id, enviar_sms, institucion_id) VALUES (1, 1, 1) ON CONFLICT (id) DO NOTHING"
    );
    console.log('Config inicial lista.');

    console.log('Resincronizando secuencias en PostgreSQL...');
    const tablasSecuencia = [
      'Instituciones', 'Usuarios', 'Grados', 'Grupos', 'Clases',
      'Alumnos', 'Asistencias', 'Dias_Inhabiles', 'Asistencias_Maestros',
      'Visitas_Portal', 'Avisos', 'Actividades', 'Entregas_Actividades',
      'Materias', 'Horarios_Clases'
    ];
    for (const tabla of tablasSecuencia) {
      try {
        const seqName = `${tabla.toLowerCase()}_id_seq`;
        await pool.query(`
          SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${tabla}), 0) + 1, false);
        `);
        console.log(`✅ Secuencia ${seqName} resincronizada.`);
      } catch (err) {
        console.log(`Nota: Omitiendo resincronización de secuencia para ${tabla}: ${err.message}`);
      }
    }

    console.log('✅ Base de datos configurada para MULTI-TENANCY (SaaS).');
    return db;
  }
}

module.exports = { setupDatabase, db };