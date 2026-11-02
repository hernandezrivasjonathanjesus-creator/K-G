let empresaActual = null;
let fuenteActual = 16;
let ventaSeleccionadaId = null;

setInterval(() => {
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = new Date().toLocaleString('es-VE');
}, 1000);

// --- ACCESIBILIDAD ---
function toggleAccesibilidad() { document.getElementById('panel-accesibilidad').classList.toggle('hidden'); }
function cambiarTema(tema) { document.body.className = ''; if (tema !== 'default') document.body.classList.add(`theme-${tema}`); }
function cambiarFuente(accion) { fuenteActual += (accion * 2); if (fuenteActual < 12) fuenteActual = 12; if (fuenteActual > 24) fuenteActual = 24; document.documentElement.style.fontSize = `${fuenteActual}px`; }

// --- MODAL CLAVE ---
function abrirModalClave() { document.getElementById('modal-clave').classList.remove('hidden'); document.getElementById('empresa-clave-txt').textContent = `Empresa: ${empresaActual}`; document.getElementById('nueva-clave').value = ''; }
function cerrarModalClave() { document.getElementById('modal-clave').classList.add('hidden'); }
async function guardarClave() {
    const nueva = document.getElementById('nueva-clave').value;
    if (nueva.length < 4) return alert('La contraseña debe tener al menos 4 caracteres.');
    const res = await fetch('/api/cambiar-clave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa: empresaActual, nuevaClave: nueva }) });
    if (res.ok) { alert('¡Contraseña actualizada!'); cerrarModalClave(); } else { alert('Error al guardar.'); }
}

// --- MODAL EDITAR PRODUCTO ---
function abrirModalEditar(id, producto, distribuidor, precio, stock) {
    document.getElementById('modal-editar').classList.remove('hidden');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-prod').value = producto;
    document.getElementById('edit-dist').value = distribuidor === '-' ? '' : distribuidor;
    document.getElementById('edit-precio').value = precio;
    document.getElementById('edit-stock').value = stock;
}
function cerrarModalEditar() { document.getElementById('modal-editar').classList.add('hidden'); }
async function guardarEdicion() {
    const id = document.getElementById('edit-id').value;
    const payload = {
        producto: document.getElementById('edit-prod').value.trim(),
        distribuidor: document.getElementById('edit-dist').value.trim(),
        precio: parseFloat(document.getElementById('edit-precio').value),
        stock: parseInt(document.getElementById('edit-stock').value)
    };
    await fetch(`/api/inventario/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    cerrarModalEditar();
    await cargarInventario();
}

// --- MODAL ABONO ---
function abrirModalAbono(id, resta) {
    ventaSeleccionadaId = id;
    document.getElementById('modal-abono').classList.remove('hidden');
    document.getElementById('abono-resta-txt').textContent = `Resta por pagar: $${Number(resta).toFixed(2)}`;
    document.getElementById('monto-abono').value = Number(resta).toFixed(2);
    document.getElementById('ref-abono').value = '';
}
function cerrarModalAbono() { document.getElementById('modal-abono').classList.add('hidden'); }
async function guardarAbono() {
    const monto = parseFloat(document.getElementById('monto-abono').value);
    const referencia = document.getElementById('ref-abono').value.trim();
    if (monto <= 0) return alert('El monto debe ser mayor a 0');
    await fetch(`/api/cobranza/${ventaSeleccionadaId}/abono`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abono: monto, referencia: referencia }) });
    cerrarModalAbono();
    await cargarCobranza();
}

// --- LOGIN ---
async function verificar() {
    const empresa = document.getElementById('empresa-select').value;
    const password = document.getElementById('pass').value;
    const errBox = document.getElementById('login-error');
    errBox.textContent = '';

    try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa, password }) });
        const data = await res.json();
        if (!data.ok) { errBox.textContent = data.msg || 'Error de acceso'; return; }

        empresaActual = empresa;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('nombre-empresa-titulo').textContent = empresa;

        await cargarInventario();
        await cargarCobranza();
        await cargarBCV();
    } catch (e) { errBox.textContent = 'Error de conexión'; }
}

function verPestaña(tab) {
    document.getElementById('sec-inv').classList.toggle('hidden', tab !== 'inv');
    document.getElementById('sec-cob').classList.toggle('hidden', tab !== 'cob');
}

// --- INVENTARIO ---
async function cargarInventario() {
    const res = await fetch(`/api/inventario/${empresaActual}`);
    const datos = await res.json();
    const tbody = document.querySelector('#t-inv tbody');
    tbody.innerHTML = '';
    if (datos.length === 0) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">Sin productos</td></tr>`;

    datos.forEach(d => {
        const alerta = d.stock <= 5 ? `<br><span class="alerta-stock">¡Quedan pocos!</span>` : '';
        tbody.innerHTML += `
            <tr>
                <td>${d.producto}</td>
                <td>${d.distribuidor || '-'}</td>
                <td>$${Number(d.precio).toFixed(2)}</td>
                <td>${d.stock} ${alerta}</td>
                <td>
                    <button style="background: #38bdf8; color: #0f172a; margin-right: 5px;" onclick="abrirModalEditar(${d.id}, '${d.producto}', '${d.distribuidor}', ${d.precio}, ${d.stock})">✏️</button>
                    <button onclick="eliminarInv(${d.id})">🗑️</button>
                </td>
            </tr>
        `;
    });

    const sel = document.getElementById('cl');
    sel.innerHTML = '<option value="">¿Qué lleva?</option>';
    datos.filter(d => d.stock > 0).forEach(d => {
        sel.innerHTML += `<option value="${d.id}" data-precio="${d.precio}" data-stock="${d.stock}" data-nombre="${d.producto}">${d.producto} — $${Number(d.precio).toFixed(2)} (Stock: ${d.stock})</option>`;
    });
}

// VALIDACIÓN DE PRODUCTO DUPLICADO AL GUARDAR EN INVENTARIO
document.getElementById('f-inv').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nuevoProducto = document.getElementById('in').value.trim().toLowerCase();
    
    // Obtenemos los productos actuales para verificar si ya existe
    const res = await fetch(`/api/inventario/${empresaActual}`);
    const inventarioActual = await res.json();
    
    const existe = inventarioActual.some(p => p.producto.toLowerCase() === nuevoProducto);
    
    if (existe) {
        return alert(`⚠️ ¡ERROR! El producto "${document.getElementById('in').value.trim()}" ya existe en tu inventario.`);
    }

    await fetch('/api/inventario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        empresa: empresaActual, producto: document.getElementById('in').value.trim(), distribuidor: document.getElementById('id').value.trim(),
        precio: parseFloat(document.getElementById('ip').value), stock: parseInt(document.getElementById('ic').value)
    })});
    e.target.reset();
    await cargarInventario();
});

