require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
  try {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT)`,
      `CREATE TABLE IF NOT EXISTS inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT, empresa TEXT, producto TEXT, 
        categoria TEXT, distribuidor TEXT, precio REAL, stock INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS cobranza (
        id INTEGER PRIMARY KEY AUTOINCREMENT, empresa TEXT, cliente TEXT, 
        producto TEXT, cantidad INTEGER, precio_unitario REAL, total REAL, 
        abonado REAL DEFAULT 0, referencia TEXT, fecha DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ]);
    console.log("✅ Conectado a Turso y tablas verificadas.");
  } catch (e) {
    console.error("❌ Error conectando a Turso:", e);
  }
}

initDB();

module.exports = db;