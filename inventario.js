const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');
const modalRegistro = document.getElementById('modalRegistro');
let html5QrCode;
let filtrandoAlertas = false;

// --- AUTENTICACIÓN ---
async function checkAuth() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        if(userEmailDisplay) userEmailDisplay.textContent = user.email; 
        obtenerProductos(user.id);
    } else {
        window.location.href = 'index.html';
    }
}

// --- OBTENER Y RENDERIZAR (ORDEN ALFABÉTICO) ---
async function obtenerProductos(userId) {
    const { data, error } = await _supabase
        .from('productos')
        .select('*')
        .eq('user_id', userId)
        .order('nombre', { ascending: true }); // Orden alfabético aquí

    if (!error) {
        renderizarTabla(data);      
        actualizarDashboard(data);  
    }
}

function renderizarTabla(productos) {
    if(!listaProductos) return;
    listaProductos.innerHTML = '';
    productos.forEach(prod => {
        const fila = document.createElement('tr');
        fila.className = "hover:bg-blue-50 transition-colors text-sm border-b border-slate-50";
        fila.innerHTML = `
            <td class="py-4 px-4">
                <span class="text-[9px] font-black text-blue-500 uppercase block tracking-tighter">${prod.categoria || 'Otros'}</span>
                <span class="font-bold text-slate-800">${prod.nombre}</span>
                <span class="text-[9px] text-slate-400 block font-mono italic">${prod.codigo_barras || 'Sin código'}</span>
            </td>
            <td class="py-4 px-4 text-center">
                <span class="px-3 py-1 rounded-lg text-[10px] font-black ${prod.cantidad < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}">
                    ${prod.cantidad} UNID.
                </span>
            </td>
            <td class="py-4 px-4 font-bold text-slate-700">$${parseFloat(prod.precio || 0).toFixed(2)}</td>
            <td class="py-4 px-4 text-center">
                <div class="flex gap-2 justify-center">
                    <button onclick="prepararEdicion(${prod.id}, '${prod.nombre}', ${prod.cantidad}, ${prod.precio}, '${prod.categoria}', ${prod.precio_costo || 0}, '${prod.codigo_barras || ''}')" 
                        class="bg-slate-100 text-slate-600 px-3 py-1 rounded-md font-bold text-[9px] uppercase hover:bg-slate-200">Editar</button>
                    <button onclick="eliminarProducto(${prod.id})" 
                        class="text-red-400 hover:text-red-600 font-bold text-[9px] uppercase">Borrar</button>
                </div>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

function actualizarDashboard(productos) {
    let valorVentaTotal = 0;
    let stockBajo = 0;
    productos.forEach(prod => {
        const cant = parseInt(prod.cantidad) || 0;
        valorVentaTotal += (parseFloat(prod.precio) || 0) * cant;
        if (cant < 5) stockBajo++;
    });
    const statValor = document.getElementById('stat-valor');
    if(statValor) statValor.innerHTML = `<h3 class="text-3xl font-black text-slate-800">$${valorVentaTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</h3>`;
    document.getElementById('stat-cantidad').textContent = productos.length;
    document.getElementById('stat-alerta').textContent = stockBajo;
}

// --- MODALES REGISTRO ---
window.abrirModalRegistro = () => modalRegistro.classList.remove('hidden');
window.cerrarModalRegistro = () => {
    modalRegistro.classList.add('hidden');
    // LIMPIEZA PROFUNDA: Ponemos todos los IDs en blanco
    const campos = ['codigoProducto', 'nombreProducto', 'cantidadProducto', 'precioProducto', 'precioCosto'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    // Regresamos la categoría a la primera opción por defecto
    document.getElementById('categoriaProducto').selectedIndex = 0;
};

window.abrirModalRegistroDesdeBusqueda = () => {
    const query = document.getElementById('buscador').value;
    abrirModalRegistro();
    // Si la búsqueda era un código (números largos), ponerlo en el campo código
    if(!isNaN(query) && query.length > 5) {
        document.getElementById('codigoProducto').value = query;
    } else {
        document.getElementById('nombreProducto').value = query;
    }
};

// --- CÁMARA (CORREGIDA PARA EVITAR BLOQUEOS) ---
async function encenderCamara(targetInputId) {
    const container = document.getElementById('lectorContainer');
    if(!container) return;
    
    // Ocultamos modal de registro solo si venimos de ahí
    if(targetInputId === 'codigoProducto') {
        modalRegistro.classList.add('hidden');
    }

    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            await html5QrCode.clear();
        } catch (e) { console.log("Reinicio de cámara"); }
    }

    container.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 }, 
            async (decodedText) => {
                const input = document.getElementById(targetInputId);
                if(input) {
                    input.value = decodedText;
                    
                    // IMPORTANTE: Cerramos cámara ANTES de cualquier lógica de modales
                    await cerrarCamara();

                    if(targetInputId === 'buscador') {
                        // Si es buscador, SOLO filtramos la tabla
                        input.dispatchEvent(new Event('input'));
                    } 
                    else if(targetInputId === 'codigoProducto') {
                        // Si es registro, validamos duplicado
                        validarDuplicado(decodedText);
                    }
                }
            }
        );
    } catch (err) {
        console.error("Error de cámara", err);
        container.classList.add('hidden');
        if(targetInputId === 'codigoProducto') modalRegistro.classList.remove('hidden');
    }
}

function cerrarCamara() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('lectorContainer').classList.add('hidden');
            // Si el campo de código está vacío o activo, regresamos al modal
            if(!modalEditar.classList.contains('hidden') === false) {
                 modalRegistro.classList.remove('hidden');
            }
        }).catch(() => {
            document.getElementById('lectorContainer').classList.add('hidden');
        });
    }
}

// --- VALIDACIÓN DE DUPLICADOS ---
async function validarDuplicado(codigo) {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data } = await _supabase
        .from('productos')
        .select('*')
        .eq('codigo_barras', codigo)
        .eq('user_id', user.id)
        .maybeSingle();

    if(data) {
        // confirm() da opción de Aceptar o Cancelar
        const respuesta = confirm(`El producto "${data.nombre}" ya existe.\n\n¿Deseas ir a la ventana de EDICIÓN?`);
        
        if(respuesta) {
            cerrarModalRegistro();
            // Pasamos todos los datos incluyendo el precio_costo
            prepararEdicion(data.id, data.nombre, data.cantidad, data.precio, data.categoria, data.precio_costo, data.codigo_barras);
        } else {
            // Si dice que NO, regresamos al modal de registro pero limpiamos el código para que no guarde duplicado
            document.getElementById('codigoProducto').value = '';
            modalRegistro.classList.remove('hidden');
        }
    } else {
        // Si el producto es realmente nuevo, simplemente mostramos el modal para seguir llenando
        modalRegistro.classList.remove('hidden');
    }
}

// --- BUSCADOR CON MENSAJE "NO EXISTE" ---
const inputBuscador = document.getElementById('buscador');
if(inputBuscador) {
    inputBuscador.addEventListener('input', (e) => {
        const filtro = e.target.value.toLowerCase();
        const filas = document.querySelectorAll('#listaProductos tr');
        let coincidencias = 0;

        filas.forEach(fila => {
            const texto = fila.innerText.toLowerCase();
            const coincide = texto.includes(filtro);
            fila.style.display = coincide ? "" : "none";
            if(coincide) coincidencias++;
        });

        const sinResultados = document.getElementById('sinResultados');
        if(coincidencias === 0 && filtro !== "") {
            sinResultados.classList.remove('hidden');
        } else {
            sinResultados.classList.add('hidden');
        }
    });
}

// --- GUARDAR NUEVO ---
document.getElementById('btnConfirmarGuardar').onclick = async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const nombre = document.getElementById('nombreProducto').value;
    const codigo = document.getElementById('codigoProducto').value;
    const cat = document.getElementById('categoriaProducto').value;
    const cant = parseInt(document.getElementById('cantidadProducto').value);
    const precio = parseFloat(document.getElementById('precioProducto').value);
    const costo = parseFloat(document.getElementById('precioCosto').value) || 0;

    if (!nombre || isNaN(cant)) return alert("Nombre y Stock son obligatorios");

    const { error } = await _supabase.from('productos').insert([{ 
        nombre, codigo_barras: codigo, categoria: cat, cantidad: cant, precio, precio_costo: costo, user_id: user.id 
    }]);

    if (!error) {
        cerrarModalRegistro();
        obtenerProductos(user.id);
    } else {
        alert("Error al guardar: " + error.message);
    }
};

// --- EDITAR Y BORRAR ---
window.prepararEdicion = (id, nombre, cant, precio, cat, costo, cod) => {
    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = nombre;
    document.getElementById('editCantidad').value = cant;
    document.getElementById('editPrecio').value = precio;
    document.getElementById('editCategoria').value = cat || 'Otros';
    document.getElementById('editCodigo').value = cod || ''; 
    
    // CORRECCIÓN: Asignar el costo al campo oculto o visible del modal
    const inputCosto = document.getElementById('editPrecioCosto');
    if(inputCosto) inputCosto.value = costo || 0;

    modalEditar.classList.remove('hidden');
};

window.cerrarModal = () => modalEditar.classList.add('hidden');

document.getElementById('btnGuardarCambios').onclick = async () => {
    const id = document.getElementById('editId').value;
    const updates = {
        nombre: document.getElementById('editNombre').value,
        codigo_barras: document.getElementById('editCodigo').value,
        categoria: document.getElementById('editCategoria').value,
        cantidad: parseInt(document.getElementById('editCantidad').value),
        precio: parseFloat(document.getElementById('editPrecio').value)
    };
    const { error } = await _supabase.from('productos').update(updates).eq('id', id);
    if (!error) {
        cerrarModal();
        const { data: { user } } = await _supabase.auth.getUser();
        obtenerProductos(user.id);
    }
};

window.eliminarProducto = async (id) => {
    if(!confirm("¿Eliminar producto permanentemente?")) return;
    const { error } = await _supabase.from('productos').delete().eq('id', id);
    if (!error) {
        const { data: { user } } = await _supabase.auth.getUser();
        obtenerProductos(user.id);
    }
};

// --- FILTRO ALERTAS ---
window.toggleAlertas = function() {
    const btn = document.getElementById('btnFiltroAlertas');
    const filas = document.querySelectorAll('#listaProductos tr');
    filtrandoAlertas = !filtrandoAlertas;

    filas.forEach(fila => {
        const tieneAlerta = fila.innerHTML.includes('text-red-600');
        fila.style.display = filtrandoAlertas ? (tieneAlerta ? "" : "none") : "";
    });

    btn.textContent = filtrandoAlertas ? "Ver Todo" : "Ver Faltantes";
    btn.className = filtrandoAlertas ? "bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase" : "bg-red-50 text-red-600 px-6 py-4 rounded-2xl border border-red-100 font-black text-[10px] uppercase";
};

// INICIO
checkAuth();