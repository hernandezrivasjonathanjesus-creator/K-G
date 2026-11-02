const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Definir ruta de la base de datos
// En Render (producción) usamos /tmp porque el disco es efímero
// En local usamos una carpeta "data"
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const dbDir = isProduction ? '/tmp' : path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'database.db');

// 2. Crear la carpeta si no existe (esto evita tu error)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 3. Abrir la base de datos
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 4. Crear las tablas si no existen (por si Render las borra)
db.exec(`
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );
  CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT,
    producto TEXT,
    distribuidor TEXT,
    precio REAL,
    stock INTEGER
  );
  CREATE TABLE IF NOT EXISTS cobranza (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT,
    cliente TEXT,
    producto TEXT,
    cantidad INTEGER,
    precio_unitario REAL,
    total REAL,
    abonado REAL DEFAULT 0,
    referencia TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;