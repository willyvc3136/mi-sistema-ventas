const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p'; // USA TU LLAVE REAL
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

async function registrarCliente() {
    const nombre = document.getElementById('nombreCliente').value;
    const telefono = document.getElementById('telefonoCliente').value;
    const { data: { user } } = await _supabase.auth.getUser();

    if(!nombre) return alert("El nombre es obligatorio");

    const { error } = await _supabase.from('clientes').insert([
        { nombre, telefono, user_id: user.id }
    ]);

    if(!error) location.reload();
}

async function obtenerClientes() {
    const { data: { user } } = await _supabase.auth.getUser();
    const { data, error } = await _supabase
        .from('clientes')
        .select('*')
        .eq('user_id', user.id)
        .order('nombre', { ascending: true });

    if(!error) renderizarClientes(data);
}

function renderizarClientes(clientes) {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = '';
    clientes.forEach(c => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="py-4 px-4 font-bold">${c.nombre}</td>
            <td class="py-4 px-4 text-gray-500">${c.telefono || '-'}</td>
            <td class="py-4 px-4 text-center">
                <span class="font-black ${c.deuda > 0 ? 'text-red-600' : 'text-green-600'}">
                    $${parseFloat(c.deuda).toFixed(2)}
                </span>
            </td>
            <td class="py-4 px-4 text-center">
                <button onclick="abrirModalAbono(${c.id}, '${c.nombre}')" class="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold text-xs hover:bg-green-600 hover:text-white transition-all">
                    Cobrar / Abonar
                </button>
            </td>
        `;
        lista.appendChild(fila);
    });
}

// Lógica del Modal de Abonos
window.abrirModalAbono = (id, nombre) => {
    document.getElementById('idClienteAbono').value = id;
    document.getElementById('nombreClienteAbono').textContent = "Cliente: " + nombre;
    document.getElementById('modalAbono').classList.remove('hidden');
};

window.cerrarModalAbono = () => document.getElementById('modalAbono').classList.add('hidden');

async function guardarAbono() {
    const idCliente = document.getElementById('idClienteAbono').value;
    const monto = parseFloat(document.getElementById('montoAbono').value);
    const { data: { user } } = await _supabase.auth.getUser();

    if(!monto || monto <= 0) return alert("Ingresa un monto válido");

    // 1. Registrar el abono en la tabla 'abonos' (para el reporte de caja de HOY)
    await _supabase.from('abonos').insert([
        { cliente_id: idCliente, monto: monto, user_id: user.id }
    ]);

    // 2. Actualizar la deuda en la tabla 'clientes' (Restar el pago)
    // Primero obtenemos la deuda actual
    const { data: cliente } = await _supabase.from('clientes').select('deuda').eq('id', idCliente).single();
    const nuevaDeuda = cliente.deuda - monto;

    await _supabase.from('clientes').update({ deuda: nuevaDeuda }).eq('id', idCliente);

    alert("¡Pago registrado con éxito!");
    location.reload();
}

// ... (Todo tu código anterior de registrarCliente, obtenerClientes y abrirModal se mantiene igual)

async function guardarAbono() {
    const idCliente = document.getElementById('idClienteAbono').value;
    const monto = parseFloat(document.getElementById('montoAbono').value);
    const { data: { user } } = await _supabase.auth.getUser();

    if(!monto || monto <= 0) return alert("Ingresa un monto válido");

    try {
        // 1. Registrar el abono en la tabla 'abonos' (Historial de pagos)
        const { error: errorAbono } = await _supabase.from('abonos').insert([
            { cliente_id: idCliente, monto: monto, user_id: user.id }
        ]);
        if (errorAbono) throw errorAbono;

        // 2. Actualizar la deuda en la tabla 'clientes' (Restar el pago)
        const { data: cliente, error: errorCliente } = await _supabase
            .from('clientes')
            .select('deuda')
            .eq('id', idCliente)
            .single();
        
        if (errorCliente) throw errorCliente;

        // Usamos Number() para asegurar que la resta sea matemática
        const nuevaDeuda = Number(cliente.deuda || 0) - monto;

        const { error: errorUpdate } = await _supabase
            .from('clientes')
            .update({ deuda: nuevaDeuda })
            .eq('id', idCliente);
        
        if (errorUpdate) throw errorUpdate;

        // ==========================================
        // 3. NUEVO: REGISTRAR EN VENTAS PARA REPORTES
        // ==========================================
        // Esto hace que el dinero sume a tu "Total Efectivo" de hoy
        await _supabase.from('ventas').insert([{
            total: monto,
            metodo_pago: 'Efectivo', // Puedes cambiarlo si el modal tiene opción de Yape/Plin
            estado_pago: 'pagado',
            cliente_id: idCliente,
            vendedor_id: user.id,
            productos_vendidos: [{ nombre: "PAGO/ABONO DE DEUDA", cantidad: 1 }]
        }]);
        // ==========================================

        alert("¡Pago registrado con éxito y sumado a reportes!");
        location.reload();

    } catch (error) {
        console.error("Error procesando abono:", error);
        alert("Hubo un error: " + error.message);
    }
}

obtenerClientes();