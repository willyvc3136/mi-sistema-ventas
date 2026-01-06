// ==========================================
// CONFIGURACIÓN DE CONEXIÓN (SUPABASE)
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// VARIABLES GLOBALES
let carrito = []; 
let productosBaseDeDatos = []; 
let html5QrCode; 
let metodoSeleccionado = 'Efectivo'; 

// VARIABLES PARA EL CONTROL DEL ESCÁNER
let ultimoCodigoLeido = null;
let tiempoUltimaLectura = 0;

// ==========================================
// UTILIDADES: SONIDO Y VIBRACIÓN
// ==========================================
function emitirBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
        console.log("Audio no permitido aún por el navegador");
    }
}

// ==========================================
// SEGURIDAD E INICIALIZACIÓN
// ==========================================
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        const display = document.getElementById('user-display');
        if(display) display.textContent = `Vendedor: ${user.email}`;
        await cargarProductos(user.id); 
        
        const inputBusqueda = document.getElementById('inputBusqueda');
        if(inputBusqueda) inputBusqueda.focus();

        const btnFinalizar = document.getElementById('btnFinalizarVenta');
        if(btnFinalizar) btnFinalizar.onclick = finalizarVenta;
    } else {
        window.location.href = 'index.html';
    }
}

async function cargarProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true });
    
    if (!error) productosBaseDeDatos = data;
}

// ==========================================
// LÓGICA DE LA CÁMARA (ANTI-REPETICIÓN)
// ==========================================
window.toggleLector = async function() {
    const container = document.getElementById('lectorContainer');
    const btn = document.getElementById('btnCamara');

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        btn.textContent = "🚫 Detener Cámara";
        btn.classList.replace('bg-slate-900', 'bg-red-600');
        await encenderCamara('inputBusqueda');
    } else {
        await cerrarCamara();
    }
};

async function encenderCamara(targetInputId) {
    if (html5QrCode) {
        await html5QrCode.stop().catch(() => {});
    }

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 20, qrbox: { width: 250, height: 180 }, aspectRatio: 1.0 };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                const ahora = Date.now();
                // Si es el mismo código y han pasado menos de 2.5 segundos, ignorar
                if (decodedText === ultimoCodigoLeido && (ahora - tiempoUltimaLectura) < 2500) {
                    return; 
                }
                
                ultimoCodigoLeido = decodedText;
                tiempoUltimaLectura = ahora;
                
                procesarEscaneo(decodedText);
            }
        );
    } catch (err) {
        console.error("Error de cámara:", err);
        cerrarCamara();
    }
}

async function cerrarCamara() {
    const container = document.getElementById('lectorContainer');
    const btn = document.getElementById('btnCamara');
    if (html5QrCode) {
        await html5QrCode.stop().catch(() => {});
        html5QrCode = null;
    }
    container.classList.add('hidden');
    btn.textContent = "📷 Activar Cámara";
    btn.classList.replace('bg-red-600', 'bg-slate-900');
}

// ==========================================
// PROCESAMIENTO DE ESCANEO
// ==========================================
function procesarEscaneo(codigo) {
    const producto = productosBaseDeDatos.find(p => p.codigo_barras === codigo);
    if (producto) {
        emitirBeep();
        if (navigator.vibrate) navigator.vibrate(100);
        
        agregarAlCarrito(producto.id);
        
        document.getElementById('inputBusqueda').value = '';
        const totalElem = document.getElementById('totalVenta');
        totalElem.classList.add('scale-110', 'text-blue-500');
        setTimeout(() => totalElem.classList.remove('scale-110', 'text-blue-500'), 200);
    }
}

// Buscador manual
window.manejarBusqueda = (e) => {
    const busqueda = e.target.value.toLowerCase();
    const tabla = document.getElementById('tablaResultados');
    tabla.innerHTML = '';
    if (busqueda.length < 1) return;

    const filtrados = productosBaseDeDatos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) || 
        (p.codigo_barras && p.codigo_barras === busqueda)
    );

    filtrados.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 cursor-pointer border-b";
        fila.innerHTML = `
            <td class="p-4"><p class="font-bold text-gray-800">${prod.nombre}</p></td>
            <td class="p-4 font-black text-emerald-600">$${prod.precio.toFixed(2)}</td>
            <td class="p-4 text-xs">${prod.cantidad} disp.</td>
            <td class="p-4 text-center">
                <button onclick="agregarAlCarrito(${prod.id})" class="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold">+ Añadir</button>
            </td>
        `;
        tabla.appendChild(fila);
    });
};

const inputBusq = document.getElementById('inputBusqueda');
if(inputBusq) {
    inputBusq.addEventListener('input', manejarBusqueda);
    inputBusq.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            procesarEscaneo(e.target.value.trim());
            e.target.value = '';
        }
    });
}

// ==========================================
// GESTIÓN DEL CARRITO
// ==========================================
window.agregarAlCarrito = (id) => {
    const producto = productosBaseDeDatos.find(p => p.id === id);
    const itemEnCarrito = carrito.find(item => item.id === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidadSeleccionada < producto.cantidad) {
            itemEnCarrito.cantidadSeleccionada++;
        } else {
            alert("⚠️ Stock insuficiente");
        }
    } else {
        if (producto.cantidad > 0) {
            carrito.push({ ...producto, cantidadSeleccionada: 1 });
        } else {
            alert("⚠️ Producto sin stock");
        }
    }
    renderizarCarrito();
};

