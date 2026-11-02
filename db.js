const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 1. Definir ruta de la base de datos
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// 2. Intentar usar la carpeta /data de Render (que es persistente)
let dbDir;

if (isProduction) {
  dbDir = '/data'; 
} else {
  dbDir = path.join(__dirname, 'data');
}

// 3. Crear la carpeta si no existe
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (error) {
  console.warn(`⚠️ No se pudo crear la carpeta ${dbDir}, usando /tmp (LOS DATOS SE BORRARÁN AL REINICIAR)`);
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

// 5. Crear las tablas (CORREGIDO: Se quitó el comentario HTML que rompía el código)
db.exec(`
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );
  CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT,
    producto TEXT,
    categoria TEXT,
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

// 6. PARCHE DE MIGRACIÓN: Si tu base de datos ya existía sin la columna, esto la agrega sin borrar tus datos.
try {
    // Verificamos si la columna existe consultando la estructura de la tabla
    const tableInfo = db.prepare("PRAGMA table_info(inventario)").all();
    const tieneCategoria = tableInfo.some(col => col.name === 'categoria');
    
    if (!tieneCategoria) {
        db.exec(`ALTER TABLE inventario ADD COLUMN categoria TEXT;`);
        console.log("✅ Columna 'categoria' agregada a la base de datos exitosamente.");
    }
} catch (e) {
    console.log("La columna 'categoria' ya existe o hubo un error menor:", e.message);
}

module.exports = db;