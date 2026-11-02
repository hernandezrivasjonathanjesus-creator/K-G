let empresaActual = null;
let fuenteActual = 16;
let ventaSeleccionadaId = null;
let carrito = []; // Aquí guardamos los productos temporalmente

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

document.getElementById('f-inv').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevoProducto = document.getElementById('in').value.trim().toLowerCase();
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

// --- CARRITO DE COMPRAS ---
function agregarAlCarrito() {
    const sel = document.getElementById('cl');
    const opt = sel.options[sel.selectedIndex];
    const cant = parseInt(document.getElementById('cc').value);
    
    if (!opt.value) return alert("Selecciona un producto");
    if (isNaN(cant) || cant <= 0) return alert("Cantidad inválida");
    if (cant > parseInt(opt.dataset.stock)) return alert("Stock insuficiente");

    const precio = parseFloat(opt.dataset.precio);
    
    carrito.push({
        productoId: opt.value,
        nombre: opt.dataset.nombre,
        cantidad: cant,
        precio: precio,
        subtotal: cant * precio
    });

    actualizarCarritoVisual();
}

function actualizarCarritoVisual() {
    const tbody = document.querySelector('#t-carrito tbody');
    tbody.innerHTML = '';
    let total = 0;

    carrito.forEach((item, index) => {
        total += item.subtotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad}</td>
                <td>$${item.precio.toFixed(2)}</td>
                <td>$${item.subtotal.toFixed(2)}</td>
                <td><button style="background:#ef4444; padding: 5px 10px; font-size:12px;" onclick="quitarDelCarrito(${index})">X</button></td>
            </tr>
        `;
    });

    document.getElementById('total-carrito').textContent = `$${total.toFixed(2)}`;
}

function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarritoVisual();
}

// REGISTRAR TODA LA DEUDA DEL CARRITO
async function registrarVentaCarrito() {
    const cliente = document.getElementById('cn').value.trim();
    if (!cliente) return alert("Por favor, ingresa el nombre del cliente.");
    if (carrito.length === 0) return alert("El carrito está vacío.");

    // Guardamos cada producto del carrito en tu base de datos
    for (let item of carrito) {
        await fetch('/api/cobranza', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            empresa: empresaActual, 
            cliente: cliente, 
            producto: item.productoId, 
            cantidad: item.cantidad,
            precio_unitario: item.precio, 
            total: item.subtotal
        })});
    }

    alert(`¡Deuda registrada para ${cliente}!`);
    carrito = []; // Vaciamos el carrito
    document.getElementById('cn').value = '';
    actualizarCarritoVisual();
    
    await cargarInventario();
    await cargarCobranza();
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
        const botonAbonar = resta > 0 ? `<button class="pago-btn" onclick="abrirModalAbono(${d.id}, ${resta})" style="background:#f59e0b; color:white; margin-right:5px;">💵 Abonar</button>` : '';
        
        // Le pasamos solo el nombre del cliente al botón de la nota
        const botonNota = `<button onclick="generarNotaCliente('${d.cliente}')" style="background:#38bdf8; color:#0f172a; margin-right:5px;">🖨️ Nota</button>`;

        tbody.innerHTML += `
            <tr>
                <td>${d.cliente}</td>
                <td>${d.producto} x${d.cantidad}</td>
                <td>$${Number(d.total).toFixed(2)}</td>
                <td>$${Number(d.abonado).toFixed(2)}</td>
                <td style="${colorResta}">$${Number(resta).toFixed(2)}</td>
                <td>${d.referencia || '-'}</td>
                <td>${botonNota} ${botonAbonar} <button onclick="eliminarVenta(${d.id})">🗑️</button></td>
            </tr>
        `;
    });

    document.getElementById('ganancia-ventas').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('ganancia-cobrado').textContent = `$${totalCobrado.toFixed(2)}`;
    document.getElementById('ganancia-deuda').textContent = `$${(totalVentas - totalCobrado).toFixed(2)}`;
}

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

// --- GENERAR NOTA DE CRÉDITO (IMPRIMIBLE Y TOTALIZADA) ---
async function generarNotaCliente(nombreCliente) {
    let tasaStr = prompt(`Ingrese la tasa del día (Bs/USD) para la nota de ${nombreCliente}:`);
    if (!tasaStr) return; 
    let tasa = parseFloat(tasaStr);
    if (isNaN(tasa) || tasa <= 0) return alert("Por favor, ingrese una tasa válida.");

    // Buscamos TODAS las deudas de este cliente y las unificamos
    const res = await fetch(`/api/cobranza/${empresaActual}`);
    const todasLasVentas = await res.json();
    const ventasCliente = todasLasVentas.filter(v => v.cliente.toLowerCase() === nombreCliente.toLowerCase());

    let htmlProductos = '';
    let totalUSD = 0;
    let abonadoUSD = 0;
    
    ventasCliente.forEach(v => {
        totalUSD += v.total;
        abonadoUSD += v.abonado;
        htmlProductos += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${v.producto}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${v.cantidad}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(v.total).toFixed(2)}</td>
            </tr>
        `;
    });

    let restaUSD = totalUSD - abonadoUSD;
    let restaBs = restaUSD * tasa;

    // Diseño de la factura en formato "papel"
    let facturaHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="/LOGO.png" alt="Logo" style="width: 120px; object-fit: contain;">
            <h2 style="margin: 10px 0 5px 0; color: #0f172a;">NOTA DE CRÉDITO / ESTADO DE CUENTA</h2>
            <p style="margin: 0; color: #64748b;">Empresa: ${empresaActual} | Fecha: ${new Date().toLocaleDateString('es-VE')}</p>
            <p style="margin: 5px 0; font-weight: bold; font-size: 18px;">Cliente: ${nombreCliente.toUpperCase()}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #38bdf8;">Producto</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #38bdf8;">Cant.</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #38bdf8;">Total USD</th>
                </tr>
            </thead>
            <tbody>
                ${htmlProductos}
            </tbody>
        </table>

        <div style="text-align: right; margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 16px;">Total Deuda (USD): <strong>$${totalUSD.toFixed(2)}</strong></p>
            <p style="margin: 5px 0; font-size: 16px; color: #16a34a;">Total Abonado (USD): <strong>$${abonadoUSD.toFixed(2)}</strong></p>
            <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 10px 0;">
            <p style="margin: 5px 0; font-size: 20px; color: #ef4444;">RESTA POR PAGAR (USD): <strong>$${restaUSD.toFixed(2)}</strong></p>
            <p style="margin: 5px 0; font-size: 16px; color: #64748b;">Equivalente en Bs (Tasa ${tasa.toFixed(2)}): <strong>Bs. ${restaBs.toFixed(2)}</strong></p>
        </div>

        <div style="border: 2px dashed #38bdf8; padding: 15px; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; color: #0f172a;">Datos para Pago Móvil</h4>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Titular:</strong> Fanielis Sánchez</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>C.I:</strong> V-16.438.319</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Banco:</strong> Banesco</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Teléfono:</strong> 0414-0000000</p> <!-- PON EL TELÉFONO AQUÍ -->
        </div>

        <div style="margin-top: 30px; text-align: center;" class="no-print">
            <button onclick="window.print()" style="background: #16a34a; color: white; padding: 12px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer;">
                🖨️ Imprimir Nota de Crédito
            </button>
        </div>
    `;

    // Lo inyectamos en el modal que creamos en el HTML
    document.getElementById('contenido-nota').innerHTML = facturaHTML;
    document.getElementById('modal-nota').classList.remove('hidden');
}