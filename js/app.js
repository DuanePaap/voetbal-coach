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
      const tasks = [
        PlayerController.init(),
        MatchController.init(),
        LineupController.init(),
        GamePlanController.init(),
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

  function _closeMenus() {
    document.querySelectorAll('.nav-links.open').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.nav-hamburger.open').forEach(el => {
      el.classList.remove('open');
      el.setAttribute('aria-expanded', 'false');
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
        const svg = document.querySelector('.auth-hero-svg');
        if (img) { img.src = data.image; img.style.display = ''; }
        if (svg) svg.style.display = 'none';
      }
    }).catch(() => {});

    // Hamburger menus
    _initHamburger('nav-hamburger', 'nav-links');
    _initHamburger('player-nav-hamburger', 'player-nav-links');

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
