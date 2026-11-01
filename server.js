const express = require('express');
const path = require('path');
const db = require('./db');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// CONFIGURACIÓN DEL BOT
// ============================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '9163487748:AAHv_6Utv1p-1feY7p_oyAsqfYImfkpKb0U';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 ¡Hola! Soy el asistente de K&G.\n\nComandos:\n/deudas\n/cliente [nombre]\n/stock");
});

bot.onText(/\/deudas/, (msg) => {
  const deudas = db.prepare(`SELECT cliente, producto, cuota1, cuota2, pago1, pago2, fecha FROM cobranza WHERE pago1 = 0 OR pago2 = 0 ORDER BY fecha DESC`).all();
  if (deudas.length === 0) return bot.sendMessage(msg.chat.id, "✅ No hay deudas pendientes.");
  let mensaje = "📋 *DEUDAS PENDIENTES:*\n\n";
  deudas.forEach(d => {
    mensaje += `👤 *${d.cliente}*\n📦 ${d.producto}\n`;
    if (d.pago1 === 0) mensaje += `   🔴 Cuota 1 (15d): $${Number(d.cuota1).toFixed(2)}\n`;
    if (d.pago2 === 0) mensaje += `   🔴 Cuota 2 (30d): $${Number(d.cuota2).toFixed(2)}\n\n`;
  });
  bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
});

bot.onText(/\/cliente (.+)/, (msg, match) => {
  const nombreCliente = match[1].trim();
  const deudas = db.prepare(`SELECT cliente, producto, cuota1, cuota2, pago1, pago2 FROM cobranza WHERE cliente LIKE ? AND (pago1 = 0 OR pago2 = 0)`).all(`%${nombreCliente}%`);
  if (deudas.length === 0) return bot.sendMessage(msg.chat.id, `✅ No se encontraron deudas para "${nombreCliente}".`);
  let mensaje = `🔍 *Deudas de ${nombreCliente}:*\n\n`;
  deudas.forEach(d => {
    mensaje += `📦 ${d.producto}\n`;
    if (d.pago1 === 0) mensaje += `   🔴 Cuota 1: $${Number(d.cuota1).toFixed(2)}\n`;
    if (d.pago2 === 0) mensaje += `   🔴 Cuota 2: $${Number(d.cuota2).toFixed(2)}\n\n`;
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

// ============================================
// API DE LA WEB
// ============================================
app.post('/api/login', (req, res) => {
  const { empresa, password } = req.body;
  if (!empresa || !password) return res.status(400).json({ ok: false, msg: 'Faltan datos' });
  
  const config = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(`pass_${empresa}`);
  const passCorrecta = config ? config.valor : (empresa === 'FEMELY' ? '1234' : '5678');
  
  if (passCorrecta === password) return res.json({ ok: true, empresa });
  return res.status(401).json({ ok: false, msg: 'Contraseña incorrecta' });
});

app.post('/api/cambiar-clave', (req, res) => {
  const { empresa, nuevaClave } = req.body;
  if (!empresa || !nuevaClave || nuevaClave.length < 4) return res.status(400).json({ error: 'Mínimo 4 caracteres' });
  
  db.prepare(`INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(`pass_${empresa}`, nuevaClave);
  res.json({ ok: true });
});

app.get('/api/inventario/:empresa', (req, res) => {
  const datos = db.prepare('SELECT * FROM inventario WHERE empresa = ? ORDER BY id DESC').all(req.params.empresa);
  res.json(datos);
});

app.post('/api/inventario', (req, res) => {
  const { empresa, producto, distribuidor, precio, stock } = req.body;
  try {
    db.prepare(`INSERT INTO inventario (empresa, producto, distribuidor, precio, stock) VALUES (?, ?, ?, ?, ?)`).run(empresa, producto, distribuidor || '', Number(precio), Number(stock));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventario/:id', (req, res) => {
  db.prepare('DELETE FROM inventario WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/cobranza/:empresa', (req, res) => {
  const datos = db.prepare('SELECT * FROM cobranza WHERE empresa = ? ORDER BY id DESC').all(req.params.empresa);
  res.json(datos);
});

app.post('/api/cobranza', (req, res) => {
  const { empresa, cliente, producto, cantidad, precio_unitario, total, cuota1, cuota2, referencia } = req.body;
  try {
    const item = db.prepare('SELECT * FROM inventario WHERE id = ? AND empresa = ?').get(producto, empresa);
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
    if (item.stock < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

    db.prepare(`INSERT INTO cobranza (empresa, cliente, producto, cantidad, precio_unitario, total, cuota1, cuota2, referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(empresa, cliente, item.producto, Number(cantidad), Number(precio_unitario), Number(total), Number(cuota1), Number(cuota2), referencia || '');

    db.prepare('UPDATE inventario SET stock = stock - ? WHERE id = ?').run(Number(cantidad), item.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cobranza/:id/pago', (req, res) => {
  const { cuota } = req.body;
  db.prepare(`UPDATE cobranza SET pago${cuota} = 1 - pago${cuota} WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/cobranza/:id', (req, res) => {
  db.prepare('DELETE FROM cobranza WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`✅ Servidor en puerto ${PORT}`));