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

  function getActiveTeam() {
    return _teams.find(t => t.id === _activeId) || null;
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
      select.value = localStorage.getItem('vc_team_id');
      await createTeam();
      return;
    }
    _switchTo(select.value);
  }

  async function createTeam() {
    const name = prompt('Naam van het nieuwe team:');
    if (!name?.trim()) return;
    try {
      const team = await TeamModel.create(name.trim());
      _switchTo(team.id);
    } catch (err) {
      alert(err.message);
    }
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

  // ── Teams-beheer lightbox (alleen teams die de coach zelf bezit) ────────
  let _ownedTeamsCache = [];

  async function openTeamsModal() {
    const err = document.getElementById('teams-modal-error');
    if (err) err.textContent = '';
    document.getElementById('teams-modal')?.classList.add('open');
    await _loadTeamsModalList();
  }

  function closeTeamsModal() {
    document.getElementById('teams-modal')?.classList.remove('open');
  }

  async function _loadTeamsModalList() {
    const listEl = document.getElementById('teams-modal-list');
    if (listEl) listEl.innerHTML = '<p style="color:var(--text-muted)">Laden…</p>';
    try {
      const teams = await TeamModel.getAll();
      _ownedTeamsCache = teams.filter(t => t.isOwner);
      _renderTeamsModalList();
    } catch (err) {
      if (listEl) listEl.innerHTML = `<p class="auth-error">${_esc(err.message)}</p>`;
    }
  }

  function _renderTeamsModalList() {
    const listEl = document.getElementById('teams-modal-list');
    if (!listEl) return;
    if (!_ownedTeamsCache.length) {
      listEl.innerHTML = '<p style="color:var(--text-muted)">Geen teams gevonden.</p>';
      return;
    }
    listEl.innerHTML = _ownedTeamsCache.map(t => `
      <div class="overview-row">
        <span>${_esc(t.name)}${t.isDefault ? ' <span style="color:var(--text-dim);font-size:.72rem">(standaard)</span>' : ''}</span>
        <span class="overview-meta">${t.playerCount ?? 0} spelers · ${t.matchCount ?? 0} wedstrijden</span>
        <button class="table-action-btn" onclick="TeamController.deleteTeam('${t.id}')" title="Verwijderen">🗑</button>
      </div>`).join('');
  }

  async function deleteTeam(id) {
    const team = _ownedTeamsCache.find(t => t.id === id);
    if (!team) return;
    if (!confirm(`Team "${team.name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    const err = document.getElementById('teams-modal-error');
    if (err) err.textContent = '';
    try {
      await TeamModel.remove(id);
      if (id === localStorage.getItem('vc_team_id')) {
        location.reload();
      } else {
        await _loadTeamsModalList();
      }
    } catch (ex) {
      if (err) err.textContent = ex.message;
    }
  }

  return { init, getActiveTeam, createTeam, openTeamsModal, closeTeamsModal, deleteTeam };
})();
