let empresaActual = null;
let fuenteActual = 16;
let ventaSeleccionadaId = null;
let carrito = []; 
let inventarioGlobal = []; // Guardamos todo el inventario para filtrar

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

// --- MODAL EDITAR PRODUCTO (CON CATEGORÍA) ---
function abrirModalEditar(id, producto, distribuidor, precio, stock, categoria) {
    document.getElementById('modal-editar').classList.remove('hidden');
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-prod').value = producto;
    document.getElementById('edit-cat').value = categoria || 'General';
    document.getElementById('edit-dist').value = distribuidor === '-' ? '' : distribuidor;
    document.getElementById('edit-precio').value = precio;
    document.getElementById('edit-stock').value = stock;
}
function cerrarModalEditar() { document.getElementById('modal-editar').classList.add('hidden'); }
async function guardarEdicion() {
    const id = document.getElementById('edit-id').value;
    const payload = {
        producto: document.getElementById('edit-prod').value.trim(),
        categoria: document.getElementById('edit-cat').value.trim(),
        distribuidor: document.getElementById('edit-dist').value.trim(),
        precio: parseFloat(document.getElementById('edit-precio').value),
        stock: parseInt(document.getElementById('edit-stock').value)
    };
    await fetch(`/api/inventario/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    cerrarModalEditar();
    await cargarInventario();
}

// --- MODAL ABONO ---
function abrirModalAbono(ids, resta) {
    ventaSeleccionadaId = ids; 
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

    let primerId = Array.isArray(ventaSeleccionadaId) ? ventaSeleccionadaId[0] : ventaSeleccionadaId;

    await fetch(`/api/cobranza/${primerId}/abono`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abono: monto, referencia: referencia }) });
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

function verPestana(tab) {
    document.getElementById('sec-inv').classList.toggle('hidden', tab !== 'inv');
    document.getElementById('sec-cob').classList.toggle('hidden', tab !== 'cob');
}

// --- INVENTARIO (CON CATEGORÍA Y FILTRO) ---
async function cargarInventario() {
    const res = await fetch(`/api/inventario/${empresaActual}`);
    const datos = await res.json();
    inventarioGlobal = datos;

    // Llenar el select de filtro con categorías únicas
    const filtroCat = document.getElementById('filtro-categoria');
    const categoriaActual = filtroCat.value || 'Todas';
    const categoriasUnicas = [...new Set(datos.map(d => d.categoria || 'General'))].sort();

    filtroCat.innerHTML = '<option value="Todas">Todas las categorías</option>';
    categoriasUnicas.forEach(cat => {
        filtroCat.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    if (categoriasUnicas.includes(categoriaActual)) filtroCat.value = categoriaActual;

    // Renderizar tabla respetando el filtro actual
    renderizarInventario();

    // Llenar select del carrito (todos los productos con stock)
    const sel = document.getElementById('cl');
    sel.innerHTML = '<option value="">¿Qué lleva?</option>';
    datos.filter(d => d.stock > 0).forEach(d => {
        sel.innerHTML += `<option value="${d.id}" data-precio="${d.precio}" data-stock="${d.stock}" data-nombre="${d.producto}">${d.producto} — $${Number(d.precio).toFixed(2)} (Stock: ${d.stock})</option>`;
    });
}

// Pinta la tabla según el filtro activo
function renderizarInventario() {
    const filtro = document.getElementById('filtro-categoria').value;
    const tbody = document.querySelector('#t-inv tbody');
    tbody.innerHTML = '';

    const datosFiltrados = filtro === 'Todas'
        ? inventarioGlobal
        : inventarioGlobal.filter(d => (d.categoria || 'General') === filtro);

    if (datosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Sin productos${filtro !== 'Todas' ? ' en esta categoría' : ''}</td></tr>`;
        return;
    }

    datosFiltrados.forEach(d => {
        const alerta = d.stock <= 5 ? `<br><span class="alerta-stock">¡Quedan pocos!</span>` : '';
        tbody.innerHTML += `
            <tr>
                <td>${d.producto}</td>
                <td>${d.categoria || '-'}</td>
                <td>${d.distribuidor || '-'}</td>
                <td>$${Number(d.precio).toFixed(2)}</td>
                <td>${d.stock} ${alerta}</td>
                <td>
                    <button style="background: #38bdf8; color: #0f172a; margin-right: 5px;" onclick="abrirModalEditar(${d.id}, '${d.producto}', '${d.distribuidor}', ${d.precio}, ${d.stock}, '${d.categoria}')">✏️</button>
                    <button onclick="eliminarInv(${d.id})">🗑️</button>
                </td>
            </tr>
        `;
    });
}

