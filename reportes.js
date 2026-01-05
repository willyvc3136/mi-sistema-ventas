// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'TU_LLAVE_PUBLICA_AQUI'; // <--- ASEGÚRATE DE PONER TU LLAVE REAL AQUÍ
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// INICIALIZACIÓN
// ==========================================
async function inicializarReportes() {
    const { data: { user } } = await _supabase.auth.getUser();
    
    if (user) {
        cargarReporte(); // Cargamos los datos
    } else {
        window.location.href = 'index.html';
    }
}

// ==========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ==========================================
async function cargarReporte() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        
        // 1. Traemos las ventas con el nombre del cliente
        const { data: ventas, error: errorVentas } = await _supabase
            .from('ventas')
            .select(`
                *,
                clientes ( nombre )
            `)
            .eq('vendedor_id', user.id)
            .order('created_at', { ascending: false });

        if (errorVentas) throw errorVentas;

        // 2. Procesamos los totales para las tarjetas de colores
        procesarTotales(ventas);

        // 3. Dibujamos la tabla de historial
        renderizarTabla(ventas);

    } catch (error) {
        console.error("Error detallado:", error);
        // Si sale error aquí, es probable que la columna se llame 'user_id' y no 'vendedor_id'
    }
}

// ==========================================
// CÁLCULO DE TOTALES (TARJETAS)
// ==========================================
function procesarTotales(ventas) {
    let efectivo = 0;
    let yape = 0;
    let plin = 0;
    let granTotal = 0;

    ventas.forEach(v => {
        // Sumamos al Gran Total siempre que no esté fallida la venta
        granTotal += v.total || 0;
        
        // Clasificamos por el método de pago (Exactamente como los guardas en ventas.js)
        if (v.metodo_pago === 'Efectivo') efectivo += v.total;
        if (v.metodo_pago === 'Yape') yape += v.total;
        if (v.metodo_pago === 'Plin') plin += v.total;
    });

    // Actualizamos el HTML usando los IDs que tienes en tu archivo
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotal.toFixed(2)}`;
}

// ==========================================
// DIBUJAR LA TABLA
// ==========================================
function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas'); // Tu ID real del HTML
    if (!tabla) return;

    tabla.innerHTML = '';

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString();
        const hora = new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const cliente = v.clientes ? v.clientes.nombre : 'Público General';
        
        // Definir color según el método
        let badgeColor = "bg-gray-100 text-gray-600";
        if(v.metodo_pago === 'Yape') badgeColor = "bg-purple-100 text-purple-700";
        if(v.metodo_pago === 'Plin') badgeColor = "bg-blue-100 text-blue-700";

        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-gray-800">${cliente}</p>
                <p class="text-[10px] text-gray-400 uppercase">${fecha} - ${hora}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${badgeColor}">
                    ${v.metodo_pago || 'Efectivo'}
                </span>
            </td>
            <td class="p-5 text-right font-black text-gray-800">
                $${v.total.toFixed(2)}
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// Arrancar la aplicación
inicializarReportes();