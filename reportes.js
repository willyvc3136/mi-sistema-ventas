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
    let efectivo = 0, yape = 0, plin = 0, fiado = 0;
    
    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();

        if (metodo === 'EFECTIVO') efectivo += monto;
        else if (metodo === 'YAPE') yape += monto;
        else if (metodo === 'PLIN') plin += monto;
        else if (metodo === 'FIADO') fiado += monto;
    });

    const totalDigital = yape + plin;
    const granTotalReal = efectivo + totalDigital;
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalDigital').textContent = `$${totalDigital.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;
    document.getElementById('totalPorCobrar').textContent = `$${totalDeudaReal.toFixed(2)}`;

    renderizarTabla(ventas);
    actualizarGrafica(efectivo, totalDigital, totalDeudaReal);
}

function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas');
    if (!tabla) return;
    tabla.innerHTML = '';

    ventas.forEach((v, index) => {
        const fecha = new Date(v.created_at).toLocaleDateString('es-ES', { 
            day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12: true
        });
        
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Consumidor Final';
        const metodo = (v.metodo_pago || "").toUpperCase();
        
        // --- PROCESAMIENTO DE PRODUCTOS (REPORTE) ---
        let listaNombres = "Venta General";
        try {
            const productosArr = typeof v.productos_vendidos === 'string' 
                ? JSON.parse(v.productos_vendidos) 
                : (v.productos_vendidos || []);

            if (Array.isArray(productosArr) && productosArr.length > 0) {
                listaNombres = productosArr.map(p => {
                    const cant = p.cantidadSeleccionada || p.cantidad || 1;
                    const nom = p.nombre || "Producto";
                    return `${cant}x ${nom}`;
                }).join(", ");
            }
        } catch (e) {
            listaNombres = "Venta General";
        }

        const fila = document.createElement('tr');
        fila.className = "group border-b border-slate-50 hover:bg-slate-50 transition-colors";
        
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">${clienteNombre}</p>
                <p class="text-[11px] text-emerald-600 font-medium italic mb-1 line-clamp-2">${listaNombres}</p>
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
                <button id="btn-print-${index}" class="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all">📄</button>
            </td>
        `;
        tabla.appendChild(fila);

        document.getElementById(`btn-print-${index}`).onclick = () => window.imprimirTicket(v);
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

window.imprimirTicket = (venta) => {
    // 1. Generar número de ticket (Usa el ID de la base de datos o un aleatorio si no existe)
    const ticketID = venta.id ? String(venta.id).slice(-4).toUpperCase() : Math.floor(1000 + Math.random() * 9000);
    
    // 2. Formatear Fecha
    const fechaBoleta = new Date(venta.created_at).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });

    // 3. Procesar Productos
    let productosHtml = "";
    try {
        let pArray = venta.productos_vendidos;
        if (typeof pArray === 'string') pArray = JSON.parse(pArray);

        if (Array.isArray(pArray) && pArray.length > 0) {
            productosHtml = pArray.map(p => {
                const cant = Number(p.cantidadSeleccionada || p.cantidad || 1);
                const precioUnit = Number(p.precio || p.precio_unitario || 0);
                const subtotal = precioUnit * cant;

                return `
                <tr style="font-size: 11px; border-bottom: 0.5px solid #eee;">
                    <td style="padding: 5px 0; text-align: center;">${cant}</td>
                    <td style="padding: 5px 0;">${p.nombre || 'Producto'}</td>
                    <td style="padding: 5px 0; text-align: right;">${precioUnit.toFixed(2)}</td>
                    <td style="padding: 5px 0; text-align: right; font-weight: bold;">${subtotal.toFixed(2)}</td>
                </tr>`;
            }).join('');
        } else {
            productosHtml = `
                <tr>
                    <td colspan="4" style="padding: 15px 0; text-align: center; font-style: italic;">
                        Venta General - Detalle no disponible
                    </td>
                </tr>`;
        }
    } catch (e) {
        console.error("Error en detalle ticket:", e);
        productosHtml = `<tr><td colspan="4" style="text-align:center; padding:10px;">Error al cargar productos</td></tr>`;
    }

    // 4. Crear Ventana de Impresión
    const win = window.open('', '', 'width=350,height=600');
    win.document.write(`
        <html>
        <head>
            <title>Ticket ${ticketID}</title>
            <style>
                body { 
                    font-family: 'Courier New', Courier, monospace; 
                    width: 270px; 
                    margin: 0; 
                    padding: 10px; 
                    color: #000;
                }
                .text-center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                th { font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; text-align: left; }
                .total-section { font-size: 16px; margin-top: 10px; display: flex; justify-content: space-between; }
                @media print { margin: 0; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <h2 style="margin: 0; font-size: 18px;">MINIMARKET PRO</h2>
                <p style="margin: 5px 0; font-size: 12px; font-weight: bold;">TICKET: #TK-${ticketID}</p>
                <p style="font-size: 11px; margin: 0;">${fechaBoleta}</p>
            </div>

            <div class="divider"></div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">CT</th>
                        <th>DESCRIPCIÓN</th>
                        <th style="width: 45px; text-align: right;">UNIT</th>
                        <th style="width: 50px; text-align: right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosHtml}
                </tbody>
            </table>

            <div class="divider"></div>

            <div class="total-section bold">
                <span>TOTAL:</span>
                <span>$${Number(venta.total).toFixed(2)}</span>
            </div>

            <div style="margin-top: 10px; font-size: 11px;">
                <p style="margin: 2px 0;"><b>MÉTODO:</b> ${(venta.metodo_pago || 'Efectivo').toUpperCase()}</p>
                <p style="margin: 2px 0;"><b>CLIENTE:</b> ${venta.clientes ? venta.clientes.nombre : 'CONSUMIDOR FINAL'}</p>
            </div>

            <div class="divider"></div>

            <div class="text-center" style="font-size: 10px; margin-top: 15px;">
                ¡GRACIAS POR SU PREFERENCIA!<br>
                *** Vuelva pronto ***
            </div>

            <script>
                window.onload = () => {
                    window.print();
                    setTimeout(() => { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    win.document.close();
};
// ==========================================
// FUNCIONES DE EXPORTACIÓN (CORREGIDAS)
// ==========================================

window.exportarExcel = () => {
    // Verificamos si hay datos cargados
    if (!ventasActualesParaExportar || ventasActualesParaExportar.length === 0) {
        return alert("⚠️ No hay datos en la tabla para exportar. Intenta cambiar el filtro de fecha.");
    }

    const datosExcel = ventasActualesParaExportar.map(v => ({
        Fecha: new Date(v.created_at).toLocaleString(),
        Cliente: v.clientes ? v.clientes.nombre : 'Consumidor Final',
        Metodo_Pago: v.metodo_pago,
        Total: v.total
    }));

    const libro = XLSX.utils.book_new();
    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    XLSX.utils.book_append_sheet(libro, hoja, "Ventas");
    XLSX.writeFile(libro, `Reporte_Ventas_${new Date().toLocaleDateString()}.xlsx`);
};

window.exportarPDF = () => {
    if (!ventasActualesParaExportar || ventasActualesParaExportar.length === 0) {
        return alert("⚠️ No hay datos en la tabla para exportar.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. CÁLCULOS DEL REPORTE
    let efectivo = 0, yapePlin = 0, fiadoHoy = 0;
    ventasActualesParaExportar.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();
        if (metodo === 'EFECTIVO') efectivo += monto;
        else if (metodo === 'YAPE' || metodo === 'PLIN') yapePlin += monto;
        else if (metodo === 'FIADO') fiadoHoy += monto;
    });

    // Obtenemos el monto que ya calculaste en la pantalla (Deuda total de todos los clientes)
    const deudaTotalGlobal = document.getElementById('totalPorCobrar').textContent.replace('$', '') || "0.00";

    // 2. CABECERA
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("REPORTE DE VENTAS - MINIMARKET PRO", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periodo: ${document.getElementById('filtroTiempo').value.toUpperCase()}`, 14, 27);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 32);

    // 3. TABLA DE VENTAS
    const columnas = ["Fecha", "Cliente", "Método", "Monto"];
    const filas = ventasActualesParaExportar.map(v => [
        new Date(v.created_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }),
        v.clientes ? v.clientes.nombre : 'Consumidor Final',
        v.metodo_pago.toUpperCase(),
        `$${Number(v.total).toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 38,
        head: [columnas],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 9 }
    });

    // 4. BLOQUE DE RESUMEN TÉCNICO
    const posY = doc.lastAutoTable.finalY + 15;
    const startX = 125;
    
    // Fondo gris claro para el resumen
    doc.setFillColor(245, 247, 250);
    doc.rect(startX - 5, posY - 7, 80, 55, 'F');

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("DESGLOSE DE CAJA", startX, posY);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Total Efectivo:`, startX, posY + 8);
    doc.text(`$${efectivo.toFixed(2)}`, 198, posY + 8, { align: "right" });
    
    doc.text(`Total Digital (Y/P):`, startX, posY + 14);
    doc.text(`$${yapePlin.toFixed(2)}`, 198, posY + 14, { align: "right" });

    doc.text(`Fiado de hoy:`, startX, posY + 20);
    doc.text(`$${fiadoHoy.toFixed(2)}`, 198, posY + 20, { align: "right" });

    doc.setDrawColor(200);
    doc.line(startX, posY + 24, 198, posY + 24);

    // Venta Real (Efectivo + Digital)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text(`VENTA REAL:`, startX, posY + 31);
    doc.text(`$${(efectivo + yapePlin).toFixed(2)}`, 198, posY + 31, { align: "right" });

    // --- SECCIÓN DE DEUDA GLOBAL ---
    doc.setTextColor(220, 38, 38); // Rojo para alertar deuda total
    doc.text(`DEUDA TOTAL POR COBRAR:`, startX, posY + 42);
    doc.text(`$${Number(deudaTotalGlobal).toFixed(2)}`, 198, posY + 42, { align: "right" });

    doc.save(`Reporte_Minimarket_${new Date().toLocaleDateString()}.pdf`);
};
inicializarReportes();