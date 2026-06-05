const PlayerModel = (() => {
  const STORAGE_KEY = 'vc_players';

  const ALL_POSITIONS = [
    { code: 'GK',  label: 'Keeper' },
    { code: 'LB',  label: 'Links Back' },
    { code: 'CB',  label: 'Centraal Back' },
    { code: 'RB',  label: 'Rechts Back' },
    { code: 'LM',  label: 'Links Midden' },
    { code: 'CM',  label: 'Centraal Midden' },
    { code: 'RM',  label: 'Rechts Midden' },
    { code: 'LW',  label: 'Links Wing' },
    { code: 'ST',  label: 'Spits' },
    { code: 'RW',  label: 'Rechts Wing' },
    { code: 'CAM', label: 'Aanv. Midden' },
    { code: 'CDM', label: 'Def. Midden' },
  ];

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function _save(players) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }

  function getAll() { return _load(); }

  function getById(id) { return _load().find(p => p.id === id) || null; }

  function save(data) {
    const players = _load();
    if (data.id) {
      const idx = players.findIndex(p => p.id === data.id);
      if (idx !== -1) players[idx] = { ...players[idx], ...data };
      else players.push(data);
    } else {
      players.push({ ...data, id: crypto.randomUUID() });
    }
    _save(players);
  }

  function remove(id) {
    _save(_load().filter(p => p.id !== id));
  }

  return { getAll, getById, save, remove, ALL_POSITIONS };
})();
