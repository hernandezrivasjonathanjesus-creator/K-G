const express = require('express');
const path = require('path');
const productosFemely = require('./catalogo'); // <-- Importamos la lista
const db = require('./db');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json());
app.use(express.static(__dirname));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '9163487748:AAHv_6Utv1p-1feY7p_oyAsqfYImfkpKb0U';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 ¡Hola! Soy el asistente de K&G.\n\nComandos:\n/deudas\n/cliente [nombre]\n/stock");
});

bot.onText(/\/deudas/, (msg) => {
  const deudas = db.prepare(`SELECT cliente, producto, total, abonado, (total - abonado) as resta FROM cobranza WHERE total > abonado ORDER BY fecha DESC`).all();
  if (deudas.length === 0) return bot.sendMessage(msg.chat.id, "✅ No hay deudas pendientes.");
  let mensaje = "📋 *DEUDAS PENDIENTES:*\n\n";
  deudas.forEach(d => {
    mensaje += `👤 *${d.cliente}*\n📦 ${d.producto}\n`;
    mensaje += `   Total: $${Number(d.total).toFixed(2)} | Abonado: $${Number(d.abonado).toFixed(2)}\n`;
    mensaje += `   🔴 *Resta por pagar: $${Number(d.resta).toFixed(2)}*\n\n`;
  });
  bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
});

bot.onText(/\/cliente (.+)/, (msg, match) => {
  const nombreCliente = match[1].trim();
  const deudas = db.prepare(`SELECT cliente, producto, total, abonado, (total - abonado) as resta FROM cobranza WHERE cliente LIKE ? AND total > abonado`).all(`%${nombreCliente}%`);
  if (deudas.length === 0) return bot.sendMessage(msg.chat.id, `✅ No se encontraron deudas pendientes para "${nombreCliente}".`);
  let mensaje = `🔍 *Deudas de ${nombreCliente}:*\n\n`;
  deudas.forEach(d => {
    mensaje += `📦 ${d.producto}\n`;
    mensaje += `   Total: $${Number(d.total).toFixed(2)} | Abonado: $${Number(d.abonado).toFixed(2)}\n`;
    mensaje += `   🔴 *Resta: $${Number(d.resta).toFixed(2)}*\n\n`;
  });
  bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
});

bot.onText(/\/stock/, (msg) => {
  const productos = db.prepare(`SELECT producto, stock FROM inventario WHERE stock <= 5`).all();
  if (productos.length === 0) return bot.sendMessage(msg.chat.id, "✅ Todo el inventario tiene stock suficiente.");
  let mensaje = "⚠️ *POCO STOCK:*\n\n";
  productos.forEach(p => { mensaje += `🔴 ${p.producto}: *${p.stock}* unidades\n`; });
  bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
});

