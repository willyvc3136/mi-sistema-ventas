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
// UTILIDADES: SONIDO Y NOTIFICACIONES
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
    } catch (e) { console.log("Audio bloqueado"); }
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-lg text-white font-bold z-50 shadow-2xl transition-all transform translate-y-0 ${tipo === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
        setTimeout(() => toast.remove(), 500);
    }, 2000);
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
        enfocarBuscador();

        configurarEventosFiado();

        const btnFinalizar = document.getElementById('btnFinalizarVenta');
        if(btnFinalizar) btnFinalizar.onclick = finalizarVenta;

        crearBotonesPagoRapido();
    } else {
        window.location.href = 'index.html';
    }
}

function enfocarBuscador() {
    const inputBusqueda = document.getElementById('inputBusqueda');
    if(inputBusqueda) inputBusqueda.focus();
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
// GESTIÓN DE FIADOS Y CLIENTES
// ==========================================
function configurarEventosFiado() {
    const checkFiado = document.getElementById('esFiado');
    const contenedorSelector = document.getElementById('contenedorSelectorCliente');
    const panelVuelto = document.getElementById('panelVuelto');

    if (!checkFiado) return;

    checkFiado.addEventListener('change', async () => {
        if (checkFiado.checked) {
            // Mostrar selector de clientes y OCULTAR panel de vuelto
            if (contenedorSelector) contenedorSelector.classList.remove('hidden');
            if (panelVuelto) panelVuelto.classList.add('hidden');
            await cargarClientesAlSelector();
        } else {
            // Ocultar selector y MOSTRAR vuelto solo si el método es Efectivo
            if (contenedorSelector) contenedorSelector.classList.add('hidden');
            if (metodoSeleccionado === 'Efectivo' && panelVuelto) {
                panelVuelto.classList.remove('hidden');
            }
        }
    });
}

async function cargarClientesAlSelector() {
    const selectCliente = document.getElementById('selectCliente');
    if (!selectCliente) return;

    const { data: { user } } = await _supabase.auth.getUser();

    let { data: clientes, error } = await _supabase
        .from('clientes')
        .select('id, nombre')
        .eq('user_id', user.id)
        .order('nombre', { ascending: true });

    if (!clientes || clientes.length === 0) {
        const { data: todos } = await _supabase
            .from('clientes')
            .select('id, nombre')
            .order('nombre', { ascending: true });
        clientes = todos;
    }

    if (error) return console.error("Error cargando clientes:", error);

    selectCliente.innerHTML = '<option value="">-- Elige un cliente --</option>';
    
    if (clientes && clientes.length > 0) {
        clientes.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.nombre;
            selectCliente.appendChild(option);
        });
    } else {
        selectCliente.innerHTML = '<option value="">Sin clientes registrados</option>';
    }
}

