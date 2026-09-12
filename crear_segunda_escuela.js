/*
 * ARCHIVO: crear_segunda_escuela.js
 * USO: Ejecutar con "node crear_segunda_escuela.js" en la terminal
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function crearDatosPrueba() {
  try {
    console.log('--- CREANDO ESCUELA DE PRUEBA (SAAS) ---');

    // 1. Crear la Institución
    console.log('1. Creando Institución "Academia Test SaaS"...');
    const resInst = await pool.query(`
      INSERT INTO Instituciones (nombre, plan, estado) 
      VALUES ($1, $2, $3) 
      RETURNING id`, 
      ['Academia Test SaaS', 'pro', 'activo']
    );
    const escuelaId = resInst.rows[0].id;
    console.log(`✅ Institución creada con ID: ${escuelaId}`);

    // 2. Crear el Director para esa escuela
    console.log('2. Creando usuario Director...');
    const email = 'director@test.com';
    const password = '123'; // Contraseña simple para pruebas
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const resUser = await pool.query(`
      INSERT INTO Usuarios (email, password_hash, rol, nombre_completo, institucion_id) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [email, hash, 'director', 'Director de Prueba', escuelaId]
    );
    console.log(`✅ Usuario creado: ${email} (Password: ${password})`);
    
    // 3. Crear unos datos "falsos" solo para esta escuela (para ver que no se mezclan)
    console.log('3. Insertando datos de ejemplo...');
    await pool.query("INSERT INTO Grados (nombre_grado, institucion_id) VALUES ('1er Semestre', $1)", [escuelaId]);
    await pool.query("INSERT INTO Grupos (nombre_grupo, institucion_id) VALUES ('Grupo Alpha', $1)", [escuelaId]);
    
    console.log('--- ¡LISTO! ---');
    console.log('Ahora intenta hacer login con estas credenciales y verifica que NO veas los alumnos de tu escuela real.');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

crearDatosPrueba();