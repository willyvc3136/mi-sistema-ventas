const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 

async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session && session.user) {
        // Eventos para filtros
        document.getElementById('filtroTiempo').addEventListener('change', () => {
            // Limpiar rango manual si se elige un filtro rápido
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

    // LÓGICA DE FILTRO POR RANGO
    if (fInicio !== "" && fFin !== "") {
        desde = new Date(fInicio + "T00:00:00");
        hasta = new Date(fFin + "T23:59:59");
    } else if (fInicio !== "") {
        // Si solo elige una fecha, asumimos que quiere ver solo ese día
        desde = new Date(fInicio + "T00:00:00");
        hasta = new Date(fInicio + "T23:59:59");
    } else {
        // Filtros rápidos predefinidos
        if (filtro === 'semanal') desde.setDate(desde.getDate() - 7);
        else if (filtro === 'anual') desde.setMonth(0, 1);
    }

    // Consulta unificada de ventas por rango
    const { data: ventas, error: errorVentas } = await _supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .gte('created_at', desde.toISOString())
        .lte('created_at', hasta.toISOString())
        .order('created_at', { ascending: false });

    // Consulta de deuda de clientes (esto es global)
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
    const totalDeudaReal = clientes.reduce((acc, c) => acc + (Number(c.deuda) || 0), 0);

    // Actualizar Interfaz
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;
    document.getElementById('totalPorCobrar').textContent = `$${totalDeudaReal.toFixed(2)}`;

    renderizarTabla(ventas);
    actualizarGrafica(granTotalReal, totalDeudaReal);
}

function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas');
    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400 italic">No hay ventas en este rango</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fechaObj = new Date(v.created_at);
        const fechaLabel = fechaObj.toLocaleDateString();
        const hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Público General';
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all text-sm";
        fila.innerHTML = `
            <td class="p-4">
                <p class="font-bold">${clienteNombre}</p>
                <p class="text-[10px] text-gray-400">${fechaLabel} - ${hora}</p>
            </td>
            <td class="p-4 text-center">
                <span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase ${v.metodo_pago === 'Fiado' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}">
                    ${v.metodo_pago}
                </span>
            </td>
            <td class="p-4 text-right font-black">$${Number(v.total).toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick='imprimirTicket(${JSON.stringify(v)})' class="hover:scale-120 transition-transform">📄</button>
            </td>
        `;
        tabla.appendChild(fila);
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
            <div style="text-align:center; border-bottom:1px dashed #000; margin-bottom:10px;">
                <h3 style="margin:0;">MINIMARKET PRO</h3>
                <small>${fecha}</small>
            </div>
            ${productosHtml}
            <div style="border-top:1px dashed #000; margin-top:10px; padding-top:5px; text-align:right;">
                <strong>TOTAL: $${Number(venta.total).toFixed(2)}</strong>
            </div>
            <div style="text-align:center; margin-top:15px; font-size:10px;">¡Gracias por su compra!</div>
            <script>window.print(); setTimeout(()=>window.close(), 500);</script>
        </body>
        </html>
    `);
    win.document.close();
};

function actualizarGrafica(real, fiado) {
    const canvas = document.getElementById('graficaBalance');
    if (!canvas) return;
    if (miGrafica) miGrafica.destroy();
    miGrafica = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['En Caja (Real)', 'Por Cobrar (Fiado)'],
            datasets: [{ 
                data: [real, fiado], 
                backgroundColor: ['#22c55e', '#2563eb'], 
                borderRadius: 10 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } 
        }
    });
}

inicializarReportes();