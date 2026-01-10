const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');
const modalRegistro = document.getElementById('modalRegistro');
let html5QrCode;
let isProcessing = false;
let origenCamara = ""; 

// --- 1. AUTENTICACIÓN Y CARGA ---
async function checkAuth() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        if(userEmailDisplay) userEmailDisplay.textContent = user.email; 
        obtenerProductos(user.id);
        cargarCategorias();
    } else {
        window.location.href = 'index.html';
    }
}

async function obtenerProductos(userId) {
    const { data, error } = await _supabase.from('productos').select('*').eq('user_id', userId).order('nombre', { ascending: true });
    if (!error) renderizarTabla(data);
}

function renderizarTabla(productos) {
    if(!listaProductos) return;
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-blue-50 transition-colors text-sm border-b border-slate-50";
        fila.innerHTML = `
            <td class="py-4 px-4">
                <span class="text-[9px] font-black text-blue-500 uppercase block">${prod.categoria || 'Otros'}</span>
                <span class="font-bold text-slate-800">${prod.nombre}</span>
                <span class="text-[9px] text-slate-400 block font-mono">${prod.codigo_barras || 'Sin código'}</span>
            </td>
            <td class="py-4 px-4 text-center">
                <span class="px-3 py-1 rounded-lg text-[10px] font-black ${prod.cantidad < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}">
                    ${prod.cantidad} UNID.
                </span>
            </td>
            <td class="py-4 px-4 font-bold text-slate-700">$${parseFloat(prod.precio || 0).toFixed(2)}</td>
            <td class="py-4 px-4 text-center">
                <div class="flex gap-2 justify-center">
                    <button onclick="prepararEdicion(${prod.id}, '${prod.nombre}', ${prod.cantidad}, ${prod.precio}, '${prod.categoria}', ${prod.precio_costo || 0}, '${prod.codigo_barras || ''}')" class="bg-slate-100 text-slate-600 px-3 py-1 rounded-md text-[9px] font-bold uppercase">Editar</button>
                    <button onclick="eliminarProducto(${prod.id})" class="text-red-400 text-[9px] font-bold uppercase">Borrar</button>
                </div>
            </td>`;
        listaProductos.appendChild(fila);
    });
}

// --- 2. BUSCADOR EN TIEMPO REAL (RESTAURADO) ---
const buscador = document.getElementById('buscador');
if(buscador) {
    buscador.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const filas = document.querySelectorAll('#listaProductos tr');
        filas.forEach(fila => {
            const texto = fila.innerText.toLowerCase();
            fila.style.display = texto.includes(termino) ? "" : "none";
        });
    });
}

// --- 3. ACCIONES DE BOTONES (CORREGIDAS) ---

// Botón Guardar Nuevo
window.confirmarGuardar = async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nuevoProd = {
        nombre: document.getElementById('nombreProducto').value,
        codigo_barras: document.getElementById('codigoProducto').value,
        categoria: document.getElementById('categoriaProducto').value,
        cantidad: parseInt(document.getElementById('cantidadProducto').value) || 0,
        precio: parseFloat(document.getElementById('precioProducto').value) || 0,
        precio_costo: parseFloat(document.getElementById('precioCosto').value) || 0,
        user_id: user.id
    };
    if(!nuevoProd.nombre) return alert("El nombre es obligatorio");
    const { error } = await _supabase.from('productos').insert([nuevoProd]);
    if(!error) { cerrarModalRegistro(); obtenerProductos(user.id); }
    else { alert("Error al guardar"); }
};

// Botón Actualizar (Restaurado para el modal de edición)
// --- FUNCIONES PARA EL MODAL DE EDICIÓN ---

