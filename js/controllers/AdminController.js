const AdminController = (() => {
  let _savedImage  = null;
  let _pendingImage = null;

  async function init() {
    await _load();
    _bindEvents();
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

  return { init };
})();