function renderizarCarrito() {
    const contenedor = document.getElementById('carritoItems');
    const totalElem = document.getElementById('totalVenta');
    const btnVenta = document.getElementById('btnFinalizarVenta');
    
    contenedor.innerHTML = '';
    let total = 0;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-gray-300 py-10 italic">Caja Vacía</p>';
        totalElem.textContent = "$0.00";
        btnVenta.disabled = true;
        return;
    }

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidadSeleccionada;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-white p-3 rounded-xl mb-2 border shadow-sm";
        div.innerHTML = `
            <div>
                <p class="font-bold text-sm text-slate-800">${item.nombre}</p>
                <p class="text-xs text-slate-500">$${item.precio.toFixed(2)} unit.</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="ajustarCantidad(${index}, -1)" class="w-8 h-8 bg-slate-100 rounded-lg font-bold">-</button>
                <span class="text-sm font-black w-6 text-center">${item.cantidadSeleccionada}</span>
                <button onclick="ajustarCantidad(${index}, 1)" class="w-8 h-8 bg-slate-100 rounded-lg font-bold">+</button>
                <button onclick="quitarDelCarrito(${index})" class="text-red-400 ml-2">✕</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    totalElem.textContent = `$${total.toFixed(2)}`;
    btnVenta.disabled = false;
    actualizarVuelto();
}

window.ajustarCantidad = (index, cambio) => {
    const item = carrito[index];
    const original = productosBaseDeDatos.find(p => p.id === item.id);
    const nueva = item.cantidadSeleccionada + cambio;
    if (nueva >= 1 && nueva <= original.cantidad) {
        item.cantidadSeleccionada = nueva;
        renderizarCarrito();
    }
};

window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    renderizarCarrito();
};

// ==========================================
// FINALIZACIÓN Y PAGO
// ==========================================
window.seleccionarMetodo = (metodo) => {
    metodoSeleccionado = metodo;
    document.querySelectorAll('.metodo-pago').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
        btn.classList.add('border-slate-100', 'bg-white', 'text-slate-500');
    });
    const btnActivo = document.getElementById(`btn${metodo}`);
    if(btnActivo) btnActivo.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
    
    const panelVuelto = document.getElementById('panelVuelto');
    metodo === 'Efectivo' ? panelVuelto.classList.remove('hidden') : panelVuelto.classList.add('hidden');
};

function actualizarVuelto() {
    const total = parseFloat(document.getElementById('totalVenta').textContent.replace('$', '')) || 0;
    const pagaCon = parseFloat(document.getElementById('pagaCon').value) || 0;
    const vueltoElem = document.getElementById('vuelto');
    vueltoElem.textContent = pagaCon >= total ? `$${(pagaCon - total).toFixed(2)}` : "$0.00";
}

document.getElementById('pagaCon').addEventListener('input', actualizarVuelto);

window.toggleSelectorCliente = function() {
    const con = document.getElementById('contenedorCliente');
    const esFiado = document.getElementById('esFiado').checked;
    esFiado ? (con.classList.remove('hidden'), cargarClientesVentas()) : con.classList.add('hidden');
};

async function cargarClientesVentas() {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data } = await _supabase.from('clientes').select('id, nombre').eq('user_id', user.id);
    const select = document.getElementById('selectCliente');
    select.innerHTML = '<option value="">-- Seleccionar cliente --</option>';
    if(data) data.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.nombre;
        select.appendChild(o);
    });
}

async function finalizarVenta() {
    if (carrito.length === 0) return;
    const btn = document.getElementById('btnFinalizarVenta');
    const esFiado = document.getElementById('esFiado').checked;
    const clienteId = document.getElementById('selectCliente').value;

    if (esFiado && !clienteId) return alert("⚠️ Selecciona un cliente para el fiado.");

    btn.disabled = true;
    btn.textContent = "PROCESANDO...";

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const totalVenta = parseFloat(document.getElementById('totalVenta').textContent.replace('$', ''));

        const { error: errorVenta } = await _supabase.from('ventas').insert([{
            total: totalVenta,
            metodo_pago: esFiado ? 'Fiado' : metodoSeleccionado,
            estado_pago: esFiado ? 'pendiente' : 'pagado',
            cliente_id: esFiado ? clienteId : null,
            vendedor_id: user.id,
            productos_vendidos: carrito 
        }]);

        if (errorVenta) throw errorVenta;

        if (esFiado) {
            const { data: cl } = await _supabase.from('clientes').select('deuda').eq('id', clienteId).single();
            await _supabase.from('clientes').update({ deuda: (cl.deuda || 0) + totalVenta }).eq('id', clienteId);
        }

        for (const item of carrito) {
            await _supabase.from('productos').update({ cantidad: item.cantidad - item.cantidadSeleccionada }).eq('id', item.id);
        }

        alert("🎯 Venta procesada!");
        location.reload(); 
    } catch (e) {
        console.error(e);
        alert("Error al guardar venta");
        btn.disabled = false;
        btn.textContent = "Finalizar Venta (F2)";
    }
}

document.addEventListener('keydown', (e) => { if (e.key === "F2") finalizarVenta(); });

inicializar();