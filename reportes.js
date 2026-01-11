const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 
let ventasActualesParaExportar = []; 
let deudaGlobalSincronizada = 0;

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

// ... (Configuración inicial de Supabase se mantiene igual)

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

    // Nota: Se agregó 'detalles' en la consulta para ver productos y cantidades
    const [resVentas, resClientes] = await Promise.all([
        _supabase
            .from('ventas')
            .select('*, clientes(nombre), detalles:venta_detalles(*)')
            .gte('created_at', desde.toISOString())
            .lte('created_at', hasta.toISOString())
            .order('created_at', { ascending: false }),
        _supabase.from('clientes').select('deuda')
    ]);

    if (resVentas.error) {
        console.error("Error cargando ventas:", resVentas.error);
        return;
    }

    ventasActualesParaExportar = resVentas.data;
    procesarYMostrarDatos(resVentas.data, resClientes.data || []); 
}

function renderizarTabla(ventas) {
    const cuerpo = document.getElementById('listaVentas');
    if (!cuerpo) return;
    cuerpo.innerHTML = '';

    if (ventas.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">No hay ventas en este periodo</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const metodo = v.metodo_pago.toUpperCase();
        
        // Colores por método
        let colorMetodo = "bg-slate-100 text-slate-600";
        if(metodo === 'YAPE' || metodo === 'PLIN') colorMetodo = "bg-purple-100 text-purple-600";
        if(metodo === 'EFECTIVO') colorMetodo = "bg-emerald-100 text-emerald-600";
        if(metodo === 'FIADO') colorMetodo = "bg-red-100 text-red-600";

        // Formatear detalles de productos para la vista
        const textoDetalles = v.detalles ? v.detalles.map(d => `${d.cantidad}x ${d.nombre_producto}`).join(', ') : 'Venta General';

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 transition-colors border-b border-slate-100";
        fila.innerHTML = `
            <td class="p-4">
                <span class="font-bold text-slate-800 block">${v.clientes ? v.clientes.nombre : 'Consumidor Final'}</span>
                <span class="text-[11px] text-emerald-600 italic block mb-1">${textoDetalles}</span>
                <span class="text-[10px] text-slate-400 font-medium">${fecha}</span>
            </td>
            <td class="p-4 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${colorMetodo}">${metodo}</span>
            </td>
            <td class="p-4 text-right font-black text-slate-700">$${Number(v.total).toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick="imprimirBoletaDirecta(${v.id})" class="text-slate-400 hover:text-emerald-500 transition-colors" title="Imprimir Boleta">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </button>
            </td>
        `;
        cuerpo.appendChild(fila);
    });
}

// Nueva función para imprimir desde el historial
async function imprimirBoletaDirecta(ventaId) {
    // Aquí llamarías a tu lógica de generación de PDF o ventana de impresión
    // usando los datos de 'ventasActualesParaExportar' filtrados por ID
    const venta = ventasActualesParaExportar.find(v => v.id === ventaId);
    if(venta) {
        console.log("Generando impresión para:", venta);
        // Lógica de impresión (puedes reutilizar tu función de crear ticket térmico aquí)
        alert(`Generando boleta para: ${venta.clientes ? venta.clientes.nombre : 'Consumidor Final'}\nTotal: $${venta.total}`);
    }
}

function renderizarTabla(ventas) {
    const cuerpo = document.getElementById('listaVentas');
    if (!cuerpo) return;
    cuerpo.innerHTML = '';

    if (ventas.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">No hay ventas en este periodo</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const metodo = v.metodo_pago.toUpperCase();
        
        // Colores por método
        let colorMetodo = "bg-slate-100 text-slate-600";
        if(metodo === 'YAPE' || metodo === 'PLIN') colorMetodo = "bg-purple-100 text-purple-600";
        if(metodo === 'EFECTIVO') colorMetodo = "bg-emerald-100 text-emerald-600";
        if(metodo === 'FIADO') colorMetodo = "bg-red-100 text-red-600";

        // Formatear detalles de productos para la vista
        const textoDetalles = v.detalles ? v.detalles.map(d => `${d.cantidad}x ${d.nombre_producto}`).join(', ') : 'Venta General';

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 transition-colors border-b border-slate-100";
        fila.innerHTML = `
            <td class="p-4">
                <span class="font-bold text-slate-800 block">${v.clientes ? v.clientes.nombre : 'Consumidor Final'}</span>
                <span class="text-[11px] text-emerald-600 italic block mb-1">${textoDetalles}</span>
                <span class="text-[10px] text-slate-400 font-medium">${fecha}</span>
            </td>
            <td class="p-4 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${colorMetodo}">${metodo}</span>
            </td>
            <td class="p-4 text-right font-black text-slate-700">$${Number(v.total).toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick="imprimirBoletaDirecta(${v.id})" class="text-slate-400 hover:text-emerald-500 transition-colors" title="Imprimir Boleta">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </button>
            </td>
        `;
        cuerpo.appendChild(fila);
    });
}

function actualizarGrafica(efectivo, digital, deuda) {
    const ctx = document.getElementById('graficaBalance').getContext('2d');
    
    if (miGrafica) miGrafica.destroy();

    miGrafica = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Digital', 'Deuda Global'],
            datasets: [{
                data: [efectivo, digital, deuda],
                backgroundColor: ['#10b981', '#a855f7', '#f43f5e'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });
}

window.exportarExcel = () => {
    if (ventasActualesParaExportar.length === 0) return alert("No hay datos");
    const ws = XLSX.utils.json_to_sheet(ventasActualesParaExportar.map(v => ({
        Fecha: new Date(v.created_at).toLocaleString(),
        Cliente: v.clientes ? v.clientes.nombre : 'Consumidor Final',
        Metodo: v.metodo_pago,
        Total: v.total
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `Ventas_${new Date().toLocaleDateString()}.xlsx`);
};

window.exportarPDF = () => {
    if (!ventasActualesParaExportar || ventasActualesParaExportar.length === 0) {
        return alert("⚠️ No hay datos en la tabla para exportar.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let efectivo = 0, yapePlin = 0, fiadoPeriodo = 0;
    ventasActualesParaExportar.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();
        if (metodo === 'EFECTIVO') efectivo += monto;
        else if (metodo === 'YAPE' || metodo === 'PLIN') yapePlin += monto;
        else if (metodo === 'FIADO') fiadoPeriodo += monto;
    });

    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("REPORTE DE VENTAS - MINIMARKET PRO", 14, 20);
    
    doc.autoTable({
        startY: 40,
        head: [["Fecha", "Cliente", "Método", "Monto"]],
        body: ventasActualesParaExportar.map(v => [
            new Date(v.created_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }),
            v.clientes ? v.clientes.nombre : 'Consumidor Final',
            v.metodo_pago.toUpperCase(),
            `$${Number(v.total).toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
    });

    const posY = doc.lastAutoTable.finalY + 15;
    doc.text(`VENTA REAL CAJA: $${(efectivo + yapePlin).toFixed(2)}`, 14, posY);
    doc.text(`DEUDA TOTAL CLIENTES: $${deudaGlobalSincronizada.toFixed(2)}`, 14, posY + 10);

    doc.save(`Reporte_Ventas.pdf`);
};

inicializarReportes();