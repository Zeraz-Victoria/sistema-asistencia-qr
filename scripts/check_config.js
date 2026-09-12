const { db } = require('./config/database');

async function checkColumns() {
    try {
        const rows = await db.all("SELECT column_name FROM information_schema.columns WHERE table_name = 'configuracion'");
        console.log(rows.map(r => r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkColumns();
