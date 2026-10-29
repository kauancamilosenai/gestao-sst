const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const authScreen = document.querySelector('#auth-screen');
const authDialogRoot = document.querySelector('#auth-dialog-root');
const appShell = document.querySelector('#app-shell');
const demoBanner = document.querySelector('#demo-banner');
let appLoaded = false;

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Falha na API (${response.status}).`);
  return payload;
}

function enterApp(user) {
  authScreen.hidden = true;
  appShell.hidden = false;
  demoBanner.hidden = false;
  const display = document.querySelector('.signed-user > span:nth-child(2)');
  if (display) {
    display.querySelector('strong').textContent = user.fullName;
    display.querySelector('small').textContent = user.email;
  }
  const avatar = document.querySelector('.signed-user .avatar');
  if (avatar) avatar.textContent = user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  if (!appLoaded) {
    appLoaded = true;
    const script = document.createElement('script');
    script.src = './app.js';
    script.onerror = () => { window.alert('Não foi possível carregar a aplicação. Atualize a página.'); };
    document.body.append(script);
  }
}

function showLogin(message = '') {
  appShell.hidden = true;
  demoBanner.hidden = true;
  authScreen.hidden = false;
  loginError.textContent = message;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  const formData = new FormData(loginForm);
  button.disabled = true;
  button.textContent = 'Entrando…';
  loginError.textContent = '';
  try {
    const result = await request('/auth/login', { method: 'POST', body: {
      email: formData.get('email'), password: formData.get('password'),
    } });
    loginForm.reset();
    enterApp(result.user);
  } catch (error) {
    loginError.textContent = error.message || 'Não foi possível entrar.';
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar';
  }
});

document.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-auth-action]')?.dataset.authAction;
  if (action === 'logout') {
    try { await request('/auth/logout', { method: 'POST' }); }
    finally { window.location.reload(); }
  }
  if (action === 'add-user') openAddUserDialog();
  if (event.target.matches('[data-close-auth-dialog]')) authDialogRoot.innerHTML = '';
});

function openAddUserDialog() {
  authDialogRoot.innerHTML = `<div class="auth-dialog-backdrop" data-close-auth-dialog>
    <form class="auth-dialog" id="add-user-form" aria-labelledby="add-user-title">
      <button class="auth-dialog-close" type="button" aria-label="Fechar" data-close-auth-dialog>×</button>
      <p class="auth-eyebrow">ACESSO DA EQUIPE</p><h2 id="add-user-title">Adicionar usuário</h2>
      <p class="auth-description">A nova conta terá acesso completo aos mesmos cadastros.</p>
      <label for="new-user-name">Nome</label><input id="new-user-name" name="fullName" autocomplete="name" required />
      <label for="new-user-email">E-mail</label><input id="new-user-email" name="email" type="email" autocomplete="email" required />
      <label for="new-user-password">Senha temporária</label><input id="new-user-password" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required />
      <small class="auth-help">Use pelo menos 12 caracteres e entregue a senha por um canal privado.</small>
      <p class="auth-error" id="add-user-error" role="alert"></p><button class="auth-submit" type="submit">Criar conta</button>
    </form></div>`;
  const form = document.querySelector('#add-user-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const errorBox = document.querySelector('#add-user-error');
    button.disabled = true;
    button.textContent = 'Criando…';
    errorBox.textContent = '';
    try {
      await request('/auth/users', { method: 'POST', body: {
        fullName: formData.get('fullName'), email: formData.get('email'), password: formData.get('password'),
      } });
      authDialogRoot.innerHTML = '';
      window.showToast?.('Usuário criado. Compartilhe a senha temporária por um canal privado.');
    } catch (error) {
      errorBox.textContent = error.message || 'Não foi possível criar a conta.';
    } finally {
      if (button.isConnected) { button.disabled = false; button.textContent = 'Criar conta'; }
    }
  });
}

request('/auth/me').then(({ user }) => enterApp(user)).catch((error) => {
  showLogin(error.message === 'Faça login para continuar.' ? '' : error.message);
});

