(() => {
  async function init() {
    if (!AuthModel.isLoggedIn()) {
      _showAuth();
      return;
    }
    if (AuthModel.isPlayer()) {
      _showPlayerApp();
      await PlayerAppController.init();
    } else {
      _showCoachApp();
      await Promise.all([
        PlayerController.init(),
        MatchController.init(),
        LineupController.init(),
        GamePlanController.init(),
      ]);
    }
  }

  function _showAuth() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';
    document.getElementById('player-app').style.display = 'none';
    _bindAuthForms();
  }

  function _showCoachApp() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    document.getElementById('player-app').style.display = 'none';
    const coach = AuthModel.getUser();
    const nameEl = document.getElementById('coach-name');
    const avatarEl = document.getElementById('coach-avatar');
    if (nameEl && coach) nameEl.textContent = coach.name;
    if (avatarEl && coach?.name) avatarEl.textContent = coach.name.charAt(0).toUpperCase();
  }

  function _showPlayerApp() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'none';
    document.getElementById('player-app').style.display = '';
    const player = AuthModel.getUser();
    const nameEl = document.getElementById('player-name-display');
    const avatarEl = document.getElementById('player-avatar');
    if (nameEl && player) nameEl.textContent = player.name;
    if (avatarEl && player?.name) avatarEl.textContent = player.name.charAt(0).toUpperCase();
  }

  function _bindAuthForms() {
    // Panel switches
    document.getElementById('show-register')?.addEventListener('click', () => {
      document.getElementById('auth-login').style.display = 'none';
      document.getElementById('auth-register').style.display = 'block';
      document.getElementById('auth-player-login').style.display = 'none';
    });
    document.getElementById('show-login')?.addEventListener('click', () => {
      document.getElementById('auth-login').style.display = 'block';
      document.getElementById('auth-register').style.display = 'none';
      document.getElementById('auth-player-login').style.display = 'none';
    });
    document.getElementById('show-player-login')?.addEventListener('click', () => {
      document.getElementById('auth-login').style.display = 'none';
      document.getElementById('auth-register').style.display = 'none';
      document.getElementById('auth-player-login').style.display = 'block';
    });
    document.getElementById('show-coach-login')?.addEventListener('click', () => {
      document.getElementById('auth-player-login').style.display = 'none';
      document.getElementById('auth-login').style.display = 'block';
    });

    // Coach login
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

    // Coach register
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

    // Player code login
    document.getElementById('form-player-login')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('player-login-error');
      err.textContent = '';
      try {
        await AuthModel.loginWithCode(document.getElementById('player-code').value);
        location.reload();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Coach tab navigation
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
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
