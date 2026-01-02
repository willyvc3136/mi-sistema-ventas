const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Referencias
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');

const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnRegistro = document.getElementById('btnRegistro');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btn-logout');

const inputNombre = document.getElementById('nombreProducto');
const inputCantidad = document.getElementById('cantidadProducto');
const inputPrecio = document.getElementById('precioProducto');
const btnAgregar = document.getElementById('btnAgregar');

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

btnLogin.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signInWithPassword({
        email: authEmail.value, password: authPassword.value
    });
    if (error) alert(error.message); else checkUser();
});

btnRegistro.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signUp({
        email: authEmail.value, password: authPassword.value
    });
    if (error) alert(error.message); else alert("Revisa tu correo");
});

btnLogout.addEventListener('click', async () => {
    await _supabase.auth.signOut();
    window.location.reload();
});

// --- Lógica de Inventario ---

async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });

    if (!error) {
        renderizarTabla(data);
        actualizarDashboard(data);
    }
}

function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50";
        
        // CORRECCIÓN: Usamos argumentos individuales en abrirModal para evitar errores de JSON
        fila.innerHTML = `
            <td class="py-3 px-2">${prod.nombre}</td>
            <td class="py-3 px-2 font-bold ${prod.cantidad < 5 ? 'text-red-600' : 'text-gray-700'}">${prod.cantidad}</td>
            <td class="py-3 px-2 text-blue-600 font-medium">$${parseFloat(prod.precio || 0).toFixed(2)}</td>
            <td class="py-3 px-2 text-center space-x-3">
                <button onclick="prepararEdicion(${prod.id}, '${prod.nombre}', ${prod.cantidad}, ${prod.precio})" class="text-blue-500 hover:underline">Editar</button>
                <button onclick="eliminarProducto(${prod.id})" class="text-red-400 text-sm hover:underline">Eliminar</button>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

function actualizarDashboard(productos) {
    let valorTotal = 0;
    let totalUnicos = productos.length;
    let stockBajo = 0;

    productos.forEach(prod => {
        valorTotal += (parseFloat(prod.precio) || 0) * (parseInt(prod.cantidad) || 0);
        if (prod.cantidad < 5) stockBajo++;
    });

    document.getElementById('stat-valor').textContent = `$${valorTotal.toFixed(2)}`;
    document.getElementById('stat-cantidad').textContent = totalUnicos;
    document.getElementById('stat-alerta').textContent = stockBajo;
}

btnAgregar.addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nombre = inputNombre.value;
    const cantidad = parseInt(inputCantidad.value);
    const precio = parseFloat(inputPrecio.value);

    if (!nombre || isNaN(cantidad) || isNaN(precio)) return alert("Completa todos los campos correctamente");

    const { error } = await _supabase.from('productos').insert([{ 
        nombre, cantidad, precio, user_id: user.id 
    }]);

    if (!error) {
        inputNombre.value = ''; inputCantidad.value = ''; inputPrecio.value = '';
        obtenerProductos(user.id);
    } else {
        alert("Error al agregar: " + error.message);
    }
});

window.eliminarProducto = async (id) => {
    if(!confirm("¿Estás seguro de eliminar este producto?")) return;
    const { data: { user } } = await _supabase.auth.getUser();
    await _supabase.from('productos').delete().eq('id', id);
    obtenerProductos(user.id);
};

// --- Funciones del Modal Corregidas ---
// --- Funciones del Modal Mejoradas con Debug ---

window.prepararEdicion = (id, nombre, cantidad, precio) => {
    console.log("Abriendo modal para ID:", id); // Mensaje en consola
    
    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = nombre;
    document.getElementById('editCantidad').value = cantidad;
    document.getElementById('editPrecio').value = precio;
    
    modalEditar.classList.remove('hidden');
};

window.cerrarModal = () => {
    modalEditar.classList.add('hidden');
};

document.getElementById('btnGuardarCambios').addEventListener('click', async () => {
    console.log("Intentando guardar cambios...");
    
    const id = document.getElementById('editId').value;
    const nombre = document.getElementById('editNombre').value;
    const cantidad = parseInt(document.getElementById('editCantidad').value);
    const precio = parseFloat(document.getElementById('editPrecio').value);

    const { error } = await _supabase
        .from('productos')
        .update({ nombre, cantidad, precio })
        .eq('id', id);

    if (error) {
        alert("Error de Supabase: " + error.message);
    } else {
        alert("✅ ¡Producto actualizado con éxito!");
        cerrarModal();
        // El true fuerza a recargar desde el servidor, no desde el caché
        window.location.href = window.location.href.split('?')[0] + '?update=' + new Date().getTime();
    }
});

// Inicialización
checkUser();