const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let carrito = [];
let productosBaseDeDatos = [];

// --- Verificación de Usuario ---
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        document.getElementById('user-display').textContent = `Vendedor: ${user.email}`;
        cargarProductos(user.id);
    } else {
        window.location.href = 'index.html'; // Si no hay sesión, vuelve al inicio
    }
}

// --- Cargar productos de Supabase para el buscador ---
async function cargarProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId);
    
    if (!error) productosBaseDeDatos = data;
}

// --- Buscador en tiempo real ---
document.getElementById('inputBusqueda').addEventListener('input', (e) => {
    const busqueda = e.target.value.toLowerCase();
    const tabla = document.getElementById('tablaResultados');
    tabla.innerHTML = '';

    if (busqueda.length < 2) return;

    const filtrados = productosBaseDeDatos.filter(p => p.nombre.toLowerCase().includes(busqueda));

    filtrados.forEach(prod => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="p-4">${prod.nombre}</td>
            <td class="p-4 font-bold">$${prod.precio.toFixed(2)}</td>
            <td class="p-4 text-sm">${prod.cantidad} disp.</td>
            <td class="p-4 text-center">
                <button onclick="agregarAlCarrito(${prod.id})" class="bg-blue-600 text-white px-4 py-1 rounded-lg hover:bg-blue-700">Añadir</button>
            </td>
        `;
        tabla.appendChild(fila);
    });
});

// --- Manejo del Carrito ---
window.agregarAlCarrito = (id) => {
    const producto = productosBaseDeDatos.find(p => p.id === id);
    const itemEnCarrito = carrito.find(item => item.id === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidadSeleccionada < producto.cantidad) {
            itemEnCarrito.cantidadSeleccionada++;
        } else {
            alert("No hay más stock disponible");
        }
    } else {
        carrito.push({ ...producto, cantidadSeleccionada: 1 });
    }
    renderizarCarrito();
};

function renderizarCarrito() {
    const contenedor = document.getElementById('carritoItems');
    const totalVentaElem = document.getElementById('totalVenta');
    const btnFinalizar = document.getElementById('btnFinalizarVenta');
    
    if (carrito.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-gray-400 py-10 italic">No hay productos en la venta</p>';
        totalVentaElem.textContent = "$0.00";
        btnFinalizar.disabled = true;
        return;
    }

    contenedor.innerHTML = '';
    let total = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidadSeleccionada;
        total += subtotal;
        
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100";
        div.innerHTML = `
            <div>
                <p class="font-bold text-gray-800">${item.nombre}</p>
                <p class="text-xs text-gray-500">$${item.precio.toFixed(2)} x ${item.cantidadSeleccionada}</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-bold text-blue-600">$${subtotal.toFixed(2)}</span>
                <button onclick="quitarDelCarrito(${index})" class="text-red-400 hover:text-red-600">✕</button>
            </div>
        `;
        contenedor.appendChild(div);
    });

    totalVentaElem.textContent = `$${total.toFixed(2)}`;
    btnFinalizar.disabled = false;
}

window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    renderizarCarrito();
};

// --- Finalizar Venta y Descontar Stock ---
document.getElementById('btnFinalizarVenta').addEventListener('click', finalizarVenta);

async function finalizarVenta() {
    if (!confirm("¿Confirmar venta? Se descontará el stock automáticamente.")) return;

    try {
        for (const item of carrito) {
            const nuevoStock = item.cantidad - item.cantidadSeleccionada;
            
            const { error } = await _supabase
                .from('productos')
                .update({ cantidad: nuevoStock })
                .eq('id', item.id);
            
            if (error) throw error;
        }

        alert("✅ Venta procesada con éxito y stock actualizado.");
        carrito = [];
        location.reload(); // Recargamos para actualizar la lista de productosBaseDeDatos
    } catch (error) {
        alert("Error al procesar: " + error.message);
    }
}

// Teclas rápidas: F2 para finalizar
document.addEventListener('keydown', (e) => {
    if (e.key === "F2" && !document.getElementById('btnFinalizarVenta').disabled) {
        finalizarVenta();
    }
});

inicializar();