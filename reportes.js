// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; // Variable global para la gráfica

// ==========================================
// INICIALIZACIÓN Y SEGURIDAD
// ==========================================
async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session && session.user) {
        cargarReporte(); // Quitamos el ID de aquí para que la función sea más flexible
    } else {
        alert("Tu sesión ha expirado.");
        window.location.href = 'index.html';
    }
}

// ==========================================
// CARGA Y PROCESAMIENTO DE DATOS (UNIFICADO)
// ==========================================
async function cargarReporte() {
    console.log("Cargando datos del reporte...");
    
    // 1. Obtener las ventas (con datos del cliente para la tabla)
    const { data: ventas, error: errorVentas } = await _supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .order('created_at', { ascending: false });

    // 2. Obtener deudas reales de la tabla clientes
    const { data: clientes, error: errorClientes } = await _supabase
        .from('clientes')
        .select('deuda');

    if (errorVentas || errorClientes) {
        console.error("Error:", errorVentas || errorClientes);
        return;
    }

    // 3. Procesar montos
    let efectivo = 0, yape = 0, plin = 0;

    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        if (v.metodo_pago === 'Efectivo') efectivo += monto;
        else if (v.metodo_pago === 'Yape') yape += monto;
        else if (v.metodo_pago === 'Plin') plin += monto;
    });

    const granTotalReal = efectivo + yape + plin;
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    // 4. Actualizar Interfaz (IDs del HTML)
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;
    document.getElementById('totalPorCobrar').textContent = `$${totalDeudaReal.toFixed(2)}`;

    // 5. Renderizar tabla y gráfica
    renderizarTabla(ventas);
    actualizarGrafica(granTotalReal, totalDeudaReal);
}

// ==========================================
// COMPONENTES VISUALES (TABLA Y GRÁFICA)
// ==========================================
function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas');
    if (!tabla) return;
    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="3" class="p-10 text-center text-gray-400 italic">No hay ventas</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fechaObj = new Date(v.created_at);
        const fecha = fechaObj.toLocaleDateString();
        const hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Público General';
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-gray-800">${clienteNombre}</p>
                <p class="text-[10px] text-gray-400 uppercase">${fecha} - ${hora}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${v.metodo_pago === 'Fiado' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}">
                    ${v.metodo_pago || 'Efectivo'}
                </span>
            </td>
            <td class="p-5 text-right font-black text-gray-800">
                $${Number(v.total).toFixed(2)}
            </td>
        `;
        tabla.appendChild(fila);
    });
}

function actualizarGrafica(real, fiado) {
    const canvas = document.getElementById('graficaBalance');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (miGrafica) miGrafica.destroy();

    miGrafica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Dinero en Caja', 'Por Cobrar'],
            datasets: [{
                data: [real, fiado],
                backgroundColor: ['#22c55e', '#2563eb'],
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Iniciar proceso
inicializarReportes();