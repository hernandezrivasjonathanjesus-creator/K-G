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
        sel.innerHTML += `<option value="${d.id}" data-precio="${d.precio}" data-stock="${d.stock}">${d.producto} — $${Number(d.precio).toFixed(2)} (Stock: ${d.stock})</option>`;
    });
}

document.getElementById('f-inv').addEventListener('submit', async (e) => {
    e.preventDefault();
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

    // Actualizar el cuadro de ganancias
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