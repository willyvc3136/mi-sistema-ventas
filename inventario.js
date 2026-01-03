const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Referencias HTML
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');

// --- Lógica de Autenticación ---

async function checkUser() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userEmailDisplay.textContent = user.email;
        obtenerProductos(user.id);
    } else {
        authSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
}

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message); else checkUser();
});

document.getElementById('btnRegistro').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const { error } = await _supabase.auth.signUp({ email, password });
    if (error) alert(error.message); else alert("Revisa tu correo para confirmar el registro");
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await _supabase.auth.signOut();
    window.location.reload();
});

// --- Lógica de Inventario Pro ---

async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: false });

    if (!error) {
        renderizarTabla(data);
        actualizarDashboard(data);
    }
}

function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-blue-50 transition-colors";

        // Calculamos la ganancia por unidad para que la veas tú
        const ganancia = (prod.precio || 0) - (prod.precio_costo || 0);
        
        fila.innerHTML = `
            <td class="py-4 px-4 border-b">
                <span class="text-[10px] font-bold text-blue-500 uppercase block">${prod.categoria || 'Otros'}</span>
                <span class="font-medium text-gray-800">${prod.nombre}</span>
            </td>
            <td class="py-4 px-4 border-b text-center">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${prod.cantidad < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">
                    ${prod.cantidad} und.
                </span>
            </td>
            <td class="py-4 px-4 border-b font-bold text-gray-700">
                $${parseFloat(prod.precio || 0).toFixed(2)}
            </td>
            <td class="py-4 px-4 border-b text-center space-x-3">
                <button onclick="prepararEdicion(${prod.id}, '${prod.nombre}', ${prod.cantidad}, ${prod.precio}, '${prod.categoria}', ${prod.precio_costo})" class="text-blue-600 hover:underline font-bold text-sm">Editar</button>
                <button onclick="eliminarProducto(${prod.id})" class="text-red-400 hover:underline text-xs">Eliminar</button>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

// --- Actualizar Dashboard ---

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

    // Actualizamos los textos (Asegúrate de tener estos IDs en tu HTML o usa el de stat-valor)
    document.getElementById('stat-valor').innerHTML = `
        <div class="text-2xl">$${valorVentaTotal.toFixed(2)}</div>
        <div class="text-xs text-green-500 font-normal">Ganancia estimada: $${gananciaPotencial.toFixed(2)}</div>
    `;
    document.getElementById('stat-cantidad').textContent = productos.length;
    document.getElementById('stat-alerta').textContent = stockBajo;
}

// --- Agregar Producto ---

document.getElementById('btnAgregar').addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nombre = document.getElementById('nombreProducto').value;
    const categoria = document.getElementById('categoriaProducto').value;
    const cantidad = parseInt(document.getElementById('cantidadProducto').value);
    const precio_costo = parseFloat(document.getElementById('precioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('precioProducto').value) || 0;

    if (!nombre || isNaN(cantidad)) return alert("Nombre y Stock son campos obligatorios");

    const { error } = await _supabase.from('productos').insert([{ 
        nombre, categoria, cantidad, precio_costo, precio, user_id: user.id 
    }]);

    if (!error) {
        // Limpiar campos y recargar
        location.reload(); 
    } else {
        alert("Error al guardar: " + error.message);
    }
});

// --- Modal de Edición ---

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
    const nombre = document.getElementById('editNombre').value;
    const categoria = document.getElementById('editCategoria').value;
    const cantidad = parseInt(document.getElementById('editCantidad').value);
    const precio_costo = parseFloat(document.getElementById('editPrecioCosto').value);
    const precio = parseFloat(document.getElementById('editPrecio').value);

    const { error } = await _supabase
        .from('productos')
        .update({ nombre, categoria, cantidad, precio_costo, precio })
        .eq('id', id);

    if (error) {
        alert("Error al actualizar: " + error.message);
    } else {
        alert("✅ Producto actualizado correctamente");
        location.reload();
    }
});

window.eliminarProducto = async (id) => {
    if(!confirm("¿Estás seguro de eliminar este producto del inventario?")) return;
    const { error } = await _supabase.from('productos').delete().eq('id', id);
    if (error) alert(error.message); else location.reload();
};

// --- Buscador en Tiempo Real ---

document.getElementById('buscador').addEventListener('input', (e) => {
    const filtro = e.target.value.toLowerCase();
    const filas = listaProductos.getElementsByTagName('tr');

    Array.from(filas).forEach(fila => {
        const textoFila = fila.innerText.toLowerCase();
        fila.style.display = textoFila.includes(filtro) ? "" : "none";
    });
});

// Inicializar app
checkUser();