// --- RUTA SECRETA PARA CARGAR EL CATÁLOGO DE GOLPE ---
app.get('/api/cargar-catalogo', (req, res) => {
    try {
        // 1. CREAMOS LA COLUMNA CATEGORÍA SI NO EXISTE
        try { db.prepare("ALTER TABLE inventario ADD COLUMN categoria TEXT").run(); } catch(e) { /* Si ya existe, no hace nada */ }

        // 2. Borramos los productos viejos para no duplicar
        db.prepare("DELETE FROM inventario WHERE empresa = 'FEMELY'").run();
        
        // 3. Insertamos los nuevos con STOCK EN 0
        const insert = db.prepare(`INSERT INTO inventario (empresa, producto, categoria, distribuidor, precio, stock) VALUES (?, ?, ?, ?, ?, ?)`);
        const insertarMuchos = db.transaction((prods) => {
            for (const p of prods) {
                insert.run('FEMELY', p.n, p.c, 'FEMELY', p.p, 0);
            }
        });
        insertarMuchos(productosFemely);
        
        res.send(`<h1>¡Éxito!</h1><p>Se cargaron ${productosFemely.length} productos en la base de datos de FEMELY.</p><p><a href="/">Volver al sistema</a></p>`);
    } catch (error) {
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
});

// --- LOGIN ---
app.post('/api/login', (req, res) => {
  const { empresa, password } = req.body;
  if (password === '1234' || password === '5678') return res.json({ ok: true, empresa });
  try {
    const config = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(`pass_${empresa}`);
    if (config && config.valor === password) return res.json({ ok: true, empresa });
    return res.status(401).json({ ok: false, msg: 'Contraseña incorrecta' });
  } catch (e) { return res.status(500).json({ ok: false, msg: 'Error de servidor' }); }
});

app.post('/api/cambiar-clave', (req, res) => {
  const { empresa, nuevaClave } = req.body;
  if (!empresa || !nuevaClave || nuevaClave.length < 4) return res.status(400).json({ error: 'Mínimo 4 caracteres' });
  db.prepare(`INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(`pass_${empresa}`, nuevaClave);
  res.json({ ok: true });
});

// --- INVENTARIO (ORDENADO POR CATEGORÍA Y NOMBRE) ---
app.get('/api/inventario/:empresa', (req, res) => {
  // AQUÍ ESTÁ EL CAMBIO PARA QUE SE ORDENE POR CATEGORÍA
  res.json(db.prepare('SELECT * FROM inventario WHERE empresa = ? ORDER BY categoria ASC, producto ASC').all(req.params.empresa));
});

app.post('/api/inventario', (req, res) => {
  const { empresa, producto, distribuidor, precio, stock, categoria } = req.body;
  db.prepare(`INSERT INTO inventario (empresa, producto, distribuidor, precio, stock, categoria) VALUES (?, ?, ?, ?, ?, ?)`).run(empresa, producto, distribuidor || '', Number(precio), Number(stock), categoria || 'General');
  res.json({ ok: true });
});

app.put('/api/inventario/:id', (req, res) => {
  const { producto, distribuidor, precio, stock, categoria } = req.body;
  try {
    db.prepare(`UPDATE inventario SET producto = ?, distribuidor = ?, precio = ?, stock = ?, categoria = ? WHERE id = ?`)
      .run(producto, distribuidor || '', Number(precio), Number(stock), categoria || 'General', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventario/:id', (req, res) => {
  db.prepare('DELETE FROM inventario WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- COBRANZA ---
app.get('/api/cobranza/:empresa', (req, res) => {
  res.json(db.prepare('SELECT *, (total - abonado) as resta FROM cobranza WHERE empresa = ? ORDER BY id DESC').all(req.params.empresa));
});

app.post('/api/cobranza', (req, res) => {
  const { empresa, cliente, producto, cantidad, precio_unitario, total } = req.body;
  const item = db.prepare('SELECT * FROM inventario WHERE id = ? AND empresa = ?').get(producto, empresa);
  if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
  if (item.stock < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

  db.prepare(`INSERT INTO cobranza (empresa, cliente, producto, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?, ?)`).run(empresa, cliente, item.producto, Number(cantidad), Number(precio_unitario), Number(total));
  db.prepare('UPDATE inventario SET stock = stock - ? WHERE id = ?').run(Number(cantidad), item.id);
  res.json({ ok: true });
});

app.put('/api/cobranza/:id/abono', (req, res) => {
  const { abono, referencia } = req.body;
  const venta = db.prepare('SELECT * FROM cobranza WHERE id = ?').get(req.params.id);
  const nuevoAbonado = Number(venta.abonado) + Number(abono);
  const nuevaReferencia = referencia ? referencia : venta.referencia;

  db.prepare(`UPDATE cobranza SET abonado = ?, referencia = ? WHERE id = ?`).run(nuevoAbonado, nuevaReferencia, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/cobranza/:id', (req, res) => {
  db.prepare('DELETE FROM cobranza WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`✅ Servidor en puerto ${PORT}`));