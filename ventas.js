const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let carrito = [];
let productosBaseDeDatos = [];

// --- Seguridad: Verificar Sesión e Inicializar ---
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        document.getElementById('user-display').textContent = `Vendedor: ${user.email}`;
        cargarProductos(user.id);
    } else {
        // Bloqueo de seguridad: Si no hay usuario, regresa al index
        window.location.href = 'index.html';
    }
}

// --- Cargar productos de Supabase ---
async function cargarProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true });
    
    if (!error) productosBaseDeDatos = data;
}

// --- Buscador en tiempo real ---
document.getElementById('inputBusqueda').addEventListener('input', (e) => {
    const busqueda = e.target.value.toLowerCase();
    const tabla = document.getElementById('tablaResultados');
    tabla.innerHTML = '';

    if (busqueda.length < 1) return;

    const filtrados = productosBaseDeDatos.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) || 
        (p.categoria && p.categoria.toLowerCase().includes(busqueda))
    );

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

// --- Lógica del Carrito ---
window.agregarAlCarrito = (id) => {
    const producto = productosBaseDeDatos.find(p => p.id === id);
    const itemEnCarrito = carrito.find(item => item.id === id);

    if (itemEnCarrito) {
        if (itemEnCarrito.cantidadSeleccionada < producto.cantidad) {
            itemEnCarrito.cantidadSeleccionada++;
        } else {
            alert("⚠️ Stock insuficiente en almacén");
        }
    } else {
        if (producto.cantidad > 0) {
            carrito.push({ ...producto, cantidadSeleccionada: 1 });
        } else {
            alert("⚠️ Este producto no tiene stock");
        }
    }
    renderizarCarrito();
};

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

window.quitarDelCarrito = (index) => {
    carrito.splice(index, 1);
    renderizarCarrito();
};

// --- Procesar Venta en Supabase ---
document.getElementById('btnFinalizarVenta').addEventListener('click', finalizarVenta);

async function finalizarVenta() {
    if (!confirm("¿Confirmar cobro y actualizar inventario?")) return;

    try {
        // Actualizamos cada producto en la base de datos
        for (const item of carrito) {
            const nuevoStock = item.cantidad - item.cantidadSeleccionada;
            
            const { error } = await _supabase
                .from('productos')
                .update({ cantidad: nuevoStock })
                .eq('id', item.id);
            
            if (error) throw error;
        }

        alert("🎯 Venta realizada con éxito");
        carrito = [];
        location.reload(); 
    } catch (error) {
        alert("Error al descontar stock: " + error.message);
    }
}

// Atajo de teclado
document.addEventListener('keydown', (e) => {
    if (e.key === "F2" && !document.getElementById('btnFinalizarVenta').disabled) {
        finalizarVenta();
    }
});

inicializar();