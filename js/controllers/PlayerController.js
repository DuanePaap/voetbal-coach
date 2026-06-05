const PlayerController = (() => {
  let _selectedId = null;
  let _lastPlayers = [];
  let _lastCodes = [];

  async function init() {
    document.getElementById('btn-add-player').addEventListener('click', () => PlayerView.openModal(null));
    document.getElementById('player-form').addEventListener('submit', _onSave);
    document.querySelector('#player-modal .modal-close').addEventListener('click', PlayerView.closeModal);
    document.querySelector('#player-modal .modal-backdrop').addEventListener('click', PlayerView.closeModal);
    document.querySelector('#player-modal [data-modal="player-modal"]').addEventListener('click', PlayerView.closeModal);
    await refresh();
  }

  async function refresh() {
    const [players, codes] = await Promise.all([
      PlayerModel.getAll(),
      API.get('/api/codes'),
    ]);
    _lastPlayers = players;
    _lastCodes   = codes;
    PlayerView.renderList(players, codes);
    // Re-render detail panel if a player was selected
    if (_selectedId) {
      const p = players.find(p => String(p.id) === String(_selectedId));
      const c = codes.find(c => String(c.playerId) === String(_selectedId));
      if (p) PlayerView.showDetail(p, c || null);
      else _selectedId = null;
    }
    // Update coach avatar initial
    const coach = AuthModel.getUser();
    const avatar = document.getElementById('coach-avatar');
    if (avatar && coach?.name) avatar.textContent = coach.name.charAt(0).toUpperCase();
  }

  function selectPlayer(id) {
    _selectedId = id;
    const p = _lastPlayers.find(p => String(p.id) === String(id));
    const c = _lastCodes.find(c => String(c.playerId) === String(id));
    if (p) PlayerView.showDetail(p, c || null);
  }

  async function generateCode(playerId) {
    await API.post('/api/codes', { playerId });
    await refresh();
  }

  async function revokeCode(code) {
    if (!confirm('Logincode verwijderen?')) return;
    await API.delete(`/api/codes/${code}`);
    await refresh();
  }

  async function edit(id) {
    PlayerView.openModal(await PlayerModel.getById(id));
  }

  async function remove(id) {
    if (!confirm('Speler verwijderen?')) return;
    await PlayerModel.remove(id);
    if (String(_selectedId) === String(id)) {
      _selectedId = null;
      const detail = document.getElementById('player-detail');
      if (detail) detail.innerHTML = `
        <div class="detail-empty">
          <div class="detail-empty-icon">&#x26BD;</div>
          <p>Selecteer een speler<br>voor details</p>
        </div>`;
    }
    await refresh();
  }

  async function _onSave(e) {
    e.preventDefault();
    const data = PlayerView.getFormData();
    if (!data.name) return;
    const saved = await PlayerModel.save(data);
    PlayerView.closeModal();
    // Keep selection on the saved player
    if (saved?.id) _selectedId = saved.id;
    else if (data.id) _selectedId = data.id;
    await refresh();
  }

  return { init, refresh, selectPlayer, generateCode, revokeCode, edit, remove };
})();
