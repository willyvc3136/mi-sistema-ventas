const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 

async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session && session.user) {
        // Eventos
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
        else if (filtro === 'anual') desde.setMonth(0, 1);
    }

    // Consulta de ventas
    const { data: ventas, error: errorVentas } = await _supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .gte('created_at', desde.toISOString())
        .lte('created_at', hasta.toISOString())
        .order('created_at', { ascending: false });

    // Consulta de deuda de clientes
    const { data: clientes } = await _supabase.from('clientes').select('deuda');

    if (errorVentas) return console.error("Error:", errorVentas);
    procesarYMostrarDatos(ventas, clientes || []); 
}

function procesarYMostrarDatos(ventas, clientes) {
    let efectivo = 0, yape = 0, plin = 0, fiado = 0;
    
    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        if (v.metodo_pago === 'Efectivo') efectivo += monto;
        else if (v.metodo_pago === 'Yape') yape += monto;
        else if (v.metodo_pago === 'Plin') plin += monto;
        else if (v.metodo_pago === 'Fiado') fiado += monto;
    });

    const granTotalReal = efectivo + yape + plin;
    const totalDigital = yape + plin;
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    // UI Updates con animación sencilla
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
        
        const fila = document.createElement('tr');
        fila.className = "group border-b border-slate-50 hover:bg-slate-50 transition-colors";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">${clienteNombre}</p>
                <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-tighter">${fecha}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    v.metodo_pago === 'Fiado' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                }">
                    ${v.metodo_pago}
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

window.imprimirTicket = (venta) => {
    const fecha = new Date(venta.created_at).toLocaleString();
    const productosHtml = venta.productos_vendidos.map(p => `
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span>${p.cantidadSeleccionada} x ${p.nombre.substring(0,18)}</span>
            <span>$${(p.precio * p.cantidadSeleccionada).toFixed(2)}</span>
        </div>
    `).join('');

    const win = window.open('', '', 'width=300,height=600');
    win.document.write(`
        <html>
        <body style="font-family:monospace; width:250px; padding:10px;">
            <div style="text-align:center; border-bottom:1px dashed #000; margin-bottom:10px; padding-bottom:10px;">
                <h3 style="margin:0; font-size:16px;">MINIMARKET PRO</h3>
                <small>${fecha}</small>
            </div>
            ${productosHtml}
            <div style="border-top:1px dashed #000; margin-top:10px; padding-top:5px; text-align:right;">
                <strong style="font-size:14px;">TOTAL: $${Number(venta.total).toFixed(2)}</strong>
                <br><small>Metodo: ${venta.metodo_pago}</small>
            </div>
            <div style="text-align:center; margin-top:20px; font-size:10px;">*** Gracias por preferirnos ***</div>
            <script>window.print(); setTimeout(()=>window.close(), 500);</script>
        </body>
        </html>
    `);
    win.document.close();
};

inicializarReportes();