// Se llama desde el onchange del select
function filtrarInventario() {
    renderizarInventario();
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
        empresa: empresaActual, 
        producto: document.getElementById('in').value.trim(), 
        categoria: document.getElementById('icat').value.trim(),
        distribuidor: document.getElementById('id').value.trim(),
        precio: parseFloat(document.getElementById('ip').value), 
        stock: parseInt(document.getElementById('ic').value)
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

async function registrarVentaCarrito() {
    const cliente = document.getElementById('cn').value.trim();
    if (!cliente) return alert("Por favor, ingresa el nombre del cliente.");
    if (carrito.length === 0) return alert("El carrito está vacío.");

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
    carrito = []; 
    document.getElementById('cn').value = '';
    actualizarCarritoVisual();
    
    await cargarInventario();
    await cargarCobranza();
}

// --- COBRANZA Y GANANCIAS (AGRUPADO POR CLIENTE) ---
async function cargarCobranza() {
    const res = await fetch(`/api/cobranza/${empresaActual}`);
    const datos = await res.json();
    const tbody = document.querySelector('#t-cob tbody');
    tbody.innerHTML = '';

    let totalVentas = 0;
    let totalCobrado = 0;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Sin ventas registradas</td></tr>`;
    } else {
        const clientesAgrupados = {};

        datos.forEach(d => {
            const nombre = d.cliente.toLowerCase();
            if (!clientesAgrupados[nombre]) {
                clientesAgrupados[nombre] = {
                    nombreReal: d.cliente,
                    ids: [],
                    productos: [],
                    total: 0,
                    abonado: 0,
                    referencia: d.referencia || '-'
                };
            }
            clientesAgrupados[nombre].ids.push(d.id);
            clientesAgrupados[nombre].productos.push(`${d.producto} x${d.cantidad}`);
            clientesAgrupados[nombre].total += d.total;
            clientesAgrupados[nombre].abonado += d.abonado;
            if (d.referencia) clientesAgrupados[nombre].referencia = d.referencia;
        });

        Object.keys(clientesAgrupados).forEach(key => {
            const c = clientesAgrupados[key];
            const resta = c.total - c.abonado;
            
            totalVentas += c.total;
            totalCobrado += c.abonado;

            const colorResta = resta <= 0 ? 'color: #16a34a; font-weight: bold;' : 'color: #ef4444; font-weight: bold;';
            
            const botonAbonar = resta > 0 ? `<button class="pago-btn" onclick="abrirModalAbono([${c.ids}], ${resta})" style="background:#f59e0b; color:white; margin-right:5px;">💵 Abonar</button>` : '';
            const botonAgregar = `<button onclick="agregarMasProductos('${c.nombreReal}')" style="background:#10b981; color:white; margin-right:5px;">➕ Agregar</button>`;
            const botonNota = `<button onclick="generarNotaCliente('${c.nombreReal}')" style="background:#38bdf8; color:#0f172a; margin-right:5px;">🖨️ Nota</button>`;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.nombreReal}</strong></td>
                    <td style="font-size: 13px;">${c.productos.join(', ')}</td>
                    <td>$${Number(c.total).toFixed(2)}</td>
                    <td>$${Number(c.abonado).toFixed(2)}</td>
                    <td style="${colorResta}">$${Number(resta).toFixed(2)}</td>
                    <td>${c.referencia}</td>
                    <td>${botonNota} ${botonAgregar} ${botonAbonar}</td>
                </tr>
            `;
        });
    }

    document.getElementById('ganancia-ventas').textContent = `$${totalVentas.toFixed(2)}`;
    document.getElementById('ganancia-cobrado').textContent = `$${totalCobrado.toFixed(2)}`;
    document.getElementById('ganancia-deuda').textContent = `$${(totalVentas - totalCobrado).toFixed(2)}`;
}

// FUNCIÓN PARA AUTOCOMPLETAR EL NOMBRE Y AGREGAR MÁS PRODUCTOS
function agregarMasProductos(nombreCliente) {
    document.getElementById('cn').value = nombreCliente;
    document.getElementById('cc').value = 1;
    document.getElementById('cl').focus();
    alert(`Selecciona el nuevo producto en la lista y dale a "➕ Añadir". Luego presiona "Registrar Deuda Completa".`);
}

// --- TASA DEL BCV ---
async function cargarBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        document.getElementById('bcv-val').textContent = Number(data.promedio).toFixed(2) + ' Bs';
    } catch { document.getElementById('bcv-val').textContent = 'N/D'; }
}

