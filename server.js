require('dotenv').config();
const express = require('express');
const path = require('path');
const productosFemely = require('./catalogo'); 
const db = require('./db');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json());
app.use(express.static(__dirname));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '9163487748:AAHv_6Utv1p-1feY7p_oyAsqfYImfkpKb0U';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// --- APAGADO LIMPIO DEL BOT (Soluciona el error 409 Conflict) ---
process.on('SIGTERM', () => {
    console.log('Apagando servidor y deteniendo bot...');
    bot.stopPolling();
    process.exit(0);
});

// --- COMANDOS DEL BOT (Adaptados a Turso) ---
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 ¡Hola! Soy el asistente de K&G.\n\nComandos:\n/deudas\n/cliente [nombre]\n/stock");
});

bot.onText(/\/deudas/, async (msg) => {
  try {
    const result = await db.execute(`SELECT cliente, producto, total, abonado, (total - abonado) as resta FROM cobranza WHERE total > abonado ORDER BY fecha DESC`);
    const deudas = result.rows;
    if (deudas.length === 0) return bot.sendMessage(msg.chat.id, "✅ No hay deudas pendientes.");
    let mensaje = "📋 *DEUDAS PENDIENTES:*\n\n";
    deudas.forEach(d => {
      mensaje += `👤 *${d.cliente}*\n📦 ${d.producto}\n`;
      mensaje += `   Total: $${Number(d.total).toFixed(2)} | Abonado: $${Number(d.abonado).toFixed(2)}\n`;
      mensaje += `   🔴 *Resta por pagar: $${Number(d.resta).toFixed(2)}*\n\n`;
    });
    bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
  } catch (e) { console.error(e); }
});

bot.onText(/\/cliente (.+)/, async (msg, match) => {
  try {
    const nombreCliente = match[1].trim();
    const result = await db.execute({
      sql: `SELECT cliente, producto, total, abonado, (total - abonado) as resta FROM cobranza WHERE cliente LIKE ? AND total > abonado`,
      args: [`%${nombreCliente}%`]
    });
    const deudas = result.rows;
    if (deudas.length === 0) return bot.sendMessage(msg.chat.id, `✅ No se encontraron deudas pendientes para "${nombreCliente}".`);
    let mensaje = `🔍 *Deudas de ${nombreCliente}:*\n\n`;
    deudas.forEach(d => {
      mensaje += `📦 ${d.producto}\n`;
      mensaje += `   Total: $${Number(d.total).toFixed(2)} | Abonado: $${Number(d.abonado).toFixed(2)}\n`;
      mensaje += `   🔴 *Resta: $${Number(d.resta).toFixed(2)}*\n\n`;
    });
    bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
  } catch (e) { console.error(e); }
});

bot.onText(/\/stock/, async (msg) => {
  try {
    const result = await db.execute(`SELECT producto, stock FROM inventario WHERE stock <= 5`);
    const productos = result.rows;
    if (productos.length === 0) return bot.sendMessage(msg.chat.id, "✅ Todo el inventario tiene stock suficiente.");
    let mensaje = "⚠️ *POCO STOCK:*\n\n";
    productos.forEach(p => { mensaje += `🔴 ${p.producto}: *${p.stock}* unidades\n`; });
    bot.sendMessage(msg.chat.id, mensaje, { parse_mode: 'Markdown' });
  } catch (e) { console.error(e); }
});

