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
    const fechaBoleta = new Date(venta.created_at).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });

    // --- PROCESAMIENTO DE PRODUCTOS (BOLETA) ---
    let productosArr = [];
    try {
        productosArr = typeof venta.productos_vendidos === 'string' 
            ? JSON.parse(venta.productos_vendidos) 
            : (venta.productos_vendidos || []);
    } catch (e) {
        productosArr = [];
    }

    const productosHtml = (Array.isArray(productosArr) && productosArr.length > 0)
        ? productosArr.map(p => {
            const cant = p.cantidadSeleccionada || p.cantidad || 1;
            const nom = p.nombre || 'Producto';
            const precio = p.precio || 0;
            return `
                <tr style="font-size: 12px;">
                    <td style="padding: 4px 0;">${cant}</td>
                    <td style="padding: 4px 0;">${nom}</td>
                    <td style="padding: 4px 0; text-align: right;">$${(precio * cant).toFixed(2)}</td>
                </tr>`;
        }).join('')
        : `<tr><td colspan="3" style="text-align:center; padding:15px; font-style:italic;">Venta General (Sin detalle)</td></tr>`;

    const win = window.open('', '', 'width=350,height=600');
    win.document.write(`
        <html>
        <head><title>Ticket</title></head>
        <body style="font-family:'Courier New', monospace; width:280px; padding:10px; color: #000;">
            <div style="text-align:center; margin-bottom: 10px;">
                <h2 style="margin:0; font-size:16px;">MINIMARKET PRO</h2>
                <p style="font-size:11px; margin:5px 0;">${fechaBoleta}</p>
                <hr style="border:none; border-top:1px dashed #000;">
            </div>
            
            <table style="width:100%; border-collapse:collapse; margin-bottom: 10px;">
                <thead>
                    <tr style="font-size:10px; border-bottom:1px solid #000;">
                        <th style="text-align:left;">CANT</th>
                        <th style="text-align:left;">DESCRIPCIÓN</th>
                        <th style="text-align:right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosHtml}
                </tbody>
            </table>

            <div style="border-top:1px dashed #000; padding-top:5px;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:15px;">
                    <span>TOTAL:</span>
                    <span>$${Number(venta.total).toFixed(2)}</span>
                </div>
                <div style="margin-top:5px; font-size:11px; text-align:right;">
                    <p style="margin:2px 0;">Método: ${venta.metodo_pago}</p>
                    <p style="margin:2px 0;">Cliente: ${venta.clientes ? venta.clientes.nombre : 'Consumidor Final'}</p>
                </div>
            </div>

            <div style="text-align:center; margin-top:20px; font-size:10px;">
                ¡GRACIAS POR SU COMPRA!<br>
                *** Minimarket Pro ***
            </div>
            <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }</script>
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

    // --- CÁLCULOS PARA EL RESUMEN ---
    let efectivo = 0, yapePlin = 0, fiado = 0;
    ventasActualesParaExportar.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();
        if (metodo === 'EFECTIVO') efectivo += monto;
        else if (metodo === 'YAPE' || metodo === 'PLIN') yapePlin += monto;
        else if (metodo === 'FIADO') fiado += monto;
    });

    // --- CABECERA DEL PDF ---
    doc.setFontSize(18);
    doc.text("REPORTE DE VENTAS - MINIMARKET PRO", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

    // --- TABLA DE VENTAS ---
    const columnas = ["Fecha", "Cliente", "Método", "Monto"];
    const filas = ventasActualesParaExportar.map(v => [
        new Date(v.created_at).toLocaleString(),
        v.clientes ? v.clientes.nombre : 'Consumidor Final',
        v.metodo_pago,
        `$${Number(v.total).toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 35,
        head: [columnas],
        body: filas,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        didDrawPage: (data) => {
            // Guardamos la posición final de la tabla para saber dónde escribir el resumen
            finalY = data.cursor.y;
        }
    });

    // --- BLOQUE DE RESUMEN AL FINAL ---
    const posY = doc.lastAutoTable.finalY + 15; // Espacio después de la tabla
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN DE CAJA", 140, posY);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Efectivo:`, 140, posY + 8);
    doc.text(`$${efectivo.toFixed(2)}`, 190, posY + 8, { align: "right" });
    
    doc.text(`Total Digital (Y/P):`, 140, posY + 14);
    doc.text(`$${yapePlin.toFixed(2)}`, 190, posY + 14, { align: "right" });
    
    doc.text(`Total Fiados:`, 140, posY + 20);
    doc.text(`$${fiado.toFixed(2)}`, 190, posY + 20, { align: "right" });

    // Línea divisoria
    doc.setDrawColor(200);
    doc.line(140, posY + 23, 190, posY + 23);

    // Gran Total Real
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // Color verde
    doc.text(`VENTA REAL:`, 140, posY + 30);
    doc.text(`$${(efectivo + yapePlin).toFixed(2)}`, 190, posY + 30, { align: "right" });

    // Guardar archivo
    doc.save(`Reporte_Ventas_${new Date().toLocaleDateString()}.pdf`);
};
inicializarReportes();