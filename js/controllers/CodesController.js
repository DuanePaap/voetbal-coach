const CodesController = (() => {
  function open() {
    document.getElementById('codes-modal').classList.add('open');
    _refresh();
  }

  function close() {
    document.getElementById('codes-modal').classList.remove('open');
  }

  async function _refresh() {
    const [codes, players] = await Promise.all([
      API.get('/api/codes'),
      PlayerModel.getAll(),
    ]);
    _render(players, codes);
  }

  function _render(players, codes) {
    const el = document.getElementById('codes-list');
    if (!players.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">Voeg eerst spelers toe.</p>';
      return;
    }
    const codeMap = {};
    codes.forEach(c => { codeMap[c.playerId] = c; });

    el.innerHTML = players.map(p => {
      const existing = codeMap[p.id];
      const codeSection = existing
        ? `<span class="code-badge">${existing.code}</span>
           <button class="btn btn-secondary btn-sm" onclick="CodesController.generate('${p.id}')">Vernieuwen</button>
           <button class="btn btn-danger btn-sm" onclick="CodesController.revoke('${existing.code}')">✕</button>`
        : `<span class="code-none">Geen code</span>
           <button class="btn btn-primary btn-sm" onclick="CodesController.generate('${p.id}')">Genereer</button>`;
      return `<div class="code-row">
        <span class="code-player-name">${p.name}</span>
        <div class="code-actions">${codeSection}</div>
      </div>`;
    }).join('');
  }

  async function generate(playerId) {
    await API.post('/api/codes', { playerId });
    await _refresh();
  }

  async function revoke(code) {
    if (!confirm('Logincode verwijderen?')) return;
    await API.delete(`/api/codes/${code}`);
    await _refresh();
  }

  return { open, close, generate, revoke };
})();