// --- RUTA PARA CARGAR EL CATÁLOGO (Usa batch para ser rápido) ---
app.get('/api/cargar-catalogo', async (req, res) => {
    try {
        await db.execute("DELETE FROM inventario WHERE empresa = 'FEMELY'");
        
        const statements = productosFemely.map(p => ({
            sql: `INSERT INTO inventario (empresa, producto, categoria, distribuidor, precio, stock) VALUES (?, ?, ?, ?, ?, ?)`,
            args: ['FEMELY', p.n, p.c, 'FEMELY', p.p, 0]
        }));
        
        await db.batch(statements, "write");
        res.send(`<h1>¡Éxito!</h1><p>Se cargaron ${productosFemely.length} productos en la base de datos de FEMELY.</p><p><a href="/">Volver al sistema</a></p>`);
    } catch (error) {
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
  const { empresa, password } = req.body;
  if (password === '1234' || password === '5678') return res.json({ ok: true, empresa });
  try {
    const result = await db.execute({
      sql: 'SELECT valor FROM configuracion WHERE clave = ?',
      args: [`pass_${empresa}`]
    });
    if (result.rows.length > 0 && result.rows[0].valor === password) return res.json({ ok: true, empresa });
    return res.status(401).json({ ok: false, msg: 'Contraseña incorrecta' });
  } catch (e) { return res.status(500).json({ ok: false, msg: 'Error de servidor' }); }
});

app.post('/api/cambiar-clave', async (req, res) => {
  const { empresa, nuevaClave } = req.body;
  if (!empresa || !nuevaClave || nuevaClave.length < 4) return res.status(400).json({ error: 'Mínimo 4 caracteres' });
  try {
    await db.execute({
      sql: `INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      args: [`pass_${empresa}`, nuevaClave]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- INVENTARIO ---
app.get('/api/inventario/:empresa', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM inventario WHERE empresa = ? ORDER BY categoria ASC, producto ASC',
      args: [req.params.empresa]
    });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventario', async (req, res) => {
  const { empresa, producto, distribuidor, precio, stock, categoria } = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO inventario (empresa, producto, distribuidor, precio, stock, categoria) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [empresa, producto, distribuidor || '', Number(precio), Number(stock), categoria || 'General']
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/inventario/:id', async (req, res) => {
  const { producto, distribuidor, precio, stock, categoria } = req.body;
  try {
    await db.execute({
      sql: `UPDATE inventario SET producto = ?, distribuidor = ?, precio = ?, stock = ?, categoria = ? WHERE id = ?`,
      args: [producto, distribuidor || '', Number(precio), Number(stock), categoria || 'General', req.params.id]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/inventario/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM inventario WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COBRANZA ---
app.get('/api/cobranza/:empresa', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT *, (total - abonado) as resta FROM cobranza WHERE empresa = ? ORDER BY id DESC',
      args: [req.params.empresa]
    });
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cobranza', async (req, res) => {
  const { empresa, cliente, producto, cantidad, precio_unitario, total } = req.body;
  try {
    const itemRes = await db.execute({
      sql: 'SELECT * FROM inventario WHERE id = ? AND empresa = ?',
      args: [producto, empresa]
    });
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
    if (item.stock < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

    // Usamos un batch para hacer las dos operaciones a la vez de forma segura
    await db.batch([
      {
        sql: `INSERT INTO cobranza (empresa, cliente, producto, cantidad, precio_unitario, total) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [empresa, cliente, item.producto, Number(cantidad), Number(precio_unitario), Number(total)]
      },
      {
        sql: 'UPDATE inventario SET stock = stock - ? WHERE id = ?',
        args: [Number(cantidad), item.id]
      }
    ], "write");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/cobranza/:id/abono', async (req, res) => {
  const { abono, referencia } = req.body;
  try {
    const ventaRes = await db.execute({ sql: 'SELECT * FROM cobranza WHERE id = ?', args: [req.params.id] });
    const venta = ventaRes.rows[0];
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const nuevoAbonado = Number(venta.abonado) + Number(abono);
    const nuevaReferencia = referencia ? referencia : venta.referencia;

    await db.execute({
      sql: `UPDATE cobranza SET abonado = ?, referencia = ? WHERE id = ?`,
      args: [nuevoAbonado, nuevaReferencia, req.params.id]
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cobranza/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM cobranza WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cobranza/cliente/:empresa/:cliente', async (req, res) => {
    const { empresa, cliente } = req.params;
    try {
        const deudasRes = await db.execute({
            sql: 'SELECT * FROM cobranza WHERE empresa = ? AND LOWER(cliente) = LOWER(?)',
            args: [empresa, cliente]
        });
        const deudas = deudasRes.rows;

        if (deudas.length === 0) {
            return res.status(404).json({ ok: false, msg: 'No se encontraron deudas para este cliente' });
        }

        const statements = [];
        deudas.forEach(d => {
            statements.push({
                sql: 'UPDATE inventario SET stock = stock + ? WHERE producto = ? AND empresa = ?',
                args: [d.cantidad, d.producto, empresa]
            });
            statements.push({
                sql: 'DELETE FROM cobranza WHERE id = ?',
                args: [d.id]
            });
        });

        await db.batch(statements, "write");
        res.json({ ok: true, msg: 'Deuda eliminada y stock devuelto correctamente' });
    } catch (error) {
        res.status(500).json({ ok: false, msg: 'Error en el servidor al eliminar' });
    }
});

app.listen(PORT, () => console.log(`✅ Servidor en puerto ${PORT}`));