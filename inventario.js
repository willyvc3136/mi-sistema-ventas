const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const listaProductos = document.getElementById('listaProductos');
const userEmailDisplay = document.getElementById('user-email');
const modalEditar = document.getElementById('modalEditar');
const modalRegistro = document.getElementById('modalRegistro');
let html5QrCode;
let isProcessing = false;
let origenCamara = ""; // Controla de dónde venimos

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

// --- LÓGICA DE CÁMARA MEJORADA ---
async function encenderCamara(targetInputId) {
    origenCamara = targetInputId; 
    const container = document.getElementById('lectorContainer');
    if(!container) return;
    
    container.classList.remove('hidden');
    
    // Ocultamos el formulario de registro para que no estorbe visualmente a la cámara
    if(targetInputId === 'codigoProducto') {
        modalRegistro.classList.add('hidden');
    }

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
                        // SI ESCANEÓ CON ÉXITO: Aquí sí volvemos al formulario para terminar de llenar datos
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

// BOTÓN CERRAR (CANCELAR MANUALMENTE)
window.cerrarCamara = async () => {
    await cerrarCamaraPure(); // Detiene la cámara y oculta el cuadro negro

    // LÓGICA DE CANCELACIÓN:
    // Si el usuario presiona "Cancelar", no importa de dónde venga, 
    // asumimos que ya no quiere hacer la operación.
    
    if (origenCamara === 'codigoProducto') {
        // En lugar de volver a mostrarlo, nos aseguramos de que esté CERRADO
        modalRegistro.classList.add('hidden'); 
        // Limpiamos los campos por si acaso
        cerrarModalRegistro(); 
    }
    
    // Si venía del buscador, no hacemos nada extra (ya está en la lista)
    origenCamara = ""; 
    console.log("Escaneo cancelado por el usuario. Regresando a la lista principal.");
};

// --- VALIDACIÓN DE DUPLICADOS ---
async function validarDuplicado(codigo) {
    if(isProcessing) return;
    isProcessing = true;
    const { data: { user } } = await _supabase.auth.getUser();
    const { data } = await _supabase.from('productos').select('*').eq('codigo_barras', codigo).eq('user_id', user.id).maybeSingle();

    if(data) {
        if(confirm(`"${data.nombre}" ya existe. ¿Deseas editarlo?`)) {
            cerrarModalRegistro();
            prepararEdicion(data.id, data.nombre, data.cantidad, data.precio, data.categoria, data.precio_costo, data.codigo_barras);
        } else {
            document.getElementById('codigoProducto').value = '';
        }
    }
    setTimeout(() => isProcessing = false, 600);
}

// --- BUSCADOR MANUAL/PC ---
const inputBuscador = document.getElementById('buscador');
if(inputBuscador) {
    inputBuscador.addEventListener('input', (e) => {
        const filtro = e.target.value.toLowerCase();
        document.querySelectorAll('#listaProductos tr').forEach(fila => {
            fila.style.display = fila.innerText.toLowerCase().includes(filtro) ? "" : "none";
        });
    });
}

// --- ESCÁNER FÍSICO (PC) ---
let buffer = "";
let lastKeyTime = Date.now();

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && !['buscador', 'codigoProducto'].includes(e.target.id)) return;

    const now = Date.now();
    if (now - lastKeyTime > 100) buffer = ""; 
    lastKeyTime = now;

    if (e.key.length === 1) buffer += e.key;

    if (e.key === 'Enter') {
        e.preventDefault(); 
        const code = buffer.trim() || e.target.value.trim();
        if (code.length > 2) {
            const modalAbierto = !modalRegistro.classList.contains('hidden');
            const dest = modalAbierto ? document.getElementById('codigoProducto') : document.getElementById('buscador');
            dest.value = code;
            dest.focus();
            if (dest.id === 'codigoProducto') validarDuplicado(code);
            else dest.dispatchEvent(new Event('input'));
        }
        buffer = "";
    }
});

// --- MODALES ---
window.abrirModalRegistro = () => modalRegistro.classList.remove('hidden');
window.cerrarModalRegistro = () => {
    modalRegistro.classList.add('hidden');
    ['codigoProducto', 'nombreProducto', 'cantidadProducto', 'precioProducto', 'precioCosto'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = '';
    });
};

async function cargarCategorias() {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data: cat } = await _supabase.from('categorias').select('nombre').eq('user_id', user.id);
    let html = `<option value="" disabled selected>Categoría</option>`;
    cat?.forEach(c => html += `<option value="${c.nombre}">${c.nombre}</option>`);
    html += `<option value="Otros">Otros</option>`;
    if(document.getElementById('categoriaProducto')) document.getElementById('categoriaProducto').innerHTML = html;
    if(document.getElementById('editCategoria')) document.getElementById('editCategoria').innerHTML = html;
}

checkAuth();