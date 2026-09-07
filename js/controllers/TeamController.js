const TeamController = (() => {
  const NEW_TEAM_VALUE = '__new__';
  let _teams = [];
  let _activeId = null;

  async function init() {
    _teams = await TeamModel.getAll();
    if (!_teams.length) return;

    _activeId = localStorage.getItem('vc_team_id');
    if (!_activeId || !_teams.some(t => t.id === _activeId)) {
      _activeId = _teams[0].id;
      localStorage.setItem('vc_team_id', _activeId);
    }

    _render();
    document.getElementById('team-switcher')?.addEventListener('change', _onChange);
    document.getElementById('btn-edit-team-name')?.addEventListener('click', _renameActiveTeam);
  }

  function _render() {
    const select = document.getElementById('team-switcher');
    if (select) {
      select.innerHTML = _teams.map(t =>
        `<option value="${t.id}">${_esc(t.name)}</option>`
      ).join('') + `<option value="${NEW_TEAM_VALUE}">+ Nieuw team</option>`;
      select.value = _activeId;
      select.style.display = '';
    }

    const titleEl = document.getElementById('spelers-team-name');
    const activeTeam = _teams.find(t => t.id === _activeId);
    if (titleEl && activeTeam) titleEl.textContent = activeTeam.name;
  }

  async function _renameActiveTeam() {
    const activeTeam = _teams.find(t => t.id === _activeId);
    if (!activeTeam) return;
    const name = prompt('Nieuwe teamnaam:', activeTeam.name);
    if (!name?.trim() || name.trim() === activeTeam.name) return;
    try {
      const updated = await TeamModel.rename(activeTeam.id, name.trim());
      activeTeam.name = updated.name;
      _render();
    } catch (err) {
      alert(err.message);
    }
  }

  async function _onChange(e) {
    const select = e.target;
    if (select.value === NEW_TEAM_VALUE) {
      const name = prompt('Naam van het nieuwe team:');
      select.value = localStorage.getItem('vc_team_id');
      if (!name?.trim()) return;
      try {
        const team = await TeamModel.create(name.trim());
        _switchTo(team.id);
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    _switchTo(select.value);
  }

  function _switchTo(teamId) {
    if (teamId === localStorage.getItem('vc_team_id')) return;
    const desc = document.getElementById('gameplan-description')?.value?.trim();
    if (desc && !confirm('Je hebt een niet-opgeslagen scenario-omschrijving. Toch wisselen van team?')) return;
    localStorage.setItem('vc_team_id', teamId);
    location.reload();
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  return { init };
})();
