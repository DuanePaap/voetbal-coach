const LineupController = (() => {
  let _currentMatchId = null;
  let _currentMinute = 0;
  let _selected = null; // { kind: 'field', posIndex } | { kind: 'bench', playerId } | null
  let _cachedMatch = null;
  let _cachedPlayers = null;
  let _segmentInfo = null;
  let _grid = null;
  let _pins = null; // array (per segment) of Map<playerId, boolean> — locked cells
  let _currentPositions = null; // last positions rendered on the field, incl. playerId per posIndex

  async function init() {
    const select = document.getElementById('lineup-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));
    document.getElementById('btn-generate-lineup').addEventListener('click', _generateLineup);
    document.getElementById('btn-share-whatsapp').addEventListener('click', shareViaWhatsapp);

    const genBtn = document.getElementById('btn-generate-lineup');
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.style.cssText = 'width:100%;margin-top:6px;font-size:.8rem';
    resetBtn.textContent = '↺ Posities resetten';
    resetBtn.addEventListener('click', async () => {
      if (!_currentMatchId) return;
      await MatchModel.clearPositionOverrides(_currentMatchId);
      _renderAll();
    });
    genBtn.insertAdjacentElement('afterend', resetBtn);

    await _refreshMatchSelect();
  }

  // Default to today's match; otherwise the soonest upcoming one; otherwise the
  // most recently played one — so opening Opstelling always lands on what's
  // actually relevant right now instead of whichever match sorts first.
  function _pickDefaultMatchId(matches) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = matches.find(m => m.date === todayStr);
    if (today) return today.id;

    const upcoming = matches.filter(m => m.date > todayStr).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (upcoming.length) return upcoming[0].id;

    const past = matches.filter(m => m.date < todayStr).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (past.length) return past[0].id;

    return matches[0].id;
  }

  async function _refreshMatchSelect() {
    const matches = await MatchModel.getAll();
    LineupView.populateMatchSelect(matches);
    if (!matches.length) return;
    const select = document.getElementById('lineup-match-select');
    const defaultId = _pickDefaultMatchId(matches);
    select.value = defaultId;
    await _loadMatch(defaultId);
  }

  async function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    await _renderAll();
  }

  async function _renderAll() {
    const [match, players] = await Promise.all([
      MatchModel.getById(_currentMatchId),
      PlayerModel.getAll(),
    ]);
    _cachedMatch = match;
    _cachedPlayers = players;
    _segmentInfo = match ? MatchModel.getSegmentInfo(match, players) : null;
    _grid = _segmentInfo ? _segmentInfo.grid.map(s => new Set(s)) : null;
    _pins = _segmentInfo ? _segmentInfo.pins.map(m => new Map(m)) : null;

    LineupView.renderInfo(match, players);
    LineupView.renderNoSubPicker(match, players);
    LineupView.renderPeriodNav(match, _currentMinute);
    _renderMatrix();
    LineupView.renderSubstitutionTimeline(match, players);
    LineupView.renderBench(match, players);
    _selected = null;
    _renderField();
    _renderFieldBench();
  }

  function _renderMatrix() {
    if (!_cachedMatch || !_segmentInfo) return;
    LineupView.renderSwitchMatrix(_cachedMatch, _cachedPlayers, _segmentInfo, _grid, _pins);
  }

  // Tap cycle per cell: uit → aan → aan (vast 📌) → uit (vast 📌) → uit …
  // Vergrendelen/ontgrendelen wordt meteen opgeslagen (los van "Toepassen"), zodat
  // een 📌 nooit stilletjes verloren gaat als de coach de pagina verlaat zonder op
  // Toepassen te klikken.
  async function toggleMatrixCell(segIdx, playerId) {
    if (!_grid || !_pins) return;
    const on = _grid[segIdx].has(playerId);
    const pinned = _pins[segIdx].has(playerId);
    let pinChanged = false;

    if (!on && !pinned) {
      _grid[segIdx].add(playerId);
    } else if (on && !pinned) {
      _pins[segIdx].set(playerId, true);
      pinChanged = true;
    } else if (on && pinned) {
      _grid[segIdx].delete(playerId);
      _pins[segIdx].set(playerId, false);
      pinChanged = true;
    } else {
      _pins[segIdx].delete(playerId);
      pinChanged = true;
    }
    _renderMatrix();

    if (pinChanged) {
      try {
        await MatchModel.saveSegmentPins(_currentMatchId, _pins);
      } catch (err) {
        console.error(err);
        alert('Vergrendelen opslaan is mislukt — controleer je verbinding en probeer opnieuw.');
      }
    }
  }

  async function applyMatrix() {
    if (!_currentMatchId || !_grid) return;
    const result = await MatchModel.applySegmentGrid(_currentMatchId, _segmentInfo, _grid, _pins);
    if (!result) return alert('Kon de opstelling niet bijwerken — controleer of elk blok het juiste aantal spelers heeft.');
    _currentMinute = 0;
    await _renderAll();
  }

  function _renderField() {
    const formation = _cachedMatch ? FormationModel.getFormation(_cachedMatch.fieldType, _cachedMatch.formation) : null;
    const svgEl = document.getElementById('lineup-field');
    if (_cachedMatch && formation) {
      _currentPositions = LineupView.getPositionsAtMinute(_cachedMatch, _cachedPlayers, formation, _currentMinute);
      FieldView.render(svgEl, _currentPositions, _cachedMatch.fieldType, null, {
        cardMode: true,
        draggable: true,
        selectedPosIndex: _selected?.kind === 'field' ? _selected.posIndex : null,
        onPositionChange: (posIndex, x, y) => MatchModel.savePositionOverride(_currentMatchId, posIndex, x, y),
        onPlayerClick: _onFieldClick,
      });
    } else {
      _currentPositions = [];
      FieldView.render(svgEl, [], 'full', null, { cardMode: true });
    }
  }

  // Huidig wisselmoment-blok (index in _segmentInfo.bounds) voor _currentMinute —
  // zelfde grenzen als MatchModel.swapLineupPlayers gebruikt, zodat wissels via de
  // wisselbank altijd binnen hetzelfde blok blijven als een positie-swap op het veld.
  function _segmentIndexForMinute() {
    if (!_segmentInfo) return 0;
    const { bounds } = _segmentInfo;
    for (let i = 0; i < bounds.length - 1; i++) {
      if (_currentMinute >= bounds[i] && _currentMinute < bounds[i + 1]) return i;
    }
    return Math.max(0, bounds.length - 2);
  }

  // Een speler op het veld mag alleen weg als hij niet "Geen wissel" heeft en niet
  // vergrendeld is voor dit blok in "Wie staat wanneer?".
  function _canSwapField(playerId, segIdx) {
    if (!playerId || !_segmentInfo || !_pins) return false;
    if (_segmentInfo.noSubPresent.some(p => p.id === playerId)) return false;
    return !_pins[segIdx].has(playerId);
  }

  // Een wisselspeler mag alleen erin als hij niet vergrendeld is voor dit blok.
  function _canSwapBench(playerId, segIdx) {
    if (!_pins) return false;
    return !_pins[segIdx].has(playerId);
  }

  function _onFieldClick(posIndex) {
    const playerId = (_currentPositions || []).find(p => p.positionIndex === posIndex)?.playerId;
    if (!_selected) {
      if (!playerId) return;
      _selected = { kind: 'field', posIndex };
      _renderField();
      _renderFieldBench();
      return;
    }
    if (_selected.kind === 'field' && _selected.posIndex === posIndex) {
      _selected = null;
      _renderField();
      _renderFieldBench();
      return;
    }
    if (_selected.kind === 'field') {
      const prev = _selected.posIndex;
      _selected = null;
      if (!playerId) {
        _moveFieldToEmpty(prev, posIndex);
      } else {
        MatchModel.swapLineupPlayers(_currentMatchId, prev, posIndex, _currentMinute)
          .then(() => _renderAll())
          .catch(console.error);
      }
      return;
    }
    // Een wisselspeler was geselecteerd — plaats 'm op dit veldvak.
    if (!playerId) {
      _placeBenchAtEmpty(_selected.playerId, posIndex);
      return;
    }
    _swapBenchField(_selected.playerId, playerId);
  }

  function selectBench(playerId) {
    const segIdx = _segmentIndexForMinute();
    if (_selected?.kind === 'bench' && _selected.playerId === playerId) {
      _selected = null;
      _renderFieldBench();
      return;
    }
    if (!_selected || _selected.kind === 'bench') {
      if (!_canSwapBench(playerId, segIdx)) return;
      _selected = { kind: 'bench', playerId };
      _renderField();
      _renderFieldBench();
      return;
    }
    // Een veldspeler was geselecteerd — wissel hem met deze wisselspeler.
    const fieldPlayerId = (_currentPositions || []).find(p => p.positionIndex === _selected.posIndex)?.playerId;
    if (!fieldPlayerId) {
      _selected = null;
      _renderField();
      _renderFieldBench();
      return;
    }
    _swapBenchField(playerId, fieldPlayerId);
  }

  // Wissel een wisselspeler en een veldspeler binnen het huidige blok. Herleidt de
  // grid bewust vers uit de opgeslagen opstelling (niet uit de mogelijk nog niet
  // toegepaste matrix-staat _grid), zodat alleen déze ene wissel wordt doorgevoerd —
  // en geen losstaande, nog niet op "Toepassen" bevestigde matrix-aanpassingen.
  async function _swapBenchField(benchId, fieldId) {
    const segIdx = _segmentIndexForMinute();
    _selected = null;
    if (!_canSwapBench(benchId, segIdx) || !_canSwapField(fieldId, segIdx)) {
      _renderField();
      _renderFieldBench();
      return;
    }
    const fresh = MatchModel.getSegmentInfo(_cachedMatch, _cachedPlayers);
    fresh.grid[segIdx].delete(fieldId);
    fresh.grid[segIdx].add(benchId);
    const result = await MatchModel.applySegmentGrid(_currentMatchId, fresh, fresh.grid, fresh.pins);
    if (!result) alert('Kon de wissel niet doorvoeren.');
    await _renderAll();
  }

  // Plaats een wisselspeler in een LEEG veldvak — anders dan _swapBenchField hoeft
  // er niemand al op die plek te staan, dus dit werkt ook vóór er ooit een
  // opstelling gegenereerd is (dan staat iedereen nog op de bank).
  async function _placeBenchAtEmpty(benchId, posIndex) {
    const segIdx = _segmentIndexForMinute();
    _selected = null;
    if (!_canSwapBench(benchId, segIdx)) {
      _renderField();
      _renderFieldBench();
      return;
    }
    const result = await MatchModel.placePlayerAtPosition(_currentMatchId, benchId, posIndex, _currentMinute);
    if (!result) alert('Kon de speler niet plaatsen.');
    await _renderAll();
  }

  // Verplaats een speler die al op het veld staat naar een LEEG vak.
  async function _moveFieldToEmpty(fromPosIndex, toPosIndex) {
    const fieldPlayerId = (_currentPositions || []).find(p => p.positionIndex === fromPosIndex)?.playerId;
    if (!fieldPlayerId) { await _renderAll(); return; }
    const segIdx = _segmentIndexForMinute();
    if (!_canSwapField(fieldPlayerId, segIdx)) {
      await _renderAll();
      return;
    }
    const result = await MatchModel.placePlayerAtPosition(_currentMatchId, fieldPlayerId, toPosIndex, _currentMinute, fromPosIndex);
    if (!result) alert('Kon de speler niet verplaatsen.');
    await _renderAll();
  }

  function _renderFieldBench() {
    if (!_cachedMatch || !_segmentInfo) { LineupView.renderFieldBench([], _cachedMatch); return; }
    const segIdx = _segmentIndexForMinute();
    const onFieldIds = new Set((_currentPositions || []).map(p => p.playerId).filter(Boolean));
    const items = _segmentInfo.subEligible
      .filter(p => !onFieldIds.has(p.id))
      .map(p => ({
        player: p,
        blocked: !_canSwapBench(p.id, segIdx),
        selected: _selected?.kind === 'bench' && _selected.playerId === p.id,
      }));
    LineupView.renderFieldBench(items, _cachedMatch);
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    _selected = null;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderField();
    _renderFieldBench();
  }

  async function toggleNoSub(playerId) {
    if (!_currentMatchId) return;
    await MatchModel.toggleNoSub(_currentMatchId, playerId);
    await _renderAll();
  }

  async function _generateLineup() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const [match, players] = await Promise.all([MatchModel.getById(_currentMatchId), PlayerModel.getAll()]);
    if (match?.lineup?.length) {
      const ok = confirm('Weet je zeker dat je een nieuwe opstelling wilt genereren? De huidige indeling en handmatige positie-wissels worden overschreven (vergrendelde vakjes in de matrix blijven staan).');
      if (!ok) return;
    }
    const result = MatchModel.generateLineup(match, players);
    if (!result) return alert('Niet genoeg spelers voor de opstelling — voeg meer aanwezige spelers toe of pas de vergrendelingen in de matrix aan.');
    await MatchModel.saveLineup(_currentMatchId, result.lineup, result.substitutions);
    _currentMinute = 0;
    await _renderAll();
  }

  async function refresh() { await _refreshMatchSelect(); }

  async function shareViaWhatsapp() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const match = await MatchModel.getById(_currentMatchId);
    if (!match?.lineup?.length) return alert('Genereer eerst een opstelling voordat je deze deelt.');
    const url = await MatchModel.getShareLink(_currentMatchId);
    const dateStr = new Date(match.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    const text = `Opstelling vs ${match.opponent} (${dateStr}): ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return { init, refresh, showMinute, toggleNoSub, toggleMatrixCell, applyMatrix, selectBench, shareViaWhatsapp };
})();
