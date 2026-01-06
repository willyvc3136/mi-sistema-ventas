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
let metodoSeleccionado = 'Efectivo'; // Método por defecto

// ==========================================
// SEGURIDAD E INICIALIZACIÓN
// ==========================================
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        document.getElementById('user-display').textContent = `Vendedor: ${user.email}`;
        await cargarProductos(user.id); 
        
        // FOCO AUTOMÁTICO AL INICIAR: Prepara la pistola apenas abre la página
        document.getElementById('inputBusqueda').focus();
    } else {
        window.location.href = 'index.html';
    }
}

// ==========================================
// DESCARGAR PRODUCTOS (INVENTARIO LOCAL)
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
// BUSCADOR MANUAL Y PISTOLA (LÓGICA HÍBRIDA)
// ==========================================
const inputBusqueda = document.getElementById('inputBusqueda');

// 1. Detección de escritura manual (Búsqueda por nombre)
inputBusqueda.addEventListener('input', (e) => {
    const busqueda = e.target.value.toLowerCase();
    const tabla = document.getElementById('tablaResultados');
    tabla.innerHTML = '';

    if (busqueda.length < 1) return;

    const filtrados = productosBaseDeDatos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) || 
        (p.categoria && p.categoria.toLowerCase().includes(busqueda)) ||
        (p.codigo_barras && p.codigo_barras === busqueda) // También busca por código exacto mientras escribes
    );

    filtrados.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 transition-all cursor-pointer";
        fila.innerHTML = `
            <td class="p-4">
                <p class="font-bold text-gray-800">${prod.nombre}</p>
                <p class="text-[10px] text-blue-500 uppercase font-black">${prod.categoria || 'General'}</p>
            </td>
            <td class="p-4 font-black text-gray-700">$${prod.precio.toFixed(2)}</td>
            <td class="p-4">
                <span class="text-xs font-bold ${prod.cantidad < 5 ? 'text-red-500' : 'text-gray-400'}">
                    ${prod.cantidad} disp.
                </span>
            </td>
            <td class="p-4 text-center">
                <button onclick="agregarAlCarrito(${prod.id})" 
                    class="bg-green-100 text-green-700 px-4 py-2 rounded-xl hover:bg-green-500 hover:text-white transition-all font-bold text-xs uppercase">
                    + Añadir
                </button>
            </td>
        `;
        tabla.appendChild(fila);
    });
});

// 2. Detección de la PISTOLA (Señal de Enter)
inputBusqueda.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const valor = e.target.value.trim();
        if (valor.length > 2) {
            procesarEscaneo(valor);
            e.target.value = ''; // Limpia el buscador para el siguiente "disparo"
        }
    }
});

// 3. FOCO INFINITO: Mantiene el cursor en el buscador para que la pistola nunca falle
document.addEventListener('click', (e) => {
    // Si el usuario no está haciendo clic en los campos de pago o cliente, regresa el foco al buscador
    const camposIgnorar = ['pagaCon', 'selectCliente', 'esFiado'];
    if (!camposIgnorar.includes(e.target.id) && e.target.tagName !== 'BUTTON') {
        inputBusqueda.focus();
    }
});

