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
let html5QrCode; // Variable global para el control de la cámara

// ==========================================
// SEGURIDAD: VERIFICAR SI EL USUARIO ESTÁ LOGUEADO
// ==========================================
async function checkAuth() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        userEmailDisplay.textContent = user.email; 
        obtenerProductos(user.id);                
    } else {
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
        .order('nombre', { ascending: true });

    if (!error) {
        renderizarTabla(data);      
        actualizarDashboard(data);  
    }
}

// ==========================================
// RENDERIZAR LA TABLA (DIBUJAR EN PANTALLA)
// ==========================================
function renderizarTabla(productos) {
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-blue-50 transition-colors group text-sm";
        
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
                    class="bg-gray-100 text-gray-600 px-3 py-1 rounded-md hover:bg-blue-600 hover:text-white transition-all text-[10px] font-bold uppercase tracking-tighter">Editar</button>
                <button onclick="eliminarProducto(${prod.id})" 
                    class="text-red-300 hover:text-red-600 transition-colors text-[10px] font-bold uppercase">Borrar</button>
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

    document.getElementById('stat-valor').innerHTML = `
        <h3 class="text-3xl font-bold text-blue-600 tracking-tighter">$${valorVentaTotal.toFixed(2)}</h3>
        <p class="text-[10px] text-green-600 font-black mt-1 uppercase tracking-widest">Utilidad: $${gananciaPotencial.toFixed(2)}</p>
    `;
    document.getElementById('stat-cantidad').textContent = productos.length;
    document.getElementById('stat-alerta').textContent = stockBajo;
}

// ==========================================
// CRUD: AGREGAR NUEVO PRODUCTO
// ==========================================
document.getElementById('btnAgregar').addEventListener('click', async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    
    const nombre = document.getElementById('nombreProducto').value;
    const codigo_barras = document.getElementById('codigoProducto').value;
    const categoria = document.getElementById('categoriaProducto').value;
    const cantidad = parseInt(document.getElementById('cantidadProducto').value);
    const precio_costo = parseFloat(document.getElementById('precioCosto').value) || 0;
    const precio = parseFloat(document.getElementById('precioProducto').value) || 0;

    if (!nombre || isNaN(cantidad)) return alert("Error: El nombre y el stock son obligatorios");

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
    document.getElementById('editCodigo').value = codigo || ''; 
    modalEditar.classList.remove('hidden');
};

window.cerrarModal = () => modalEditar.classList.add('hidden');

// ==========================================
// CRUD: GUARDAR CAMBIOS DE EDICIÓN
// ==========================================
document.getElementById('btnGuardarCambios').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    
    const updates = {
        nombre: document.getElementById('editNombre').value,
        codigo_barras: document.getElementById('editCodigo').value,
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
    if(!confirm("¿Eliminar este producto permanentemente del inventario?")) return;
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
        // Mejoramos el filtro para buscar en nombre, categoría y código de barras
        fila.style.display = fila.innerText.toLowerCase().includes(filtro) ? "" : "none";
    });
});

// ==========================================
// LÓGICA DEL LECTOR DE CÁMARA (NUEVO)
// ==========================================

// Función para encender la cámara y dirigir el resultado a un input
async function encenderCamara(targetInputId) {
    const container = document.getElementById('lectorContainer');
    container.classList.remove('hidden');

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                const input = document.getElementById(targetInputId);
                input.value = decodedText;
                
                // Si escaneamos en el buscador, disparamos el evento de filtrado
                if(targetInputId === 'buscador') {
                    input.dispatchEvent(new Event('input'));
                }

                cerrarCamara();
                
                // Efecto visual de lectura exitosa
                input.classList.add('bg-green-100');
                setTimeout(() => input.classList.remove('bg-green-100'), 800);
            }
        );
    } catch (err) {
        alert("Error de cámara: Asegúrate de otorgar los permisos necesarios.");
        container.classList.add('hidden');
    }
}

// Función para detener y ocultar la cámara
function cerrarCamara() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById('lectorContainer').classList.add('hidden');
            html5QrCode.clear();
        });
    } else {
        document.getElementById('lectorContainer').classList.add('hidden');
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
checkAuth();