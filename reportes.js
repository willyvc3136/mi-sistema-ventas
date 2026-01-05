// ==========================================
// CONFIGURACIÓN DE CONEXIÓN
// ==========================================
const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; // <-- Coloca aquí tu clave real
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// INICIALIZACIÓN Y SEGURIDAD (CORREGIDO)
// ==========================================
async function inicializarReportes() {
    console.log("Iniciando reportes...");
    // Usamos getSession para una verificación más rápida y persistente
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session && session.user) {
        console.log("Sesión activa:", session.user.email);
        cargarReporte(session.user.id);
    } else {
        console.error("No se encontró sesión activa");
        // En lugar de redirigir de golpe, avisamos al usuario
        alert("Tu sesión ha expirado o no has iniciado sesión.");
        window.location.href = 'index.html';
    }
}

// ==========================================
// CARGA DE DATOS
// ==========================================
async function cargarReporte(userId) {
    try {
        // Consultamos ventas y traemos el nombre del cliente (relación Foreign Key)
        const { data: ventas, error: errorVentas } = await _supabase
            .from('ventas')
            .select(`
                *,
                clientes ( nombre )
            `)
            .eq('vendedor_id', userId)
            .order('created_at', { ascending: false });

        if (errorVentas) throw errorVentas;

        procesarEstadisticas(ventas);
        renderizarTabla(ventas);

    } catch (error) {
        console.error("Error en cargarReporte:", error.message);
        // Si sale error aquí, verifica si en Supabase la columna es 'vendedor_id' o 'user_id'
    }
}

// ==========================================
// CÁLCULOS CORREGIDOS (DINERO REAL)
// ==========================================
function procesarEstadisticas(ventas) {
    let efectivo = 0;
    let yape = 0;
    let plin = 0;
    let porCobrar = 0; // Para rastrear cuánto dinero hay en "Fiados"

    ventas.forEach(v => {
        const monto = Number(v.total || 0);

        // Clasificamos según el método de pago
        if (v.metodo_pago === 'Efectivo') {
            efectivo += monto;
        } else if (v.metodo_pago === 'Yape') {
            yape += monto;
        } else if (v.metodo_pago === 'Plin') {
            plin += monto;
        } else if (v.metodo_pago === 'Fiado') {
            porCobrar += monto; // Esto NO suma al dinero real del día
        }
    });

    // CÁLCULO DEL DINERO REAL (Solo lo que ya pagaron)
    // Esto evitará que tus reportes marquen $190 cuando solo tienes $133.50 reales
    const granTotalReal = efectivo + yape + plin;

    // Actualizamos los IDs en tu HTML
    document.getElementById('totalEfectivo').textContent = `$${efectivo.toFixed(2)}`;
    document.getElementById('totalYape').textContent = `$${yape.toFixed(2)}`;
    document.getElementById('totalPlin').textContent = `$${plin.toFixed(2)}`;
    document.getElementById('granTotal').textContent = `$${granTotalReal.toFixed(2)}`;

    // OPCIONAL: Si creas un ID llamado 'totalPorCobrar', puedes ver tus fiados ahí
    const elemPorCobrar = document.getElementById('totalPorCobrar');
    if (elemPorCobrar) {
        elemPorCobrar.textContent = `$${porCobrar.toFixed(2)}`;
    }
}

// ==========================================
// TABLA DE HISTORIAL
// ==========================================
function renderizarTabla(ventas) {
    const tabla = document.getElementById('listaVentas'); // ID correcto de tu HTML
    if (!tabla) return;

    tabla.innerHTML = '';

    if (ventas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="3" class="p-10 text-center text-gray-400 italic">No hay ventas registradas</td></tr>';
        return;
    }

    ventas.forEach(v => {
        const fecha = new Date(v.created_at).toLocaleDateString();
        const hora = new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clienteNombre = v.clientes ? v.clientes.nombre : 'Público General';
        
        const fila = document.createElement('tr');
        fila.className = "border-b hover:bg-gray-50 transition-all";
        fila.innerHTML = `
            <td class="p-5">
                <p class="font-bold text-gray-800">${clienteNombre}</p>
                <p class="text-[10px] text-gray-400 uppercase">${fecha} - ${hora}</p>
            </td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-600">
                    ${v.metodo_pago || 'Efectivo'}
                </span>
            </td>
            <td class="p-5 text-right font-black text-gray-800">
                $${v.total.toFixed(2)}
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// Ejecutar al cargar el script
inicializarReportes();