const AuthModel = (() => {
  const T = 'vc_token';
  const C = 'vc_user';

  function getToken()   { return localStorage.getItem(T); }
  function getUser()    { try { return JSON.parse(localStorage.getItem(C)); } catch { return null; } }
  function getCoach()   { return getUser(); } // backward compat
  function isLoggedIn() { return !!getToken(); }

  function isPlayer() {
    const t = getToken();
    if (!t) return false;
    try {
      const parts = t.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.type === 'player';
    } catch { return false; }
  }

  async function register(email, password, name) {
    const res = await API.post('/api/auth/register', { email, password, name });
    localStorage.setItem(T, res.token);
    localStorage.setItem(C, JSON.stringify(res.coach));
    return res.coach;
  }

  async function login(email, password) {
    const res = await API.post('/api/auth/login', { email, password });
    localStorage.setItem(T, res.token);
    localStorage.setItem(C, JSON.stringify(res.coach));
    return res.coach;
  }

  async function loginWithCode(code) {
    const res = await API.post('/api/auth/player-login', { code });
    localStorage.setItem(T, res.token);
    localStorage.setItem(C, JSON.stringify(res.player));
    return res.player;
  }

  function logout() {
    localStorage.removeItem(T);
    localStorage.removeItem(C);
    location.reload();
  }

  return { getToken, getUser, getCoach, isLoggedIn, isPlayer, register, login, loginWithCode, logout };
})();
