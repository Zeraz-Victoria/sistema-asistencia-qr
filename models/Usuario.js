const { db } = require('../config/database');

class Usuario {
    static async findByEmail(identifier) {
        if (!identifier) return null;
        const clean = identifier.trim().toLowerCase();
        // 1. Coincidencia exacta por correo
        let u = await db.get("SELECT * FROM Usuarios WHERE LOWER(email) = $1", [clean]);
        if (u) return u;

        // 2. Coincidencia por columna usuario
        try {
            u = await db.get("SELECT * FROM Usuarios WHERE LOWER(usuario) = $1", [clean]);
            if (u) return u;
        } catch (e) {}

        // 3. Coincidencia por nombre completo
        u = await db.get("SELECT * FROM Usuarios WHERE LOWER(nombre_completo) = $1", [clean]);
        if (u) return u;

        // 4. Coincidencia por prefijo de correo (antes del @)
        u = await db.get("SELECT * FROM Usuarios WHERE LOWER(email) LIKE $1", [`${clean}@%`]);
        if (u) return u;

        return null;
    }

    static async findByNfc(nfcUid) {
        return await db.get(`
            SELECT * FROM Usuarios 
            WHERE UPPER(TRIM(COALESCE(codigo_qr, nfc_uid))) = UPPER(TRIM($1))
               OR UPPER(REPLACE(REPLACE(REPLACE(COALESCE(codigo_qr, nfc_uid), ':', ''), '-', ''), ' ', '')) = UPPER(REPLACE(REPLACE(REPLACE($1, ':', ''), '-', ''), ' ', ''))
        `, [nfcUid]);
    }

    static async findById(id) {
        return await db.get("SELECT * FROM Usuarios WHERE id = $1", [id]);
    }

    // Add other methods as needed
}

module.exports = Usuario;