// --- GENERAR NOTA DE CRÉDITO ---
async function generarNotaCliente(nombreCliente) {
    let tasaTexto = document.getElementById('bcv-val').textContent.replace(' Bs', '').replace(',', '.');
    let tasa = parseFloat(tasaTexto);
    if (isNaN(tasa) || tasa <= 0) tasa = 1;

    const res = await fetch(`/api/cobranza/${empresaActual}`);
    const todasLasVentas = await res.json();
    const ventasCliente = todasLasVentas.filter(v => v.cliente.toLowerCase() === nombreCliente.toLowerCase());

    let htmlProductos = '';
    let totalUSD = 0;
    let abonadoUSD = 0;

    ventasCliente.forEach(v => {
        totalUSD += Number(v.total);
        abonadoUSD += Number(v.abonado);
        htmlProductos += `
            <tr>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; word-break: break-word; text-align: left;">${v.producto}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${v.cantidad}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; white-space: nowrap;">$${Number(v.total).toFixed(2)}</td>
            </tr>
        `;
    });

    let restaUSD = totalUSD - abonadoUSD;
    let restaBs = restaUSD * tasa;

    let facturaHTML = `
        <div style="width: 100%; max-width: 650px; margin: 0 auto; font-family: Arial, sans-serif; color: #1e293b; box-sizing: border-box; background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #38bdf8; padding-bottom: 15px;">
                <img src="/LOGO.png" alt="Logo" style="width: 100px; max-height: 80px; object-fit: contain;">
                <h2 style="margin: 10px 0 4px 0; color: #0f172a; font-size: 18px; text-transform: uppercase;">Nota de Crédito</h2>
                <p style="margin: 0; color: #64748b; font-size: 12px;">Empresa: <strong>${empresaActual}</strong> | Fecha: ${new Date().toLocaleDateString('es-VE')}</p>
                <p style="margin: 8px 0 0 0; font-weight: bold; font-size: 15px;">Cliente: <span style="color: #0284c7;">${nombreCliente.toUpperCase()}</span></p>
            </div>
            <div style="width: 100%; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #38bdf8; font-size: 13px; width: 60%; color: #0f172a;">Producto</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #38bdf8; font-size: 13px; width: 15%; color: #0f172a;">Cant.</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #38bdf8; font-size: 13px; width: 25%; color: #0f172a;">Total USD</th>
                        </tr>
                    </thead>
                    <tbody>${htmlProductos || '<tr><td colspan="3" style="text-align:center; padding:15px; color:#64748b;">Sin productos</td></tr>'}</tbody>
                </table>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 14px; color: #475569;">Total Deuda (USD):</span>
                    <strong style="font-size: 14px;">$${totalUSD.toFixed(2)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 14px; color: #475569;">Total Abonado (USD):</span>
                    <strong style="font-size: 14px; color: #16a34a;">$${abonadoUSD.toFixed(2)}</strong>
                </div>
                <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 15px; color: #ef4444; font-weight: bold;">RESTA POR PAGAR:</span>
                    <strong style="font-size: 18px; color: #ef4444;">$${restaUSD.toFixed(2)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; background: #e2e8f0; padding: 8px; border-radius: 4px;">
                    <span>Equivalente en Bs. (Tasa)</span>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="number" step="0.01" value="${tasa.toFixed(2)}" style="width: 65px; padding: 4px; font-size: 12px; border: 1px solid #94a3b8; border-radius: 4px; text-align: right;" onchange="cambiarTasaNota(this.value, ${restaUSD})">
                        <strong id="resta-bs" style="font-size: 14px; color: #0f172a;">Bs. ${restaBs.toFixed(2)}</strong>
                    </div>
                </div>
            </div>
            <div style="border: 2px dashed #38bdf8; padding: 15px; border-radius: 8px; background: #f0f9ff; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px; text-transform: uppercase;">Datos para Pago Móvil</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                    <p style="margin: 0;"><strong>Titular:</strong> Fanielis Sánchez</p>
                    <p style="margin: 0;"><strong>C.I:</strong> V-16.438.319</p>
                    <p style="margin: 0;"><strong>Banco:</strong> Banesco</p>
                    <p style="margin: 0;"><strong>Teléfono:</strong> 0424-602-73-93</p>
                </div>
            </div>
            <div style="text-align: center;" class="no-print">
                <button onclick="imprimirNota()" style="background: #16a34a; color: white; padding: 12px 30px; border: none; border-radius: 6px; font-size: 15px; font-weight: bold; cursor: pointer; width: 100%;">🖨️ Imprimir Nota de Crédito</button>
            </div>
        </div>
    `;

    document.getElementById('contenido-nota').innerHTML = facturaHTML;
    document.getElementById('modal-nota').classList.remove('hidden');
}

// --- FUNCIONES PARA IMPRESIÓN PERFECTA ---
function imprimirNota() {
    const contenido = document.getElementById('contenido-nota').innerHTML;
    const ventanaImpresion = window.open('', '_blank');
    
    ventanaImpresion.document.write(`
        <html>
            <head>
                <title>Imprimir Nota de Crédito</title>
                <style>
                    @page { margin: 10mm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    div { box-shadow: none !important; }
                    table { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                ${contenido}
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    };
                <\/script>
            </body>
        </html>
    `);
    ventanaImpresion.document.close();
}

function cambiarTasaNota(nuevaTasa, restaUSD) {
    let tasa = parseFloat(nuevaTasa);
    if (isNaN(tasa) || tasa <= 0) return;
    document.getElementById('resta-bs').textContent = `Bs. ${(restaUSD * tasa).toFixed(2)}`;
}