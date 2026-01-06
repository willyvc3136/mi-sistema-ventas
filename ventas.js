// ... (Tus variables de configuración Supabase al inicio se mantienen igual)

// CORRECCIÓN EN INICIALIZACIÓN
async function inicializar() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        const display = document.getElementById('user-display');
        if(display) display.textContent = `Vendedor: ${user.email}`;
        await cargarProductos(user.id); 
        
        const inputBusqueda = document.getElementById('inputBusqueda');
        if(inputBusqueda) inputBusqueda.focus();

        const btnFinalizar = document.getElementById('btnFinalizarVenta');
        if(btnFinalizar) btnFinalizar.onclick = finalizarVenta;
    } else {
        window.location.href = 'index.html';
    }
}

// LÓGICA DE MÉTODOS DE PAGO
window.seleccionarMetodo = (metodo) => {
    metodoSeleccionado = metodo;
    document.querySelectorAll('.metodo-pago').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
        btn.classList.add('border-slate-100', 'bg-white', 'text-slate-500');
    });
    
    const btnActivo = document.getElementById(`btn${metodo}`);
    if(btnActivo) btnActivo.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');

    // Mostrar/Ocultar vuelto
    const panelVuelto = document.getElementById('panelVuelto');
    if(metodo === 'Efectivo') {
        panelVuelto.classList.remove('hidden');
    } else {
        panelVuelto.classList.add('hidden');
        document.getElementById('pagaCon').value = '';
        document.getElementById('vuelto').textContent = '$0.00';
    }
};

// CÁLCULO DE VUELTO REAL-TIME
const inputPagaCon = document.getElementById('pagaCon');
if(inputPagaCon) {
    inputPagaCon.addEventListener('input', (e) => {
        const total = parseFloat(document.getElementById('totalVenta').textContent.replace('$', '')) || 0;
        const pagaCon = parseFloat(e.target.value) || 0;
        const vueltoElem = document.getElementById('vuelto');
        if (pagaCon >= total) {
            vueltoElem.textContent = `$${(pagaCon - total).toFixed(2)}`;
        } else {
            vueltoElem.textContent = "$0.00";
        }
    });
}

// CORRECCIÓN EN TOGGLE CLIENTE
window.toggleSelectorCliente = function() {
    const con = document.getElementById('contenedorCliente');
    const esFiado = document.getElementById('esFiado').checked;
    const panelVuelto = document.getElementById('panelVuelto');

    if (esFiado) {
        con.classList.remove('hidden');
        panelVuelto.classList.add('hidden');
        cargarClientesVentas(); 
    } else {
        con.classList.add('hidden');
        if(metodoSeleccionado === 'Efectivo') panelVuelto.classList.remove('hidden');
    }
};

// ... (El resto de tus funciones como agregarAlCarrito y cargarProductos se mantienen)

inicializar();