const PlayerView = (() => {
  let _mainPos = null;
  let _selectedPos = [];

  // ── Helpers ───────────────────────────────────────────────────────────
  function _posClass(code) {
    if (code === 'GK')                       return 'pos-gk';
    if (['CB','LB','RB'].includes(code))     return 'pos-def';
    if (code === 'CDM')                      return 'pos-cdm';
    if (['CM','LM','RM'].includes(code))     return 'pos-mid';
    if (code === 'CAM')                      return 'pos-cam';
    if (['LW','RW','ST'].includes(code))     return 'pos-att';
    return 'pos-mid';
  }

  function _resizePhoto(dataUrl, cb) {
    const img = new Image();
    img.onload = () => {
      const MAX = 240;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.src = dataUrl;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  function _renderStats(players, codes) {
    const el = document.getElementById('player-stats');
    if (!el) return;
    const total      = players.length;
    const withPos    = players.filter(p => (p.preferredPositions || []).length > 0).length;
    const withCode   = (codes || []).length;
    const inactive   = total - withPos;
    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-value">${total}</div>
        <div class="stat-card-label">Totaal</div>
      </div>
      <div class="stat-card green">
        <div class="stat-card-value">${withPos}</div>
        <div class="stat-card-label">Actief</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-card-value">${withCode}</div>
        <div class="stat-card-label">Met login code</div>
      </div>
      <div class="stat-card red">
        <div class="stat-card-value">${inactive}</div>
        <div class="stat-card-label">Inactief</div>
      </div>`;
  }

  // ── renderList ────────────────────────────────────────────────────────
  function renderList(players, codes) {
    _renderStats(players, codes || []);

    const container = document.getElementById('player-list');
    if (!players.length) {
      container.innerHTML = `
        <div class="player-table-wrapper">
          <div class="empty-state">
            <div class="empty-icon">&#x26BD;</div>
            <p>Nog geen spelers toegevoegd.<br>Klik op "+ Speler toevoegen" om te beginnen.</p>
          </div>
        </div>`;
      return;
    }

    const codeMap = {};
    (codes || []).forEach(c => { codeMap[c.playerId] = c; });

    container.innerHTML = `
      <div class="player-table-wrapper">
        <table class="player-table">
          <thead>
            <tr>
              <th>Speler</th>
              <th>Positie</th>
              <th>Nr.</th>
              <th>Login code</th>
              <th>Status</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p => _buildRow(p, codeMap[p.id])).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function _buildRow(p, code) {
    const mainPos  = p.mainPosition || (p.preferredPositions || [])[0] || null;
    const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const avatar = p.photo
      ? `<div class="pt-avatar"><img src="${p.photo}" alt="${p.name}"></div>`
      : `<div class="pt-avatar">${initials}</div>`;

    const posBadges = (p.preferredPositions || []).slice(0, 3).map(pos =>
      `<span class="pos-badge-pill ${_posClass(pos)}">${pos}</span>`
    ).join('');

    const codeHtml = code
      ? `<span class="table-code-badge">${code.code}</span>`
      : `<span class="table-no-code">—</span>`;

    const isActive = (p.preferredPositions || []).length > 0;
    const statusHtml = `<span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Actief' : 'Inactief'}</span>`;

    const safeId = String(p.id).replace(/'/g, "\\'");
    return `
      <tr onclick="PlayerController.selectPlayer('${safeId}')">
        <td>
          <div class="pt-player-cell">
            ${avatar}
            <span class="pt-name">${p.name}</span>
          </div>
        </td>
        <td><div class="pos-badge-table">${posBadges || '<span style="color:var(--text-dim)">—</span>'}</div></td>
        <td>${p.number ? '#' + p.number : '—'}</td>
        <td>${codeHtml}</td>
        <td>${statusHtml}</td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn" onclick="event.stopPropagation();PlayerController.edit('${safeId}')" title="Bewerken">&#x270F;&#xFE0F;</button>
            <button class="table-action-btn danger" onclick="event.stopPropagation();PlayerController.remove('${safeId}')" title="Verwijderen">&#x1F5D1;</button>
          </div>
        </td>
      </tr>`;
  }

  // ── Detail panel ──────────────────────────────────────────────────────
  function showDetail(player, code) {
    const el = document.getElementById('player-detail');
    if (!el) return;

    // Highlight selected row
    document.querySelectorAll('.player-table tbody tr').forEach(tr => {
      tr.classList.toggle('selected', tr.onclick && tr.onclick.toString().includes(`'${player.id}'`));
    });

    const mainPos  = player.mainPosition || (player.preferredPositions || [])[0] || null;
    const initials = player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const photoHtml = player.photo
      ? `<div class="detail-photo-wrap"><img src="${player.photo}" alt="${player.name}"></div>`
      : `<div class="detail-photo-wrap"><div class="detail-photo-initials">${initials}</div></div>`;

    const posBadges = (player.preferredPositions || []).map(pos => {
      const star = pos === mainPos ? ' ★' : '';
      return `<span class="pos-badge-pill ${_posClass(pos)}">${pos}${star}</span>`;
    }).join('');

    const safeId  = String(player.id).replace(/'/g, "\\'");
    const safeCode = code ? String(code.code).replace(/'/g, "\\'") : '';

    const codeSection = code
      ? `<span class="detail-code-value">${code.code}</span>
         <div class="detail-code-actions">
           <button class="btn btn-secondary btn-sm" onclick="PlayerController.generateCode('${safeId}')">Vernieuwen</button>
           <button class="btn btn-danger btn-sm" onclick="PlayerController.revokeCode('${safeCode}')">Verwijderen</button>
         </div>`
      : `<span class="detail-code-none">Geen logincode aangemaakt</span>
         <div class="detail-code-actions">
           <button class="btn btn-primary btn-sm" onclick="PlayerController.generateCode('${safeId}')">+ Genereer code</button>
         </div>`;

    el.innerHTML = `
      ${photoHtml}
      <div class="detail-body">
        <div class="detail-name">${player.name}</div>
        <div class="detail-meta">${player.number ? '#' + player.number : 'Geen rugnummer'}${mainPos ? ' · ' + mainPos : ''}</div>
        <div class="detail-positions">
          ${posBadges || '<span style="color:var(--text-muted);font-size:.82rem">Geen positie</span>'}
        </div>
        <div class="detail-code-section">
          <div class="detail-code-label">Logincode</div>
          ${codeSection}
        </div>
      </div>
      <div class="detail-footer">
        <button class="btn btn-secondary" onclick="PlayerController.edit('${safeId}')">Bewerken</button>
        <button class="btn btn-danger" onclick="PlayerController.remove('${safeId}')">Verwijderen</button>
      </div>`;
  }

  // ── Modal ─────────────────────────────────────────────────────────────
  function openModal(player) {
    document.getElementById('player-modal-title').textContent = player ? 'Speler bewerken' : 'Speler toevoegen';
    document.getElementById('player-id').value    = player?.id    || '';
    document.getElementById('player-name').value  = player?.name  || '';
    document.getElementById('player-number').value = player?.number || '';
    document.getElementById('player-photo-data').value = player?.photo || '';
    document.getElementById('player-main-position').value = player?.mainPosition || '';

    _selectedPos = [...(player?.preferredPositions || [])];
    _mainPos     = player?.mainPosition || _selectedPos[0] || null;

    _renderPhotoPreview(player?.photo);
    _renderPositionPicker();
    _bindPhotoUpload();

    document.getElementById('player-modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('player-modal').classList.remove('open');
  }

  function _renderPhotoPreview(photoUrl) {
    const preview     = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    if (photoUrl) {
      preview.src = photoUrl;
      preview.classList.add('has-photo');
      placeholder.classList.add('hidden');
    } else {
      preview.src = '';
      preview.classList.remove('has-photo');
      placeholder.classList.remove('hidden');
    }
  }

  function _bindPhotoUpload() {
    const input = document.getElementById('player-photo-input');
    const fresh = input.cloneNode(true);
    input.replaceWith(fresh);
    fresh.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        _resizePhoto(ev.target.result, resized => {
          document.getElementById('player-photo-data').value = resized;
          _renderPhotoPreview(resized);
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function _renderPositionPicker() {
    const container = document.getElementById('position-picker');
    container.innerHTML = PlayerModel.ALL_POSITIONS.map(pos => {
      const isSelected = _selectedPos.includes(pos.code);
      const isMain     = _mainPos === pos.code;
      return `
        <div class="pos-pick-item${isSelected ? ' selected' : ''}${isMain ? ' is-main' : ''}" id="ppi-${pos.code}">
          <button type="button" class="pos-pick-btn" data-code="${pos.code}">
            ${pos.code} <small style="font-weight:400;font-size:.65rem">${pos.label}</small>
          </button>
          <button type="button" class="pos-star-btn" data-code="${pos.code}" title="Voorkeurspositie">★</button>
        </div>`;
    }).join('');

    container.querySelectorAll('.pos-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (_selectedPos.includes(code)) {
          _selectedPos = _selectedPos.filter(c => c !== code);
          if (_mainPos === code) _mainPos = _selectedPos[0] || null;
        } else {
          _selectedPos.push(code);
          if (!_mainPos) _mainPos = code;
        }
        document.getElementById('player-main-position').value = _mainPos || '';
        _renderPositionPicker();
      });
    });

    container.querySelectorAll('.pos-star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (_selectedPos.includes(code)) {
          _mainPos = code;
          document.getElementById('player-main-position').value = code;
          _renderPositionPicker();
        }
      });
    });
  }

  function getFormData() {
    return {
      id:                 document.getElementById('player-id').value || null,
      name:               document.getElementById('player-name').value.trim(),
      number:             parseInt(document.getElementById('player-number').value) || null,
      photo:              document.getElementById('player-photo-data').value || null,
      mainPosition:       document.getElementById('player-main-position').value || _selectedPos[0] || null,
      preferredPositions: [..._selectedPos],
    };
  }

  return { renderList, showDetail, openModal, closeModal, getFormData };
})();
