const MatchView = (() => {
  function renderList(matches, players) {
    const container = document.getElementById('match-list');
    if (!matches.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Nog geen wedstrijden aangemaakt.</p></div>`;
      return;
    }
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    container.innerHTML = sorted.map(m => {
      const dateStr = new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
      const numPresent = (m.presentPlayers || []).length;
      return `
        <div class="match-card">
          <div class="match-card-info">
            <div class="match-title">vs ${m.opponent}</div>
            <div class="match-meta">${dateStr} &bull; ${numPresent} spelers aanwezig</div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <span class="match-badge ${m.location === 'thuis' ? 'badge-thuis' : 'badge-uit'}">${m.location === 'thuis' ? 'Thuis' : 'Uit'}</span>
              <span class="match-badge ${m.fieldType === 'half' ? 'badge-half' : 'badge-full'}">${m.fieldType === 'half' ? '8-tallen' : '11-tallen'}</span>
              <span class="match-badge" style="background:#e8ecf0;color:#445566">${m.formation || '–'}</span>
            </div>
          </div>
          <div class="match-card-actions">
            <button class="btn btn-secondary btn-icon" onclick="MatchController.edit('${m.id}')" title="Bewerken">✏️</button>
            <button class="btn btn-danger btn-icon" onclick="MatchController.remove('${m.id}')" title="Verwijderen">🗑</button>
          </div>
        </div>`;
    }).join('');
  }

  function openModal(match, players) {
    const isEdit = !!match;
    document.getElementById('match-modal-title').textContent = isEdit ? 'Wedstrijd bewerken' : 'Wedstrijd aanmaken';
    document.getElementById('match-id').value = match?.id || '';
    document.getElementById('match-date').value = match?.date || '';
    document.getElementById('match-opponent').value = match?.opponent || '';
    document.getElementById('match-location').value = match?.location || 'thuis';

    const fieldTypeEl = document.getElementById('match-fieldtype');
    fieldTypeEl.value = match?.fieldType || 'half';

    _renderFormationOptions(match?.fieldType || 'half', match?.formation);
    _renderPlayerChecklist(players, match?.presentPlayers || []);

    // Update formations when fieldtype changes
    fieldTypeEl.onchange = () => _renderFormationOptions(fieldTypeEl.value, null);

    document.getElementById('match-modal').classList.add('open');
  }

  function _renderFormationOptions(fieldType, selected) {
    const select = document.getElementById('match-formation');
    const options = FormationModel.getOptions(fieldType);
    select.innerHTML = options.map(o => `<option value="${o.key}" ${o.key === selected ? 'selected' : ''}>${o.label}</option>`).join('');
  }

  function _renderPlayerChecklist(players, selected) {
    const container = document.getElementById('match-player-checklist');
    if (!players.length) {
      container.innerHTML = '<p style="color:#aaa;font-size:.85rem;padding:4px">Geen spelers gevonden. Voeg eerst spelers toe.</p>';
      return;
    }
    container.innerHTML = players.map(p => `
      <label class="check-item">
        <input type="checkbox" value="${p.id}" ${selected.includes(p.id) ? 'checked' : ''}>
        <span>#${p.number || '?'} ${p.name}</span>
      </label>`).join('');
  }

  function closeModal() {
    document.getElementById('match-modal').classList.remove('open');
  }

  function getFormData() {
    const checked = [...document.querySelectorAll('#match-player-checklist input:checked')].map(i => i.value);
    return {
      id: document.getElementById('match-id').value || null,
      date: document.getElementById('match-date').value,
      opponent: document.getElementById('match-opponent').value.trim(),
      location: document.getElementById('match-location').value,
      fieldType: document.getElementById('match-fieldtype').value,
      formation: document.getElementById('match-formation').value,
      presentPlayers: checked,
    };
  }

  return { renderList, openModal, closeModal, getFormData };
})();
