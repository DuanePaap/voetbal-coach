(() => {
  async function init() {
    if (!AuthModel.isLoggedIn()) {
      _showAuth();
      return;
    }
    _showApp();
    await Promise.all([
      PlayerController.init(),
      MatchController.init(),
      LineupController.init(),
      GamePlanController.init(),
    ]);
  }

  function _showAuth() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';
    _bindAuthForms();
  }

  function _showApp() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    const coach = AuthModel.getCoach();
    const el = document.getElementById('coach-name');
    if (el && coach) el.textContent = coach.name;
  }

  function _bindAuthForms() {
    document.getElementById('show-register')?.addEventListener('click', () => {
      document.getElementById('auth-login').style.display = 'none';
      document.getElementById('auth-register').style.display = 'block';
    });
    document.getElementById('show-login')?.addEventListener('click', () => {
      document.getElementById('auth-login').style.display = 'block';
      document.getElementById('auth-register').style.display = 'none';
    });

    document.getElementById('form-login')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('login-error');
      err.textContent = '';
      try {
        await AuthModel.login(
          document.getElementById('login-email').value,
          document.getElementById('login-password').value
        );
        location.reload();
      } catch (ex) { err.textContent = ex.message; }
    });

    document.getElementById('form-register')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('register-error');
      err.textContent = '';
      try {
        await AuthModel.register(
          document.getElementById('reg-email').value,
          document.getElementById('reg-password').value,
          document.getElementById('reg-name').value
        );
        location.reload();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Tab navigation
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`page-${btn.dataset.page}`)?.classList.add('active');
        if (btn.dataset.page === 'wedstrijden') MatchController.refresh();
        if (btn.dataset.page === 'opstelling') LineupController.refresh();
        if (btn.dataset.page === 'gameplan') GamePlanController.refresh();
      });
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => AuthModel.logout());

    init().catch(console.error);
  });
})();
