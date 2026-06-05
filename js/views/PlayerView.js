const PlayerView = (() => {
  function renderList(players) {
    const container = document.getElementById('player-list');
    if (!players.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Nog geen spelers toegevoegd.<br>Klik op "+ Speler toevoegen" om te beginnen.</p></div>`;
      return;
    }
    container.innerHTML = players.map(p => {
      const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const positions = (p.preferredPositions || []).map(pos => `<span class="pos-badge">${pos}</span>`).join('');
      return `
        <div class="player-card">
          <div class="player-card-header">
            <div class="player-avatar">${initials}</div>
            <div>
              <div class="player-name">${p.name}</div>
              <div class="player-number">#${p.number || '–'}</div>
            </div>
          </div>
          <div class="player-positions">${positions || '<span style="color:#aaa;font-size:.8rem">Geen positie</span>'}</div>
          <div class="player-card-actions">
            <button class="btn btn-secondary btn-icon" onclick="PlayerController.edit('${p.id}')" title="Bewerken">✏️</button>
            <button class="btn btn-danger btn-icon" onclick="PlayerController.remove('${p.id}')" title="Verwijderen">🗑</button>
          </div>
        </div>`;
    }).join('');
  }

  function openModal(player) {
    document.getElementById('player-modal-title').textContent = player ? 'Speler bewerken' : 'Speler toevoegen';
    document.getElementById('player-id').value = player?.id || '';
    document.getElementById('player-name').value = player?.name || '';
    document.getElementById('player-number').value = player?.number || '';
    _renderPositionPicker(player?.preferredPositions || []);
    document.getElementById('player-modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('player-modal').classList.remove('open');
  }

  function _renderPositionPicker(selected) {
    const container = document.getElementById('position-picker');
    container.innerHTML = PlayerModel.ALL_POSITIONS.map(pos => `
      <button type="button" class="pos-btn${selected.includes(pos.code) ? ' selected' : ''}" data-code="${pos.code}">
        ${pos.code} <small style="font-weight:400">${pos.label}</small>
      </button>`).join('');
    container.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
    });
  }

  function getFormData() {
    const selected = [...document.querySelectorAll('#position-picker .pos-btn.selected')].map(b => b.dataset.code);
    return {
      id: document.getElementById('player-id').value || null,
      name: document.getElementById('player-name').value.trim(),
      number: parseInt(document.getElementById('player-number').value) || null,
      preferredPositions: selected,
    };
  }

  return { renderList, openModal, closeModal, getFormData };
})();
