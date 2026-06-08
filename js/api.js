const API = (() => {
  function _headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = localStorage.getItem('vc_token');
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }

  async function _req(method, path, body) {
    const opts = { method, headers: _headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    let data;
    try { data = await res.json(); }
    catch { throw new Error(`Server fout (${res.status} — geen JSON ontvangen)`); }
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('vc_token');
        localStorage.removeItem('vc_coach');
        location.reload();
      }
      throw new Error(data.error || 'Server fout');
    }
    return data;
  }

  return {
    get:    (p)    => _req('GET',    p),
    post:   (p, b) => _req('POST',   p, b),
    put:    (p, b) => _req('PUT',    p, b),
    delete: (p)    => _req('DELETE', p),
  };
})();
