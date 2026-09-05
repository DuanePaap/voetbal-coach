const MatchView = (() => {
  function _cardHtml(m) {
    const dateStr = new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    const numPresent = (m.presentPlayers || []).length;
    const times = [];
    if (m.gatherTime) times.push(`🕐 ${m.gatherTime} verzamelen`);
    if (m.matchTime) times.push(`⚽ ${m.matchTime} aftrap`);
    const timesStr = times.length ? ` &bull; ${times.join(' · ')}` : '';
    return `
      <div class="match-card">
        <div class="match-card-info">
          <div class="match-title">vs ${m.opponent}</div>
          <div class="match-meta">${dateStr}${timesStr} &bull; ${numPresent} spelers aanwezig</div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <span class="match-badge ${m.location === 'thuis' ? 'badge-thuis' : 'badge-uit'}">${m.location === 'thuis' ? 'Thuis' : 'Uit'}</span>
            <span class="match-badge ${m.fieldType === 'half' ? 'badge-half' : 'badge-full'}">${m.fieldType === 'half' ? '8-tallen' : '11-tallen'}</span>
            <span class="match-badge" style="background:#e8ecf0;color:#445566">${m.formation || '–'}</span>
            <span class="match-badge" style="background:#e8ecf0;color:#445566">${m.periods || 2}× perioden</span>
            <span class="match-badge" style="background:#e8ecf0;color:#445566">${m.duration || 60}′ &bull; ${m.subMoments || 2}× wisselen</span>
          </div>
        </div>
        <div class="match-card-actions">
          <button class="btn btn-secondary btn-icon" onclick="MatchController.shareViaWhatsapp('${m.id}')" title="Deel via WhatsApp">📤</button>
          <button class="btn btn-secondary btn-icon" onclick="MatchController.edit('${m.id}')" title="Bewerken">✏️</button>
          <button class="btn btn-danger btn-icon" onclick="MatchController.remove('${m.id}')" title="Verwijderen">🗑</button>
        </div>
      </div>`;
  }

  // WhatsApp-tekst voor de oudergroep: datum, thuis/uit + tegenstander, tijden,
  // dan (indien ingevuld) scheids/grensrechter/fruit, dan de aanwezige spelers.
  // Gebruikt dezelfde iconen als het Wedstrijdinfo-paneel elders in de app.
  function buildShareText(match, players) {
    const rawDateStr = new Date(match.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    const dateStr = rawDateStr.replace(/\b\p{L}/gu, ch => ch.toUpperCase());
    const locationLabel = match.location === 'thuis' ? 'Thuis' : 'Uit';

    const lines = [`*${dateStr}*`, `${locationLabel} tegen ${match.opponent}`];
    if (match.gatherTime) lines.push(`🕐 Verzamelen: ${match.gatherTime}`);
    if (match.matchTime) lines.push(`⚽ Aftrap: ${match.matchTime}`);

    const byId = {};
    (players || []).forEach(p => { byId[p.id] = p; });

    const duties = [];
    if (match.refereePlayerId && byId[match.refereePlayerId]) duties.push(`🟨 Scheidsrechter: ${byId[match.refereePlayerId].name}`);
    if (match.linesmanPlayerId && byId[match.linesmanPlayerId]) duties.push(`🚩 Grensrechter: ${byId[match.linesmanPlayerId].name}`);
    if (match.fruitPlayerId && byId[match.fruitPlayerId]) duties.push(`🍊 Teamfruit: ${byId[match.fruitPlayerId].name}`);
    if (duties.length) lines.push('', ...duties);

    const present = (match.presentPlayers || [])
      .map(id => byId[id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (present.length) {
      lines.push('', `*Aanwezige spelers (${present.length}):*`, ...present.map(p => `✅ ${p.name}`));
    }

    return lines.join('\n');
  }

  function renderList(matches, players) {
    const container = document.getElementById('match-list');
    if (!matches.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Nog geen wedstrijden aangemaakt.</p></div>`;
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...matches]
      .filter(m => m.date >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const played = [...matches]
      .filter(m => m.date < today)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = upcoming.map(_cardHtml).join('');

    if (!upcoming.length) {
      html += `<div class="empty-state"><div class="empty-icon">📅</div><p>Geen aankomende wedstrijden.</p></div>`;
    }

    if (played.length) {
      html += `
        <details class="matches-played">
          <summary class="matches-played-summary">
            <span>Gespeeld</span>
            <span class="matches-played-count">${played.length}</span>
          </summary>
          <div class="matches-played-list">
            ${played.map(_cardHtml).join('')}
          </div>
        </details>`;
    }

    container.innerHTML = html;
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

    document.getElementById('match-periods').value = String(match?.periods || 2);
    document.getElementById('match-duration').value = match?.duration || 60;
    document.getElementById('match-sub-moments').value = match?.subMoments || 2;
    document.getElementById('match-gather-time').value = match?.gatherTime || '';
    document.getElementById('match-time').value = match?.matchTime || '';

    _renderFormationOptions(match?.fieldType || 'half', match?.formation);
    _renderPlayerChecklist(players, match?.presentPlayers || []);
    _renderDutySelects(players, match);

    // Update formations when fieldtype changes
    fieldTypeEl.onchange = () => _renderFormationOptions(fieldTypeEl.value, null);

    document.getElementById('match-modal').classList.add('open');
  }

  function _renderFormationOptions(fieldType, selected) {
    const select = document.getElementById('match-formation');
    const options = FormationModel.getOptions(fieldType);
    select.innerHTML = options.map(o => `<option value="${o.key}" ${o.key === selected ? 'selected' : ''}>${o.label}</option>`).join('');
  }

  function _renderDutySelects(players, match) {
    const opts = players.map(p => `<option value="${p.id}">#${p.number || '?'} ${p.name}</option>`).join('');
    [
      ['match-captain', match?.captainPlayerId],
      ['match-fruit', match?.fruitPlayerId],
      ['match-referee', match?.refereePlayerId],
      ['match-linesman', match?.linesmanPlayerId],
    ].forEach(([id, selected]) => {
      const el = document.getElementById(id);
      el.innerHTML = `<option value="">Geen</option>${opts}`;
      el.value = selected || '';
    });
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
      periods: parseInt(document.getElementById('match-periods').value) || 2,
      duration: parseInt(document.getElementById('match-duration').value) || 60,
      subMoments: parseInt(document.getElementById('match-sub-moments').value) || 2,
      gatherTime: document.getElementById('match-gather-time').value || null,
      matchTime: document.getElementById('match-time').value || null,
      captainPlayerId: document.getElementById('match-captain').value || null,
      fruitPlayerId: document.getElementById('match-fruit').value || null,
      refereePlayerId: document.getElementById('match-referee').value || null,
      linesmanPlayerId: document.getElementById('match-linesman').value || null,
    };
  }

  return { renderList, openModal, closeModal, getFormData, buildShareText };
})();
