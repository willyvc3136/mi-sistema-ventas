const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 
let ventasActualesParaExportar = [];
let egresosActualesParaExportar = []; 

// 1. INICIALIZACIÓN ÚNICA DE SESIÓN Y EVENTOS
async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session && session.user) {
        const filtroTiempo = document.getElementById('filtroTiempo');
        const fechaInicio = document.getElementById('fechaInicio');
        const fechaFin = document.getElementById('fechaFin');

        if (filtroTiempo) {
            filtroTiempo.addEventListener('change', () => {
                if (fechaInicio) fechaInicio.value = "";
                if (fechaFin) fechaFin.value = "";
                cargarReporte();
            });
        }
        
        if (fechaInicio) fechaInicio.addEventListener('change', cargarReporte);
        if (fechaFin) fechaFin.addEventListener('change', cargarReporte);
        
        cargarReporte(); 
    } else {
        window.location.href = 'index.html';
    }
}

// 2. FUNCIÓN DE CARGA DE REPORTES
async function cargarReporte() {
    const tabla = document.getElementById('listaVentas');
    if(tabla) tabla.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-slate-400 italic">Buscando datos...</td></tr>';

    const filtro = document.getElementById('filtroTiempo')?.value || 'diario';
    const fInicio = document.getElementById('fechaInicio')?.value || "";
    const fFin = document.getElementById('fechaFin')?.value || "";
    
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

    const [resVentas, resClientes, resEgresos] = await Promise.all([
        _supabase
            .from('ventas')
            .select('*, clientes(nombre)')
            .gte('created_at', desde.toISOString())
            .lte('created_at', hasta.toISOString())
            .order('created_at', { ascending: false }),
        _supabase.from('clientes').select('deuda'),
        _supabase
            .from('egresos')
            .select('*')
            .gte('created_at', desde.toISOString())
            .lte('created_at', hasta.toISOString())
    ]);

    if (resVentas.error) {
        console.error("Error en ventas:", resVentas.error);
        ventasActualesParaExportar = [];
    } else {
        ventasActualesParaExportar = resVentas.data || [];
    }

    egresosActualesParaExportar = resEgresos.data || [];
    procesarYMostrarDatos(ventasActualesParaExportar, resClientes.data || [], egresosActualesParaExportar); 
}

function procesarYMostrarDatos(ventas, clientes, egresos) {
    let efectivo = 0, yape = 0, plin = 0, fiado = 0, digitalOtro = 0;
    
    // 1. Sumar ventas considerando pagos mixtos o tradicionales
    ventas.forEach(v => {
        const montoTotalVenta = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();

        if (metodo.includes('MIXTO') || metodo.includes('COMBINADO')) {
            // Asegúrate de que tu POS guarde campos como monto_efectivo / monto_digital o equivalente
            const efeMixto = Number(v.monto_efectivo || v.efectivo || 0);
            const digMixto = Number(v.monto_digital || v.digital || (montoTotalVenta - efeMixto));
            
            efectivo += efeMixto;
            digitalOtro += digMixto;
        } else if (metodo === 'EFECTIVO') {
            efectivo += montoTotalVenta;
        } else if (metodo === 'YAPE') {
            yape += montoTotalVenta;
        } else if (metodo === 'PLIN') {
            plin += montoTotalVenta;
        } else if (metodo === 'FIADO') {
            fiado += montoTotalVenta;
        } else {
            digitalOtro += montoTotalVenta;
        }
    });

    const totalDigital = yape + plin + digitalOtro;
    const dineroRealEntrante = efectivo + totalDigital; 
    const totalEgresos = egresos.reduce((acc, e) => acc + (Number(e.monto) || 0), 0);
    
    // 2. Actualizar cuadros superiores
    if(document.getElementById('granTotal')) {
        document.getElementById('granTotal').textContent = `$${dineroRealEntrante.toFixed(2)}`;
    }
    if(document.getElementById('totalEfectivo')) {
        document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    }
    if(document.getElementById('totalDigital')) {
        document.getElementById('totalDigital').textContent = `$${totalDigital.toFixed(2)}`;
    }
    if(document.getElementById('totalEgresos')) {
        document.getElementById('totalEgresos').textContent = `$${totalEgresos.toFixed(2)}`;
    }
    
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);
    if(document.getElementById('totalPorCobrar')) {
        document.getElementById('totalPorCobrar').textContent = `$${totalDeudaReal.toFixed(2)}`;
    }

    const gananciaReal = dineroRealEntrante - totalEgresos; 
    if(document.getElementById('utilidadNeta')) {
        document.getElementById('utilidadNeta').textContent = `$${gananciaReal.toFixed(2)}`;
        const elementoU = document.getElementById('utilidadNeta');
        elementoU.style.color = gananciaReal < 0 ? "#e11d48" : "#059669";
    }

    renderizarTabla(ventas);
    actualizarGrafica(efectivo, totalDigital, fiado);
}

