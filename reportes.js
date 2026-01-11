const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 
let ventasActualesParaExportar = []; 
let deudaGlobalSincronizada = 0;

async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session && session.user) {
        // Eventos de filtros
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
    } else {
        if (filtro === 'semanal') desde.setDate(desde.getDate() - 7);
        else if (filtro === 'mensual') desde.setDate(1); 
        else if (filtro === 'anual') { desde.setMonth(0); desde.setDate(1); }
    }

    // Consulta con JOINs manuales para evitar el Error 400
    const { data, error } = await _supabase
            .from('ventas')
            .select('*, clientes(nombre), venta_detalles(*)')
            .gte('created_at', desde.toISOString())
            .lte('created_at', hasta.toISOString())
            .order('created_at', { ascending: false });

    const { data: dataClientes } = await _supabase.from('clientes').select('deuda');

    if (error) {
        console.error("Error en Supabase:", error);
        // Si hay error, intentamos cargar al menos las ventas básicas
        const { data: dataBasica } = await _supabase.from('ventas').select('*').order('created_at', { ascending: false });
        ventasActualesParaExportar = dataBasica || [];
    } else {
        ventasActualesParaExportar = data || [];
    }

    procesarYMostrarDatos(ventasActualesParaExportar, dataClientes || []); 
}

function procesarYMostrarDatos(ventas, clientes) {
    let efectivo = 0, yape = 0, plin = 0, fiadoHoy = 0;
    
    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();
        if (metodo === 'EFECTIVO') efectivo += monto;
        else if (metodo === 'YAPE') yape += monto;
        else if (metodo === 'PLIN') plin += monto;
        else if (metodo === 'FIADO') fiadoHoy += monto;
    });

    const totalDigital = yape + plin;
    deudaGlobalSincronizada = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    // Actualizar contadores en el HTML
    if(document.getElementById('totalEfectivo')) document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    if(document.getElementById('totalDigital')) document.getElementById('totalDigital').textContent = `$${totalDigital.toFixed(2)}`;
    if(document.getElementById('granTotal')) document.getElementById('granTotal').textContent = `$${(efectivo + totalDigital).toFixed(2)}`;
    if(document.getElementById('totalPorCobrar')) document.getElementById('totalPorCobrar').textContent = `$${deudaGlobalSincronizada.toFixed(2)}`;

    renderizarTabla(ventas);
    actualizarGrafica(efectivo, totalDigital, deudaGlobalSincronizada);
}

function renderizarTabla(ventas) {
    const cuerpo = document.getElementById('listaVentas');
    if (!cuerpo) return;
    cuerpo.innerHTML = '';

    if (ventas.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">No hay ventas registradas</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const metodo = (v.metodo_pago || "S/D").toUpperCase();
        
        // Mostrar los productos (Lejía, etc.)
        let productosHtml = "";
        if (v.venta_detalles && v.venta_detalles.length > 0) {
            productosHtml = v.venta_detalles.map(d => 
                `<span class="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-100 mr-1 mb-1 inline-block">
                    ${d.cantidad}x ${d.nombre_producto || 'Producto'}
                </span>`
            ).join('');
        } else {
            productosHtml = '<span class="text-slate-400 text-[10px] italic">Sin detalles</span>';
        }

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";
        fila.innerHTML = `
            <td class="p-4">
                <span class="font-extrabold text-slate-800 block">${v.clientes ? v.clientes.nombre : 'Consumidor Final'}</span>
                <div class="mt-1 flex flex-wrap">${productosHtml}</div>
                <span class="text-[10px] text-slate-400 mt-1 block">${fecha}</span>
            </td>
            <td class="p-4 text-center">
                <span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase ${metodo === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}">
                    ${metodo}
                </span>
            </td>
            <td class="p-4 text-right font-black text-slate-700">$${Number(v.total).toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick="imprimirTicket(${v.id})" class="p-2 hover:bg-emerald-100 rounded-full text-emerald-600 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </button>
            </td>
        `;
        cuerpo.appendChild(fila);
    });
}

function imprimirTicket(ventaId) {
    const v = ventasActualesParaExportar.find(x => x.id === ventaId);
    if (!v) return;

    const ventana = window.open('', 'PRINT', 'height=600,width=400');
    
    const filasProductos = v.venta_detalles && v.venta_detalles.length > 0
        ? v.venta_detalles.map(d => `
            <tr>
                <td style="padding: 2px 0;">${d.cantidad} x ${d.nombre_producto}</td>
                <td style="text-align: right;">$${(d.cantidad * (d.precio_unitario || 0)).toFixed(2)}</td>
            </tr>`).join('')
        : '<tr><td colspan="2">Venta General</td></tr>';

    ventana.document.write(`
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', monospace; width: 75mm; padding: 10px; font-size: 12px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .sep { border-top: 1px dashed #000; margin: 8px 0; }
                table { width: 100%; border-collapse: collapse; }
                .total { font-size: 16px; text-align: right; margin-top: 10px; font-weight: bold; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="center bold">MINIMARKET PRO</div>
            <div class="sep"></div>
            <div>TICKET: 00${v.id}</div>
            <div>FECHA: ${new Date(v.created_at).toLocaleString()}</div>
            <div>CLIENTE: ${v.clientes ? v.clientes.nombre : 'Consumidor Final'}</div>
            <div class="sep"></div>
            <table>${filasProductos}</table>
            <div class="sep"></div>
            <div class="total">TOTAL: $${Number(v.total).toFixed(2)}</div>
            <div class="center" style="margin-top:15px;">¡Gracias por su compra!</div>
        </body>
        </html>
    `);
    ventana.document.close();
}

function actualizarGrafica(efectivo, digital, deuda) {
    const ctx = document.getElementById('graficaBalance');
    if (!ctx || !window.Chart) return;
    if (miGrafica) miGrafica.destroy();

    miGrafica = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Digital', 'Deuda'],
            datasets: [{
                data: [efectivo, digital, deuda],
                backgroundColor: ['#10b981', '#a855f7', '#f43f5e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '75%'
        }
    });
}

// Exportaciones
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
    XLSX.writeFile(wb, "Reporte.xlsx");
};

window.exportarPDF = () => {
    if (ventasActualesParaExportar.length === 0) return alert("No hay datos");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("REPORTE DE VENTAS", 14, 20);
    doc.autoTable({
        startY: 30,
        head: [["Fecha", "Cliente", "Método", "Monto"]],
        body: ventasActualesParaExportar.map(v => [
            new Date(v.created_at).toLocaleString(),
            v.clientes ? v.clientes.nombre : 'Consumidor Final',
            v.metodo_pago,
            `$${Number(v.total).toFixed(2)}`
        ])
    });
    doc.save("Reporte.pdf");
};

inicializarReportes();