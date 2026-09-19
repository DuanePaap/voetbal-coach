(() => {
  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  async function _loadContent() {
    const el = document.getElementById('about-content');
    try {
      const res = await fetch('/api/about');
      const data = await res.json();
      const paragraphs = (data.content || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      el.innerHTML = paragraphs.length
        ? paragraphs.map(p => `<p>${_esc(p).replace(/\n/g, '<br>')}</p>`).join('')
        : '<p>Meer informatie volgt binnenkort.</p>';
    } catch {
      el.innerHTML = '<p>Kan de inhoud niet laden. Controleer je internetverbinding.</p>';
    }
  }

  function _bindContactForm() {
    document.getElementById('form-contact').addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('contact-error');
      const success = document.getElementById('contact-success');
      err.textContent = '';
      success.style.display = 'none';

      const name = document.getElementById('contact-name').value;
      const email = document.getElementById('contact-email').value;
      const message = document.getElementById('contact-message').value;

      try {
        const res = await fetch('/api/about/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Versturen is mislukt');
        success.style.display = 'block';
        document.getElementById('form-contact').reset();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    _loadContent();
    _bindContactForm();
  });
})();
