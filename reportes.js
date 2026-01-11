const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 
let ventasActualesParaExportar = []; 
let deudaGlobalSincronizada = 0; // <--- NUEVA VARIABLE GLOBAL

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

    const [resVentas, resClientes] = await Promise.all([
        _supabase
            .from('ventas')
            .select('*, clientes(nombre)')
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
    const granTotalReal = efectivo + totalDigital;
    
    // GUARDAMOS LA DEUDA TOTAL EN LA VARIABLE GLOBAL PARA EL PDF
    deudaGlobalSincronizada = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalDigital').textContent = `$${totalDigital.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;
    document.getElementById('totalPorCobrar').textContent = `$${deudaGlobalSincronizada.toFixed(2)}`;

    renderizarTabla(ventas);
    actualizarGrafica(efectivo, totalDigital, deudaGlobalSincronizada);
}

// ... (renderizarTabla, actualizarGrafica e imprimirTicket se mantienen igual) ...

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
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Filtro: ${document.getElementById('filtroTiempo').value.toUpperCase()}`, 14, 28);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 33);

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
    const startX = 120;
    
    doc.setFillColor(245, 247, 250);
    doc.rect(startX - 5, posY - 7, 85, 55, 'F');

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("DESGLOSE DE CAJA", startX, posY);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Efectivo:`, startX, posY + 8);
    doc.text(`$${efectivo.toFixed(2)}`, 200, posY + 8, { align: "right" });
    
    doc.text(`Total Digital:`, startX, posY + 14);
    doc.text(`$${yapePlin.toFixed(2)}`, 200, posY + 14, { align: "right" });

    doc.text(`Fiado en periodo:`, startX, posY + 20);
    doc.text(`$${fiadoPeriodo.toFixed(2)}`, 200, posY + 20, { align: "right" });

    doc.setDrawColor(200);
    doc.line(startX, posY + 24, 200, posY + 24);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`VENTA REAL:`, startX, posY + 31);
    doc.text(`$${(efectivo + yapePlin).toFixed(2)}`, 200, posY + 31, { align: "right" });

    // EL CAMBIO CLAVE: USAMOS LA VARIABLE GLOBAL QUE SÍ TIENE TODA LA DEUDA
    doc.setTextColor(220, 38, 38); 
    doc.text(`POR COBRAR GLOBAL:`, startX, posY + 42);
    doc.text(`$${deudaGlobalSincronizada.toFixed(2)}`, 200, posY + 42, { align: "right" });

    doc.save(`Reporte_Minimarket_${new Date().toISOString().split('T')[0]}.pdf`);
};

inicializarReportes();