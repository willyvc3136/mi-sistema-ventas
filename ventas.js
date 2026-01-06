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

// ==========================================
// SEGURIDAD E INICIALIZACIÓN
// ==========================================
// CORRECCIÓN EN INICIALIZACIÓN
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

// ==========================================
// DESCARGAR PRODUCTOS
// ==========================================
async function cargarProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true });
    
    if (!error) productosBaseDeDatos = data;
}

// ==========================================
// BUSCADOR Y PISTOLA (LÓGICA CORREGIDA)
// ==========================================
// Usamos window para evitar el SyntaxError de doble declaración
window.manejarBusqueda = (e) => {
    const busqueda = e.target.value.toLowerCase();
    const tabla = document.getElementById('tablaResultados');
    tabla.innerHTML = '';

    if (busqueda.length < 1) return;

    const filtrados = productosBaseDeDatos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) || 
        (p.categoria && p.categoria.toLowerCase().includes(busqueda)) ||
        (p.codigo_barras && p.codigo_barras === busqueda)
    );

    filtrados.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 transition-all cursor-pointer";
        fila.innerHTML = `
            <td class="p-4"><p class="font-bold text-gray-800">${prod.nombre}</p></td>
            <td class="p-4 font-black text-gray-700">$${prod.precio.toFixed(2)}</td>
            <td class="p-4 text-xs">${prod.cantidad} disp.</td>
            <td class="p-4"><button onclick="agregarAlCarrito(${prod.id})" class="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold">+ Añadir</button></td>
        `;
        tabla.appendChild(fila);
    });
};

// Listeners corregidos para evitar duplicidad
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
// FUNCIÓN MAESTRA DE ESCANEO
// ==========================================
function procesarEscaneo(codigo) {
    const producto = productosBaseDeDatos.find(p => p.codigo_barras === codigo);
    if (producto) {
        agregarAlCarrito(producto.id);
        const totalElem = document.getElementById('totalVenta');
        totalElem.classList.add('scale-110', 'text-blue-500');
        setTimeout(() => totalElem.classList.remove('scale-110', 'text-blue-500'), 200);
    }
}

async function encenderCamara(targetInputId) {
    const container = document.getElementById('lectorContainer');
    if(!container) return; // Evita errores si el div no existe
    
    container.classList.remove('hidden');
    
    // Si ya hay una instancia corriendo, la detenemos
    if (html5QrCode) {
        await html5QrCode.stop().catch(() => {});
    }

    html5QrCode = new Html5Qrcode("reader");

    const config = { 
        fps: 15, // Un poco más rápido para móviles
        qrbox: { width: 250, height: 200 }, // Área de escaneo más grande
        aspectRatio: 1.0 
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, // Forzar cámara trasera
            config, 
            (decodedText) => {
                const input = document.getElementById(targetInputId);
                if(input) {
                    input.value = decodedText;
                    // IMPORTANTE: Disparar evento para que el buscador reaccione
                    input.dispatchEvent(new Event('input'));
                    input.dispatchEvent(new Event('change'));
                }
                
                // Si es la pantalla de ventas, procesar el escaneo automáticamente
                if(typeof procesarEscaneo === 'function') {
                    procesarEscaneo(decodedText);
                }

                cerrarCamara();
                
                // Vibración pequeña para confirmar (solo en móvil)
                if (navigator.vibrate) navigator.vibrate(100);
            }
        );
    } catch (err) {
        console.error("Error de cámara:", err);
        alert("No se pudo acceder a la cámara. Verifica los permisos de tu navegador.");
        container.classList.add('hidden');
    }
}

