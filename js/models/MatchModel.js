const MatchModel = (() => {
  async function getAll()    { return API.get('/api/matches'); }
  async function getById(id) { return API.get(`/api/matches/${id}`); }
  async function save(data)  { return data.id ? API.put(`/api/matches/${data.id}`, data) : API.post('/api/matches', data); }
  async function remove(id)  { return API.delete(`/api/matches/${id}`); }

  async function getShareLink(matchId) {
    const { token } = await API.post(`/api/matches/${matchId}/share`);
    return `${location.origin}/share.html?t=${token}`;
  }

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

  // Swap which player occupies two positions — scoped to just the wisselmoment-segment
  // containing `minute`, so repositioning players on the field never changes anyone's
  // on/off timing elsewhere (that's what the switch matrix is for). A lineup slot that
  // spans multiple segments (e.g. a player nobody ever subs) gets split at the segment
  // boundary first, so only that one block's position assignment is touched.
  async function swapLineupPlayers(matchId, posIndexA, posIndexB, minute) {
    const m = await getById(matchId);
    if (!m?.lineup) return null;

    const bounds = _segmentBounds(m);
    let segStart = bounds[0], segEnd = bounds[bounds.length - 1];
    for (let i = 0; i < bounds.length - 1; i++) {
      if (minute >= bounds[i] && minute < bounds[i + 1]) { segStart = bounds[i]; segEnd = bounds[i + 1]; break; }
    }

    let lineup = m.lineup.map(l => ({ ...l }));
    const splitAt = (boundary) => {
      lineup = lineup.flatMap(l => (l.startMinute < boundary && l.endMinute > boundary)
        ? [{ ...l, endMinute: boundary }, { ...l, startMinute: boundary }]
        : [l]);
    };
    splitAt(segStart);
    splitAt(segEnd);

    const slotA = lineup.find(l => l.positionIndex === posIndexA && l.startMinute === segStart && l.endMinute === segEnd);
    const slotB = lineup.find(l => l.positionIndex === posIndexB && l.startMinute === segStart && l.endMinute === segEnd);
    if (!slotA || !slotB) return null;
    [slotA.playerId, slotB.playerId] = [slotB.playerId, slotA.playerId];

    return save({ ...m, lineup: _mergeAdjacentSlots(lineup) });
  }

  // Re-join slots that ended up back-to-back with the same player + position after a
  // swap, so the lineup array doesn't fragment into ever-smaller pieces over time.
  function _mergeAdjacentSlots(lineup) {
    const byPlayer = {};
    lineup.forEach(l => { (byPlayer[l.playerId] = byPlayer[l.playerId] || []).push(l); });
    const merged = [];
    Object.values(byPlayer).forEach(slots => {
      const sorted = [...slots].sort((a, b) => a.startMinute - b.startMinute);
      let current = null;
      sorted.forEach(slot => {
        if (current && current.positionIndex === slot.positionIndex && current.endMinute === slot.startMinute) {
          current.endMinute = slot.endMinute;
        } else {
          if (current) merged.push(current);
          current = { ...slot };
        }
      });
      if (current) merged.push(current);
    });
    return merged;
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

  // Segment boundaries in minutes, e.g. [0, 20, 40, 60] for a 60-min match with 3
  // wisselmomenten — shared by generation, the switch matrix and position swaps so
  // they all agree on where one block ends and the next begins.
  function _segmentBounds(match) {
    const matchMinutes = match.duration || 60;
    const numSegments = match.subMoments || 2;
    const segLen = matchMinutes / numSegments;
    const bounds = [0];
    for (let i = 1; i < numSegments; i++) bounds.push(Math.round(i * segLen));
    bounds.push(matchMinutes);
    return bounds;
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

  // Build lineup + substitutions from a fixed per-segment on-field roster. Shared by
  // generateLineup (auto fair rotation) and applySegmentGrid (manual matrix edits) —
  // continuing players simply extend their slot, leaving/entering players are paired
  // by best positional fit so the vacated position + color stays put.
  function _buildFromSegments(noSubPresent, segmentsOnField, positions, segmentBounds) {
    const numSegments = segmentsOnField.length;
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

  // Generate a fair lineup: the match is split into match.subMoments equal segments
  // (decoupled from match.periods, which is purely rustmomenten for display). Every
  // sub-eligible player rotates through the bench so total playing time stays as
  // equal as possible, with substitutions spread across every segment boundary.
  // Respects match.segmentPins — coach-locked (segment, player) on/off choices from
  // the switch matrix (e.g. deliberately benching someone at the start) survive
  // regeneration; the remaining free slots are still filled as fairly as possible.
  function generateLineup(match, players) {
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    const positions = formation.positions;
    const numOnField = positions.length;
    const present = players.filter(p => match.presentPlayers.includes(p.id));
    const numSegments = match.subMoments || 2;

    if (present.length < numOnField) return null;

    const segmentBounds = _segmentBounds(match);

    const noSub = new Set(match.noSubPlayers || []);
    const noSubPresent = present.filter(p => noSub.has(p.id));
    const subEligible  = present.filter(p => !noSub.has(p.id));
    const slotsForSubs = numOnField - noSubPresent.length;

    // Sort sub-eligible: best peak fit first → tie-breaker when nobody has played yet
    const sortedByFit = [...subEligible].sort((a, b) => {
      const aFit = Math.max(...positions.map(p => score(a, p.code)));
      const bFit = Math.max(...positions.map(p => score(b, p.code)));
      return bFit - aFit;
    });
    const fitRank = new Map(sortedByFit.map((p, i) => [p.id, i]));

    const n = subEligible.length;
    if (n <= slotsForSubs) {
      // Everyone fits on the field at once — no rotation needed
      const assignment = assignPlayers(present, positions);
      const lineup = assignment.map(({ player, pos }) => ({
        playerId: player.id, positionCode: pos.code, positionIndex: positions.indexOf(pos),
        startMinute: 0, endMinute: segmentBounds[segmentBounds.length - 1],
      }));
      return { lineup, substitutions: [] };
    }

    // Coach-locked cells from the switch matrix, grouped per segment
    const pinsPerSegment = segmentBounds.slice(0, -1).map(() => new Map());
    (match.segmentPins || []).forEach(p => {
      if (pinsPerSegment[p.segment] && subEligible.some(pl => pl.id === p.playerId)) {
        pinsPerSegment[p.segment].set(p.playerId, p.on);
      }
    });

    // Greedy fair rotation: pinned players are forced first, then the remaining free
    // slots go to whoever has played the fewest minutes so far — this keeps total
    // playing time as balanced as possible even around irregular pins.
    const minutesPlayed = {};
    subEligible.forEach(p => { minutesPlayed[p.id] = 0; });

    const segmentsOnField = [];
    for (let s = 0; s < numSegments; s++) {
      const segMinutes = segmentBounds[s + 1] - segmentBounds[s];
      const segPins = pinsPerSegment[s];
      const pinnedOn  = subEligible.filter(p => segPins.get(p.id) === true);
      const pinnedOff = new Set(subEligible.filter(p => segPins.get(p.id) === false).map(p => p.id));
      const pinnedOnIds = new Set(pinnedOn.map(p => p.id));

      const freePool = subEligible.filter(p => !pinnedOnIds.has(p.id) && !pinnedOff.has(p.id));
      const freeSlots = Math.max(0, Math.min(slotsForSubs - pinnedOn.length, freePool.length));

      const chosen = [...freePool]
        .sort((a, b) => (minutesPlayed[a.id] - minutesPlayed[b.id]) || (fitRank.get(a.id) - fitRank.get(b.id)))
        .slice(0, freeSlots);

      const onField = [...pinnedOn, ...chosen];
      if (onField.length < slotsForSubs) return null; // te veel vergrendelingen om dit blok te vullen

      segmentsOnField.push(onField);
      onField.forEach(p => { minutesPlayed[p.id] += segMinutes; });
    }

    return _buildFromSegments(noSubPresent, segmentsOnField, positions, segmentBounds);
  }

  // Derive the per-segment on/off matrix from the currently saved lineup, so the UI
  // can show + edit "who's on the field in which block" directly.
  function getSegmentInfo(match, players) {
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    const numOnField = formation?.positions?.length || 0;
    const numSegments = match.subMoments || 2;
    const bounds = _segmentBounds(match);

    const noSub = new Set(match.noSubPlayers || []);
    const present = (match.presentPlayers || []).map(id => players.find(p => p.id === id)).filter(Boolean);
    const noSubPresent = present.filter(p => noSub.has(p.id));
    const subEligible  = present.filter(p => !noSub.has(p.id));
    const required = numOnField - noSubPresent.length;

    const lineup = match.lineup || [];
    const grid = [];
    for (let s = 0; s < numSegments; s++) {
      const start = bounds[s], end = bounds[s + 1];
      const onIds = subEligible
        .filter(p => lineup.some(l => l.playerId === p.id && l.startMinute <= start && l.endMinute >= end))
        .map(p => p.id);
      grid.push(new Set(onIds));
    }

    // Pins per segment: Map<playerId, boolean> — loaded so the matrix can show
    // which cells are already locked from a previous generate/apply.
    const pins = bounds.slice(0, -1).map(() => new Map());
    (match.segmentPins || []).forEach(p => {
      if (pins[p.segment] && subEligible.some(pl => pl.id === p.playerId)) pins[p.segment].set(p.playerId, p.on);
    });

    return { numSegments, bounds, noSubPresent, subEligible, required, grid, pins };
  }

  // `pins` (array of Map<playerId, boolean>, one per segment) → serializable form
  function _pinsToArray(pins) {
    const segmentPins = [];
    (pins || []).forEach((segMap, segIdx) => {
      segMap.forEach((on, playerId) => segmentPins.push({ segment: segIdx, playerId, on }));
    });
    return segmentPins;
  }

  // Persist just the locked cells — called the moment a cell is (un)pinned, so a
  // lock survives a page revisit even if the coach never clicks "Toepassen".
  async function saveSegmentPins(matchId, pins) {
    const m = await getById(matchId);
    return save({ ...m, segmentPins: _pinsToArray(pins) });
  }

  // Rebuild the lineup from a coach-edited segment grid (see getSegmentInfo). `pins`
  // is an array of Map<playerId, boolean> (one per segment) — the locked subset of
  // `grid` that should survive a future "Genereer opstelling".
  async function applySegmentGrid(matchId, segmentInfo, grid, pins) {
    const match = await getById(matchId);
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;
    const { bounds, noSubPresent, subEligible } = segmentInfo;
    const segmentsOnField = grid.map(idSet => subEligible.filter(p => idSet.has(p.id)));
    // Every segment must fill exactly the number of positions on the field — the UI
    // already disables "Toepassen" otherwise, this is a defensive backstop.
    if (segmentsOnField.some(onField => noSubPresent.length + onField.length !== formation.positions.length)) return null;
    const { lineup, substitutions } = _buildFromSegments(noSubPresent, segmentsOnField, formation.positions, bounds);

    return save({ ...match, lineup, substitutions, segmentPins: _pinsToArray(pins) });
  }

  return { getAll, getById, save, remove, saveLineup, toggleNoSub, savePositionOverride, clearPositionOverrides, generateLineup, getSegmentInfo, applySegmentGrid, saveSegmentPins, swapLineupPlayers, getShareLink };
})();
