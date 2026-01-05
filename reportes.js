const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function cargarReporte() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) window.location.href = 'index.html';

    const filtro = document.getElementById('filtroTiempo').value;
    let fechaInicio = new Date();

    // Configurar el rango de fecha según el filtro
    if (filtro === 'hoy') {
        fechaInicio.setHours(0, 0, 0, 0);
    } else if (filtro === 'semanal') {
        fechaInicio.setDate(fechaInicio.getDate() - 7);
    } else if (filtro === 'anual') {
        fechaInicio.setMonth(0, 1); // 1 de Enero
        fechaInicio.setHours(0, 0, 0, 0);
    }

    // Consultar Supabase
    const { data: ventas, error } = await _supabase
        .from('ventas')
        .select('*')
        .eq('vendedor_id', user.id)
        .gte('created_at', fechaInicio.toISOString())
        .order('created_at', { ascending: false });

    if (error) return console.error("Error al cargar ventas:", error);

    // Inicializar totales
    let efec = 0, yape = 0, plin = 0;
    const tabla = document.getElementById('listaVentas');
    tabla.innerHTML = '';

    ventas.forEach(v => {
        if (v.metodo_pago === 'Efectivo') efec += v.total;
        if (v.metodo_pago === 'Yape') yape += v.total;
        if (v.metodo_pago === 'Plin') plin += v.total;

        const fechaObj = new Date(v.created_at);
        const formatoFecha = `${fechaObj.toLocaleDateString()} ${fechaObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

        const fila = document.createElement('tr');
        fila.className = "hover:bg-gray-50 transition-all";
        fila.innerHTML = `
            <td class="p-5 text-sm font-medium text-gray-600">${formatoFecha}</td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[9px] font-black uppercase ${getBadgeStyle(v.metodo_pago)}">
                    ${v.metodo_pago}
                </span>
            </td>
            <td class="p-5 text-right font-black text-gray-800">$${v.total.toFixed(2)}</td>
        `;
        tabla.appendChild(fila);
    });

    // Actualizar pantalla
    document.getElementById('totalEfectivo').textContent = `$${efec.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${(efec + yape + plin).toFixed(2)}`;
}

function getBadgeStyle(meto) {
    if (meto === 'Yape') return 'bg-purple-100 text-purple-700';
    if (meto === 'Plin') return 'bg-blue-100 text-blue-700';
    return 'bg-green-100 text-green-700';
}

// Cargar al iniciar
cargarReporte();