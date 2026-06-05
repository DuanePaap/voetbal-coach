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
    el.innerHTML = `<h4>Geen wissel</h4>${rows}`;
  }

  function renderPeriodNav(match) {
    const el = document.getElementById('period-nav');
    if (!match?.lineup?.length) { el.innerHTML = ''; return; }
    const minutes = [0, ...(match.substitutions || []).map(s => s.minute)];
    const unique = [...new Set(minutes)].sort((a, b) => a - b);
    const buttons = unique.map((min, i) =>
      `<button class="period-btn${i === 0 ? ' active' : ''}" data-minute="${min}" onclick="LineupController.showMinute(${min}, this)">
        ${min === 0 ? 'Start' : min + "'"}
      </button>`).join('');
    el.innerHTML = buttons;
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
        playerId:  player?.id,
        playerName: player?.name,
        playerNumber: player?.number,
        tier: n >= 3 ? 'gold' : n >= 1 ? 'silver' : 'bronze',
        ovr:  player?.number ? Math.min(99, player.number) : Math.min(99, 60 + n * 9),
      };
    });
  }

  return { populateMatchSelect, renderInfo, renderNoSubPicker, renderPeriodNav, renderSubstitutionTimeline, renderBench, getPositionsAtMinute };
})();
