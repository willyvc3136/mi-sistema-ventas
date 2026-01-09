const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');
const modalRegistro = document.getElementById('modalRegistro');
let html5QrCode;
let mostrandoFaltantes = false;

// --- VARIABLES GLOBALES PARA EL ESCÁNER PRO ---
let barcodeBuffer = "";
let lastKeyTime = Date.now();
let isProcessing = false;

// --- AUTENTICACIÓN ---
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

// --- OBTENER Y RENDERIZAR ---
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
                        class="bg-slate-100 text-slate-600 px-3 py-1 rounded-md font-bold text-[9px] uppercase hover:bg-slate-200">Editar
                    </button>
                    <button onclick="eliminarProducto(${prod.id})" 
                        class="text-red-400 hover:text-red-600 font-bold text-[9px] uppercase">Borrar
                    </button>
                </div>
            </td>
        `;
        listaProductos.appendChild(fila);
    });
}

function actualizarDashboard(productos) {
    let valorVentaTotal = 0;
    let inversionTotal = 0;
    let stockBajo = 0;

    productos.forEach(prod => {
        const cant = parseInt(prod.cantidad) || 0;
        const precio = parseFloat(prod.precio) || 0;
        const costo = parseFloat(prod.precio_costo) || 0;
        valorVentaTotal += precio * cant;
        inversionTotal += costo * cant;
        if (cant < 5) stockBajo++;
    });

    const statValor = document.getElementById('stat-valor');
    if(statValor) {
        statValor.innerHTML = `
            <div class="flex flex-col">
                <h3 class="text-2xl font-black text-slate-800">$${valorVentaTotal.toLocaleString('en-US', {minimumFractionDigits: 2})} <span class="text-[10px] text-slate-400">P. VENTA</span></h3>
                <h3 class="text-lg font-bold text-red-500">$${inversionTotal.toLocaleString('en-US', {minimumFractionDigits: 2})} <span class="text-[10px] text-slate-400">INVERSIÓN</span></h3>
            </div>
        `;
    }
    if(document.getElementById('stat-cantidad')) document.getElementById('stat-cantidad').textContent = productos.length;
    if(document.getElementById('stat-alerta')) document.getElementById('stat-alerta').textContent = stockBajo;
}

// --- MODALES Y LIMPIEZA ---
window.abrirModalRegistro = () => {
    modalRegistro.classList.remove('hidden');
    setTimeout(() => document.getElementById('codigoProducto').focus(), 100);
};

window.cerrarModalRegistro = () => {
    modalRegistro.classList.add('hidden');
    const campos = ['codigoProducto', 'nombreProducto', 'cantidadProducto', 'precioProducto', 'precioCosto'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
};

// --- VALIDACIÓN DE DUPLICADOS ---
async function validarDuplicado(codigo) {
    if(isProcessing) return;
    isProcessing = true;

    const { data: { user } } = await _supabase.auth.getUser();
    const { data } = await _supabase
        .from('productos')
        .select('*')
        .eq('codigo_barras', codigo)
        .eq('user_id', user.id)
        .maybeSingle();

    if(data) {
        const respuesta = confirm(`El producto "${data.nombre}" ya existe.\n¿Deseas EDITARLO?`);
        if(respuesta) {
            cerrarModalRegistro();
            prepararEdicion(data.id, data.nombre, data.cantidad, data.precio, data.categoria, data.precio_costo, data.codigo_barras);
        } else {
            document.getElementById('codigoProducto').value = '';
        }
    } else {
        document.getElementById('nombreProducto').focus();
    }
    
    setTimeout(() => { isProcessing = false; }, 500);
}

// --- BUSCADOR ---
function ejecutarBusqueda(cadena) {
    const inputBuscador = document.getElementById('buscador');
    if(inputBuscador) {
        inputBuscador.value = cadena;
        inputBuscador.dispatchEvent(new Event('input'));
    }
}

const inputBuscadorElem = document.getElementById('buscador');
if(inputBuscadorElem) {
    inputBuscadorElem.addEventListener('input', (e) => {
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
        if(sinResultados) sinResultados.classList.toggle('hidden', coincidencias > 0 || filtro === "");
    });
}

// --- LÓGICA DE ESCÁNER PROFESIONAL (SIN REFRESCO Y SIN DUPLICADOS) ---
document.addEventListener('keydown', (e) => {
    const currentTime = Date.now();
    
    // Si escribimos en campos de texto normales (nombre, precio), no interferir
    const activeElem = document.activeElement;
    const isManualInput = activeElem.tagName === 'INPUT' && 
                         !['buscador', 'codigoProducto'].includes(activeElem.id);
    if (isManualInput) return;

    // Detectar velocidad de escáner (las teclas de escáner llegan casi juntas)
    if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = ""; // Si pasó mucho tiempo, es una tecla nueva/manual
    }

    if (e.key.length === 1) {
        barcodeBuffer += e.key;
    }

    lastKeyTime = currentTime;

    // AL RECIBIR "ENTER" (Fin de ráfaga del escáner)
    if (e.key === 'Enter') {
        e.preventDefault(); // <--- ESTO DETIENE EL PARPADEO/REFRESCO
        e.stopImmediatePropagation();

        const finalCode = barcodeBuffer.trim();
        const modalReg = document.getElementById('modalRegistro');
        const isModalOpen = modalReg && !modalReg.classList.contains('hidden');

        if (finalCode.length > 2) {
            if (isModalOpen) {
                const inputReg = document.getElementById('codigoProducto');
                inputReg.value = finalCode;
                validarDuplicado(finalCode);
            } else {
                ejecutarBusqueda(finalCode);
            }
        }
        barcodeBuffer = ""; // Limpiar buffer para el siguiente disparo
    }
});

// --- GUARDAR Y CATEGORÍAS ---
document.getElementById('btnConfirmarGuardar').onclick = async () => {
    const { data: { user } } = await _supabase.auth.getUser();
    const updates = {
        nombre: document.getElementById('nombreProducto').value,
        codigo_barras: document.getElementById('codigoProducto').value,
        categoria: document.getElementById('categoriaProducto').value,
        cantidad: parseInt(document.getElementById('cantidadProducto').value),
        precio: parseFloat(document.getElementById('precioProducto').value),
        precio_costo: parseFloat(document.getElementById('precioCosto').value) || 0,
        user_id: user.id
    };
    if (!updates.nombre || isNaN(updates.cantidad)) return alert("Datos obligatorios faltantes");
    const { error } = await _supabase.from('productos').insert([updates]);
    if (!error) { cerrarModalRegistro(); obtenerProductos(user.id); }
};

window.prepararEdicion = (id, nombre, cant, precio, cat, costo, cod) => {
    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = nombre;
    document.getElementById('editCantidad').value = cant;
    document.getElementById('editPrecio').value = precio;
    document.getElementById('editCategoria').value = cat || 'Otros';
    document.getElementById('editCodigo').value = cod || ''; 
    document.getElementById('editPrecioCosto').value = costo || 0;
    modalEditar.classList.remove('hidden');
};

document.getElementById('btnGuardarCambios').onclick = async () => {
    const id = document.getElementById('editId').value;
    const updates = {
        nombre: document.getElementById('editNombre').value,
        codigo_barras: document.getElementById('editCodigo').value,
        categoria: document.getElementById('editCategoria').value,
        cantidad: parseInt(document.getElementById('editCantidad').value),
        precio: parseFloat(document.getElementById('editPrecio').value),
        precio_costo: parseFloat(document.getElementById('editPrecioCosto').value) || 0
    };
    const { error } = await _supabase.from('productos').update(updates).eq('id', id);
    if (!error) { modalEditar.classList.add('hidden'); const { data: { user } } = await _supabase.auth.getUser(); obtenerProductos(user.id); }
};

async function cargarCategorias() {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data: categorias } = await _supabase.from('categorias').select('nombre').eq('user_id', user.id);
    const selects = [document.getElementById('categoriaProducto'), document.getElementById('editCategoria')];
    let html = `<option value="" disabled selected>Seleccionar Categoría</option>`;
    if(categorias) categorias.forEach(cat => { html += `<option value="${cat.nombre}">${cat.nombre}</option>`; });
    html += `<option value="Otros">Otros</option>`;
    selects.forEach(s => { if(s) s.innerHTML = html; });
}

checkAuth();