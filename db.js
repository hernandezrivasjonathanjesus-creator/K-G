const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Definir ruta de la base de datos
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// 2. Intentar usar la carpeta /data de Render (que suele ser persistente)
// Si no existe, la creamos.
let dbDir;

if (isProduction) {
  dbDir = '/data'; 
} else {
  dbDir = path.join(__dirname, 'data');
}

// 3. Crear la carpeta si no existe (esto evita errores)
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (error) {
  // Si Render no nos deja crear /data, usamos /tmp como respaldo
  console.warn(`No se pudo crear la carpeta ${dbDir}, usando /tmp`);
  dbDir = '/tmp';
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

const dbPath = path.join(dbDir, 'database.db');
console.log(`📁 Base de datos ubicada en: ${dbPath}`);

// 4. Abrir la base de datos
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 5. Crear las tablas si no existen (por si Render las borra)
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