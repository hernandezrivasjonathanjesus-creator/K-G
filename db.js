const Database = require('better-sqlite3');
const path = require('path');

// Usa el disco persistente en Render, o local en tu PC
const dbPath = process.env.RENDER ? '/data/kg.db' : path.join(__dirname, 'kg.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT);
  CREATE TABLE IF NOT EXISTS inventario (id INTEGER PRIMARY KEY AUTOINCREMENT, empresa TEXT, producto TEXT, distribuidor TEXT, precio REAL, stock INTEGER, creado TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS cobranza (id INTEGER PRIMARY KEY AUTOINCREMENT, empresa TEXT, cliente TEXT, producto TEXT, cantidad INTEGER, precio_unitario REAL, total REAL, cuota1 REAL, cuota2 REAL, cuota3 REAL DEFAULT 0, pago1 INTEGER DEFAULT 0, pago2 INTEGER DEFAULT 0, pago3 INTEGER DEFAULT 0, referencia TEXT, fecha TEXT DEFAULT CURRENT_TIMESTAMP);
`);

module.exports = db;