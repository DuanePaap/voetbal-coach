const PlayerView = (() => {
  // Track main position state while the form is open
  let _mainPos = null;
  let _selectedPos = [];

  // ── Helpers ───────────────────────────────────────────────────────────
  function _posColor(code) {
    if (code === 'GK')                       return '#f59e0b';
    if (['CB','LB','RB'].includes(code))     return '#3b82f6';
    if (['CDM'].includes(code))              return '#06b6d4';
    if (['CM','LM','RM'].includes(code))     return '#10b981';
    if (['CAM'].includes(code))              return '#a855f7';
    if (['LW','RW','ST'].includes(code))     return '#ef4444';
    return '#64748b';
  }

  function _tier(positions) {
    const n = (positions || []).length;
    return n >= 3 ? 'gold' : n >= 1 ? 'silver' : 'bronze';
  }

  // Resize image to max 240px and compress as JPEG
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

  // ── renderList ────────────────────────────────────────────────────────
  function renderList(players) {
    const container = document.getElementById('player-list');
    if (!players.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Nog geen spelers toegevoegd.<br>Klik op "+ Speler toevoegen" om te beginnen.</p></div>`;
      return;
    }
    container.innerHTML = players.map(p => _buildCard(p)).join('');
  }

  function _buildCard(p) {
    const tier     = _tier(p.preferredPositions);
    const mainPos  = p.mainPosition || (p.preferredPositions || [])[0] || '–';
    const lastName = p.name.split(' ').slice(-1)[0].toUpperCase();
    const number   = p.number ? `#${p.number}` : '–';

    // Position badges — highlight main
    const posBadges = (p.preferredPositions || []).map(pos => {
      const isMain = pos === mainPos;
      const col    = _posColor(pos);
      const style  = isMain ? `background:${col};color:#fff;border-color:${col}` : '';
      return `<span class="fifa-pos-badge" style="${style}">${pos}</span>`;
    }).join('');

    // Photo or initials
    const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const photoContent = p.photo
      ? `<img src="${p.photo}" alt="${p.name}">`
      : `<div class="fifa-initials">${initials}</div>`;

    return `
      <div class="fifa-card ${tier}">
        <div class="fifa-shine"></div>
        <div class="fifa-top">
          <div class="fifa-rating">${number}</div>
          <div class="fifa-main-pos">${mainPos}</div>
        </div>
        <div class="fifa-photo-wrap">${photoContent}</div>
        <div class="fifa-bottom">
          <div class="fifa-name">${lastName}</div>
          <div class="fifa-divider"></div>
          <div class="fifa-positions">${posBadges || '<span class="fifa-pos-badge">–</span>'}</div>
        </div>
        <div class="fifa-actions">
          <button class="fifa-action-btn" onclick="event.stopPropagation();PlayerController.edit('${p.id}')" title="Bewerken">✏️</button>
          <button class="fifa-action-btn danger" onclick="event.stopPropagation();PlayerController.remove('${p.id}')" title="Verwijderen">🗑</button>
        </div>
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
    // Clone to remove old listeners
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
      id:                document.getElementById('player-id').value || null,
      name:              document.getElementById('player-name').value.trim(),
      number:            parseInt(document.getElementById('player-number').value) || null,
      photo:             document.getElementById('player-photo-data').value || null,
      mainPosition:      document.getElementById('player-main-position').value || _selectedPos[0] || null,
      preferredPositions: [..._selectedPos],
    };
  }

  return { renderList, openModal, closeModal, getFormData };
})();
