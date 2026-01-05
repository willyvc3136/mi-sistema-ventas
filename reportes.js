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
    let totalVendido = 0;
    let totalCobradoEfectivo = 0;
    let totalFiadoPendiente = 0;
    let totalAbonosRecibidos = 0;

    ventas.forEach(v => {
        totalVendido += v.total;
        
        // Separamos ventas según su estado de pago
        if (v.estado_pago === 'pagado') {
            totalCobradoEfectivo += v.total;
        } else if (v.estado_pago === 'pendiente') {
            totalFiadoPendiente += v.total;
        }
    });

    // Sumamos los abonos que se hicieron hoy a deudas antiguas
    abonos.forEach(a => {
        totalAbonosRecibidos += a.monto;
    });

    // Actualizamos los elementos visuales en el HTML (asegúrate de tener estos IDs)
    document.getElementById('txtTotalVendido').textContent = `$${totalVendido.toFixed(2)}`;
    document.getElementById('txtTotalEfectivo').textContent = `$${(totalCobradoEfectivo + totalAbonosRecibidos).toFixed(2)}`;
    document.getElementById('txtTotalPendiente').textContent = `$${totalFiadoPendiente.toFixed(2)}`;
}

// ==========================================
// RENDERIZADO DE TABLA DE VENTAS RECIENTES
// ==========================================
function renderizarTablaVentas(ventas) {
    const cuerpoTabla = document.getElementById('tablaVentasCuerpo');
    if (!cuerpoTabla) return;

    cuerpoTabla.innerHTML = '';

    ventas.forEach(v => {
        const nombreCliente = v.clientes ? v.clientes.nombre : 'Público General';
        const colorEstado = v.estado_pago === 'pendiente' ? 'text-red-600' : 'text-green-600';
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all text-sm";
        fila.innerHTML = `
            <td class="p-4">${new Date(v.created_at).toLocaleDateString()}</td>
            <td class="p-4 font-bold text-gray-800">${nombreCliente}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded-full text-[10px] font-black uppercase ${v.estado_pago === 'pendiente' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">
                    ${v.estado_pago}
                </span>
            </td>
            <td class="p-4 font-black text-right ${colorEstado}">$${v.total.toFixed(2)}</td>
        `;
        cuerpoTabla.appendChild(fila);
    });
}

// Iniciar proceso
inicializarReportes();