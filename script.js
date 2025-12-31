// 1. Configuración de conexión
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// 2. REFERENCIAS A ELEMENTOS DEL HTML
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const listaProductos = document.getElementById('listaProductos');

// Elementos de Auth
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnRegistro = document.getElementById('btnRegistro');
const btnLogin = document.getElementById('btnLogin');
const btnSalir = document.getElementById('btnSalir');

// Elementos de Inventario
const inputNombre = document.getElementById('nombreProducto');
const inputCantidad = document.getElementById('cantidadProducto');
const btnAgregar = document.getElementById('btnAgregar');

// 3. CONTROL DE ACCESO (LOGIN / LOGOUT)

// Función para verificar el estado del usuario
async function checkUser() {
    const { data: { user } } = await _supabase.auth.getUser();

    if (user) {
        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        obtenerProductos(user.id); // Cargar solo sus productos
    } else {
        authSection.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
}

// Registro
btnRegistro.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signUp({
        email: authEmail.value,
        password: authPassword.value,
    });
    if (error) alert("Error al registrar: " + error.message);
    else alert("¡Registro exitoso! Revisa tu correo para confirmar.");
});

// Inicio de Sesión
btnLogin.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signInWithPassword({
        email: authEmail.value,
        password: authPassword.value,
    });
    if (error) alert("Error: " + error.message);
    else checkUser();
});

// Cerrar Sesión
btnSalir.addEventListener('click', async () => {
    await _supabase.auth.signOut();
    checkUser();
});

// 4. LÓGICA DEL INVENTARIO PRIVADO

// Obtener productos del usuario logueado
async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId) // Filtro de privacidad
        .order('id', { ascending: true });

    if (!error) renderizarTabla(data);
}

// Dibujar la tabla en el HTML
function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50";
        fila.innerHTML = `
            <td class="py-3 px-2 text-gray-700">${prod.nombre}</td>
            <td class="py-3 px-2 text-gray-700 font-medium">${prod.cantidad}</td>
            <td class="py-3 px-2 text-center">
                <button onclick="eliminarProducto(${prod.id})" class="text-red-500 hover:font-bold">Eliminar</button>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

// Agregar producto con user_id
btnAgregar.addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nombre = inputNombre.value;
    const cantidad = parseInt(inputCantidad.value);

    if (!nombre || isNaN(cantidad)) return alert("Datos inválidos");

    const { error } = await _supabase
        .from('productos')
        .insert([{ 
            nombre: nombre, 
            cantidad: cantidad, 
            user_id: user.id 
        }]);

    if (!error) {
        inputNombre.value = '';
        inputCantidad.value = '';
        obtenerProductos(user.id);
    }
});

// Eliminar producto
window.eliminarProducto = async (id) => {
    const { data: { user } } = await _supabase.auth.getUser();
    const { error } = await _supabase.from('productos').delete().eq('id', id);
    
    if (!error) obtenerProductos(user.id);
};

// Iniciar la app
checkUser();

// 1. Función para mostrar la información del usuario
async function mostrarUsuario() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // Si hay un usuario, mostramos el correo y la barra
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-bar').classList.remove('hidden');
    }
}

// 2. Función para Cerrar Sesión
document.getElementById('btn-logout').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert("Error al cerrar sesión");
    } else {
        window.location.reload(); // Recarga la página para volver al login
    }
});

// 3. Ejecutar al cargar la página
mostrarUsuario();