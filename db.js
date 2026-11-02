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
  // En local, usamos la misma carpeta donde está el proyecto
  dbDir = __dirname; 
}

// 3. Crear la carpeta si no existe (solo aplica para local o si /data falla)
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

// 4. Asignamos el nombre 'kg.db' para mantener tu archivo original
const dbPath = path.join(dbDir, 'kg.db');
console.log(`📁 Base de datos ubicada en: ${dbPath}`);

// 5. Abrir la base de datos
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 6. Crear las tablas
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

// 7. PARCHE DE MIGRACIÓN
try {
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