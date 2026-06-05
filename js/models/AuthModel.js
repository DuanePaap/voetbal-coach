const AuthModel = (() => {
  const T = 'vc_token';
  const C = 'vc_coach';

  function getToken()   { return localStorage.getItem(T); }
  function getCoach()   { try { return JSON.parse(localStorage.getItem(C)); } catch { return null; } }
  function isLoggedIn() { return !!getToken(); }

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

  function logout() {
    localStorage.removeItem(T);
    localStorage.removeItem(C);
    location.reload();
  }

  return { getToken, getCoach, isLoggedIn, register, login, logout };
})();
