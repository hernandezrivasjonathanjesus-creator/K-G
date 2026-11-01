const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.RENDER ? '/data/kg.db' : path.join(__dirname, 'kg.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );

  CREATE TABLE IF NOT EXISTS inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT NOT NULL,
    producto TEXT NOT NULL,
    distribuidor TEXT,
    precio REAL NOT NULL,
    stock INTEGER NOT NULL,
    creado TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobranza (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa TEXT NOT NULL,
    cliente TEXT NOT NULL,
    producto TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    total REAL NOT NULL,
    cuota1 REAL NOT NULL,
    cuota2 REAL NOT NULL,
    cuota3 REAL DEFAULT 0,
    pago1 INTEGER DEFAULT 0,
    pago2 INTEGER DEFAULT 0,
    pago3 INTEGER DEFAULT 0,
    fecha TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;