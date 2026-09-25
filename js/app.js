(() => {
  const ADMIN_EMAIL = 'duane@smoothmedia.nl';

  function _isAdmin() {
    return AuthModel.getUser()?.email === ADMIN_EMAIL;
  }

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
      await TeamController.init();
      const tasks = [
        PlayerController.init(),
        MatchController.init(),
        LineupController.init(),
        GamePlanController.init(),
        TeamCoachesController.init(),
        StatsController.init(),
      ];
      if (_isAdmin()) {
        document.getElementById('nav-btn-admin').style.display = '';
        tasks.push(AdminController.init());
      }
      await Promise.all(tasks);
    }
  }

  function _showAuth() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';
    document.getElementById('player-app').style.display = 'none';
    _bindAuthForms();
    _checkPasswordReset();
  }

  // Als de URL een ?reset=<token> bevat (vanuit de e-mail link), meteen het
  // reset-wachtwoord-paneel tonen i.p.v. het normale inlogscherm, en de token
  // vast valideren zodat een verlopen/ongeldige link direct duidelijk is.
  async function _checkPasswordReset() {
    const token = new URLSearchParams(location.search).get('reset');
    if (!token) return;

    document.getElementById('auth-login').style.display = 'none';
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-player-login').style.display = 'none';
    document.getElementById('auth-forgot').style.display = 'none';
    document.getElementById('auth-reset').style.display = 'block';
    document.getElementById('reset-token').value = token;

    try {
      await AuthModel.validateResetToken(token);
    } catch (ex) {
      document.getElementById('form-reset').style.display = 'none';
      const invalid = document.getElementById('reset-invalid');
      invalid.textContent = ex.message;
      invalid.style.display = 'block';
    }
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
    document.querySelector('.auth-forgot')?.addEventListener('click', () => {
      document.getElementById('auth-login').style.display = 'none';
      document.getElementById('auth-forgot').style.display = 'block';
    });
    document.getElementById('show-login-from-forgot')?.addEventListener('click', () => {
      document.getElementById('auth-forgot').style.display = 'none';
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

    // Wachtwoord vergeten — vraag een reset-link aan
    document.getElementById('form-forgot')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('forgot-error');
      const success = document.getElementById('forgot-success');
      err.textContent = '';
      success.style.display = 'none';
      try {
        await AuthModel.requestPasswordReset(document.getElementById('forgot-email').value);
        success.style.display = 'block';
        document.getElementById('form-forgot').reset();
      } catch (ex) { err.textContent = ex.message; }
    });

    // Nieuw wachtwoord instellen (via de link uit de e-mail)
    document.getElementById('form-reset')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('reset-error');
      err.textContent = '';
      try {
        await AuthModel.resetPassword(
          document.getElementById('reset-token').value,
          document.getElementById('reset-password').value
        );
        document.getElementById('form-reset').style.display = 'none';
        document.getElementById('reset-success').style.display = 'block';
      } catch (ex) { err.textContent = ex.message; }
    });
    document.getElementById('btn-reset-to-login')?.addEventListener('click', () => {
      history.replaceState(null, '', location.pathname);
      document.getElementById('auth-reset').style.display = 'none';
      document.getElementById('auth-login').style.display = 'block';
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

  function _closeMenus() {
    document.querySelectorAll('.nav-links.open').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.nav-hamburger.open').forEach(el => {
      el.classList.remove('open');
      el.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.user-menu.open').forEach(el => el.classList.remove('open'));
    document.getElementById('user-menu-trigger')?.setAttribute('aria-expanded', 'false');
  }

  function _initUserMenu() {
    const trigger = document.getElementById('user-menu-trigger');
    const menu = document.getElementById('user-menu');
    if (!trigger || !menu) return;
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const opening = !menu.classList.contains('open');
      _closeMenus();
      if (opening) {
        menu.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
    menu.addEventListener('click', e => {
      if (e.target.closest('.user-menu-item')) _closeMenus();
    });
  }

  function _openSettingsModal() {
    const coach = AuthModel.getUser();
    document.getElementById('settings-name').value = coach?.name || '';
    document.getElementById('settings-name-error').textContent = '';
    const currentTheme = localStorage.getItem('vc_theme') === 'light' ? 'light' : 'dark';
    document.querySelectorAll('#settings-theme-toggle .toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.themeChoice === currentTheme);
    });
    document.getElementById('settings-modal').classList.add('open');
  }

  function _closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('open');
  }

  function _applyTheme(theme) {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('vc_theme', theme);
    document.querySelectorAll('#settings-theme-toggle .toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.themeChoice === theme);
    });
  }

  function _initHamburger(hamburgerId, linksId) {
    const btn = document.getElementById(hamburgerId);
    const links = document.getElementById(linksId);
    if (!btn || !links) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const opening = !links.classList.contains('open');
      _closeMenus();
      if (opening) {
        links.classList.add('open');
        btn.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  let _playerAppInited = false;

  function _enterPlayerPreview() {
    _closeMenus();
    PlayerAppController.setPreviewMode(true);
    document.getElementById('app-root').style.display = 'none';
    document.getElementById('player-app').style.display = '';

    // Show back button, hide logout in player nav
    document.getElementById('btn-back-to-coach').style.display = '';
    document.getElementById('btn-player-logout').style.display = 'none';

    // Set avatar + name to coach identity
    const coach = AuthModel.getUser();
    const nameEl  = document.getElementById('player-name-display');
    const avatarEl = document.getElementById('player-avatar');
    if (nameEl  && coach)       nameEl.textContent  = coach.name;
    if (avatarEl && coach?.name) avatarEl.textContent = coach.name.charAt(0).toUpperCase();

    if (!_playerAppInited) {
      _playerAppInited = true;
      PlayerAppController.init().catch(console.error);
    } else {
      PlayerAppController.reload().catch(console.error);
    }
  }

  function _exitPlayerPreview() {
    PlayerAppController.setPreviewMode(false);
    document.getElementById('player-app').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    document.getElementById('btn-back-to-coach').style.display = 'none';
    document.getElementById('btn-player-logout').style.display = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Load custom login background (public, no auth needed)
    fetch('/api/login-image').then(r => r.json()).then(data => {
      if (data?.image) {
        const img = document.getElementById('auth-login-bg');
        if (img) { img.src = data.image; img.style.display = ''; }
      }
    }).catch(() => {});

    // Hamburger menus
    _initHamburger('nav-hamburger', 'nav-links');
    _initHamburger('player-nav-hamburger', 'player-nav-links');
    _initUserMenu();

    // Als in een ander tabblad van team gewisseld wordt, dit tabblad ook verversen
    window.addEventListener('storage', e => {
      if (e.key === 'vc_team_id' && e.newValue !== e.oldValue) location.reload();
    });

    // Close menus when clicking outside navbar
    document.addEventListener('click', e => {
      if (!e.target.closest('.navbar')) _closeMenus();
    });

    // Coach tab navigation
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        _closeMenus();
        document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`page-${btn.dataset.page}`)?.classList.add('active');
        if (btn.dataset.page === 'wedstrijden') MatchController.refresh();
        if (btn.dataset.page === 'opstelling') LineupController.refresh();
        if (btn.dataset.page === 'gameplan') GamePlanController.refresh();
      });
    });

    // Switch to player preview mode
    document.getElementById('btn-player-preview')?.addEventListener('click', _enterPlayerPreview);

    // Back to coach from player preview
    document.getElementById('btn-back-to-coach')?.addEventListener('click', _exitPlayerPreview);

    // Close player nav menu when player page button is clicked
    document.querySelectorAll('.nav-btn[data-player-page]').forEach(btn => {
      btn.addEventListener('click', _closeMenus);
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => AuthModel.logout());

    // Instellingen
    document.getElementById('menu-settings')?.addEventListener('click', _openSettingsModal);
    document.getElementById('settings-modal-close')?.addEventListener('click', _closeSettingsModal);
    document.getElementById('settings-modal-backdrop')?.addEventListener('click', _closeSettingsModal);
    document.getElementById('form-settings-name')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('settings-name-error');
      err.textContent = '';
      try {
        const updated = await AuthModel.updateName(document.getElementById('settings-name').value);
        document.getElementById('coach-name').textContent = updated.name;
        document.getElementById('coach-avatar').textContent = updated.name.charAt(0).toUpperCase();
      } catch (ex) { err.textContent = ex.message; }
    });
    document.querySelectorAll('#settings-theme-toggle .toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => _applyTheme(btn.dataset.themeChoice));
    });

    // Teams beheer
    document.getElementById('menu-teams')?.addEventListener('click', () => TeamController.openTeamsModal());
    document.getElementById('teams-modal-close')?.addEventListener('click', () => TeamController.closeTeamsModal());
    document.getElementById('teams-modal-backdrop')?.addEventListener('click', () => TeamController.closeTeamsModal());
    document.getElementById('btn-teams-modal-new')?.addEventListener('click', () => TeamController.createTeam());

    // Over Tactix26
    document.getElementById('menu-about')?.addEventListener('click', () => { location.href = '/about'; });

    // Password visibility toggle
    document.getElementById('toggle-pw')?.addEventListener('click', () => {
      const input = document.getElementById('login-password');
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      document.querySelector('#toggle-pw .eye-open').style.display = isText ? '' : 'none';
      document.querySelector('#toggle-pw .eye-shut').style.display = isText ? 'none' : '';
    });

    init().catch(console.error);
  });
})();