// ==========================================
// LÓGICA DE LA CÁMARA
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
    if (html5QrCode) await html5QrCode.stop().catch(() => {});
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 20, qrbox: { width: 250, height: 180 }, aspectRatio: 1.0 };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                const ahora = Date.now();
                if (decodedText === ultimoCodigoLeido && (ahora - tiempoUltimaLectura) < 2500) return; 
                ultimoCodigoLeido = decodedText;
                tiempoUltimaLectura = ahora;
                procesarEscaneo(decodedText);
            }
        );
    } catch (err) { cerrarCamara(); }
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
// PROCESAMIENTO DE BÚSQUEDA Y ESCANEO
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
        setTimeout(() => {
            totalElem.classList.remove('scale-110', 'text-blue-500');
            enfocarBuscador();
        }, 200);
    }
}

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
            <td class="p-4 text-xs ${prod.cantidad < 5 ? 'text-red-500 font-bold animate-pulse' : ''}">${prod.cantidad} disp.</td>
            <td class="p-4 text-center">
                <button onclick="agregarAlCarrito(${prod.id})" class="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold">+ Añadir</button>
            </td>
        `;
        tabla.appendChild(fila);
    });
};

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
            mostrarNotificacion("Stock insuficiente", "error");
            return;
        }
    } else {
        if (producto.cantidad > 0) {
            carrito.push({ ...producto, cantidadSeleccionada: 1 });
        } else {
            mostrarNotificacion("Producto sin stock", "error");
            return;
        }
    }
    renderizarCarrito();
    enfocarBuscador();
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
        const stockCritico = item.cantidad - item.cantidadSeleccionada < 3;

        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-3 rounded-xl mb-2 border shadow-sm ${stockCritico ? 'bg-orange-50 border-orange-200' : 'bg-white'}`;
        div.innerHTML = `
            <div>
                <p class="font-bold text-sm text-slate-800">${item.nombre}</p>
                <p class="text-xs ${stockCritico ? 'text-orange-600 font-bold' : 'text-slate-500'}">
                    $${item.precio.toFixed(2)} unit. ${stockCritico ? '(¡Queda poco!)' : ''}
                </p>
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
    } else if (nueva > original.cantidad) {
        mostrarNotificacion("Límite de stock alcanzado", "error");
    }
};

window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    renderizarCarrito();
};

// ==========================================
// PAGO RÁPIDO Y VUELTO
// ==========================================
function crearBotonesPagoRapido() {
    const contenedorVuelto = document.getElementById('panelVuelto');
    if(!contenedorVuelto) return;

    const existentes = contenedorVuelto.querySelector('.pago-rapido-container');
    if(existentes) existentes.remove();

    const divBotones = document.createElement('div');
    divBotones.className = "pago-rapido-container flex flex-wrap gap-2 mt-2";
    const montos = [10, 20, 50, 100];
    
    montos.forEach(monto => {
        const btn = document.createElement('button');
        btn.className = "bg-slate-100 hover:bg-emerald-100 text-slate-600 text-xs px-2 py-1 rounded border transition-colors";
        btn.textContent = `+$${monto}`;
        btn.onclick = () => {
            const inputPaga = document.getElementById('pagaCon');
            const actual = parseFloat(inputPaga.value) || 0;
            inputPaga.value = (actual + monto).toFixed(2);
            actualizarVuelto();
        };
        divBotones.appendChild(btn);
    });
    
    const btnExacto = document.createElement('button');
    btnExacto.className = "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs px-2 py-1 rounded border border-emerald-200 font-bold";
    btnExacto.textContent = "Pago Exacto";
    btnExacto.onclick = () => {
        const total = document.getElementById('totalVenta').textContent.replace('$', '');
        document.getElementById('pagaCon').value = total;
        actualizarVuelto();
    };
    divBotones.appendChild(btnExacto);
    contenedorVuelto.appendChild(divBotones);
}

window.seleccionarMetodo = (metodo) => {
    metodoSeleccionado = metodo;
    const checkFiado = document.getElementById('esFiado');
    const panelVuelto = document.getElementById('panelVuelto');

    document.querySelectorAll('.metodo-pago').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
        btn.classList.add('border-slate-100', 'bg-white', 'text-slate-500');
    });
    const btnActivo = document.getElementById(`btn${metodo}`);
    if(btnActivo) btnActivo.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
    
    // Solo mostrar vuelto si el método es Efectivo y NO está en modo Fiado
    if (metodo === 'Efectivo' && (!checkFiado || !checkFiado.checked)) {
        panelVuelto.classList.remove('hidden');
    } else {
        panelVuelto.classList.add('hidden');
    }
};

function actualizarVuelto() {
    const total = parseFloat(document.getElementById('totalVenta').textContent.replace('$', '')) || 0;
    const pagaCon = parseFloat(document.getElementById('pagaCon').value) || 0;
    const vueltoElem = document.getElementById('vuelto');
    vueltoElem.textContent = pagaCon >= total ? `$${(pagaCon - total).toFixed(2)}` : "$0.00";
}

document.getElementById('pagaCon').addEventListener('input', actualizarVuelto);

// ==========================================
// FINALIZACIÓN DE VENTA
// ==========================================
async function finalizarVenta() {
    if (carrito.length === 0) return;

    const btn = document.getElementById('btnFinalizarVenta');
    const checkFiado = document.getElementById('esFiado');
    const selectCliente = document.getElementById('selectCliente');
    
    const esFiado = checkFiado ? checkFiado.checked : false;
    const clienteId = selectCliente ? selectCliente.value : null;

    if (esFiado && !clienteId) {
        alert("⚠️ Selecciona un cliente para registrar la deuda.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "PROCESANDO...";

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const totalVenta = parseFloat(document.getElementById('totalVenta').textContent.replace('$', ''));

        // --- CORRECCIÓN AQUÍ: Limpiamos los productos para el historial ---
        const productosParaHistorial = carrito.map(p => ({
            id: p.id,
            nombre: p.nombre,
            cantidad: p.cantidadSeleccionada, // <--- Ahora guardamos lo vendido, no el stock
            precio: p.precio_venta
        }));

        // 1. Insertar Venta
        const { error: errorVenta } = await _supabase.from('ventas').insert([{
            total: totalVenta,
            metodo_pago: esFiado ? 'Fiado' : metodoSeleccionado,
            estado_pago: esFiado ? 'pendiente' : 'pagado',
            cliente_id: esFiado ? clienteId : null,
            vendedor_id: user.id, 
            productos_vendidos: JSON.stringify(productosParaHistorial) // <--- Usamos la lista limpia
        }]);

        if (errorVenta) throw errorVenta;

        // 2. Actualizar Deuda si es Fiado
        if (esFiado) {
            const { data: cl, error: errorCl } = await _supabase
                .from('clientes')
                .select('deuda')
                .eq('id', clienteId)
                .single();
            
            if (!errorCl) {
                const deudaActual = parseFloat(cl.deuda) || 0;
                const nuevaDeuda = deudaActual + totalVenta;
                await _supabase.from('clientes').update({ deuda: nuevaDeuda }).eq('id', clienteId);
            }
        }

        // 3. Actualizar Stock (Se mantiene igual, esto funciona bien)
        for (const item of carrito) {
            const nuevoStock = item.cantidad - item.cantidadSeleccionada;
            await _supabase.from('productos').update({ cantidad: nuevoStock }).eq('id', item.id);
        }

        mostrarNotificacion("🎯 Venta registrada con éxito");
        setTimeout(() => location.reload(), 1000); 
    } catch (e) {
        console.error("Error completo de Supabase:", e);
        alert("Error al procesar la venta. Revisa la consola.");
        btn.disabled = false;
        btn.textContent = "Finalizar Venta (F2)";
    }
}

// Listeners finales
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

// Función para que el escáner siempre encuentre el buscador
document.addEventListener('keydown', (e) => {
    const inputBusqPrincipal = document.getElementById('inputBusqueda');
    const inputModalInventario = document.getElementById('codigoBarrasNuevo'); // Asegúrate que este sea el ID de tu input en el modal

    // Si estamos escribiendo en cualquier otro lado manualmente, no hacemos nada
    if (document.activeElement.tagName === 'TEXTAREA' || 
       (document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'search' && document.activeElement.id !== 'inputBusqueda')) return;

    // Detectamos cuál es el buscador que debe recibir el foco
    // Si el modal está visible, mandamos el foco al input del modal
    const modalRegistro = document.getElementById('modalNuevoRegistro'); // El ID de tu modal
    const inputDestino = (modalRegistro && !modalRegistro.classList.contains('hidden')) 
                         ? inputModalInventario 
                         : inputBusqPrincipal;

    if (inputDestino && document.activeElement !== inputDestino) {
        if (e.key.length === 1 || e.key === 'Enter') {
            inputDestino.value = ''; // <--- LIMPIEZA: Borra lo anterior para que no se duplique
            inputDestino.focus();
        }
    }
});

inicializar();