// 1. Botón ACTUALIZAR: Guarda los cambios en Supabase
window.confirmarActualizar = async () => {
    const id = document.getElementById('editId').value;
    
    const actualizado = {
        nombre: document.getElementById('editNombre').value,
        cantidad: parseInt(document.getElementById('editCantidad').value) || 0,
        precio: parseFloat(document.getElementById('editPrecio').value) || 0,
        categoria: document.getElementById('editCategoria').value,
        precio_costo: parseFloat(document.getElementById('editPrecioCosto').value) || 0,
        codigo_barras: document.getElementById('editCodigo').value
    };

    try {
        const { error } = await _supabase.from('productos').update(actualizado).eq('id', id);

        if (!error) {
            alert("Producto actualizado con éxito");
            window.cerrarModal(); // Cerramos el modal
            const { data: { user } } = await _supabase.auth.getUser();
            obtenerProductos(user.id); // Refrescamos la tabla
        } else {
            alert("Error al actualizar en la base de datos");
        }
    } catch (err) {
        console.error("Error:", err);
    }
};

// 2. Botón VOLVER: Solo cierra el modal sin hacer cambios
window.cerrarModal = () => {
    if (modalEditar) {
        modalEditar.classList.add('hidden');
    }
};

// Botón Nueva Categoría (+) (Nombre de función alineado con tu error de consola)
window.nuevaCategoriaPrompt = async () => {
    const nuevaCat = prompt("Ingrese el nombre de la nueva categoría:");
    if (nuevaCat) {
        const { data: { user } } = await _supabase.auth.getUser();
        const { error } = await _supabase.from('categorias').insert([{ nombre: nuevaCat, user_id: user.id }]);
        if (!error) {
            cargarCategorias();
        } else {
            alert("Error al crear categoría o ya existe.");
        }
    }
};

// --- 4. LÓGICA DE CÁMARA Y ESCÁNER ---

async function encenderCamara(targetInputId) {
    origenCamara = targetInputId; 
    const container = document.getElementById('lectorContainer');
    if(!container) return;
    container.classList.remove('hidden');
    if(targetInputId === 'codigoProducto') modalRegistro.classList.add('hidden');

    html5QrCode = new Html5Qrcode("reader");
    try {
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
            async (decodedText) => {
                const input = document.getElementById(targetInputId);
                if(input) {
                    input.value = decodedText;
                    await cerrarCamaraPure(); 
                    if(targetInputId === 'buscador') {
                        input.dispatchEvent(new Event('input'));
                    } else if(targetInputId === 'codigoProducto') {
                        modalRegistro.classList.remove('hidden'); 
                        validarDuplicado(decodedText);
                    }
                }
            }
        );
    } catch (err) { console.error(err); }
}

async function cerrarCamaraPure() {
    if (html5QrCode) {
        try { await html5QrCode.stop(); } catch (e) {}
        document.getElementById('lectorContainer').classList.add('hidden');
    }
}

window.cerrarCamara = async () => {
    await cerrarCamaraPure();
    if (origenCamara === 'codigoProducto') {
        modalRegistro.classList.add('hidden'); 
        cerrarModalRegistro(); 
    }
    origenCamara = ""; 
};

async function validarDuplicado(codigo) {
    if(isProcessing) return;
    isProcessing = true;

    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const { data, error } = await _supabase
            .from('productos')
            .select('*')
            .eq('codigo_barras', codigo)
            .eq('user_id', user.id)
            .maybeSingle();

        if (data) {
            // SI EXISTE: Lanzamos la alerta que pediste
            if (confirm(`¡ATENCIÓN!\nEl producto "${data.nombre}" ya existe en tu inventario.\n\n¿Deseas abrirlo para EDITAR su stock o precio?`)) {
                cerrarModalRegistro();
                setTimeout(() => {
                    prepararEdicion(
                        data.id, 
                        data.nombre, 
                        data.cantidad, 
                        data.precio, 
                        data.categoria, 
                        data.precio_costo, 
                        data.codigo_barras
                    );
                }, 300);
            } else {
                // Si el usuario cancela, limpiamos el código para que no se guarde duplicado
                const inputReg = document.getElementById('codigoProducto');
                if (inputReg) {
                    inputReg.value = '';
                    inputReg.focus();
                }
            }
        } else {
            // SI NO EXISTE: Saltamos al nombre para seguir llenando
            const inputNom = document.getElementById('nombreProducto');
            if (inputNom) inputNom.focus();
        }
    } catch (err) {
        console.error("Error al validar:", err);
    } finally {
        setTimeout(() => { isProcessing = false; }, 500);
    }
}

let buffer = "";
let lastKeyTime = Date.now();