// ==========================================
// FUNCIÓN MAESTRA DE ESCANEO (CÁMARA Y PISTOLA)
// ==========================================
function procesarEscaneo(codigo) {
    const producto = productosBaseDeDatos.find(p => p.codigo_barras === codigo);
    
    if (producto) {
        agregarAlCarrito(producto.id);
        
        // Feedback visual: El total parpadea en verde cuando la pistola agrega algo
        const totalElem = document.getElementById('totalVenta');
        totalElem.classList.add('scale-110', 'text-blue-500');
        setTimeout(() => totalElem.classList.remove('scale-110', 'text-blue-500'), 200);
        
        // Limpiar tabla de resultados manuales si hubiera algo
        document.getElementById('tablaResultados').innerHTML = '';
    } else {
        console.warn("Producto no registrado: " + codigo);
        // Podrías agregar un sonido de error aquí
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
    const contadorElem = document.getElementById('contadorItems');
    const btnVenta = document.getElementById('btnFinalizarVenta');
    const pagaConInput = document.getElementById('pagaCon');
    const vueltoElem = document.getElementById('vuelto');
    
    contenedor.innerHTML = '';
    let total = 0;
    let totalItems = 0;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-gray-300 py-10 italic">Carrito vacío</p>';
        totalElem.textContent = "$0.00";
        contadorElem.textContent = "0";
        btnVenta.disabled = true;
        return;
    }

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidadSeleccionada;
        total += subtotal;
        totalItems += item.cantidadSeleccionada;
        
        const div = document.createElement('div');
        div.className = "flex flex-col bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm gap-2";
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="font-black text-gray-800 text-sm leading-tight">${item.nombre}</p>
                    <p class="text-xs text-gray-400 font-bold">$${item.precio.toFixed(2)} c/u</p>
                </div>
                <button onclick="quitarDelCarrito(${index})" class="text-red-300 hover:text-red-500 transition-all font-bold text-lg">✕</button>
            </div>
            <div class="flex justify-between items-center mt-2">
                <div class="flex items-center gap-2 bg-white rounded-xl border p-1">
                    <button onclick="ajustarCantidad(${index}, -1)" class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-red-100 hover:text-red-600 transition-all font-bold">-</button>
                    <span class="w-8 text-center font-black text-sm">${item.cantidadSeleccionada}</span>
                    <button onclick="ajustarCantidad(${index}, 1)" class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-green-100 hover:text-green-600 transition-all font-bold">+</button>
                </div>
                <span class="font-black text-green-600 text-lg">$${subtotal.toFixed(2)}</span>
            </div>
        `;
        contenedor.appendChild(div);
    });

    totalElem.textContent = `$${total.toFixed(2)}`;
    contadorElem.textContent = totalItems;
    btnVenta.disabled = false;

    // Reset de calculadora de vuelto al cambiar el carrito
    if(pagaConInput) pagaConInput.value = '';
    if(vueltoElem) vueltoElem.textContent = '$0.00';
}

// ==========================================
// PROCESAR VENTA FINAL
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

        // 2. Actualizar Deuda si es fiado
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
        alert("Error: " + error.message);
    }
}

// ==========================================
// FUNCIONES DE SOPORTE (CÁMARA, VUELTO, ETC)
// ==========================================
async function toggleCamara() {
    const readerDiv = document.getElementById('reader');
    if (readerDiv.classList.contains('hidden')) {
        readerDiv.classList.remove('hidden');
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
            procesarEscaneo(text);
            detenerCamara();
        });
    } else {
        detenerCamara();
    }
}

function detenerCamara() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => document.getElementById('reader').classList.add('hidden'));
    }
}

window.seleccionarMetodo = (metodo) => {
    metodoSeleccionado = metodo;
    document.querySelectorAll('.metodo-pago').forEach(btn => {
        btn.classList.remove('border-green-500', 'bg-green-50', 'text-green-700');
        btn.classList.add('border-gray-100', 'bg-gray-50', 'text-gray-500');
    });
    const btn = document.getElementById(`btn${metodo}`);
    btn.classList.replace('border-gray-100', 'border-green-500');
    btn.classList.replace('bg-gray-50', 'bg-green-50');
    btn.classList.replace('text-gray-500', 'text-green-700');
};

// Cálculo de vuelto en tiempo real
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

// Atajos globales
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

window.toggleSelectorCliente = function() {
    const con = document.getElementById('contenedorCliente');
    if (document.getElementById('esFiado').checked) {
        con.classList.remove('hidden');
        cargarClientesVentas(); 
    } else {
        con.classList.add('hidden');
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

// Ejecutar inicio
inicializar();