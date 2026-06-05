const LineupView = (() => {
  function populateMatchSelect(matches) {
    const select = document.getElementById('lineup-match-select');
    if (!matches.length) {
      select.innerHTML = '<option value="">Geen wedstrijden</option>';
      return;
    }
    const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    select.innerHTML = sorted.map(m => `<option value="${m.id}">${new Date(m.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} vs ${m.opponent}</option>`).join('');
  }

  function renderInfo(match, players) {
    const el = document.getElementById('lineup-info');
    if (!match) { el.innerHTML = ''; return; }
    const numPresent = (match.presentPlayers || []).length;
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    const numPositions = formation?.positions?.length || '?';
    el.innerHTML = `
      <strong>vs ${match.opponent}</strong><br>
      ${new Date(match.date + 'T00:00:00').toLocaleDateString('nl-NL')}<br>
      <span style="color:#666">${numPresent} aanwezig / ${numPositions} veld posities · ${match.fieldType === 'half' ? 'Halve veld' : 'Heel veld'}</span>
    `;
  }

  function renderSubstitutionTimeline(match, players) {
    const container = document.getElementById('substitution-timeline');
    if (!match?.substitutions?.length) {
      container.innerHTML = '<h4>Wissels</h4><p style="font-size:.8rem;color:#aaa">Geen wissels gepland.</p>';
      return;
    }
    const playerName = id => players.find(p => p.id === id)?.name?.split(' ')[0] || '?';
    const rows = match.substitutions.map(sub => `
      <div class="sub-row">
        <span class="sub-arrow">↓</span> ${playerName(sub.playerOut)}
        <span class="sub-arrow">↑</span> ${playerName(sub.playerIn)}
        <small style="margin-left:auto;color:#888">${sub.minute}'</small>
      </div>`).join('');
    container.innerHTML = `<h4>Wissels</h4>${rows}`;
  }

  function renderBench(match, players) {
    const container = document.getElementById('bench-list');
    if (!match) { container.innerHTML = ''; return; }

    // Calculate bench players: those not starting (not in lineup at minute 0)
    const starters = new Set((match.lineup || []).filter(l => l.startMinute === 0).map(l => l.playerId));
    const present = players.filter(p => (match.presentPlayers || []).includes(p.id));
    const bench = present.filter(p => !starters.has(p.id));

    // Calculate total minutes each player is on the field
    const minutesOn = {};
    (match.lineup || []).forEach(l => {
      minutesOn[l.playerId] = (minutesOn[l.playerId] || 0) + (l.endMinute - l.startMinute);
    });

    const rows = present.map(p => {
      const mins = minutesOn[p.id] || 0;
      const isStarter = starters.has(p.id);
      return `
        <div class="bench-row">
          <span>${p.name.split(' ')[0]}</span>
          <span class="bench-minutes">${mins}'${isStarter ? ' 🟢' : ' 🔄'}</span>
        </div>`;
    }).join('');

    container.innerHTML = `<h4>Speeltijden</h4>${rows}`;
  }

  // Build positions array for FieldView from match lineup at a given minute
  function getPositionsAtMinute(match, players, formation, minute) {
    const positions = formation?.positions || [];
    return positions.map((pos, i) => {
      const slot = (match.lineup || []).find(l => l.positionIndex === i && l.startMinute <= minute && l.endMinute > minute);
      const player = slot ? players.find(p => p.id === slot.playerId) : null;
      return { positionCode: pos.code, x: pos.x, y: pos.y, playerId: player?.id, playerName: player?.name };
    });
  }

  return { populateMatchSelect, renderInfo, renderSubstitutionTimeline, renderBench, getPositionsAtMinute };
})();