async function eliminarInv(id) {
    if (confirm('¿Eliminar producto?')) { await fetch(`/api/inventario/${id}`, { method: 'DELETE' }); await cargarInventario(); }
}

// --- COBRANZA Y GANANCIAS ---
async function cargarCobranza() {
    const res = await fetch(`/api/cobranza/${empresaActual}`);
    const datos = await res.json();
    const tbody = document.querySelector('#t-cob tbody');
    tbody.innerHTML = '';

    let totalVentas = 0;
    let totalCobrado = 0;

    if (datos.length === 0) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Sin ventas registradas</td></tr>`;

    datos.forEach(d => {
        const resta = d.total - d.abonado;
        totalVentas += d.total;
        totalCobrado += d.abonado;

        const colorResta = resta <= 0 ? 'color: #16a34a; font-weight: bold;' : 'color: #ef4444; font-weight: bold;';
        const botonAbonar = resta > 0 ? `<button class="pago-btn" onclick="abrirModalAbono(${d.id}, ${resta})" style="background:#f59e0b; color:white;">💵 Abonar</button>` : '';

        tbody.innerHTML += `
            <tr>
                <td>${d.cliente}</td>
                <td>${d.producto} x${d.cantidad}</td>
                <td>$${Number(d.total).toFixed(2)}</td>
                <td>$${Number(d.abonado).toFixed(2)}</td>
                <td style="${colorResta}">$${Number(resta).toFixed(2)}</td>
                <td>${d.referencia || '-'}</td>
                <td>${botonAbonar} <button onclick="eliminarVenta(${d.id})">🗑️</button></td>
            </tr>
        `;
    });

    document.getElementById('ganancia-ventas').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('ganancia-cobrado').textContent = `$${totalCobrado.toFixed(2)}`;
    document.getElementById('ganancia-deuda').textContent = `$${(totalVentas - totalCobrado).toFixed(2)}`;
}

document.getElementById('f-cob').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sel = document.getElementById('cl');
    const opt = sel.options[sel.selectedIndex];
    const cant = parseInt(document.getElementById('cc').value);
    const precio = parseFloat(opt.dataset.precio);
    
    if (cant > parseInt(opt.dataset.stock)) return alert('Stock insuficiente');

    await fetch('/api/cobranza', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        empresa: empresaActual, cliente: document.getElementById('cn').value.trim(), producto: opt.value, cantidad: cant,
        precio_unitario: precio, total: +(precio * cant).toFixed(2)
    })});
    e.target.reset();
    await cargarInventario();
    await cargarCobranza();
});

async function eliminarVenta(id) {
    if (confirm('¿Eliminar esta venta?')) { await fetch(`/api/cobranza/${id}`, { method: 'DELETE' }); await cargarCobranza(); }
}

// --- TASA DEL BCV ---
async function cargarBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        document.getElementById('bcv-val').textContent = Number(data.promedio).toFixed(2) + ' Bs';
    } catch { document.getElementById('bcv-val').textContent = 'N/D'; }
}

// --- FUNCIÓN NUEVA: GENERAR NOTA CON TASA, PAGO MÓVIL Y LOGO ---
async function generarNotaCliente() {
    // 1. Preguntamos la tasa
    let tasaStr = prompt("Ingrese la tasa del día para calcular los Bolívares (Bs/USD):");
    if (!tasaStr) return; 
    let tasa = parseFloat(tasaStr);
    if (isNaN(tasa) || tasa <= 0) {
        alert("Por favor, ingrese una tasa válida.");
        return;
    }

    // 2. Traemos los productos para simular la nota. 
    // Como el sistema actual registra deuda de 1 producto a la vez, aquí pedimos los datos.
    const sel = document.getElementById('cl');
    const opt = sel.options[sel.selectedIndex];
    
    if (!opt || !opt.value) {
        return alert("Por favor, seleccione un producto en la lista de '¿Qué lleva?' para armar la nota.");
    }

    let cantidad = prompt(`¿Cuántas unidades de "${opt.dataset.nombre}" va a llevar en esta nota?`, "1");
    if (!cantidad || isNaN(cantidad) || cantidad <= 0) return;
    cantidad = parseInt(cantidad);

    let precioUSD = parseFloat(opt.dataset.precio);
    let totalUSD = precioUSD * cantidad;
    let totalBs = totalUSD * tasa;

    // 3. Armamos el HTML de la nota con el logo, los datos y el pago móvil de Fanielis
    let notaHTML = `
        <html>
        <head>
            <title>Nota de Entrega - K&G</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #38bdf8; padding-bottom: 20px; }
                .header img { width: 150px; object-fit: contain; margin-bottom: 10px; }
                .header h2 { margin: 0; color: #0f172a; }
                .info { margin-bottom: 30px; font-size: 16px; line-height: 1.6; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #cbd5e1; padding: 12px; font-size: 15px; text-align: left; }
                th { background-color: #f1f5f9; color: #0f172a; }
                .totales { text-align: right; font-size: 18px; margin-bottom: 40px; }
                .totales h3 { margin: 5px 0; color: #16a34a; }
                .totales h4 { margin: 5px 0; color: #64748b; }
                .pago-movil { border: 2px dashed #38bdf8; padding: 20px; background: #f8fafc; width: 350px; border-radius: 8px; }
                .pago-movil h4 { margin-top: 0; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
                .pago-movil p { margin: 8px 0; font-size: 15px; }
            </style>
        </head>
        <body>
            <div class="header">
                <!-- LOGO DE LA EMPRESA -->
                <img src="/LOGO.png" alt="Logo K&G">
                <h2>NOTA DE ENTREGA</h2>
                <p style="margin: 5px 0 0 0; color: #64748b;">Empresa: ${empresaActual}</p>
            </div>
            
            <div class="info">
                <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-VE')}</p>
                <p><strong>Tasa aplicada:</strong> ${tasa.toFixed(2)} Bs/USD</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th style="text-align:center;">Cant.</th>
                        <th style="text-align:right;">Precio USD</th>
                        <th style="text-align:right;">Subtotal USD</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${opt.dataset.nombre}</td>
                        <td style="text-align:center;">${cantidad}</td>
                        <td style="text-align:right;">$${precioUSD.toFixed(2)}</td>
                        <td style="text-align:right;">$${totalUSD.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="totales">
                <h3>Total en Dólares: $${totalUSD.toFixed(2)}</h3>
                <h4>Total en Bolívares: Bs. ${totalBs.toFixed(2)}</h4>
            </div>

            <div class="pago-movil">
                <h4>Datos para Pago Móvil</h4>
                <p><strong>Titular:</strong> Fanielis Sánchez</p>
                <p><strong>C.I:</strong> V-16.438.319</p>
                <p><strong>Banco:</strong> Banesco</p>
                <p><strong>Teléfono:</strong> (Por favor, agrega el teléfono aquí en el código si lo necesitas)</p>
            </div>
        </body>
        </html>
    `;

    // 4. Abrimos ventana para imprimir
    let ventana = window.open('', '_blank');
    ventana.document.write(notaHTML);
    ventana.document.close();
    ventana.focus();
    
    setTimeout(() => {
        ventana.print();
    }, 1000); 
}