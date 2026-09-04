const LineupController = (() => {
  let _currentMatchId = null;
  let _currentMinute = 0;
  let _selectedPosIndex = null;
  let _cachedMatch = null;
  let _cachedPlayers = null;
  let _segmentInfo = null;
  let _grid = null;
  let _pins = null; // array (per segment) of Map<playerId, boolean> — locked cells

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

  async function _refreshMatchSelect() {
    const matches = await MatchModel.getAll();
    LineupView.populateMatchSelect(matches);
    const select = document.getElementById('lineup-match-select');
    if (select.value) await _loadMatch(select.value);
    else if (matches.length) { select.value = matches[0].id; await _loadMatch(matches[0].id); }
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
    LineupView.renderPeriodNav(match);
    _renderMatrix();
    LineupView.renderSubstitutionTimeline(match, players);
    LineupView.renderBench(match, players);
    _selectedPosIndex = null;
    _renderField();
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
      const positions = LineupView.getPositionsAtMinute(_cachedMatch, _cachedPlayers, formation, _currentMinute);
      FieldView.render(svgEl, positions, _cachedMatch.fieldType, null, {
        cardMode: true,
        draggable: true,
        selectedPosIndex: _selectedPosIndex,
        onPositionChange: (posIndex, x, y) => MatchModel.savePositionOverride(_currentMatchId, posIndex, x, y),
        onPlayerClick: _onPlayerClick,
      });
    } else {
      FieldView.render(svgEl, [], 'full', null, { cardMode: true });
    }
  }

  function _onPlayerClick(posIndex) {
    if (_selectedPosIndex === null) {
      _selectedPosIndex = posIndex;
      _renderField();
    } else if (_selectedPosIndex === posIndex) {
      _selectedPosIndex = null;
      _renderField();
    } else {
      const prev = _selectedPosIndex;
      _selectedPosIndex = null;
      MatchModel.swapLineupPlayers(_currentMatchId, prev, posIndex, _currentMinute)
        .then(() => _renderAll())
        .catch(console.error);
    }
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    _selectedPosIndex = null;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderField();
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

  return { init, refresh, showMinute, toggleNoSub, toggleMatrixCell, applyMatrix, shareViaWhatsapp };
})();
