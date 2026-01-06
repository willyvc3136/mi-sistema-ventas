// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; 
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let miGrafica; 

async function inicializarReportes() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session && session.user) {
        // Vinculamos ambos controles a la misma función de carga
        document.getElementById('filtroTiempo').addEventListener('change', () => {
            // Si el usuario cambia a "Semana/Año", limpiamos el calendario manual para evitar conflictos
            document.getElementById('fechaManual').value = "";
            cargarReporte();
        });
        
        document.getElementById('fechaManual').addEventListener('change', cargarReporte);
        
        cargarReporte(); 
    } else {
        window.location.href = 'index.html';
    }
}

async function cargarReporte() {
    const filtro = document.getElementById('filtroTiempo').value;
    const fechaManual = document.getElementById('fechaManual').value;
    
    let fechaInicio = new Date();
    fechaInicio.setHours(0, 0, 0, 0);
    
    let fechaFin = new Date();
    fechaFin.setHours(23, 59, 59, 999);

    // LÓGICA DE FILTRO CORREGIDA
    if (fechaManual !== "") {
        // 1. Si hay una fecha en el calendario, filtramos SOLO ese día
        fechaInicio = new Date(fechaManual + "T00:00:00");
        fechaFin = new Date(fechaManual + "T23:59:59");
        console.log("Filtrando por día específico:", fechaManual);
    } else {
        // 2. Si el calendario está vacío, usamos el selector (Hoy, Semana, Año)
        if (filtro === 'semanal') {
            fechaInicio.setDate(fechaInicio.getDate() - 7);
        } else if (filtro === 'anual') {
            fechaInicio.setMonth(0, 1); // 1 de Enero
        }
        // Si es 'hoy', ya está configurado por defecto a las 00:00
        console.log("Filtrando por periodo:", filtro);
    }

    const { data: ventas, error: errorVentas } = await _supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .gte('created_at', fechaInicio.toISOString())
        .lte('created_at', fechaFin.toISOString())
        .order('created_at', { ascending: false });

    // ... (El resto del código de procesamiento de totales, renderizarTabla y actualizarGrafica se mantiene igual)
    
    if (errorVentas) return console.error("Error cargando ventas:", errorVentas);
    
    procesarYMostrarDatos(ventas); 
}

function procesarYMostrarDatos(ventas) {
    let efectivo = 0, yape = 0, plin = 0;
    
    ventas.forEach(v => {
        const monto = Number(v.total || 0);
        if (v.metodo_pago === 'Efectivo') efectivo += monto;
        else if (v.metodo_pago === 'Yape') yape += monto;
        else if (v.metodo_pago === 'Plin') plin += monto;
    });

    const granTotalReal = efectivo + yape + plin;
    
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;

    renderizarTabla(ventas);
    // Para la deuda total, podrías llamar a otra función que consulte la tabla clientes
    actualizarDeudaTotal(); 
    actualizarGrafica(granTotalReal, 0); // Ajustar según necesites
}

function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas');
    tabla.innerHTML = '';

    ventas.forEach(v => {
        const fechaObj = new Date(v.created_at);
        const hora = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Público General';
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all text-sm";
        fila.innerHTML = `
            <td class="p-4">
                <p class="font-bold">${clienteNombre}</p>
                <p class="text-[10px] text-gray-400">${hora}</p>
            </td>
            <td class="p-4 text-center">
                <span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-gray-100">${v.metodo_pago}</span>
            </td>
            <td class="p-4 text-right font-black">$${Number(v.total).toFixed(2)}</td>
            <td class="p-4 text-right">
                <button onclick='imprimirTicket(${JSON.stringify(v)})' class="text-blue-500 hover:text-blue-700 text-lg">📄</button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// ==========================================
// FUNCIÓN DE TICKET (VIRTUAL / PDF)
// ==========================================
window.imprimirTicket = (venta) => {
    const fecha = new Date(venta.created_at).toLocaleString();
    const productosHtml = venta.productos_vendidos.map(p => `
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span>${p.cantidadSeleccionada}x ${p.nombre.substring(0,15)}</span>
            <span>$${(p.precio * p.cantidadSeleccionada).toFixed(2)}</span>
        </div>
    `).join('');

    const ventanaTicket = window.open('', '', 'width=300,height=600');
    ventanaTicket.document.write(`
        <html>
        <body style="font-family: monospace; padding: 20px; width: 260px;">
            <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px;">
                <h2 style="margin:0">MINIMARKET PRO</h2>
                <p style="font-size: 10px;">Fecha: ${fecha}</p>
            </div>
            <div style="padding: 10px 0; border-bottom: 1px dashed #000;">
                ${productosHtml}
            </div>
            <div style="text-align: right; font-weight: bold; padding-top: 10px;">
                TOTAL: $${Number(venta.total).toFixed(2)}
            </div>
            <p style="text-align: center; font-size: 10px; margin-top: 20px;">¡Gracias por su compra!</p>
            <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
        </html>
    `);
    ventanaTicket.document.close();
};

function actualizarGrafica(real, fiado) {
    const canvas = document.getElementById('graficaBalance');
    if (!canvas) return;
    if (miGrafica) miGrafica.destroy();
    miGrafica = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['En Caja', 'Por Cobrar'],
            datasets: [{ data: [real, fiado], backgroundColor: ['#22c55e', '#2563eb'], borderRadius: 10 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

inicializarReportes();