// 1. Configuración de conexión (Asegúrate de que tus credenciales sean correctas)
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// 2. REFERENCIAS A ELEMENTOS DEL HTML
const authSection = document.getElementById('authSection');
const mainApp = document.getElementById('mainApp');
const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');

// Elementos de Auth
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnRegistro = document.getElementById('btnRegistro');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btn-logout'); // El nuevo botón rojo

// Elementos de Inventario
const inputNombre = document.getElementById('nombreProducto');
const inputCantidad = document.getElementById('cantidadProducto');
const btnAgregar = document.getElementById('btnAgregar');

// 3. CONTROL DE ACCESO (LOGIN / LOGOUT)

async function checkUser() {
    const { data: { user } } = await _supabase.auth.getUser();

    if (user) {
        // Mostrar la App y el Email, ocultar el Login
        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userEmailDisplay.textContent = user.email; // Mostramos el email en la barra azul
        obtenerProductos(user.id);
    } else {
        // Mostrar Login, ocultar la App
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

// Cerrar Sesión (Ahora usando el nuevo botón btn-logout)
btnLogout.addEventListener('click', async () => {
    const { error } = await _supabase.auth.signOut();
    if (error) alert("Error al cerrar sesión");
    else window.location.reload(); 
});

// 4. LÓGICA DEL INVENTARIO

async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('id', { ascending: true });

    if (!error) renderizarTabla(data);
}

function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50";
        fila.innerHTML = `
            <td class="py-3 px-2 text-gray-700">${prod.nombre}</td>
            <td class="py-3 px-2 text-gray-700 font-medium">${prod.cantidad}</td>
            <td class="py-3 px-2 text-center">
                <button onclick="eliminarProducto(${prod.id})" class="text-red-500 hover:font-bold transition">
                    Eliminar
                </button>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

btnAgregar.addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nombre = inputNombre.value;
    const cantidad = parseInt(inputCantidad.value);

    if (!nombre || isNaN(cantidad)) return alert("Por favor, completa los datos.");

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

window.eliminarProducto = async (id) => {
    const { data: { user } } = await _supabase.auth.getUser();
    const { error } = await _supabase.from('productos').delete().eq('id', id);
    if (!error) obtenerProductos(user.id);
};

// Iniciar la app al cargar
checkUser();