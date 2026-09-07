const TeamCoachesController = (() => {
  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  async function init() {
    document.getElementById('btn-add-team-coach')?.addEventListener('click', _addCoach);
    await refresh();
  }

  async function refresh() {
    const card = document.getElementById('team-coaches-card');
    if (!card) return;
    const team = TeamController.getActiveTeam();
    if (!team?.isOwner) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    await _load(team.id);
  }

  async function _load(teamId) {
    const errEl = document.getElementById('team-coaches-error');
    if (errEl) errEl.textContent = '';
    try {
      const rows = await TeamCoachModel.getAll(teamId);
      _render(teamId, rows);
    } catch (err) {
      console.error('Team coaches load error:', err);
      if (errEl) errEl.textContent = err.message;
    }
  }

  function _render(teamId, rows) {
    const tbody = document.getElementById('team-coaches-body');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted)">Nog geen andere coaches toegevoegd.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const name = r.name
        ? _esc(r.name)
        : '<span style="color:var(--text-dim);font-size:.78rem">Nog niet geregistreerd</span>';
      const statusBadge = r.active
        ? '<span class="status-badge status-active">Actief</span>'
        : '<span class="status-badge status-inactive">Inactief</span>';
      return `
        <tr>
          <td>${name}</td>
          <td>${_esc(r.email)}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn" onclick="TeamCoachesController.toggleActive('${teamId}','${r.id}', ${r.active})" title="${r.active ? 'Deactiveren' : 'Activeren'}">${r.active ? '🔒' : '🔓'}</button>
              <button class="table-action-btn" onclick="TeamCoachesController.removeCoach('${teamId}','${r.id}')" title="Verwijderen">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  async function _addCoach() {
    const errEl = document.getElementById('team-coaches-error');
    if (errEl) errEl.textContent = '';
    const team = TeamController.getActiveTeam();
    if (!team) return;
    const email = prompt('E-mailadres van de coach die je wilt toevoegen:');
    if (!email?.trim()) return;
    try {
      await TeamCoachModel.add(team.id, email.trim());
      await _load(team.id);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  }

  async function toggleActive(teamId, id, currentlyActive) {
    const errEl = document.getElementById('team-coaches-error');
    if (errEl) errEl.textContent = '';
    try {
      await TeamCoachModel.setActive(teamId, id, !currentlyActive);
      await _load(teamId);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  }

  async function removeCoach(teamId, id) {
    if (!confirm('Deze coach de toegang tot dit team ontnemen?')) return;
    const errEl = document.getElementById('team-coaches-error');
    if (errEl) errEl.textContent = '';
    try {
      await TeamCoachModel.remove(teamId, id);
      await _load(teamId);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  }

  return { init, refresh, toggleActive, removeCoach };
})();
