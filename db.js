const { createClient } = require('@libsql/client');

const db = createClient({
  url: 'libsql://kg-db-cosmic-aquarius-tnuc4n.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM1Njg4NzAsImlkIjoiMDFhMTk4ZGEtYTMwMS03MTUxLTgyMTEtNjIxZmY5MmE2OTE0Iiwia2lkIjoiOHk1bVFYWVo0RjNGR05sYTJ1bTZlWHhzMkMwR282cm1na1FjS0c0SjRmSSIsInJpZCI6IjYzZGM0YjlmLWQxYTUtNGE5Yy04YWVkLWZmZGU3NWJjMGU5YiJ9.hJJaW9fzaSlCL1Xu7XrlITnltNwMb662dorpd20LA8OS6tnulNGsIB9YLOg3Km8UVq2quedQQxVqYlVrUftFDg'
});

const prepare = (sql) => ({
  run: async (...args) => await db.execute({ sql, args }),
  get: async (...args) => (await db.execute({ sql, args })).rows[0],
  all: async (...args) => (await db.execute({ sql, args })).rows
});

// Creamos las tablas
db.batch([
  `CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT)`,
  `CREATE TABLE IF NOT EXISTS inventario (id INTEGER PRIMARY KEY AUTOINCREMENT, empresa TEXT, producto TEXT, distribuidor TEXT, precio REAL, stock INTEGER, creado TEXT DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS cobranza (id INTEGER PRIMARY KEY AUTOINCREMENT, empresa TEXT, cliente TEXT, producto TEXT, cantidad INTEGER, precio_unitario REAL, total REAL, cuota1 REAL, cuota2 REAL, cuota3 REAL DEFAULT 0, pago1 INTEGER DEFAULT 0, pago2 INTEGER DEFAULT 0, pago3 INTEGER DEFAULT 0, fecha TEXT DEFAULT CURRENT_TIMESTAMP)`
], "write").catch(console.error);

// Agregamos la columna 'referencia' a la tabla cobranza si no existe
db.execute(`ALTER TABLE cobranza ADD COLUMN referencia TEXT`).catch(() => {
  // Si la columna ya existe, no hace nada y evita el error
});

module.exports = { prepare };