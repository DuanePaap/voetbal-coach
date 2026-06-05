const GamePlanController = (() => {
  let _currentMatchId = null;
  let _possession = 'yes';
  let _zone = 'midden-voor';
  let _ballPos = { x: 200, y: 130 };
  let _currentMinute = 0;
  let _promptPositions = null;
  let _activeScenarioIdx = null;
  let _basePositionsCache = null; // Synchronous cache for drag callbacks

  async function init() {
    const select = document.getElementById('gameplan-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));

    document.querySelectorAll('.toggle-btn[data-possession]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn[data-possession]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _possession = btn.dataset.possession;
        _promptPositions = null;
        _basePositionsCache = null;
        _activeScenarioIdx = null;
        _update();
        _renderScenarios();
      });
    });

    document.getElementById('btn-save-scenario').addEventListener('click', _saveScenario);
    await _refreshMatchSelect();
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    document.querySelectorAll('#gameplan-period-nav .period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _promptPositions = null;
    _basePositionsCache = null;
    _update();
  }

  async function loadScenario(idx) {
    if (!_currentMatchId) return;
    const scenarios = await GamePlanModel.listScenarios(_currentMatchId);
    const scenario = scenarios[idx];
    if (!scenario) return;

    _activeScenarioIdx = idx;
    _possession = scenario.possession;
    _zone = scenario.zone;
    _ballPos = scenario.ballPos || { x: 200, y: 300 };
    _promptPositions = null;
    _basePositionsCache = null;

    document.querySelectorAll('.toggle-btn[data-possession]').forEach(b => {
      b.classList.toggle('active', b.dataset.possession === _possession);
    });
    const descEl = document.getElementById('gameplan-description');
    if (descEl) descEl.value = scenario.description || '';

    await _update();
    await _renderScenarios();
  }

  async function _refreshMatchSelect() {
    const matches = await MatchModel.getAll();
    GamePlanView.populateMatchSelect(matches);
    const select = document.getElementById('gameplan-match-select');
    if (matches.length) {
      _currentMatchId = select.value || matches[0].id;
      select.value = _currentMatchId;
      await _loadMatch(_currentMatchId);
    }
  }

  async function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    _promptPositions = null;
    _basePositionsCache = null;
    _activeScenarioIdx = null;
    const match = await MatchModel.getById(matchId);
    GamePlanView.renderPeriodNav(match);
    await _update();
    await _renderScenarios();
  }

  async function _renderScenarios() {
    GamePlanView.renderScenarioList(
      await GamePlanModel.listScenarios(_currentMatchId),
      _activeScenarioIdx
    );
  }

  async function _computeBasePositions() {
    const [match, players] = await Promise.all([
      MatchModel.getById(_currentMatchId),
      PlayerModel.getAll(),
    ]);
    if (!match) return null;
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    const saved = await GamePlanModel.getScenario(_currentMatchId, _possession, _zone);
    const baseCoords = saved
      ? saved.positions.map(s => ({ positionCode: s.positionCode, x: s.x, y: s.y }))
      : formation.positions.map((pos, i) => {
          const ov = (match.positionOverrides || {})[String(i)];
          return { positionCode: pos.code, x: ov?.x ?? pos.x, y: ov?.y ?? pos.y };
        });

    const positions = baseCoords.map((coord, i) => {
      const slot = (match.lineup || []).find(
        l => l.positionIndex === i && l.startMinute <= _currentMinute && l.endMinute > _currentMinute
      );
      const player = slot ? players.find(p => p.id === slot.playerId) : null;
      return {
        positionCode: coord.positionCode, x: coord.x, y: coord.y,
        positionIndex: i,
        playerId: player?.id, playerName: player?.name, playerPhoto: player?.photo || null,
      };
    });
    return { positions, fieldType: match.fieldType };
  }

  async function _update() {
    const base = await _computeBasePositions();
    if (!base) return;
    _basePositionsCache = base; // Update cache so _onPlayerMove can use it synchronously
    const displayPositions = _promptPositions || base.positions;
    FieldView.render(
      document.getElementById('gameplan-field'),
      displayPositions,
      base.fieldType,
      _ballPos,
      {
        cardMode: true,
        draggable: true,
        onPositionChange: _onPlayerMove,
        onBallDrop: _onBallDrop,
      }
    );
  }

  function _onPlayerMove(idx, x, y) {
    // Called synchronously from drag — uses cached base positions
    if (!_promptPositions) {
      if (!_basePositionsCache) return;
      _promptPositions = _basePositionsCache.positions.map(p => ({ ...p }));
    }
    if (_promptPositions[idx]) {
      _promptPositions[idx] = { ..._promptPositions[idx], x, y };
    }
  }

  function _onBallDrop(x, y) {
    _ballPos = { x, y };
    _zone = FieldView._coordsToZone(x, y);
    _update(); // async fire-and-forget
  }

  async function _saveScenario() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const base = _basePositionsCache || await _computeBasePositions();
    if (!base) return;
    const description = document.getElementById('gameplan-description')?.value?.trim() || '';
    const coords = (_promptPositions || base.positions)
      .map(p => ({ positionCode: p.positionCode, x: Math.round(p.x), y: Math.round(p.y) }));
    await GamePlanModel.saveScenario(_currentMatchId, _possession, _zone, _ballPos, coords, description);
    _basePositionsCache = null;
    const scenarios = await GamePlanModel.listScenarios(_currentMatchId);
    _activeScenarioIdx = scenarios.findIndex(s => s.possession === _possession && s.zone === _zone);
    await _renderScenarios();
  }

  async function deleteScenario(idx) {
    if (!_currentMatchId) return;
    await GamePlanModel.deleteScenario(_currentMatchId, idx);
    if (_activeScenarioIdx === idx) {
      _activeScenarioIdx = null;
      _promptPositions = null;
      _basePositionsCache = null;
      await _update();
    } else if (_activeScenarioIdx !== null && _activeScenarioIdx > idx) {
      _activeScenarioIdx--;
    }
    await _renderScenarios();
  }

  async function refresh() { await _refreshMatchSelect(); }

  return { init, refresh, showMinute, loadScenario, deleteScenario };
})();
