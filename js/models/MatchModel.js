const MatchModel = (() => {
  async function getAll()    { return API.get('/api/matches'); }
  async function getById(id) { return API.get(`/api/matches/${id}`); }
  async function save(data)  { return data.id ? API.put(`/api/matches/${data.id}`, data) : API.post('/api/matches', data); }
  async function remove(id)  { return API.delete(`/api/matches/${id}`); }

  async function saveLineup(matchId, lineup, substitutions) {
    const m = await getById(matchId);
    return save({ ...m, lineup, substitutions });
  }

  async function toggleNoSub(matchId, playerId) {
    const m = await getById(matchId);
    const noSub = [...(m.noSubPlayers || [])];
    const i = noSub.indexOf(playerId);
    if (i === -1) noSub.push(playerId); else noSub.splice(i, 1);
    return save({ ...m, noSubPlayers: noSub });
  }

  async function savePositionOverride(matchId, positionIndex, x, y) {
    const m = await getById(matchId);
    const overrides = { ...(m.positionOverrides || {}) };
    overrides[String(positionIndex)] = { x: Math.round(x), y: Math.round(y) };
    return save({ ...m, positionOverrides: overrides });
  }

  async function clearPositionOverrides(matchId) {
    const m = await getById(matchId);
    return save({ ...m, positionOverrides: {} });
  }

  async function swapLineupPlayers(matchId, posIndexA, posIndexB, minute) {
    const m = await getById(matchId);
    if (!m?.lineup) return null;
    const lineup = m.lineup.map(l => ({ ...l }));
    const slotA = lineup.find(l => l.positionIndex === posIndexA && l.startMinute <= minute && l.endMinute > minute);
    const slotB = lineup.find(l => l.positionIndex === posIndexB && l.startMinute <= minute && l.endMinute > minute);
    if (!slotA || !slotB) return null;
    [slotA.playerId, slotB.playerId] = [slotB.playerId, slotA.playerId];
    return save({ ...m, lineup });
  }

  async function _rebuildLineupFromMatch(m) {
    if (!m?.lineup?.length) return m;
    const matchMinutes = m.duration || 60;
    const initialSlots = m.lineup.filter(l => l.startMinute === 0);
    const lineupMap = {};
    initialSlots.forEach(slot => {
      lineupMap[slot.playerId] = [{
        startMinute: 0, endMinute: matchMinutes,
        positionCode: slot.positionCode, positionIndex: slot.positionIndex,
      }];
    });
    const subs = [...(m.substitutions || [])].sort((a, b) => a.minute - b.minute);
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
    Object.entries(lineupMap).forEach(([playerId, slots]) => slots.forEach(slot => lineup.push({ playerId, ...slot })));
    return save({ ...m, lineup });
  }

  async function overrideSubstitution(matchId, subIdx, playerOut, playerIn) {
    const m = await getById(matchId);
    if (!m?.substitutions?.[subIdx]) return null;
    const subs = [...m.substitutions];
    subs[subIdx] = { ...subs[subIdx], playerOut, playerIn };
    return _rebuildLineupFromMatch({ ...m, substitutions: subs });
  }

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
    if (all.size > 0) return -5;
    return 0; // No preferences at all → last-resort flexible fill
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

  // Generate a fair lineup: the match is split into match.subMoments equal segments
  // (decoupled from match.periods, which is purely rustmomenten for display). Every
  // sub-eligible player rotates through the bench so total playing time stays as
  // equal as possible, with substitutions spread across every segment boundary.
  function generateLineup(match, players) {
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    const positions = formation.positions;
    const numOnField = positions.length;
    const present = players.filter(p => match.presentPlayers.includes(p.id));
    const matchMinutes = match.duration || 60;
    const numSegments = match.subMoments || 2;

    if (present.length < numOnField) return null;

    const segLen = matchMinutes / numSegments;
    const segmentBounds = [0];
    for (let i = 1; i < numSegments; i++) segmentBounds.push(Math.round(i * segLen));
    segmentBounds.push(matchMinutes);

    const noSub = new Set(match.noSubPlayers || []);
    const noSubPresent = present.filter(p => noSub.has(p.id));
    const subEligible  = present.filter(p => !noSub.has(p.id));
    const slotsForSubs = numOnField - noSubPresent.length;

    // Sort sub-eligible: best peak fit first → they form the initial XI
    const sortedByFit = [...subEligible].sort((a, b) => {
      const aFit = Math.max(...positions.map(p => score(a, p.code)));
      const bFit = Math.max(...positions.map(p => score(b, p.code)));
      return bFit - aFit;
    });

    const n = sortedByFit.length;
    const sitOutPerSegment = Math.max(0, n - slotsForSubs);

    if (sitOutPerSegment === 0) {
      // Everyone fits on the field at once — no rotation needed
      const assignment = assignPlayers(present, positions);
      const lineup = assignment.map(({ player, pos }) => ({
        playerId: player.id, positionCode: pos.code, positionIndex: positions.indexOf(pos),
        startMinute: 0, endMinute: matchMinutes,
      }));
      return { lineup, substitutions: [] };
    }

    // Who's on the field for each segment: rotate the sit-out window through the
    // whole squad so every player sits out (roughly) the same number of segments.
    const segmentsOnField = [];
    let cursor = slotsForSubs % n;
    for (let s = 0; s < numSegments; s++) {
      const sitOut = new Set();
      for (let k = 0; k < sitOutPerSegment; k++) sitOut.add(sortedByFit[(cursor + k) % n].id);
      cursor = (cursor + sitOutPerSegment) % n;
      segmentsOnField.push(sortedByFit.filter(p => !sitOut.has(p.id)));
    }

    // Segment 0: fresh greedy assignment for the initial XI
    const lineupMap = {};
    const currentPos = {}; // playerId -> { code, index }
    const initialAssignment = assignPlayers([...noSubPresent, ...segmentsOnField[0]], positions);
    initialAssignment.forEach(({ player, pos }) => {
      const positionIndex = positions.indexOf(pos);
      currentPos[player.id] = { code: pos.code, index: positionIndex };
      lineupMap[player.id] = [{ startMinute: segmentBounds[0], endMinute: segmentBounds[1], positionCode: pos.code, positionIndex }];
    });

    const substitutions = [];

    for (let s = 1; s < numSegments; s++) {
      const start = segmentBounds[s];
      const end = segmentBounds[s + 1];
      const prevIds = new Set(segmentsOnField[s - 1].map(p => p.id));
      const currIds = new Set(segmentsOnField[s].map(p => p.id));

      // Players continuing from the previous segment simply extend their slot
      const continuing = [...noSubPresent, ...segmentsOnField[s].filter(p => prevIds.has(p.id))];
      continuing.forEach(p => {
        const last = lineupMap[p.id].slice(-1)[0];
        if (last.endMinute === start) last.endMinute = end;
        else lineupMap[p.id].push({ startMinute: start, endMinute: end, positionCode: last.positionCode, positionIndex: last.positionIndex });
      });

      // Match each leaving player's vacated position to the best-fit entering player
      const leaving  = segmentsOnField[s - 1].filter(p => !currIds.has(p.id));
      const entering = [...segmentsOnField[s].filter(p => !prevIds.has(p.id))];

      leaving.forEach(playerOut => {
        const vacated = currentPos[playerOut.id];
        let bestIdx = -1, bestScore = -Infinity;
        entering.forEach((p, idx) => {
          const sc = score(p, vacated.code);
          if (sc > bestScore) { bestScore = sc; bestIdx = idx; }
        });
        if (bestIdx === -1) return;
        const playerIn = entering.splice(bestIdx, 1)[0];

        substitutions.push({ minute: start, playerOut: playerOut.id, playerIn: playerIn.id });
        const newSlot = { startMinute: start, endMinute: end, positionCode: vacated.code, positionIndex: vacated.index };
        if (lineupMap[playerIn.id]) lineupMap[playerIn.id].push(newSlot); else lineupMap[playerIn.id] = [newSlot];
        currentPos[playerIn.id] = vacated;
        delete currentPos[playerOut.id];
      });
    }

    const lineup = [];
    Object.entries(lineupMap).forEach(([playerId, slots]) => {
      slots.forEach(slot => lineup.push({ playerId, ...slot }));
    });

    return { lineup, substitutions };
  }

  return { getAll, getById, save, remove, saveLineup, toggleNoSub, savePositionOverride, clearPositionOverrides, generateLineup, overrideSubstitution, swapLineupPlayers };
})();
