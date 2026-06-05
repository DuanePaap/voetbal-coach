const MatchModel = (() => {
  const STORAGE_KEY = 'vc_matches';

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function _save(matches) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  }

  function getAll() { return _load(); }

  function getById(id) { return _load().find(m => m.id === id) || null; }

  function save(data) {
    const matches = _load();
    if (data.id) {
      const idx = matches.findIndex(m => m.id === data.id);
      if (idx !== -1) matches[idx] = { ...matches[idx], ...data };
      else matches.push(data);
    } else {
      matches.push({ ...data, id: crypto.randomUUID(), lineup: [], substitutions: [] });
    }
    _save(matches);
  }

  function remove(id) {
    _save(_load().filter(m => m.id !== id));
  }

  function saveLineup(matchId, lineup, substitutions) {
    const matches = _load();
    const idx = matches.findIndex(m => m.id === matchId);
    if (idx !== -1) {
      matches[idx].lineup = lineup;
      matches[idx].substitutions = substitutions;
      _save(matches);
    }
  }

  function toggleNoSub(matchId, playerId) {
    const matches = _load();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    if (!match.noSubPlayers) match.noSubPlayers = [];
    const idx = match.noSubPlayers.indexOf(playerId);
    if (idx === -1) match.noSubPlayers.push(playerId);
    else match.noSubPlayers.splice(idx, 1);
    _save(matches);
    return getById(matchId);
  }

  // Generate fair lineup with substitutions based on match.periods (2 or 4)
  function generateLineup(match, players) {
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    const positions = formation.positions;
    const numOnField = positions.length;
    const present = players.filter(p => match.presentPlayers.includes(p.id));
    const matchMinutes = 60;
    const numPeriods = match.periods || 2;

    if (present.length < numOnField) return null;

    // Score player fit for a position — uses mainPosition + preferredPositions combined
    function score(player, posCode) {
      const prefs = player.preferredPositions || [];
      const all   = new Set([player.mainPosition, ...prefs].filter(Boolean));

      if (posCode === 'GK') return all.has('GK') ? 10 : -20;
      if (all.has('GK') && !all.has(posCode)) return -10; // keeper shouldn't play outfield
      if (player.mainPosition === posCode) return 5;
      if (prefs.includes(posCode)) return 3;
      const grps = [['LB','CB','RB'], ['CDM','LM','CM','RM'], ['CAM','LW','RW','ST']];
      for (const grp of grps) {
        if (grp.includes(posCode) && [...all].some(p => grp.includes(p))) return 1;
      }
      return 0;
    }

    // Greedy assignment: most-restricted positions first (fewest qualified players), GK always first
    function assignPlayers(availablePlayers, posList) {
      const used = new Set();
      const assignment = [];
      const sorted = [...posList].sort((a, b) => {
        if (a.code === 'GK') return -1;
        if (b.code === 'GK') return 1;
        const qa = availablePlayers.filter(p => score(p, a.code) > 0).length;
        const qb = availablePlayers.filter(p => score(p, b.code) > 0).length;
        return qa - qb; // fewer qualified → assign first
      });
      for (const pos of sorted) {
        let best = null, bestScore = -Infinity;
        for (const p of availablePlayers) {
          if (used.has(p.id)) continue;
          const s = score(p, pos.code);
          if (s > bestScore) { bestScore = s; best = p; }
        }
        if (best) { assignment.push({ player: best, pos }); used.add(best.id); }
      }
      return assignment;
    }

    // Substitution moments: evenly spaced based on numPeriods
    const periodLen = matchMinutes / numPeriods;
    const subMinutes = [];
    for (let i = 1; i < numPeriods; i++) subMinutes.push(Math.round(i * periodLen));

    const noSub = new Set(match.noSubPlayers || []);
    const noSubPresent = present.filter(p => noSub.has(p.id));
    const subEligible  = present.filter(p => !noSub.has(p.id));
    const slotsForSubs = numOnField - noSubPresent.length;

    if (present.length === numOnField) {
      const assignment = assignPlayers(present, positions);
      const lineup = assignment.map(({ player, pos }) => ({
        playerId: player.id, positionCode: pos.code, positionIndex: positions.indexOf(pos),
        startMinute: 0, endMinute: matchMinutes,
      }));
      return { lineup, substitutions: [] };
    }

    // Sort sub-eligible: best peak fit → starters (max score for any single position)
    // Using max prevents multi-position players from outranking a specialist (e.g. GK)
    const sortedByFit = [...subEligible].sort((a, b) => {
      const aFit = Math.max(...positions.map(p => score(a, p.code)));
      const bFit = Math.max(...positions.map(p => score(b, p.code)));
      return bFit - aFit;
    });

    const fieldStarters = [...noSubPresent, ...sortedByFit.slice(0, slotsForSubs)];
    const benchQueue    = sortedByFit.slice(slotsForSubs);

    // Spread bench players evenly across sub moments (round-robin)
    const subAssignments = subMinutes.map(() => []);
    benchQueue.forEach((p, i) => subAssignments[i % subMinutes.length].push(p));

    const lineupMap = {};

    // All starters: full-match slots, trimmed when subbed off
    const starterAssignment = assignPlayers(fieldStarters, positions);
    starterAssignment.forEach(({ player, pos }) => {
      lineupMap[player.id] = [{
        startMinute: 0, endMinute: matchMinutes,
        positionCode: pos.code, positionIndex: positions.indexOf(pos),
      }];
    });

    const substitutions = [];
    let currentField = [...fieldStarters];

    subMinutes.forEach((minute, momentIdx) => {
      const incoming = subAssignments[momentIdx];
      const addedThisRound = new Set(); // prevent immediately subbing off a just-added player

      incoming.forEach(benchPlayer => {
        // Pick worst-fit non-no-sub field player; skip players added this round
        let worstFit = null, worstScore = Infinity;
        for (const fp of currentField) {
          if (noSub.has(fp.id) || addedThisRound.has(fp.id)) continue;
          const s = score(fp, lineupMap[fp.id]?.slice(-1)[0]?.positionCode || '');
          if (s < worstScore) { worstScore = s; worstFit = fp; }
        }
        const playerOut = worstFit || currentField.find(p => !noSub.has(p.id) && !addedThisRound.has(p.id));
        if (!playerOut) return;

        const outSlot = lineupMap[playerOut.id]?.slice(-1)[0];
        if (outSlot) outSlot.endMinute = minute;

        substitutions.push({ minute, playerOut: playerOut.id, playerIn: benchPlayer.id });

        lineupMap[benchPlayer.id] = [{
          startMinute: minute, endMinute: matchMinutes,
          positionCode: outSlot?.positionCode || positions[0].code,
          positionIndex: outSlot?.positionIndex ?? 0,
        }];

        currentField = currentField.filter(p => p.id !== playerOut.id);
        currentField.push(benchPlayer);
        addedThisRound.add(benchPlayer.id);
      });
    });

    const lineup = [];
    Object.entries(lineupMap).forEach(([playerId, slots]) => {
      slots.forEach(slot => lineup.push({ playerId, ...slot }));
    });

    return { lineup, substitutions };
  }

  function savePositionOverride(matchId, positionIndex, x, y) {
    const matches = _load();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    if (!match.positionOverrides) match.positionOverrides = {};
    match.positionOverrides[String(positionIndex)] = { x: Math.round(x), y: Math.round(y) };
    _save(matches);
  }

  // Rebuild lineup slots from initial starters + current substitutions list
  function rebuildLineupFromSubs(matchId) {
    const match = getById(matchId);
    if (!match?.lineup?.length) return null;
    const matchMinutes = 60;

    const initialSlots = match.lineup.filter(l => l.startMinute === 0);
    const lineupMap = {};
    initialSlots.forEach(slot => {
      lineupMap[slot.playerId] = [{
        startMinute: 0, endMinute: matchMinutes,
        positionCode: slot.positionCode, positionIndex: slot.positionIndex,
      }];
    });

    const subs = [...(match.substitutions || [])].sort((a, b) => a.minute - b.minute);
    subs.forEach(sub => {
      const outSlots = lineupMap[sub.playerOut];
      if (!outSlots) return;
      const outSlot = outSlots[outSlots.length - 1];
      if (!outSlot || outSlot.endMinute <= sub.minute) return;
      outSlot.endMinute = sub.minute;

      if (!lineupMap[sub.playerIn]) lineupMap[sub.playerIn] = [];
      lineupMap[sub.playerIn].push({
        startMinute: sub.minute, endMinute: matchMinutes,
        positionCode: outSlot.positionCode, positionIndex: outSlot.positionIndex,
      });
    });

    const lineup = [];
    Object.entries(lineupMap).forEach(([playerId, slots]) => {
      slots.forEach(slot => lineup.push({ playerId, ...slot }));
    });

    const matches = _load();
    const idx = matches.findIndex(m => m.id === matchId);
    if (idx !== -1) { matches[idx].lineup = lineup; _save(matches); }
    return getById(matchId);
  }

  // Change playerOut / playerIn for a specific substitution and rebuild lineup
  function overrideSubstitution(matchId, subIdx, playerOut, playerIn) {
    const matches = _load();
    const match = matches.find(m => m.id === matchId);
    if (!match?.substitutions?.[subIdx]) return null;
    match.substitutions[subIdx] = { ...match.substitutions[subIdx], playerOut, playerIn };
    _save(matches);
    return rebuildLineupFromSubs(matchId);
  }

  function clearPositionOverrides(matchId) {
    const matches = _load();
    const match = matches.find(m => m.id === matchId);
    if (match) { match.positionOverrides = {}; _save(matches); }
  }

  return { getAll, getById, save, remove, saveLineup, toggleNoSub, savePositionOverride, clearPositionOverrides, generateLineup, overrideSubstitution };
})();
