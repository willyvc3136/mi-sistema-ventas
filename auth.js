const supabaseUrl = 'https://ijyhkbiukiqiqjabpubm.supabase.co';
const supabaseKey = 'sb_publishable_EpJx4G5egW9GZdj8P7oudw_kDWWsj6p';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Manejar el formulario de Login del nuevo index.html
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    btn.innerText = "Cargando...";
    btn.disabled = true;

    const { data, error } = await _supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Error: " + error.message);
        btn.innerText = "Entrar al Sistema";
        btn.disabled = false;
    } else {
        // Redirigir al nuevo Dashboard profesional
        window.location.href = 'dashboard.html';
    }
});