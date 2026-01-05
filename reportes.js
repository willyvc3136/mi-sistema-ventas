const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'TU_LLAVE_PUBLICA_AQUI'; // <--- ASEGÚRATE DE QUE SEA LA CORRECTA
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// 1. VERIFICAR SESIÓN AL ENTRAR
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        obtenerClientes(user.id); // Solo carga si hay usuario
    } else {
        // Si no estás logueado, te manda al index (login)
        window.location.href = 'index.html';
    }
}

// 2. REGISTRAR CLIENTE (CORREGIDO)
async function registrarCliente() {
    const nombre = document.getElementById('nombreCliente').value;
    const telefono = document.getElementById('telefonoCliente').value;
    
    // Obtenemos el usuario actual de nuevo para estar seguros
    const { data: { user } } = await _supabase.auth.getUser();

    if (!user) return alert("Sesión expirada. Por favor, inicia sesión de nuevo.");
    if (!nombre) return alert("El nombre es obligatorio");

    const { error } = await _supabase.from('clientes').insert([
        { 
            nombre: nombre, 
            telefono: telefono, 
            user_id: user.id, // Ahora sí tendrá el ID
            deuda: 0 
        }
    ]);

    if (error) {
        console.error(error);
        alert("Error al guardar: " + error.message);
    } else {
        alert("Cliente guardado correctamente");
        location.reload();
    }
}

// 3. OBTENER CLIENTES (CORREGIDO)
async function obtenerClientes(userId) {
    const { data, error } = await _supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true });

    if (!error) renderizarClientes(data);
}

// Al final de tu archivo clientes.js, cambia obtenerClientes() por:
inicializar();