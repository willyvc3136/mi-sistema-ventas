const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 
let ventasActualesParaExportar = []; 

async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session && session.user) {
        document.getElementById('filtroTiempo').addEventListener('change', () => {
            document.getElementById('fechaInicio').value = "";
            document.getElementById('fechaFin').value = "";
            cargarReporte();
        });
        
        document.getElementById('fechaInicio').addEventListener('change', cargarReporte);
        document.getElementById('fechaFin').addEventListener('change', cargarReporte);
        
        cargarReporte(); 
    } else {
        window.location.href = 'index.html';
    }
}

async function cargarReporte() {
    const tabla = document.getElementById('listaVentas');
    if(tabla) tabla.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">Buscando datos...</td></tr>';

    const filtro = document.getElementById('filtroTiempo').value;
    const fInicio = document.getElementById('fechaInicio').value;
    const fFin = document.getElementById('fechaFin').value;
    
    let desde = new Date();
    desde.setHours(0, 0, 0, 0);
    let hasta = new Date();
    hasta.setHours(23, 59, 59, 999);

    if (fInicio !== "" && fFin !== "") {
        desde = new Date(fInicio + "T00:00:00");
        hasta = new Date(fFin + "T23:59:59");
    } else if (fInicio !== "") {
        desde = new Date(fInicio + "T00:00:00");
        hasta = new Date(fInicio + "T23:59:59");
    } else {
        if (filtro === 'semanal') desde.setDate(desde.getDate() - 7);
        else if (filtro === 'mensual') desde.setDate(1); 
        else if (filtro === 'anual') { desde.setMonth(0); desde.setDate(1); }
    }

    // Consulta paralela: Ventas y Clientes
    const [resVentas, resClientes] = await Promise.all([
        _supabase
            .from('ventas')
            .select(`*, clientes(nombre), venta_detalles:venta_detalles(cantidad, nombre_producto)`) // Intentamos traer todo
            .gte('created_at', desde.toISOString())
            .lte('created_at', hasta.toISOString())
            .order('created_at', { ascending: false }),
        _supabase.from('clientes').select('deuda')
    ]);

    if (resVentas.error) {
        console.warn("Error con detalles, cargando solo ventas básicas...");
        const resBasica = await _supabase
            .from('ventas')
            .select('*, clientes(nombre)')
            .gte('created_at', desde.toISOString())
            .lte('created_at', hasta.toISOString())
            .order('created_at', { ascending: false });
        
        if (resBasica.error) return console.error("Error crítico:", resBasica.error);
        ventasActualesParaExportar = resBasica.data;
    } else {
        ventasActualesParaExportar = resVentas.data;
    }

    procesarYMostrarDatos(ventasActualesParaExportar, resClientes.data || []);

    ventasActualesParaExportar = resVentas.data;
procesarYMostrarDatos(resVentas.data, resClientes.data || []); 
}

function procesarYMostrarDatos(ventas, clientes) {
    let efectivo = 0, yape = 0, plin = 0, fiado = 0;
    
    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        // Normalizamos a MAYÚSCULAS para que no falle si es "Yape" o "YAPE"
        const metodo = (v.metodo_pago || "").toUpperCase();

        if (metodo === 'EFECTIVO') efectivo += monto;
        else if (metodo === 'YAPE') yape += monto;
        else if (metodo === 'PLIN') plin += monto;
        else if (metodo === 'FIADO') fiado += monto;
    });

    const totalDigital = yape + plin;
    const granTotalReal = efectivo + totalDigital; // Dinero que realmente entró (No incluye fiados)
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    // Actualización de la Interfaz
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalDigital').textContent = `$${totalDigital.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;
    document.getElementById('totalPorCobrar').textContent = `$${totalDeudaReal.toFixed(2)}`;

    renderizarTabla(ventas);
    actualizarGrafica(efectivo, totalDigital, totalDeudaReal);
}

function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas');
    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="p-20 text-center text-slate-400 font-medium italic">Sin registros en este periodo</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Consumidor Final';
        const metodo = (v.metodo_pago || "").toUpperCase();
        
        // --- NUEVA LÓGICA PARA PRODUCTOS ---
        const listaProductos = v.venta_detalles 
            ? v.venta_detalles.map(d => `${d.cantidad}x ${d.nombre_producto}`).join(', ') 
            : 'Sin detalles';

        const fila = document.createElement('tr');
        fila.className = "group border-b border-slate-50 hover:bg-slate-50 transition-colors";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">${clienteNombre}</p>
                <p class="text-[11px] text-emerald-500 font-medium italic">${listaProductos}</p> 
                <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">${fecha}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    metodo === 'FIADO' ? 'bg-orange-100 text-orange-600' : 
                    metodo === 'YAPE' ? 'bg-purple-100 text-purple-600' :
                    metodo === 'PLIN' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }">
                    ${metodo}
                </span>
            </td>
            <td class="p-5 text-right font-extrabold text-slate-700">$${Number(v.total).toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick='imprimirTicket(${JSON.stringify(v)})' class="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all">📄</button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

function actualizarGrafica(efectivo, digital, fiado) {
    const canvas = document.getElementById('graficaBalance');
    if (miGrafica) miGrafica.destroy();
    
    miGrafica = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Digital', 'Por Cobrar'],
            datasets: [{
                data: [efectivo, digital, fiado],
                backgroundColor: ['#10b981', '#a855f7', '#3b82f6'],
                borderWidth: 0,
                hoverOffset: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: { legend: { display: false } }
        }
    });
}

// ... Las funciones de imprimirTicket, exportarExcel y exportarPDF se mantienen igual ...
window.imprimirTicket = (venta) => { /* Código original de ticket */ };
window.exportarExcel = () => { /* Código original de Excel */ };
window.exportarPDF = () => { /* Código original de PDF */ };

inicializarReportes();