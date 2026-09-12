const { db } = require('../config/database');

async function run() {
    try {
        console.log("Applying migration: Add motivo to Dias_Inhabiles...");
        await db.exec("ALTER TABLE Dias_Inhabiles ADD COLUMN IF NOT EXISTS motivo TEXT;");
        console.log("Migration successful.");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    }
}

run();
