const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Referencias HTML
const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');

// --- Seguridad: Verificar Sesión ---
async function checkAuth() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        userEmailDisplay.textContent = user.email;
        obtenerProductos(user.id);
    } else {
        // Si no hay usuario, mandamos al login principal
        window.location.href = 'index.html';
    }
}

// --- Lógica de Datos ---
async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true });

    if (!error) {
        renderizarTabla(data);
        actualizarDashboard(data);
    }
}

function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-blue-50 transition-colors group";
        
        fila.innerHTML = `
            <td class="py-4 px-4">
                <span class="text-[10px] font-black text-blue-500 uppercase block">${prod.categoria || 'Otros'}</span>
                <span class="font-bold text-gray-800">${prod.nombre}</span>
            </td>
            <td class="py-4 px-4 text-center">
                <span class="px-3 py-1 rounded-lg text-xs font-black ${prod.cantidad < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}">
                    ${prod.cantidad} UNIDADES
                </span>
            </td>
            <td class="py-4 px-4 font-bold text-gray-700">
                $${parseFloat(prod.precio || 0).toFixed(2)}
            </td>
            <td class="py-4 px-4 text-center space-x-2">
                <button onclick="prepararEdicion(${prod.id}, '${prod.nombre}', ${prod.cantidad}, ${prod.precio}, '${prod.categoria}', ${prod.precio_costo})" 
                    class="bg-gray-100 text-gray-600 px-3 py-1 rounded-md hover:bg-blue-600 hover:text-white transition-all text-xs font-bold">Editar</button>
                <button onclick="eliminarProducto(${prod.id})" 
                    class="text-red-300 hover:text-red-600 transition-colors text-xs font-bold">Eliminar</button>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

function actualizarDashboard(productos) {
    let valorVentaTotal = 0;
    let inversionTotal = 0;
    let stockBajo = 0;

    productos.forEach(prod => {
        const cant = parseInt(prod.cantidad) || 0;
        valorVentaTotal += (parseFloat(prod.precio) || 0) * cant;
        inversionTotal += (parseFloat(prod.precio_costo) || 0) * cant;
        if (cant < 5) stockBajo++;
    });

    const gananciaPotencial = valorVentaTotal - inversionTotal;

    document.getElementById('stat-valor').innerHTML = `
        <h3 class="text-3xl font-bold text-blue-600">$${valorVentaTotal.toFixed(2)}</h3>
        <p class="text-xs text-green-600 font-bold mt-1">Ganancia Esperada: $${gananciaPotencial.toFixed(2)}</p>
    `;
    document.getElementById('stat-cantidad').textContent = productos.length;
    document.getElementById('stat-alerta').textContent = stockBajo;
}

// --- CRUD: Agregar, Editar, Eliminar ---
document.getElementById('btnAgregar').addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nombre = document.getElementById('nombreProducto').value;
    const categoria = document.getElementById('categoriaProducto').value;
    const cantidad = parseInt(document.getElementById('cantidadProducto').value);
    const precio_costo = parseFloat(document.getElementById('precioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('precioProducto').value) || 0;

    if (!nombre || isNaN(cantidad)) return alert("El nombre y el stock son obligatorios");

    const { error } = await _supabase.from('productos').insert([{ 
        nombre, categoria, cantidad, precio_costo, precio, user_id: user.id 
    }]);

    if (!error) location.reload(); else alert("Error: " + error.message);
});

window.prepararEdicion = (id, nombre, cantidad, precio, categoria, costo) => {
    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = nombre;
    document.getElementById('editCantidad').value = cantidad;
    document.getElementById('editPrecio').value = precio;
    document.getElementById('editCategoria').value = categoria || 'Otros';
    document.getElementById('editPrecioCosto').value = costo || 0;
    modalEditar.classList.remove('hidden');
};

window.cerrarModal = () => modalEditar.classList.add('hidden');

document.getElementById('btnGuardarCambios').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const updates = {
        nombre: document.getElementById('editNombre').value,
        categoria: document.getElementById('editCategoria').value,
        cantidad: parseInt(document.getElementById('editCantidad').value),
        precio_costo: parseFloat(document.getElementById('editPrecioCosto').value),
        precio: parseFloat(document.getElementById('editPrecio').value)
    };

    const { error } = await _supabase.from('productos').update(updates).eq('id', id);
    if (!error) location.reload(); else alert("Error: " + error.message);
});

window.eliminarProducto = async (id) => {
    if(!confirm("¿Eliminar este producto permanentemente?")) return;
    const { error } = await _supabase.from('productos').delete().eq('id', id);
    if (!error) location.reload();
};

// --- Buscador ---
document.getElementById('buscador').addEventListener('input', (e) => {
    const filtro = e.target.value.toLowerCase();
    const filas = listaProductos.getElementsByTagName('tr');
    Array.from(filas).forEach(fila => {
        fila.style.display = fila.innerText.toLowerCase().includes(filtro) ? "" : "none";
    });
});

// Inicializar
checkAuth();