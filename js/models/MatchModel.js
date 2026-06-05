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

  // Generate fair lineup with substitutions
  // Returns { lineup: [{playerId, positionCode, positionIndex}], substitutions: [{minute, playerOut, playerIn}], periods: [...] }
  function generateLineup(match, players) {
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    const positions = formation.positions;
    const numOnField = positions.length; // 8 or 11
    const present = players.filter(p => match.presentPlayers.includes(p.id));
    const totalMinutes = 60; // standard match length in minutes
    const halfTime = 30;

    if (present.length < numOnField) return null;

    // Score each player for each position (higher = better fit)
    function score(player, posCode) {
      if (player.preferredPositions && player.preferredPositions.includes(posCode)) return 2;
      // GK can only go in GK
      if (posCode === 'GK') return player.preferredPositions?.includes('GK') ? 2 : -10;
      if (player.preferredPositions?.includes('GK')) return -5; // keeper shouldn't play other positions if possible
      return 0;
    }

    // Greedy assignment: fill positions greedily by best score
    function assignPlayers(availablePlayers, positionList) {
      const used = new Set();
      const assignment = [];
      // Sort positions: GK first
      const sorted = [...positionList].sort((a, b) => (a.code === 'GK' ? -1 : b.code === 'GK' ? 1 : 0));
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

    if (present.length === numOnField) {
      // Exact fit, no subs needed
      const assignment = assignPlayers(present, positions);
      const lineup = assignment.map(({ player, pos }, i) => ({
        playerId: player.id, positionCode: pos.code, positionIndex: i,
        startMinute: 0, endMinute: totalMinutes,
      }));
      return { lineup, substitutions: [], periods: [] };
    }

    // More players than field spots — plan substitutions
    const numSubs = present.length - numOnField;
    const minutesPerPeriod = Math.floor(totalMinutes / (numSubs + 1));

    // Distribute minutes fairly
    // Split into periods, each period rotate one player out
    const periods = [];
    let startMinute = 0;
    for (let i = 0; i <= numSubs; i++) {
      const end = i === numSubs ? totalMinutes : startMinute + minutesPerPeriod;
      periods.push({ start: startMinute, end });
      startMinute = end;
    }

    // Assign bench rotation: players with least preferred positions on bench first
    const sortedByFit = [...present].sort((a, b) => {
      const aFit = positions.filter(p => (a.preferredPositions || []).includes(p.code)).length;
      const bFit = positions.filter(p => (b.preferredPositions || []).includes(p.code)).length;
      return aFit - bFit; // worst fit first on bench
    });

    // Bench players cycle through; each period one bench player swaps with a field player
    const benchQueue = sortedByFit.slice(numOnField);
    const fieldStarters = sortedByFit.slice(0, numOnField);

    const lineupMap = {}; // playerId -> [{start, end, positionCode, positionIndex}]

    // Period 0: all starters on field
    const starterAssignment = assignPlayers(fieldStarters, positions);
    starterAssignment.forEach(({ player, pos }, i) => {
      lineupMap[player.id] = [{ start: 0, end: periods[0].end, positionCode: pos.code, positionIndex: i }];
    });

    const substitutions = [];
    let currentField = [...fieldStarters];

    benchQueue.forEach((benchPlayer, idx) => {
      if (idx >= periods.length - 1) return;
      const period = periods[idx + 1];

      // Pick field player to sub out: prefer least fit for their position
      let worstFit = null, worstScore = Infinity;
      for (const fp of currentField) {
        if (fp.id === lineupMap[fp.id]?.[0]?.positionCode === 'GK' && (fp.preferredPositions || []).includes('GK')) continue;
        const curPos = lineupMap[fp.id]?.slice(-1)[0]?.positionCode || '';
        const s = score(fp, curPos);
        if (s < worstScore) { worstScore = s; worstFit = fp; }
      }
      const playerOut = worstFit || currentField[0];
      const outPos = lineupMap[playerOut.id]?.slice(-1)[0];
      if (outPos) outPos.end = period.start;

      substitutions.push({ minute: period.start, playerOut: playerOut.id, playerIn: benchPlayer.id });

      // Assign bench player to that position
      lineupMap[benchPlayer.id] = lineupMap[benchPlayer.id] || [];
      lineupMap[benchPlayer.id].push({
        start: period.start, end: period.end,
        positionCode: outPos?.positionCode || positions[0].code,
        positionIndex: outPos?.positionIndex ?? 0,
      });

      currentField = currentField.filter(p => p.id !== playerOut.id);
      currentField.push(benchPlayer);
    });

    // Flatten lineupMap to array
    const lineup = [];
    Object.entries(lineupMap).forEach(([playerId, slots]) => {
      slots.forEach(slot => lineup.push({ playerId, ...slot }));
    });

    return { lineup, substitutions, periods };
  }

  return { getAll, getById, save, remove, saveLineup, generateLineup };
})();