function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas');
    if (!tabla) return;
    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="p-20 text-center text-slate-400 font-medium italic">Sin registros en este periodo</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Consumidor Final';
        const metodo = (v.metodo_pago || "").toUpperCase();
        
        const listaProductos = (v.productos_vendidos && v.productos_vendidos.length > 0) 
            ? v.productos_vendidos.map(p => {
                const cant = p.cantidadSeleccionada || p.cantidad || 1; 
                return `${cant}x ${p.nombre}`;
            }).join(', ') 
            : 'Sin detalles';

        let badgeMetodo = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">${metodo}</span>`;
        if (metodo.includes('FIADO')) {
            badgeMetodo = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-100 text-orange-600">FIADO</span>`;
        } else if (metodo === 'YAPE') {
            badgeMetodo = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-100 text-purple-600">YAPE</span>`;
        } else if (metodo === 'PLIN') {
            badgeMetodo = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-600">PLIN</span>`;
        } else if (metodo.includes('MIXTO') || metodo.includes('COMBINADO')) {
            badgeMetodo = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600">MIXTO</span>`;
        }

        const fila = document.createElement('tr');
        fila.className = "group border-b border-slate-50 hover:bg-slate-50 transition-colors";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">${clienteNombre}</p>
                <p class="text-[10px] text-emerald-500 leading-tight italic opacity-90">${listaProductos}</p> 
                <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">${fecha}</p>
            </td>
            <td class="p-5 text-center">${badgeMetodo}</td>
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

window.imprimirTicket = (v) => {
    const ventana = window.open('', '', 'width=400,height=600');
    
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
                setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
        </body>
        </html>
    `);
    ventana.document.close();
};

window.exportarExcel = () => {
    if (ventasActualesParaExportar.length === 0) {
        alert("No hay datos para exportar");
        return;
    }

    let totalEfectivo = 0;
    let totalDigital = 0;
    ventasActualesParaExportar.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();
        if (metodo.includes('MIXTO') || metodo.includes('COMBINADO')) {
            totalEfectivo += Number(v.monto_efectivo || v.efectivo || 0);
            totalDigital += Number(v.monto_digital || v.digital || (monto - Number(v.monto_efectivo || v.efectivo || 0)));
        } else if (metodo === 'EFECTIVO') {
            totalEfectivo += monto;
        } else if (metodo !== 'FIADO') {
            totalDigital += monto;
        }
    });

    const totalDeudaReal = Number(document.getElementById('totalPorCobrar')?.textContent.replace('$', '')) || 0;
    const totalEnCaja = totalEfectivo + totalDigital;

    const dataParaExcel = ventasActualesParaExportar.map(v => ({
        "Fecha": new Date(v.created_at).toLocaleString(),
        "Cliente": v.clientes ? v.clientes.nombre : 'Consumidor Final',
        "Productos": (v.productos_vendidos || []).map(p => `${p.cantidadSeleccionada || 1}x ${p.nombre}`).join(', '),
        "Método de Pago": v.metodo_pago,
        "Monto ($)": Number(v.total).toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(dataParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte de Ventas");

    const ultimaFila = dataParaExcel.length + 3;
    XLSX.utils.sheet_add_aoa(ws, [
        ["RESUMEN FINANCIERO"],
        ["Total Efectivo:", totalEfectivo.toFixed(2)],
        ["Total Digital:", totalDigital.toFixed(2)],
        ["TOTAL REAL EN CAJA:", totalEnCaja.toFixed(2)],
        [""],
        ["DEUDA PENDIENTE (POR COBRAR):", totalDeudaReal.toFixed(2)]
    ], { origin: `D${ultimaFila}` });

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Reporte_Ventas_${fechaArchivo}.xlsx`);
};

