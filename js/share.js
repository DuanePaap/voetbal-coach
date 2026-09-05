(() => {
  let _match = null;
  let _minute = 0;

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  async function _load() {
    const token = new URLSearchParams(location.search).get('t');
    const content = document.getElementById('share-content');
    if (!token) return _showMessage('Deze link is ongeldig.');

    let res;
    try {
      res = await fetch(`/api/share/${encodeURIComponent(token)}`);
    } catch {
      return _showMessage('Kan de opstelling niet laden. Controleer je internetverbinding.');
    }

    let data;
    try { data = await res.json(); } catch { data = null; }

    if (res.status === 404) return _showMessage('Deze link is ongeldig.');
    if (res.status === 410) return _showMessage('Deze opstelling is niet meer beschikbaar. Links zijn geldig tot en met de dag van de wedstrijd.');
    if (!res.ok) return _showMessage(data?.error || 'Er ging iets mis bij het laden van de opstelling.');

    _match = data;
    _renderInfo();
    _renderShell(content);
    _renderPeriodNav();
    _renderField();
    _renderSubs();
  }

  function _showMessage(text) {
    document.getElementById('share-content').innerHTML = `<p class="share-message">${_esc(text)}</p>`;
  }

  function _renderInfo() {
    const el = document.getElementById('share-match-info');
    const dateStr = new Date(_match.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    el.innerHTML = `<strong>vs ${_esc(_match.opponent)}</strong><span>${_esc(dateStr)}</span>`;
  }

  function _renderShell(content) {
    content.innerHTML = `
      <div id="share-period-nav" class="period-nav"></div>
      <div class="lineup-field-wrapper">
        <svg id="share-lineup-field" class="field-svg" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
      <div id="share-subs" class="share-subs-panel"></div>`;
  }

  // Same FC26 position colors as FieldView's on-field markers, so the mini avatars
  // in the substitution list match the field exactly.
  function _posColor(code) {
    if (code === 'GK')                     return '#f59e0b';
    if (['CB','LB','RB'].includes(code))   return '#3b82f6';
    if (['CDM'].includes(code))            return '#06b6d4';
    if (['CM','LM','RM'].includes(code))   return '#10b981';
    if (['CAM'].includes(code))            return '#a855f7';
    if (['LW','RW','ST'].includes(code))   return '#ef4444';
    return '#64748b';
  }

  function _initials(name) {
    return (name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function _miniAvatar(player, positionCode) {
    const col = _posColor(positionCode);
    const inner = player?.photo
      ? `<img src="${_esc(player.photo)}" alt="">`
      : `<span class="share-mini-initials">${_esc(_initials(player?.name))}</span>`;
    return `<span class="share-mini-avatar" style="border-color:${col}">${inner}</span>`;
  }

  function _renderSubs() {
    const el = document.getElementById('share-subs');
    if (!el) return;
    const subs = _match.substitutions || [];
    if (!subs.length) { el.innerHTML = ''; return; }

    const playerById = {};
    (_match.players || []).forEach(p => { playerById[p.id] = p; });

    const lineup = _match.lineup || [];
    const rows = [...subs].sort((a, b) => a.minute - b.minute).map(sub => {
      const outPos = lineup.find(l => l.playerId === sub.playerOut && l.endMinute === sub.minute)?.positionCode;
      const inPos  = lineup.find(l => l.playerId === sub.playerIn  && l.startMinute === sub.minute)?.positionCode;
      const pOut = playerById[sub.playerOut];
      const pIn  = playerById[sub.playerIn];
      return `
        <div class="share-sub-row">
          <span class="share-sub-minute">${sub.minute}'</span>
          <span class="share-sub-player">
            ${_miniAvatar(pOut, outPos)}
            <span class="share-sub-name">${_esc(pOut?.name?.split(' ')[0] || '?')}</span>
            <span class="share-sub-arrow share-sub-out">↓</span>
          </span>
          <span class="share-sub-player">
            ${_miniAvatar(pIn, inPos)}
            <span class="share-sub-name">${_esc(pIn?.name?.split(' ')[0] || '?')}</span>
            <span class="share-sub-arrow share-sub-in">↑</span>
          </span>
        </div>`;
    }).join('');

    el.innerHTML = `<h4>Wissels</h4>${rows}`;
  }

  function _renderPeriodNav() {
    const el = document.getElementById('share-period-nav');
    if (!_match.lineup?.length) { el.innerHTML = ''; return; }
    const minutes = [0, ...(_match.substitutions || []).map(s => s.minute)];
    const unique = [...new Set(minutes)].sort((a, b) => a - b);
    el.innerHTML = unique.map((min, i) =>
      `<button class="period-btn${i === 0 ? ' active' : ''}" data-minute="${min}">${min === 0 ? 'Start' : min + "'"}</button>`
    ).join('');
    el.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _minute = parseInt(btn.dataset.minute, 10);
        el.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderField();
      });
    });
  }

  function _renderField() {
    const svgEl = document.getElementById('share-lineup-field');
    const formation = FormationModel.getFormation(_match.fieldType, _match.formation);
    if (!formation) { FieldView.render(svgEl, [], _match.fieldType || 'half', null, { cardMode: true }); return; }
    const positions = LineupView.getPositionsAtMinute(_match, _match.players, formation, _minute);
    FieldView.render(svgEl, positions, _match.fieldType, null, { cardMode: true, draggable: false });
  }

  document.addEventListener('DOMContentLoaded', _load);
})();
