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
    const numSubs = (match.substitutions || []).length;
    const subBadge = numSubs > 0
      ? `<span class="sub-count">⇄ ${numSubs} wissel${numSubs !== 1 ? 's' : ''}</span>`
      : '<span style="color:#aaa;font-size:.75rem">Geen wissels</span>';
    el.innerHTML = `
      <strong>vs ${match.opponent}</strong><br>
      ${new Date(match.date + 'T00:00:00').toLocaleDateString('nl-NL')}<br>
      <span style="color:#666">${numPresent} aanwezig / ${numPositions} posities · ${match.fieldType === 'half' ? 'Halve veld' : 'Heel veld'}</span><br>
      ${subBadge}
    `;
  }

  function renderNoSubPicker(match, players) {
    const el = document.getElementById('no-sub-section');
    if (!match?.presentPlayers?.length) { el.innerHTML = ''; return; }
    const noSub = new Set(match.noSubPlayers || []);
    const present = players.filter(p => (match.presentPlayers || []).includes(p.id));
    const rows = present.map(p => {
      const isLocked = noSub.has(p.id);
      const mainPos = (p.preferredPositions || [])[0] || '–';
      return `
        <div class="no-sub-row">
          <span class="no-sub-name">${p.name.split(' ')[0]}</span>
          <span class="no-sub-pos">${mainPos}</span>
          <button class="lock-btn${isLocked ? ' locked' : ''}"
            onclick="LineupController.toggleNoSub('${p.id}')"
            title="${isLocked ? 'Wissel toestaan' : 'Geen wissel'}">
            ${isLocked ? '🔒' : '🔓'}
          </button>
        </div>`;
    }).join('');
    el.innerHTML = rows;
  }

  function renderPeriodNav(match, currentMinute = 0) {
    const el = document.getElementById('period-nav');
    if (!match?.lineup?.length) { el.innerHTML = ''; return; }
    const minutes = [0, ...(match.substitutions || []).map(s => s.minute)];
    const unique = [...new Set(minutes)].sort((a, b) => a - b);
    const activeMin = unique.includes(currentMinute) ? currentMinute : unique[0];
    const buttons = unique.map(min =>
      `<button class="period-btn${min === activeMin ? ' active' : ''}" data-minute="${min}" onclick="LineupController.showMinute(${min}, this)">
        ${min === 0 ? 'Start' : min + "'"}
      </button>`).join('');
    el.innerHTML = buttons;
  }

  function renderSubstitutionTimeline(match, players) {
    const container = document.getElementById('substitution-timeline');
    if (!match?.substitutions?.length) {
      container.innerHTML = '<p style="font-size:.8rem;color:#aaa">Geen wissels gepland.</p>';
      return;
    }
    const present = (match.presentPlayers || []).map(id => players.find(p => p.id === id)).filter(Boolean);
    const rows = match.substitutions.map(sub => `
      <div class="sub-row">
        <span class="sub-arrow">↓</span> ${present.find(p=>p.id===sub.playerOut)?.name?.split(' ')[0]||'?'}
        <span class="sub-arrow">↑</span> ${present.find(p=>p.id===sub.playerIn)?.name?.split(' ')[0]||'?'}
        <small style="margin-left:auto;color:#888">${sub.minute}'</small>
      </div>`).join('');
    container.innerHTML = rows;
  }

  // Editable "wie staat in welk blokje" matrix — players × wisselmomenten. `grid`
  // (one Set<playerId> per segment) and `pins` (one Map<playerId, boolean> per
  // segment, for locked cells) are owned by the controller; this function only
  // renders them and wires click handlers back to LineupController. Tap cycle per
  // cell: uit → aan → aan+vast (📌) → uit+vast (📌) → uit.
  function renderSwitchMatrix(match, players, segmentInfo, grid, pins) {
    const el = document.getElementById('switch-matrix');
    if (!el) return;
    const { numSegments, bounds, noSubPresent, subEligible, required } = segmentInfo;

    if (numSegments < 2 || subEligible.length <= required) { el.innerHTML = ''; return; }

    const header = bounds.slice(0, -1).map(min =>
      `<span class="matrix-col-label">${min}'</span>`).join('');

    const rows = subEligible.map(p => {
      const cells = grid.map((segSet, i) => {
        const on = segSet.has(p.id);
        const isPinned = pins[i].has(p.id);
        const cls = ['matrix-cell', on ? 'on' : '', isPinned ? 'pinned' : ''].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" onclick="LineupController.toggleMatrixCell(${i}, '${p.id}')" title="${isPinned ? 'Vergrendeld — tik om te ontgrendelen' : 'Tik om te wisselen, nogmaals tikken = vergrendelen'}"></button>`;
      }).join('');
      return `<div class="matrix-row"><span class="matrix-name">${p.name.split(' ')[0]}</span>${cells}</div>`;
    }).join('');

    const badCols = grid.reduce((n, s) => n + (s.size !== required ? 1 : 0), 0);
    const counts = grid.map(s =>
      `<span class="matrix-count${s.size !== required ? ' bad' : ''}">${s.size}/${required}</span>`).join('');

    el.innerHTML = `
      <h4>Wie staat wanneer? <span class="matrix-hint-inline">(tik voor aan/uit, nogmaals = 📌 vast)</span></h4>
      <div class="matrix-grid" style="--matrix-cols:${numSegments}">
        <div class="matrix-row matrix-header"><span class="matrix-name"></span>${header}</div>
        ${rows}
        <div class="matrix-row matrix-footer"><span class="matrix-name">Op veld</span>${counts}</div>
      </div>
      ${noSubPresent.length ? `<p class="matrix-hint">🔒 ${noSubPresent.map(p => p.name.split(' ')[0]).join(', ')} sta${noSubPresent.length === 1 ? 'at' : 'an'} altijd op het veld.</p>` : ''}
      <p class="matrix-hint">📌 Vergrendelen wordt direct opgeslagen en blijft staan na een nieuwe "Genereer opstelling". Klik op Toepassen om de opstelling zelf bij te werken.</p>
      <button type="button" class="btn btn-primary matrix-apply" onclick="LineupController.applyMatrix()" ${badCols ? 'disabled' : ''}>
        ${badCols ? `✓ Toepassen (${badCols} blok${badCols !== 1 ? 'ken' : ''} klopt niet)` : '✓ Toepassen'}
      </button>`;
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

    container.innerHTML = rows;
  }

  function getPositionsAtMinute(match, players, formation, minute) {
    const positions = formation?.positions || [];
    const overrides = match.positionOverrides || {};
    return positions.map((pos, i) => {
      const slot   = (match.lineup || []).find(l => l.positionIndex === i && l.startMinute <= minute && l.endMinute > minute);
      const player = slot ? players.find(p => p.id === slot.playerId) : null;
      const ov     = overrides[String(i)];
      const n      = (player?.preferredPositions || []).length;
      return {
        positionCode: pos.code,
        x: ov?.x ?? pos.x,
        y: ov?.y ?? pos.y,
        positionIndex: i,
        playerId:      player?.id,
        playerName:    player?.name,
        playerNumber:  player?.number,
        playerPhoto:   player?.photo || null,
        tier: n >= 3 ? 'gold' : n >= 1 ? 'silver' : 'bronze',
        ovr:  player?.number || null,
      };
    });
  }

  return { populateMatchSelect, renderInfo, renderNoSubPicker, renderPeriodNav, renderSubstitutionTimeline, renderSwitchMatrix, renderBench, getPositionsAtMinute };
})();
