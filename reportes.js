// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; // <-- Coloca aquí tu clave real
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// INICIALIZACIÓN Y SEGURIDAD (CORREGIDO)
// ==========================================
async function inicializarReportes() {
    console.log("Iniciando reportes...");
    // Usamos getSession para una verificación más rápida y persistente
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session && session.user) {
        console.log("Sesión activa:", session.user.email);
        cargarReporte(session.user.id);
    } else {
        console.error("No se encontró sesión activa");
        // En lugar de redirigir de golpe, avisamos al usuario
        alert("Tu sesión ha expirado o no has iniciado sesión.");
        window.location.href = 'index.html';
    }
}

// ==========================================
// CARGA DE DATOS
// ==========================================
// En tu archivo reportes.js

async function cargarDatosReporte() {
    // 1. Obtener las ventas del día (como ya lo haces)
    const { data: ventas, error: errorVentas } = await _supabase
        .from('ventas')
        .select('*')
        // ... aquí va tu filtro de fecha actual ...

    // 2. NUEVO: Obtener la deuda total real de la tabla clientes
    const { data: clientes, error: errorClientes } = await _supabase
        .from('clientes')
        .select('deuda');

    if (errorVentas || errorClientes) {
        console.error("Error cargando datos");
        return;
    }

    // 3. Procesar las estadísticas
    procesarEstadisticas(ventas, clientes);
}

function procesarEstadisticas(ventas, clientes) {
    let efectivo = 0, yape = 0, plin = 0;

    // Calculamos el dinero real que entró hoy
    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        if (v.metodo_pago === 'Efectivo') efectivo += monto;
        else if (v.metodo_pago === 'Yape') yape += monto;
        else if (v.metodo_pago === 'Plin') plin += monto;
    });

    // CALCULAMOS LA DEUDA REAL (Sumando la columna deuda de cada cliente)
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    // Actualizamos los elementos del HTML
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${(efectivo + yape + plin).toFixed(2)}`;
    
    // Aquí actualizamos la tarjeta azul con el dato de la tabla CLIENTES
    document.getElementById('totalPorCobrar').textContent = `$${totalDeudaReal.toFixed(2)}`;

    // Actualizamos la gráfica con los nuevos datos
    actualizarGrafica(efectivo + yape + plin, totalDeudaReal);
}

// ==========================================
// CÁLCULOS CORREGIDOS (DINERO REAL)
// ==========================================
let miGrafica; // Variable global para la gráfica

function procesarEstadisticas(ventas) {
    let efectivo = 0, yape = 0, plin = 0, porCobrar = 0;

    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        if (v.metodo_pago === 'Efectivo') efectivo += monto;
        else if (v.metodo_pago === 'Yape') yape += monto;
        else if (v.metodo_pago === 'Plin') plin += monto;
        else if (v.metodo_pago === 'Fiado') porCobrar += monto;
    });

    const granTotalReal = efectivo + yape + plin;

    // Actualizar textos
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;
    document.getElementById('totalPorCobrar').textContent = `$${porCobrar.toFixed(2)}`;

    // DIBUJAR LA GRÁFICA
    const ctx = document.getElementById('graficaBalance').getContext('2d');
    
    // Si la gráfica ya existe, la destruimos para crearla de nuevo con datos frescos
    if (miGrafica) miGrafica.destroy();

    miGrafica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Dinero Real (Caja)', 'Dinero Fiado (Calle)'],
            datasets: [{
                label: 'Monto Total $',
                data: [granTotalReal, porCobrar],
                backgroundColor: ['#22c55e', '#3b82f6'], // Verde y Azul
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

// ==========================================
// TABLA DE HISTORIAL
// ==========================================
function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas'); // ID correcto de tu HTML
    if (!tabla) return;

    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="3" class="p-10 text-center text-gray-400 italic">No hay ventas registradas</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString();
        const hora = new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Público General';
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-gray-800">${clienteNombre}</p>
                <p class="text-[10px] text-gray-400 uppercase">${fecha} - ${hora}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-600">
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

// Ejecutar al cargar el script
inicializarReportes();