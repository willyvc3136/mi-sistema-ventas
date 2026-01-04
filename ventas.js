// ==========================================
// CONFIGURACIÓN DE CONEXIÓN (SUPABASE)
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// VARIABLES GLOBALES
let carrito = []; // Almacena los productos que se van a vender
let productosBaseDeDatos = []; // Copia local del inventario para búsquedas rápidas
let html5QrCode; // Variable para controlar la cámara

// ==========================================
// SEGURIDAD: VERIFICAR SESIÓN E INICIALIZAR
// ==========================================
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        document.getElementById('user-display').textContent = `Vendedor: ${user.email}`;
        cargarProductos(user.id); // Descarga el inventario del usuario
    } else {
        // Bloqueo: Si no hay usuario, regresa al login
        window.location.href = 'index.html';
    }
}

// ==========================================
// DESCARGAR PRODUCTOS (PARA BÚSQUEDA RÁPIDA)
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
// BUSCADOR MANUAL (POR NOMBRE O CATEGORÍA)
// ==========================================
document.getElementById('inputBusqueda').addEventListener('input', (e) => {
    const busqueda = e.target.value.toLowerCase();
    const tabla = document.getElementById('tablaResultados');
    tabla.innerHTML = '';

    if (busqueda.length < 1) return;

    // Filtra productos que coincidan con el texto escrito
    const filtrados = productosBaseDeDatos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) || 
        (p.categoria && p.categoria.toLowerCase().includes(busqueda))
    );

    // Dibuja los resultados en la tabla de búsqueda
    filtrados.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 transition-all";
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

// ==========================================
// LÓGICA DEL CARRITO (AÑADIR PRODUCTOS)
// ==========================================
window.agregarAlCarrito = (id) => {
    const producto = productosBaseDeDatos.find(p => p.id === id);
    const itemEnCarrito = carrito.find(item => item.id === id);

    if (itemEnCarrito) {
        // Si ya está en el carrito, aumenta la cantidad si hay stock
        if (itemEnCarrito.cantidadSeleccionada < producto.cantidad) {
            itemEnCarrito.cantidadSeleccionada++;
        } else {
            alert("⚠️ Stock insuficiente en almacén");
        }
    } else {
        // Si es nuevo, lo añade al carrito
        if (producto.cantidad > 0) {
            carrito.push({ ...producto, cantidadSeleccionada: 1 });
        } else {
            alert("⚠️ Este producto no tiene stock");
        }
    }
    renderizarCarrito(); // Actualiza la vista del ticket
};

// ==========================================
// RENDERIZAR TICKET (RESUMEN DE VENTA)
// ==========================================
function renderizarCarrito() {
    const contenedor = document.getElementById('carritoItems');
    const totalElem = document.getElementById('totalVenta');
    const contadorElem = document.getElementById('contadorItems');
    const btnVenta = document.getElementById('btnFinalizarVenta');
    
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

    // Crea visualmente cada item en el ticket
    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidadSeleccionada;
        total += subtotal;
        totalItems += item.cantidadSeleccionada;
        
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm";
        div.innerHTML = `
            <div class="flex-1">
                <p class="font-black text-gray-800 text-sm leading-tight">${item.nombre}</p>
                <p class="text-xs text-gray-400 font-bold">$${item.precio.toFixed(2)} x ${item.cantidadSeleccionada}</p>
            </div>
            <div class="flex items-center gap-4">
                <span class="font-black text-green-600">$${subtotal.toFixed(2)}</span>
                <button onclick="quitarDelCarrito(${index})" class="bg-white text-red-400 w-8 h-8 rounded-full shadow-sm hover:text-red-600 transition-all flex items-center justify-center font-bold">✕</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    totalElem.textContent = `$${total.toFixed(2)}`;
    contadorElem.textContent = totalItems;
    btnVenta.disabled = false;
}

// Quita un producto del ticket
window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    renderizarCarrito();
};

// ==========================================
// PROCESAR VENTA (ACTUALIZAR NUBE)
// ==========================================
document.getElementById('btnFinalizarVenta').addEventListener('click', finalizarVenta);

async function finalizarVenta() {
    if (!confirm("¿Confirmar cobro y actualizar inventario?")) return;

    try {
        // Descuenta el stock de cada producto vendido en Supabase
        for (const item of carrito) {
            const nuevoStock = item.cantidad - item.cantidadSeleccionada;
            
            const { error } = await _supabase
                .from('productos')
                .update({ cantidad: nuevoStock })
                .eq('id', item.id);
            
            if (error) throw error;
        }

        alert("🎯 Venta realizada con éxito");
        carrito = []; // Limpia el carrito
        location.reload(); // Recarga para actualizar el stock local
    } catch (error) {
        alert("Error al descontar stock: " + error.message);
    }
}

// Atajo de teclado: F2 para cobrar rápido
document.addEventListener('keydown', (e) => {
    if (e.key === "F2" && !document.getElementById('btnFinalizarVenta').disabled) {
        finalizarVenta();
    }
});

// ==========================================
// ESCÁNER: CÁMARA DEL CELULAR
// ==========================================
async function toggleCamara() {
    const readerDiv = document.getElementById('reader');
    
    if (readerDiv.classList.contains('hidden')) {
        readerDiv.classList.remove('hidden');
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 150 } };

        // Inicia el lector usando la cámara trasera (environment)
        html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
            procesarEscaneo(decodedText); // Acción al leer un código
            detenerCamara(); // Cierra la cámara automáticamente tras leer
        });
    } else {
        detenerCamara();
    }
}

function detenerCamara() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').classList.add('hidden');
        });
    }
}

// ==========================================
// ESCÁNER: PISTOLA DE CÓDIGO DE BARRAS
// ==========================================
// Detecta el "Enter" que envían las pistolas al terminar de leer
document.getElementById('inputBusqueda').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const valor = e.target.value.trim();
        if (valor.length > 3) {
            procesarEscaneo(valor);
            e.target.value = ''; // Limpia el campo para el siguiente producto
        }
    }
});

// ==========================================
// FUNCIÓN MAESTRA DE ESCANEO
// ==========================================
function procesarEscaneo(codigo) {
    // Busca el producto en nuestra lista local usando la columna 'codigo_barras'
    const producto = productosBaseDeDatos.find(p => p.codigo_barras === codigo);
    
    if (producto) {
        agregarAlCarrito(producto.id); // Si existe, lo mete al ticket
        
        // Efecto visual de parpadeo en el total para avisar que se agregó
        const totalElem = document.getElementById('totalVenta');
        totalElem.classList.add('scale-110', 'text-blue-500');
        setTimeout(() => totalElem.classList.remove('scale-110', 'text-blue-500'), 200);
    } else {
        console.log("Código no encontrado: " + codigo);
        // Aquí podrías poner un sonido de error o un alert pequeño
    }
}

// Inicia el proceso de autenticación al cargar el archivo
inicializar();