document.addEventListener('keydown', (e) => {
    // Si estamos escribiendo manualmente en el buscador o nombre, no interferimos
    if (e.target.tagName === 'INPUT' && e.target.id !== 'codigoProducto' && e.target.id !== 'buscador') {
        return;
    }

    const now = Date.now();
    // La pistola escribe muy rápido. Si pasa más de 100ms, es teclado manual y limpiamos.
    if (now - lastKeyTime > 100) buffer = ""; 
    lastKeyTime = now;

    // Capturamos el carácter si no es una tecla de control
    if (e.key.length === 1) {
        buffer += e.key;
    }

    // Cuando la pistola envía 'Enter' (fin de lectura)
    if (e.key === 'Enter') {
        e.preventDefault();
        const code = buffer.trim();
        
        if (code.length > 2) {
            // DECIDIR: ¿Estamos registrando o buscando?
            const modalAbierto = !modalRegistro.classList.contains('hidden');
            
            if (modalAbierto) {
                // Caso: Modal de registro abierto -> Llenar código y validar si ya existe
                const inputReg = document.getElementById('codigoProducto');
                if (inputReg) inputReg.value = code;
                validarDuplicado(code);
            } else {
                // Caso: Estamos en la lista principal -> Buscar producto
                const inputBus = document.getElementById('buscador');
                if (inputBus) {
                    inputBus.value = code;
                    // Disparamos el filtrado de la tabla
                    const filas = document.querySelectorAll('#listaProductos tr');
                    let encontrado = false;
                    filas.forEach(fila => {
                        const coincide = fila.innerText.toLowerCase().includes(code.toLowerCase());
                        fila.style.display = coincide ? "" : "none";
                        if(coincide) encontrado = true;
                    });

                    if (!encontrado) {
                        alert(`El producto con código "${code}" NO existe en tu inventario.`);
                        inputBus.value = '';
                        filas.forEach(f => f.style.display = "");
                    }
                }
            }
        }
        buffer = ""; // Limpiar para la siguiente lectura
    }
});


// --- 5. UTILIDADES ---

window.abrirModalRegistro = () => modalRegistro.classList.remove('hidden');
window.cerrarModalRegistro = () => {
    modalRegistro.classList.add('hidden');
    ['codigoProducto', 'nombreProducto', 'cantidadProducto', 'precioProducto', 'precioCosto'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
};

async function cargarCategorias() {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data: cat } = await _supabase.from('categorias').select('nombre').eq('user_id', user.id);
    let html = `<option value="" disabled selected>Categoría</option>`;
    cat?.forEach(c => html += `<option value="${c.nombre}">${c.nombre}</option>`);
    html += `<option value="Otros">Otros</option>`;
    const selectReg = document.getElementById('categoriaProducto');
    const selectEdit = document.getElementById('editCategoria');
    if(selectReg) selectReg.innerHTML = html;
    if(selectEdit) selectEdit.innerHTML = html;
}

window.prepararEdicion = (id, nombre, cantidad, precio, categoria, costo, codigo) => {
    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = nombre;
    document.getElementById('editCantidad').value = cantidad;
    document.getElementById('editPrecio').value = precio;
    document.getElementById('editCategoria').value = categoria || 'Otros';
    document.getElementById('editPrecioCosto').value = costo;
    document.getElementById('editCodigo').value = codigo;
    modalEditar.classList.remove('hidden');
};

window.eliminarProducto = async (id) => {
    if(confirm("¿Eliminar este producto?")) {
        await _supabase.from('productos').delete().eq('id', id);
        const { data: { user } } = await _supabase.auth.getUser();
        obtenerProductos(user.id);
    }
};

// Vinculamos los botones que no tienen 'onclick' en el HTML
document.addEventListener('DOMContentLoaded', () => {
    const btnActualizar = document.getElementById('btnGuardarCambios');
    if (btnActualizar) {
        btnActualizar.onclick = window.confirmarActualizar;
    }
    
    const btnGuardarNuevo = document.getElementById('btnConfirmarGuardar');
    if (btnGuardarNuevo) {
        btnGuardarNuevo.onclick = window.confirmarGuardar;
    }
});

checkAuth();