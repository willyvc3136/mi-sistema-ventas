const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Referencias
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');

const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnRegistro = document.getElementById('btnRegistro');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btn-logout');

const inputNombre = document.getElementById('nombreProducto');
const inputCantidad = document.getElementById('cantidadProducto');
const inputPrecio = document.getElementById('precioProducto');
const btnAgregar = document.getElementById('btnAgregar');

// Lógica de Autenticación
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

// Lógica de Inventario
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
        // CORRECCIÓN: prod.cantidad va en Stock y prod.precio va en Precio
        fila.innerHTML = `
            <td class="py-3 px-2">${prod.nombre}</td>
            <td class="py-3 px-2 font-bold ${prod.cantidad < 5 ? 'text-red-600' : 'text-gray-700'}">${prod.cantidad}</td>
            <td class="py-3 px-2 text-blue-600 font-medium">$${parseFloat(prod.precio || 0).toFixed(2)}</td>
            <td class="py-3 px-2 text-center space-x-3">
                <button onclick='abrirModal(${JSON.stringify(prod)})' class="text-blue-500 hover:underline">Editar</button>
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
    }
});

window.eliminarProducto = async (id) => {
    const { data: { user } } = await _supabase.auth.getUser();
    await _supabase.from('productos').delete().eq('id', id);
    obtenerProductos(user.id);
};

// Funciones para el Modal
    const modalEditar = document.getElementById('modalEditar');

window.abrirModal = (prod) => {
    document.getElementById('editId').value = prod.id;
    document.getElementById('editNombre').value = prod.nombre;
    document.getElementById('editCantidad').value = prod.cantidad;
    document.getElementById('editPrecio').value = prod.precio;
    modalEditar.classList.remove('hidden');
};

window.cerrarModal = () => {
    modalEditar.classList.add('hidden');
};

// Guardar cambios en Supabase
document.getElementById('btnGuardarCambios').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const nombre = document.getElementById('editNombre').value;
    const cantidad = parseInt(document.getElementById('editCantidad').value);
    const precio = parseFloat(document.getElementById('editPrecio').value);
    const { data: { user } } = await _supabase.auth.getUser();

    const { error } = await _supabase
        .from('productos')
        .update({ nombre, cantidad, precio })
        .eq('id', id);

    if (!error) {
        cerrarModal();
        obtenerProductos(user.id); // Recarga la tabla y el dashboard
    } else {
        alert("Error al actualizar: " + error.message);
    }
});

checkUser();