// ==========================================
// LÓGICA DEL CARRITO
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
        contenedor.innerHTML = '<p class="text-center text-gray-300 py-10 italic">Carrito vacío</p>';
        totalElem.textContent = "$0.00";
        btnVenta.disabled = true;
        return;
    }

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidadSeleccionada;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-3 rounded-xl mb-2 border";
        div.innerHTML = `
            <div>
                <p class="font-bold text-sm">${item.nombre}</p>
                <p class="text-xs text-gray-500">$${item.precio.toFixed(2)} x ${item.cantidadSeleccionada}</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="ajustarCantidad(${index}, -1)" class="px-2 bg-white border rounded">-</button>
                <button onclick="ajustarCantidad(${index}, 1)" class="px-2 bg-white border rounded">+</button>
                <button onclick="quitarDelCarrito(${index})" class="text-red-500 ml-2">✕</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    totalElem.textContent = `$${total.toFixed(2)}`;
    btnVenta.disabled = false;
}

// ==========================================
// PROCESAR VENTA (MODIFICADO)
// ==========================================
async function finalizarVenta() {
    if (carrito.length === 0) return;
    
    const esFiado = document.getElementById('esFiado').checked;
    const clienteId = document.getElementById('selectCliente').value;

    if (esFiado && !clienteId) {
        return alert("⚠️ Selecciona un cliente para el fiado.");
    }

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const totalVenta = parseFloat(document.getElementById('totalVenta').textContent.replace('$', ''));

        // 1. Registrar Venta
        const { error: errorVenta } = await _supabase
            .from('ventas')
            .insert([{
                total: totalVenta,
                metodo_pago: esFiado ? 'Fiado' : metodoSeleccionado,
                estado_pago: esFiado ? 'pendiente' : 'pagado',
                cliente_id: esFiado ? clienteId : null,
                vendedor_id: user.id,
                productos_vendidos: carrito 
            }]);

        if (errorVenta) throw errorVenta;

        // 2. Actualizar Deuda
        if (esFiado) {
            const { data: cliente } = await _supabase.from('clientes').select('deuda').eq('id', clienteId).single();
            const nuevaDeuda = Number(cliente.deuda || 0) + totalVenta;
            await _supabase.from('clientes').update({ deuda: nuevaDeuda }).eq('id', clienteId);
        }

        // 3. Descontar Stock
        for (const item of carrito) {
            const nuevoStock = Number(item.cantidad) - Number(item.cantidadSeleccionada);
            await _supabase.from('productos').update({ cantidad: nuevoStock }).eq('id', item.id);
        }

        alert("🎯 Venta procesada correctamente");
        location.reload(); 

    } catch (error) {
        console.error(error);
        alert("Error al finalizar venta.");
    }
}

// ==========================================
// MÉTODOS DE PAGO Y VUELTO (LÓGICA NUEVA)
// ==========================================
// LÓGICA DE MÉTODOS DE PAGO
window.seleccionarMetodo = (metodo) => {
    metodoSeleccionado = metodo;
    document.querySelectorAll('.metodo-pago').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
        btn.classList.add('border-slate-100', 'bg-white', 'text-slate-500');
    });
    
    const btnActivo = document.getElementById(`btn${metodo}`);
    if(btnActivo) btnActivo.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');

    // Mostrar/Ocultar vuelto
    const panelVuelto = document.getElementById('panelVuelto');
    if(metodo === 'Efectivo') {
        panelVuelto.classList.remove('hidden');
    } else {
        panelVuelto.classList.add('hidden');
        document.getElementById('pagaCon').value = '';
        document.getElementById('vuelto').textContent = '$0.00';
    }
};

// CÁLCULO DE VUELTO REAL-TIME
const inputPagaCon = document.getElementById('pagaCon');
if(inputPagaCon) {
    inputPagaCon.addEventListener('input', (e) => {
        const total = parseFloat(document.getElementById('totalVenta').textContent.replace('$', '')) || 0;
        const pagaCon = parseFloat(e.target.value) || 0;
        const vueltoElem = document.getElementById('vuelto');
        if (pagaCon >= total) {
            vueltoElem.textContent = `$${(pagaCon - total).toFixed(2)}`;
        } else {
            vueltoElem.textContent = "$0.00";
        }
    });
}

// Atajo de teclado F2
document.addEventListener('keydown', (e) => {
    if (e.key === "F2") finalizarVenta();
});

// Otras funciones de soporte
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

// CORRECCIÓN EN TOGGLE CLIENTE
window.toggleSelectorCliente = function() {
    const con = document.getElementById('contenedorCliente');
    const esFiado = document.getElementById('esFiado').checked;
    const panelVuelto = document.getElementById('panelVuelto');

    if (esFiado) {
        con.classList.remove('hidden');
        panelVuelto.classList.add('hidden');
        cargarClientesVentas(); 
    } else {
        con.classList.add('hidden');
        if(metodoSeleccionado === 'Efectivo') panelVuelto.classList.remove('hidden');
    }
};

async function cargarClientesVentas() {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data } = await _supabase.from('clientes').select('id, nombre').eq('user_id', user.id);
    const select = document.getElementById('selectCliente');
    select.innerHTML = '<option value="">-- Seleccionar cliente --</option>';
    data.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.nombre;
        select.appendChild(o);
    });
}

// Cálculo de vuelto
document.getElementById('pagaCon').addEventListener('input', (e) => {
    const total = parseFloat(document.getElementById('totalVenta').textContent.replace('$', '')) || 0;
    const pagaCon = parseFloat(e.target.value) || 0;
    const vueltoElem = document.getElementById('vuelto');
    if (pagaCon >= total) {
        vueltoElem.textContent = `$${(pagaCon - total).toFixed(2)}`;
    } else {
        vueltoElem.textContent = "$0.00";
    }
});

inicializar();