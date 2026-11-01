let empresaActual = null;
let fuenteActual = 16;

setInterval(() => {
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = new Date().toLocaleString('es-VE');
}, 1000);

function toggleAccesibilidad() {
    document.getElementById('panel-accesibilidad').classList.toggle('hidden');
}

function cambiarTema(tema) {
    document.body.className = ''; 
    if (tema !== 'default') document.body.classList.add(`theme-${tema}`);
}

function cambiarFuente(accion) {
    fuenteActual += (accion * 2);
    if (fuenteActual < 12) fuenteActual = 12;
    if (fuenteActual > 24) fuenteActual = 24;
    document.documentElement.style.fontSize = `${fuenteActual}px`;
}

// --- MODAL DE CONTRASEÑA ---
function abrirModalClave() {
    document.getElementById('modal-clave').classList.remove('hidden');
    document.getElementById('empresa-clave-txt').textContent = `Empresa: ${empresaActual}`;
    document.getElementById('nueva-clave').value = '';
}
function cerrarModalClave() {
    document.getElementById('modal-clave').classList.add('hidden');
}
async function guardarClave() {
    const nueva = document.getElementById('nueva-clave').value;
    if (nueva.length < 4) return alert('La contraseña debe tener al menos 4 caracteres.');
    
    const res = await fetch('/api/cambiar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa: empresaActual, nuevaClave: nueva })
    });
    
    if (res.ok) {
        alert('¡Contraseña actualizada con éxito!');
        cerrarModalClave();
    } else {
        alert('Error al guardar la contraseña.');
    }
}

// --- LOGIN ---
async function verificar() {
    const empresa = document.getElementById('empresa-select').value;
    const password = document.getElementById('pass').value;
    const errBox = document.getElementById('login-error');
    errBox.textContent = '';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa, password })
        });
        const data = await res.json();

        if (!data.ok) {
            errBox.textContent = data.msg || 'Error de acceso';
            return;
        }

        empresaActual = empresa;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('nombre-empresa-titulo').textContent = empresa;

        await cargarInventario();
        await cargarCobranza();
    } catch (e) {
        errBox.textContent = 'Error de conexión';
    }
}

function verPestaña(tab) {
    document.getElementById('sec-inv').classList.toggle('hidden', tab !== 'inv');
    document.getElementById('sec-cob').classList.toggle('hidden', tab !== 'cob');
}

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
                <td><button onclick="eliminarInv(${d.id})">🗑️</button></td>
            </tr>
        `;
    });

    const sel = document.getElementById('cl');
    sel.innerHTML = '<option value="">¿Qué lleva?</option>';
    datos.filter(d => d.stock > 0).forEach(d => {
        sel.innerHTML += `<option value="${d.id}" data-precio="${d.precio}" data-stock="${d.stock}">
            ${d.producto} — $${Number(d.precio).toFixed(2)} (Stock: ${d.stock})</option>`;
    });
}

document.getElementById('f-inv').addEventListener('submit', async (e) => {
    e.preventDefault();
    await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            empresa: empresaActual,
            producto: document.getElementById('in').value.trim(),
            distribuidor: document.getElementById('id').value.trim(),
            precio: parseFloat(document.getElementById('ip').value),
            stock: parseInt(document.getElementById('ic').value)
        })
    });
    e.target.reset();
    await cargarInventario();
});

async function eliminarInv(id) {
    if (confirm('¿Eliminar producto del inventario?')) {
        await fetch(`/api/inventario/${id}`, { method: 'DELETE' });
        await cargarInventario();
    }
}

async function cargarCobranza() {
    const res = await fetch(`/api/cobranza/${empresaActual}`);
    const datos = await res.json();
    const tbody = document.querySelector('#t-cob tbody');
    tbody.innerHTML = '';

    if (datos.length === 0) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Sin ventas registradas</td></tr>`;

    datos.forEach(d => {
        const renderCuota = (num, pagada) => {
            const clase = pagada ? 'pago-btn pagado' : 'pago-btn';
            const check = pagada ? '✓ Pagado' : '○ Pendiente';
            
            const fechaVenta = new Date(d.fecha);
            const dias = num === 1 ? 15 : 30;
            const vencimiento = new Date(fechaVenta);
            vencimiento.setDate(vencimiento.getDate() + dias);
            const fechaStr = vencimiento.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });

            return `<button class="${clase}" onclick="togglePago(${d.id}, ${num})" title="Vence: ${fechaStr}">
                ${check} - $${Number(d['cuota' + num]).toFixed(2)}
            </button><br><small style="font-size:0.7rem;color:#888">Vence: ${fechaStr}</small>`;
        };

        tbody.innerHTML += `
            <tr>
                <td>${d.cliente}</td>
                <td>${d.producto} x${d.cantidad}</td>
                <td>$${Number(d.total).toFixed(2)}</td>
                <td>${renderCuota(1, d.pago1)}</td>
                <td>${renderCuota(2, d.pago2)}</td>
                <td><button onclick="eliminarVenta(${d.id})">🗑️</button></td>
            </tr>
        `;
    });
}

document.getElementById('f-cob').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sel = document.getElementById('cl');
    const opt = sel.options[sel.selectedIndex];
    const precio = parseFloat(opt.dataset.precio);
    const stockDisp = parseInt(opt.dataset.stock);
    const cant = parseInt(document.getElementById('cc').value);

    if (cant > stockDisp) return alert(`Stock insuficiente. Disponible: ${stockDisp}`);

    const total = +(precio * cant).toFixed(2);
    const cuota = +(total / 2).toFixed(2); 

    await fetch('/api/cobranza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            empresa: empresaActual,
            cliente: document.getElementById('cn').value.trim(),
            producto: opt.value,
            cantidad: cant,
            precio_unitario: precio,
            total: total,
            cuota1: cuota,
            cuota2: +(total - cuota).toFixed(2)
        })
    });
    e.target.reset();
    await cargarInventario();
    await cargarCobranza();
});

async function togglePago(id, cuota) {
    await fetch(`/api/cobranza/${id}/pago`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuota })
    });
    await cargarCobranza();
}

async function eliminarVenta(id) {
    if (confirm('¿Eliminar esta venta del sistema?')) {
        await fetch(`/api/cobranza/${id}`, { method: 'DELETE' });
        await cargarCobranza();
    }
}