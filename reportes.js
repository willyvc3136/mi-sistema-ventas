// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'TU_LLAVE_PUBLICA_AQUI'; // Asegúrate de usar tu llave real
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// INICIALIZACIÓN Y SEGURIDAD
// ==========================================
async function inicializarReportes() {
    const { data: { user } } = await _supabase.auth.getUser();
    
    if (user) {
        // Si hay usuario, cargamos los datos pasando su ID
        cargarDatosReporte(user.id);
    } else {
        // Si no hay sesión, protegemos la página redirigiendo al login
        window.location.href = 'index.html';
    }
}

// ==========================================
// CARGA DE DATOS DESDE SUPABASE
// ==========================================
async function cargarDatosReporte(userId) {
    try {
        // NOTA CLAVE: Agregamos 'clientes(nombre)' para traer el nombre del cliente 
        // relacionado a la venta en una sola consulta.
        const { data: ventas, error: errorVentas } = await _supabase
            .from('ventas')
            .select(`
                *,
                clientes (
                    nombre
                )
            `)
            .eq('vendedor_id', userId)
            .order('created_at', { ascending: false });

        if (errorVentas) throw errorVentas;

        // También traemos los abonos para que el reporte de "Dinero Real" sea exacto
        const { data: abonos, error: errorAbonos } = await _supabase
            .from('abonos')
            .select('*')
            .eq('user_id', userId);

        if (errorAbonos) throw errorAbonos;

        // Una vez tenemos los datos, ejecutamos los cálculos y visualizaciones
        procesarEstadisticas(ventas, abonos);
        renderizarTablaVentas(ventas);

    } catch (error) {
        console.error("Error cargando reportes:", error.message);
        alert("No se pudieron cargar los reportes correctamente.");
    }
}

// ==========================================
// LÓGICA DE CÁLCULOS (ESTADÍSTICAS)
// ==========================================
function procesarEstadisticas(ventas, abonos) {
    let efectivo = 0;
    let yape = 0;
    let plin = 0;
    let granTotal = 0;

    ventas.forEach(v => {
        granTotal += v.total;
        
        // Clasificamos por el método de pago que guardamos en ventas.js
        if (v.metodo_pago === 'Efectivo') efectivo += v.total;
        if (v.metodo_pago === 'Yape') yape += v.total;
        if (v.metodo_pago === 'Plin') plin += v.total;
        // Si es Fiado, podrías sumarlo a una categoría aparte o dejarlo en el gran total
    });

    // Sumamos los abonos recibidos al efectivo (porque suelen ser cash)
    abonos.forEach(a => {
        efectivo += a.monto;
        granTotal += a.monto;
    });

    // ACTUALIZACIÓN DE LOS IDS REALES DE TU HTML
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotal.toFixed(2)}`;
}

// ==========================================
// RENDERIZADO DE TABLA DE VENTAS RECIENTES
// ==========================================
function renderizarTablaVentas(ventas) {
    const cuerpoTabla = document.getElementById('listaVentas'); // Usamos 'listaVentas' que es tu ID real
    if (!cuerpoTabla) return;

    cuerpoTabla.innerHTML = '';

    ventas.forEach(v => {
        const metodo = v.metodo_pago || (v.estado_pago === 'pendiente' ? 'Fiado' : 'Otro');
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all text-sm";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-gray-800">${new Date(v.created_at).toLocaleDateString()}</p>
                <p class="text-[10px] text-gray-400">${new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-600">
                    ${metodo}
                </span>
            </td>
            <td class="p-5 font-black text-right text-gray-800">
                $${v.total.toFixed(2)}
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}

// Iniciar proceso
inicializarReportes();