window.exportarPDF = () => {
    if (ventasActualesParaExportar.length === 0) {
        alert("No hay datos para imprimir");
        return;
    }

    let totalEfectivo = 0;
    let totalDigital = 0;
    
    ventasActualesParaExportar.forEach(v => {
        const monto = Number(v.total || 0);
        const metodo = (v.metodo_pago || "").toUpperCase();

        if (metodo.includes('MIXTO') || metodo.includes('COMBINADO')) {
            totalEfectivo += Number(v.monto_efectivo || v.efectivo || 0);
            totalDigital += Number(v.monto_digital || v.digital || (monto - Number(v.monto_efectivo || v.efectivo || 0)));
        } else if (metodo === 'EFECTIVO') {
            totalEfectivo += monto;
        } else if (metodo !== 'FIADO') {
            totalDigital += monto;
        }
    });

    const totalDeudaReal = Number(document.getElementById('totalPorCobrar')?.textContent.replace('$', '')) || 0;
    const totalEnCaja = totalEfectivo + totalDigital;

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
            <title>Reporte Pro - Gestión de Ventas</title>
            <style>
                body { font-family: sans-serif; padding: 30px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
                td { border: 1px solid #e2e8f0; padding: 8px; font-size: 11px; }
                .resumen-container { margin-top: 30px; display: flex; justify-content: flex-end; }
                .resumen-tabla { width: 320px; border-collapse: collapse; background: #fdfdfd; border: 1px solid #eee; }
                .resumen-tabla td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
                .caja-total { font-weight: bold; color: #059669; background-color: #ecfdf5; }
                .deuda-total { font-weight: bold; color: #e11d48; background-color: #fff1f2; }
                h2 { margin-bottom: 5px; color: #1e293b; }
            </style>
        </head>
        <body>
            <div style="text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 10px;">
                <h2 style="text-transform: uppercase;">Reporte de Operaciones</h2>
                <p style="margin: 0; color: #64748b;">Estado al: ${new Date().toLocaleString()}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Fecha/Hora</th>
                        <th>Cliente</th>
                        <th>Detalle Productos</th>
                        <th style="text-align:center;">Método</th>
                        <th style="text-align:right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
            <div class="resumen-container">
                <table class="resumen-tabla">
                    <tr><td>Total Efectivo:</td><td align="right">$${totalEfectivo.toFixed(2)}</td></tr>
                    <tr><td>Total Digital:</td><td align="right">$${totalDigital.toFixed(2)}</td></tr>
                    <tr class="caja-total"><td>DINERO EN CAJA:</td><td align="right">$${totalEnCaja.toFixed(2)}</td></tr>
                    <tr><td colspan="2" style="border:none; height:15px;"></td></tr>
                    <tr class="deuda-total"><td>DEUDA PENDIENTE REAL:</td><td align="right">$${totalDeudaReal.toFixed(2)}</td></tr>
                </table>
            </div>
            <script>
                setTimeout(() => { window.print(); window.close(); }, 700);
            </script>
        </body>
        </html>
    `);
    ventana.document.close();
};

window.abrirModalAuditoria = () => {
    const modal = document.getElementById('modalAuditoria');
    if(modal) modal.classList.remove('hidden');
};

window.cerrarModalAuditoria = () => {
    const modal = document.getElementById('modalAuditoria');
    if(modal) {
        modal.classList.add('hidden');
        document.getElementById('auditResultado').textContent = "$0.00";
        document.getElementById('auditCantUnidades').textContent = "0 unidades encontradas";
        document.getElementById('auditCategoria').value = "";
    }
};

window.ejecutarAuditoria = () => {
    const textoBusqueda = document.getElementById('auditCategoria').value.toLowerCase();
    const metodoElegido = document.getElementById('auditMetodo').value;
    
    let totalDinero = 0;
    let totalUnidades = 0;

    if (typeof ventasActualesParaExportar !== 'undefined') {
        ventasActualesParaExportar.forEach(venta => {
            const metodoVenta = (venta.metodo_pago || "").toUpperCase();
            
            if (metodoElegido === 'TODOS' || metodoVenta.includes(metodoElegido)) {
                if (venta.productos_vendidos && Array.isArray(venta.productos_vendidos)) {
                    venta.productos_vendidos.forEach(p => {
                        const nombreP = (p.nombre || "").toLowerCase();
                        if (nombreP.includes(textoBusqueda)) {
                            const cant = Number(p.cantidadSeleccionada || p.cantidad || 0);
                            const precio = Number(p.precio || 0);
                            totalDinero += (cant * precio);
                            totalUnidades += cant;
                        }
                    });
                }
            }
        });
    }

    document.getElementById('auditResultado').textContent = `$${totalDinero.toFixed(2)}`;
    document.getElementById('auditCantUnidades').textContent = `${totalUnidades} unidades encontradas`;
};

inicializarReportes();
