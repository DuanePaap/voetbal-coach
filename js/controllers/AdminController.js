const AdminController = (() => {
  let _savedImage  = null;
  let _pendingImage = null;
  let _coaches = [];
  let _overviewData = null;
  let _overviewTab = 'teams';

  async function init() {
    await _load();
    _bindEvents();
    await _loadCoaches();
  }

  async function _load() {
    try {
      const data = await API.get('/api/admin/login-bg');
      _savedImage = data.image || null;
      _render();
    } catch (err) {
      console.error('Admin load error:', err);
    }
  }

  function _render() {
    const previewImg   = document.getElementById('admin-bg-img');
    const placeholder  = document.getElementById('admin-bg-placeholder');
    const resetBtn     = document.getElementById('btn-admin-reset');
    const saveBtn      = document.getElementById('btn-admin-save');
    const activeImage  = _pendingImage || _savedImage;

    if (activeImage) {
      if (previewImg)  { previewImg.src = activeImage; previewImg.style.display = ''; }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (previewImg)  { previewImg.src = ''; previewImg.style.display = 'none'; }
      if (placeholder) placeholder.style.display = '';
    }
    if (resetBtn) resetBtn.style.display = _savedImage ? '' : 'none';
    if (saveBtn)  saveBtn.disabled = !_pendingImage;
  }

  function _bindEvents() {
    const fileInput  = document.getElementById('admin-bg-file');
    const dropZone   = document.getElementById('admin-drop-zone');
    const saveBtn    = document.getElementById('btn-admin-save');
    const resetBtn   = document.getElementById('btn-admin-reset');

    fileInput?.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) _processFile(f);
    });

    dropZone?.addEventListener('click', () => fileInput?.click());

    dropZone?.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone?.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/')) _processFile(f);
    });

    saveBtn?.addEventListener('click',  _save);
    resetBtn?.addEventListener('click', _reset);

    document.querySelectorAll('#coach-overview-tabs .toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#coach-overview-tabs .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _overviewTab = btn.dataset.tab;
        _renderOverviewTab();
      });
    });
  }

  function _processFile(file) {
    const reader = new FileReader();
    reader.onload = e => _compress(e.target.result, compressed => {
      _pendingImage = compressed;
      _render();
    });
    reader.readAsDataURL(file);
  }

  function _compress(dataUrl, cb) {
    const img = new Image();
    img.onload = () => {
      const MAX_W = 1920, MAX_H = 1080;
      let w = img.width, h = img.height;
      if (w > MAX_W || h > MAX_H) {
        const r = Math.min(MAX_W / w, MAX_H / h);
        w = Math.round(w * r); h = Math.round(h * r);
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.88));
    };
    img.src = dataUrl;
  }

  async function _save() {
    if (!_pendingImage) return;
    const btn = document.getElementById('btn-admin-save');
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Opslaan…'; }
    try {
      await API.post('/api/admin/login-bg', { image: _pendingImage });
      _savedImage  = _pendingImage;
      _pendingImage = null;
      if (btn) { btn.textContent = 'Opgeslagen ✓'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; _render(); }, 1800); }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = orig; }
      document.getElementById('admin-error').textContent = err.message;
    }
  }

  async function _reset() {
    if (!confirm('Achtergrond terugzetten naar de standaard animatie?')) return;
    try {
      await API.delete('/api/admin/login-bg');
      _savedImage   = null;
      _pendingImage = null;
      const fi = document.getElementById('admin-bg-file');
      if (fi) fi.value = '';
      _render();
    } catch (err) {
      document.getElementById('admin-error').textContent = err.message;
    }
  }

  // ── Coach account management ──────────────────────────────────────────
  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  async function _loadCoaches() {
    const el = document.getElementById('admin-coaches-error');
    if (el) el.textContent = '';
    try {
      const coaches = await API.get('/api/admin/coaches');
      _coaches = coaches;
      _renderCoaches(coaches);
    } catch (err) {
      console.error('Admin load coaches error:', err);
      if (el) el.textContent = err.message;
    }
  }

  function _renderCoaches(coaches) {
    const tbody = document.getElementById('admin-coaches-body');
    if (!tbody) return;
    if (!coaches.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted)">Geen coach-accounts gevonden.</td></tr>';
      return;
    }
    tbody.innerHTML = coaches.map(c => {
      const created = new Date(Number(c.createdAt)).toLocaleDateString('nl-NL');
      const statusBadge = c.blocked
        ? '<span class="status-badge status-inactive">Geblokkeerd</span>'
        : '<span class="status-badge status-active">Actief</span>';
      const actions = c.isAdmin
        ? '<span style="color:var(--text-dim);font-size:.78rem">— admin —</span>'
        : `
          <div class="table-actions">
            <button class="table-action-btn" onclick="AdminController.viewOverview('${c.id}')" title="Teams, spelers en wedstrijden bekijken">👁</button>
            <button class="table-action-btn" onclick="AdminController.editCoachEmail('${c.id}')" title="E-mail wijzigen">✏️</button>
            <button class="table-action-btn" onclick="AdminController.toggleCoachBlock('${c.id}', ${c.blocked})" title="${c.blocked ? 'Deblokkeren' : 'Blokkeren'}">${c.blocked ? '🔓' : '🔒'}</button>
            <button class="table-action-btn" onclick="AdminController.removeCoach('${c.id}')" title="Verwijderen">🗑</button>
          </div>`;
      return `
        <tr>
          <td>${_esc(c.name)}${c.isAdmin ? ' <span style="color:var(--text-dim);font-size:.72rem">(admin)</span>' : ''}</td>
          <td>${_esc(c.email)}</td>
          <td>${statusBadge}</td>
          <td>${created}</td>
          <td>${actions}</td>
        </tr>`;
    }).join('');
  }

  async function editCoachEmail(id) {
    const el = document.getElementById('admin-coaches-error');
    if (el) el.textContent = '';
    const email = prompt('Nieuw e-mailadres:');
    if (!email) return;
    try {
      await API.put(`/api/admin/coaches/${id}/email`, { email });
      await _loadCoaches();
    } catch (err) {
      if (el) el.textContent = err.message;
    }
  }

  async function toggleCoachBlock(id, currentlyBlocked) {
    const el = document.getElementById('admin-coaches-error');
    if (el) el.textContent = '';
    try {
      await API.put(`/api/admin/coaches/${id}/block`, { blocked: !currentlyBlocked });
      await _loadCoaches();
    } catch (err) {
      if (el) el.textContent = err.message;
    }
  }

  async function removeCoach(id) {
    if (!confirm('Dit coach-account en alle bijbehorende spelers/wedstrijden verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    const el = document.getElementById('admin-coaches-error');
    if (el) el.textContent = '';
    try {
      await API.delete(`/api/admin/coaches/${id}`);
      await _loadCoaches();
    } catch (err) {
      if (el) el.textContent = err.message;
    }
  }

  // ── Coach-overzicht lightbox (teams/spelers/wedstrijden die deze coach zelf
  // heeft aangemaakt — coach_id blijft "aangemaakt door", ook voor gedeelde teams) ──
  function _fmtDate(ts) {
    return new Date(Number(ts)).toLocaleDateString('nl-NL');
  }

  async function viewOverview(id) {
    const coach = _coaches.find(c => c.id === id);
    const titleEl = document.getElementById('coach-overview-title');
    if (titleEl) titleEl.textContent = coach ? `Overzicht — ${coach.name}` : 'Overzicht';
    document.getElementById('coach-overview-modal')?.classList.add('open');

    _overviewTab = 'teams';
    document.querySelectorAll('#coach-overview-tabs .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'teams'));
    const bodyEl = document.getElementById('coach-overview-body');
    if (bodyEl) bodyEl.innerHTML = '<p style="color:var(--text-muted)">Laden…</p>';

    try {
      _overviewData = await API.get(`/api/admin/coaches/${id}/overview`);
      _renderOverviewTab();
    } catch (err) {
      if (bodyEl) bodyEl.innerHTML = `<p class="auth-error">${_esc(err.message)}</p>`;
    }
  }

  function closeOverview() {
    document.getElementById('coach-overview-modal')?.classList.remove('open');
    _overviewData = null;
  }

  function _renderOverviewTab() {
    const el = document.getElementById('coach-overview-body');
    if (!el || !_overviewData) return;
    const rows = _overviewData[_overviewTab] || [];
    if (!rows.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">Niets gevonden.</p>';
      return;
    }
    if (_overviewTab === 'teams') {
      el.innerHTML = rows.map(t => `
        <div class="overview-row">
          <span>${_esc(t.name)}${t.isDefault ? ' <span style="color:var(--text-dim);font-size:.72rem">(standaard)</span>' : ''}</span>
          <span class="overview-date">${_fmtDate(t.createdAt)}</span>
        </div>`).join('');
    } else if (_overviewTab === 'players') {
      el.innerHTML = rows.map(p => `
        <div class="overview-row">
          <span>${_esc(p.name)}</span>
          <span class="overview-meta">${_esc(p.teamName || '—')}</span>
        </div>`).join('');
    } else {
      el.innerHTML = rows.map(m => `
        <div class="overview-row">
          <span>vs ${_esc(m.opponent)}</span>
          <span class="overview-meta">${_esc(m.teamName || '—')} · ${new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL')}</span>
        </div>`).join('');
    }
  }

  return { init, editCoachEmail, toggleCoachBlock, removeCoach, viewOverview, closeOverview };
})();
