const PlayerView = (() => {
  const _SILHOUETTES = {
    GK: `<svg viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="16" rx="12" ry="13" fill="rgba(0,0,0,.35)"/>
      <path d="M30 70 Q28 45 38 35 Q44 30 50 30 Q56 30 62 35 Q72 45 70 70 Z" fill="rgba(0,0,0,.35)"/>
      <path d="M38 35 Q20 42 15 65 Q18 68 25 65 Q30 50 38 48 Z" fill="rgba(0,0,0,.3)"/>
      <path d="M62 35 Q80 42 85 65 Q82 68 75 65 Q70 50 62 48 Z" fill="rgba(0,0,0,.3)"/>
      <path d="M36 68 Q32 95 28 120 Q34 122 40 120 Q42 100 50 90 Q58 100 60 120 Q66 122 72 120 Q68 95 64 68 Z" fill="rgba(0,0,0,.35)"/>
    </svg>`,
    ATK: `<svg viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="15" rx="12" ry="13" fill="rgba(0,0,0,.35)"/>
      <path d="M32 68 Q30 44 40 34 Q45 29 50 29 Q55 29 60 34 Q70 44 68 68 Z" fill="rgba(0,0,0,.35)"/>
      <path d="M40 34 Q22 38 18 58 Q22 62 28 60 Q32 48 40 46 Z" fill="rgba(0,0,0,.3)"/>
      <path d="M60 34 Q78 38 82 58 Q78 62 72 60 Q68 48 60 46 Z" fill="rgba(0,0,0,.3)"/>
      <path d="M34 67 Q26 85 20 110 Q27 113 33 110 Q38 95 44 85 L50 90 L56 85 Q62 95 67 110 Q73 113 80 110 Q74 85 66 67 Z" fill="rgba(0,0,0,.35)"/>
      <circle cx="68" cy="118" r="6" fill="rgba(255,255,255,.25)" stroke="rgba(0,0,0,.2)" stroke-width="1.5"/>
    </svg>`,
    MID: `<svg viewBox="0 0 100 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="15" rx="12" ry="13" fill="rgba(0,0,0,.35)"/>
      <path d="M31 66 Q29 43 39 33 Q44 28 50 28 Q56 28 61 33 Q71 43 69 66 Z" fill="rgba(0,0,0,.35)"/>
      <path d="M39 33 Q21 40 16 62 Q20 66 26 63 Q30 50 39 47 Z" fill="rgba(0,0,0,.3)"/>
      <path d="M61 33 Q79 40 84 62 Q80 66 74 63 Q70 50 61 47 Z" fill="rgba(0,0,0,.3)"/>
      <path d="M33 65 Q30 88 28 115 Q35 117 40 115 Q43 98 50 88 Q57 98 60 115 Q65 117 72 115 Q70 88 67 65 Z" fill="rgba(0,0,0,.35)"/>
    </svg>`,
  };

  function _getSilhouette(positions) {
    if (!positions?.length) return _SILHOUETTES.MID;
    if (positions.includes('GK')) return _SILHOUETTES.GK;
    if (positions.some(p => ['ST','LW','RW','CAM'].includes(p))) return _SILHOUETTES.ATK;
    return _SILHOUETTES.MID;
  }

  function _getTier(positions) {
    const n = (positions || []).length;
    if (n >= 3) return 'gold';
    if (n >= 1) return 'silver';
    return 'bronze';
  }

  function _getOvr(player) {
    const n = (player.preferredPositions || []).length;
    if (player.number) return Math.min(99, player.number);
    return Math.min(99, 60 + n * 9);
  }

  function _getPrimaryPos(positions) {
    if (!positions?.length) return '–';
    const order = ['GK','CB','LB','RB','CDM','CM','LM','RM','CAM','LW','RW','ST'];
    for (const p of order) { if (positions.includes(p)) return p; }
    return positions[0];
  }

  function renderList(players) {
    const container = document.getElementById('player-list');
    if (!players.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Nog geen spelers toegevoegd.<br>Klik op "+ Speler toevoegen" om te beginnen.</p></div>`;
      return;
    }
    container.innerHTML = players.map(p => {
      const tier      = _getTier(p.preferredPositions);
      const ovr       = _getOvr(p);
      const mainPos   = _getPrimaryPos(p.preferredPositions);
      const silhouette = _getSilhouette(p.preferredPositions);
      const lastName  = p.name.split(' ').slice(-1)[0].toUpperCase();
      const possBadges = (p.preferredPositions || []).map(pos => `<span class="fifa-pos-badge">${pos}</span>`).join('');
      const shirtLabel = p.number ? `#${p.number}` : '';
      return `
        <div class="fifa-card ${tier}">
          <div class="fifa-shine"></div>
          <div class="fifa-top">
            <div class="fifa-rating">${ovr}</div>
            <div class="fifa-main-pos">${mainPos}</div>
            <div class="fifa-emblem">⚽</div>
          </div>
          <div class="fifa-image">${silhouette}</div>
          <div class="fifa-bottom">
            <div class="fifa-name">${lastName}</div>
            ${shirtLabel ? `<div class="fifa-shirt">${shirtLabel}</div>` : ''}
            <div class="fifa-divider"></div>
            <div class="fifa-positions">${possBadges || '<span class="fifa-pos-badge">–</span>'}</div>
          </div>
          <div class="fifa-actions">
            <button class="fifa-action-btn" onclick="event.stopPropagation();PlayerController.edit('${p.id}')" title="Bewerken">✏️</button>
            <button class="fifa-action-btn danger" onclick="event.stopPropagation();PlayerController.remove('${p.id}')" title="Verwijderen">🗑</button>
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
