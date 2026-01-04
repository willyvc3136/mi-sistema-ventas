// ==========================================
// CONFIGURACIÓN DE CONEXIÓN (SUPABASE)
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// REFERENCIAS A ELEMENTOS DEL HTML (DOM)
// ==========================================
const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');

// ==========================================
// SEGURIDAD: VERIFICAR SI EL USUARIO ESTÁ LOGUEADO
// ==========================================
async function checkAuth() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        userEmailDisplay.textContent = user.email; // Muestra el correo en la cabecera
        obtenerProductos(user.id);                // Carga la lista de productos
    } else {
        // Bloqueo: si no hay sesión iniciada, redirige al inicio
        window.location.href = 'index.html';
    }
}

// ==========================================
// OBTENER PRODUCTOS DESDE LA BASE DE DATOS
// ==========================================
async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true }); // Orden alfabético

    if (!error) {
        renderizarTabla(data);      // Dibuja los productos en la tabla
        actualizarDashboard(data);  // Calcula los totales y alertas
    }
}

// ==========================================
// RENDERIZAR LA TABLA (DIBUJAR EN PANTALLA)
// ==========================================
function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-blue-50 transition-colors group";
        
        fila.innerHTML = `
            <td class="py-4 px-4">
                <span class="text-[10px] font-black text-blue-500 uppercase block">${prod.categoria || 'Otros'}</span>
                <span class="font-bold text-gray-800">${prod.nombre}</span>
                <span class="text-[9px] text-gray-400 block font-mono italic">${prod.codigo_barras || 'Sin código'}</span>
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
                <button onclick="prepararEdicion(${prod.id}, '${prod.nombre}', ${prod.cantidad}, ${prod.precio}, '${prod.categoria}', ${prod.precio_costo}, '${prod.codigo_barras || ''}')" 
                    class="bg-gray-100 text-gray-600 px-3 py-1 rounded-md hover:bg-blue-600 hover:text-white transition-all text-xs font-bold">Editar</button>
                <button onclick="eliminarProducto(${prod.id})" 
                    class="text-red-300 hover:text-red-600 transition-colors text-xs font-bold">Eliminar</button>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

// ==========================================
// ACTUALIZAR DASHBOARD (ESTADÍSTICAS)
// ==========================================
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

    // Actualiza las tarjetas superiores con los cálculos
    document.getElementById('stat-valor').innerHTML = `
        <h3 class="text-3xl font-bold text-blue-600">$${valorVentaTotal.toFixed(2)}</h3>
        <p class="text-xs text-green-600 font-bold mt-1">Ganancia Esperada: $${gananciaPotencial.toFixed(2)}</p>
    `;
    document.getElementById('stat-cantidad').textContent = productos.length;
    document.getElementById('stat-alerta').textContent = stockBajo;
}

// ==========================================
// CRUD: AGREGAR NUEVO PRODUCTO
// ==========================================
document.getElementById('btnAgregar').addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    
    // Captura de valores de los inputs
    const nombre = document.getElementById('nombreProducto').value;
    const codigo_barras = document.getElementById('codigoProducto').value; // NUEVO CAMPO
    const categoria = document.getElementById('categoriaProducto').value;
    const cantidad = parseInt(document.getElementById('cantidadProducto').value);
    const precio_costo = parseFloat(document.getElementById('precioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('precioProducto').value) || 0;

    if (!nombre || isNaN(cantidad)) return alert("El nombre y el stock son obligatorios");

    // Inserción en Supabase incluyendo la nueva columna
    const { error } = await _supabase.from('productos').insert([{ 
        nombre, 
        codigo_barras, 
        categoria, 
        cantidad, 
        precio_costo, 
        precio, 
        user_id: user.id 
    }]);

    if (!error) location.reload(); else alert("Error: " + error.message);
});

// ==========================================
// CRUD: PREPARAR EL MODAL PARA EDITAR
// ==========================================
window.prepararEdicion = (id, nombre, cantidad, precio, categoria, costo, codigo) => {
    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = nombre;
    document.getElementById('editCantidad').value = cantidad;
    document.getElementById('editPrecio').value = precio;
    document.getElementById('editCategoria').value = categoria || 'Otros';
    document.getElementById('editPrecioCosto').value = costo || 0;
    document.getElementById('editCodigo').value = codigo || ''; // CARGA EL CÓDIGO EN EL MODAL
    modalEditar.classList.remove('hidden');
};

window.cerrarModal = () => modalEditar.classList.add('hidden');

// ==========================================
// CRUD: GUARDAR CAMBIOS DE EDICIÓN
// ==========================================
document.getElementById('btnGuardarCambios').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    
    // Objeto con los datos actualizados
    const updates = {
        nombre: document.getElementById('editNombre').value,
        codigo_barras: document.getElementById('editCodigo').value, // ACTUALIZA EL CÓDIGO
        categoria: document.getElementById('editCategoria').value,
        cantidad: parseInt(document.getElementById('editCantidad').value),
        precio_costo: parseFloat(document.getElementById('editPrecioCosto').value),
        precio: parseFloat(document.getElementById('editPrecio').value)
    };

    const { error } = await _supabase.from('productos').update(updates).eq('id', id);
    if (!error) location.reload(); else alert("Error: " + error.message);
});

// ==========================================
// CRUD: ELIMINAR PRODUCTO
// ==========================================
window.eliminarProducto = async (id) => {
    if(!confirm("¿Eliminar este producto permanentemente?")) return;
    const { error } = await _supabase.from('productos').delete().eq('id', id);
    if (!error) location.reload();
};

// ==========================================
// BUSCADOR EN TIEMPO REAL
// ==========================================
document.getElementById('buscador').addEventListener('input', (e) => {
    const filtro = e.target.value.toLowerCase();
    const filas = listaProductos.getElementsByTagName('tr');
    
    Array.from(filas).forEach(fila => {
        // Muestra u oculta filas basándose en si coinciden con el texto buscado
        fila.style.display = fila.innerText.toLowerCase().includes(filtro) ? "" : "none";
    });
});

// ==========================================
// INICIALIZACIÓN
// ==========================================
checkAuth();