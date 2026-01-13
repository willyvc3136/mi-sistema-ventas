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

    // CONSULTA CORREGIDA: Eliminamos 'venta_detalles' porque tus productos están en 'productos_vendidos'
    const [resVentas, resClientes] = await Promise.all([
    _supabase
        .from('ventas')
        .select('*, clientes(nombre)') // QUITAMOS venta_detalles(*) porque causa el error
        .gte('created_at', desde.toISOString())
        .lte('created_at', hasta.toISOString())
        .order('created_at', { ascending: false }),
    _supabase.from('clientes').select('deuda')
]);

    if (resVentas.error) {
        console.error("Error en consulta:", resVentas.error);
        ventasActualesParaExportar = [];
    } else {
        ventasActualesParaExportar = resVentas.data || [];
    }

    procesarYMostrarDatos(ventasActualesParaExportar, resClientes.data || []); 
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
    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="p-20 text-center text-slate-400 font-medium italic">Sin registros en este periodo</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Consumidor Final';
        const metodo = (v.metodo_pago || "").toUpperCase();
        
        // --- CAMBIO AQUÍ: Ahora lee la columna productos_vendidos que vimos en tu captura ---
        const listaProductos = (v.productos_vendidos && v.productos_vendidos.length > 0) 
            ? v.productos_vendidos.map(p => {
                // Esta línea es la clave: busca 'cantidadSeleccionada' (que es como lo guarda tu ventas.js)
                // O busca 'cantidad' por si hay registros antiguos.
                const cant = p.cantidadSeleccionada || p.cantidad || 1; 
                return `${cant}x ${p.nombre}`;
            }).join(', ') 
            : 'Sin detalles';

        const fila = document.createElement('tr');
        fila.className = "group border-b border-slate-50 hover:bg-slate-50 transition-colors";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">${clienteNombre}</p>
                <p class="text-[10px] text-emerald-500 leading-tight italic opacity-90">${listaProductos}</p> 
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
    if (!canvas) return;
    if (miGrafica) miGrafica.destroy();
    
    miGrafica = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Efectivo', 'Digital', 'Por Cobrar'],
            datasets: [{
                data: [efectivo, digital, fiado],
                backgroundColor: ['#10b981', '#a855f7', '#3b82f6'],
                borderWidth: 0
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

// FUNCIONES COMPLETADAS
window.imprimirTicket = (v) => {
    const ventana = window.open('', '', 'width=400,height=600');
    
    // 1. Corregido: Usamos 'v' que es el parámetro de la función
    // 2. Corregido: Mapeamos los productos para que salgan en una tabla bonita
    const filasProductos = (v.productos_vendidos && v.productos_vendidos.length > 0) 
        ? v.productos_vendidos.map(p => {
            const cant = p.cantidadSeleccionada || p.cantidad || 1;
            const nombre = p.nombre || 'Producto';
            const precioUnit = p.precio || 0;
            const subtotal = cant * precioUnit;
            
            return `
                <tr>
                    <td style="padding: 2px 0;">${cant}x ${nombre}</td>
                    <td align="right" style="padding: 2px 0;">$${subtotal.toFixed(2)}</td>
                </tr>`;
        }).join('')
        : '<tr><td colspan="2">No hay detalles de productos</td></tr>';

    ventana.document.write(`
        <html>
        <body style="font-family:monospace; padding:20px; color:#333;">
            <center>
                <h2 style="margin:0;">MI NEGOCIO</h2>
                <p style="margin:5px 0;">Ticket #${v.id}</p>
            </center>
            <hr style="border:none; border-top:1px dashed #000;">
            <p style="margin:5px 0; font-size:12px;">
                <b>Fecha:</b> ${new Date(v.created_at).toLocaleString()}<br>
                <b>Cliente:</b> ${v.clientes?.nombre || 'General'}
            </p>
            <hr style="border:none; border-top:1px dashed #000;">
            
            <table width="100%" style="font-size:12px; border-collapse:collapse;">
                ${filasProductos}
            </table>
            
            <hr style="border:none; border-top:1px dashed #000;">
            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:14px;">
                <span>TOTAL:</span>
                <span>$${Number(v.total).toFixed(2)}</span>
            </div>
            <br>
            <center><p style="font-size:10px;">¡Gracias por su compra!</p></center>

            <script>
                // Pequeño delay para asegurar que el contenido cargue antes de imprimir
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
            </script>
        </body>
        </html>
    `);
    ventana.document.close();
};


// ==========================================
// EXPORTAR A EXCEL (Usando SheetJS)
// ==========================================
window.exportarExcel = () => {
    if (ventasActualesParaExportar.length === 0) {
        alert("No hay datos para exportar");
        return;
    }

    // Preparamos los datos de forma plana para el Excel
    const datosExcel = ventasActualesParaExportar.map(v => ({
        Fecha: new Date(v.created_at).toLocaleString(),
        Cliente: v.clientes ? v.clientes.nombre : 'Consumidor Final',
        Productos: (v.productos_vendidos || []).map(p => `${p.cantidadSeleccionada || 1}x ${p.nombre}`).join(', '),
        Metodo: v.metodo_pago,
        Total: Number(v.total).toFixed(2)
    }));

    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Ventas");
    XLSX.writeFile(libro, `Reporte_Ventas_${new Date().toLocaleDateString()}.xlsx`);
};

// ==========================================
// EXPORTAR A PDF (Generando una vista limpia)
// ==========================================
window.exportarPDF = () => {
    if (ventasActualesParaExportar.length === 0) {
        alert("No hay datos para imprimir");
        return;
    }

    // Calculamos los totales específicamente para este reporte
    let totalEfectivo = 0;
    let totalDigital = 0; // Yape + Plin
    let totalFiado = 0;
    let granTotal = 0;

    ventasActualesParaExportar.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();
        granTotal += monto;

        if (metodo === 'EFECTIVO') totalEfectivo += monto;
        else if (metodo === 'YAPE' || metodo === 'PLIN') totalDigital += monto;
        else if (metodo === 'FIADO') totalFiado += monto;
    });

    const ventana = window.open('', '', 'width=800,height=900');
    
    const filas = ventasActualesParaExportar.map(v => `
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${new Date(v.created_at).toLocaleString()}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${v.clientes ? v.clientes.nombre : 'Consumidor Final'}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${(v.productos_vendidos || []).map(p => `${p.cantidadSeleccionada || 1}x ${p.nombre}`).join(', ')}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align:center;">${v.metodo_pago}</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align:right;">$${Number(v.total).toFixed(2)}</td>
        </tr>
    `).join('');

    ventana.document.write(`
        <html>
        <head>
            <title>Reporte de Ventas</title>
            <style>
                body { font-family: sans-serif; padding: 30px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
                td { border: 1px solid #e2e8f0; padding: 8px; font-size: 11px; }
                .resumen-container { margin-top: 30px; width: 100%; display: flex; justify-content: flex-end; }
                .resumen-tabla { width: 250px; border-collapse: collapse; }
                .resumen-tabla td { padding: 8px; border: none; border-bottom: 1px solid #eee; font-size: 13px; }
                .total-final { font-weight: bold; font-size: 16px !important; color: #059669; }
                h2 { margin-bottom: 5px; color: #1e293b; }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
                <h2>REPORTE DE VENTAS</h2>
                <p style="margin: 0; color: #64748b;">Generado el: ${new Date().toLocaleString()}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Fecha/Hora</th>
                        <th>Cliente</th>
                        <th>Productos</th>
                        <th style="text-align:center;">Método</th>
                        <th style="text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>

            <div class="resumen-container">
                <table class="resumen-tabla">
                    <tr>
                        <td>Total Efectivo:</td>
                        <td align="right">$${totalEfectivo.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Total Digital:</td>
                        <td align="right">$${totalDigital.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Total Fiados:</td>
                        <td align="right" style="color: #d97706;">$${totalFiado.toFixed(2)}</td>
                    </tr>
                    <tr class="total-final">
                        <td>SUMA TOTAL:</td>
                        <td align="right">$${granTotal.toFixed(2)}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8;">
                Fin del reporte de operaciones.
            </div>

            <script>
                setTimeout(() => { window.print(); window.close(); }, 700);
            </script>
        </body>
        </html>
    `);
    ventana.document.close();
};
inicializarReportes();