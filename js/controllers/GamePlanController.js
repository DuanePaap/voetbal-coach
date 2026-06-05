const GamePlanController = (() => {
  let _currentMatchId = null;
  let _possession = 'yes';
  let _zone = 'midden-voor';
  let _ballPos = { x: 200, y: 130 };
  let _currentMinute = 0;
  let _promptPositions = null;
  let _activeScenarioIdx = null;

  function init() {
    const select = document.getElementById('gameplan-match-select');
    select.addEventListener('change', () => _loadMatch(select.value));

    document.querySelectorAll('.toggle-btn[data-possession]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn[data-possession]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _possession = btn.dataset.possession;
        _promptPositions = null;
        _activeScenarioIdx = null;
        _update();
        _renderScenarios();
      });
    });

    document.getElementById('btn-save-scenario').addEventListener('click', _saveScenario);
    _refreshMatchSelect();
  }

  function showMinute(minute, btn) {
    _currentMinute = minute;
    document.querySelectorAll('#gameplan-period-nav .period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _promptPositions = null;
    _update();
  }

  function loadScenario(idx) {
    if (!_currentMatchId) return;
    const scenarios = GamePlanModel.listScenarios(_currentMatchId);
    const scenario = scenarios[idx];
    if (!scenario) return;

    _activeScenarioIdx = idx;
    _possession = scenario.possession;
    _zone = scenario.zone;
    _ballPos = scenario.ballPos || { x: 200, y: 300 };
    _promptPositions = null;

    // Update possession toggle UI
    document.querySelectorAll('.toggle-btn[data-possession]').forEach(b => {
      b.classList.toggle('active', b.dataset.possession === _possession);
    });

    // Update description field
    const descEl = document.getElementById('gameplan-description');
    if (descEl) descEl.value = scenario.description || '';

    _update();
    _renderScenarios();
  }

  function _refreshMatchSelect() {
    const matches = MatchModel.getAll();
    GamePlanView.populateMatchSelect(matches);
    const select = document.getElementById('gameplan-match-select');
    if (matches.length) {
      _currentMatchId = select.value || matches[0].id;
      select.value = _currentMatchId;
      _loadMatch(_currentMatchId);
    }
  }

  function _loadMatch(matchId) {
    _currentMatchId = matchId;
    _currentMinute = 0;
    _promptPositions = null;
    _activeScenarioIdx = null;
    const match = MatchModel.getById(matchId);
    GamePlanView.renderPeriodNav(match);
    _update();
    _renderScenarios();
  }

  function _renderScenarios() {
    GamePlanView.renderScenarioList(
      GamePlanModel.listScenarios(_currentMatchId),
      _activeScenarioIdx
    );
  }

  function _getBasePositions() {
    const match = MatchModel.getById(_currentMatchId);
    if (!match) return null;
    const players = PlayerModel.getAll();
    const formation = FormationModel.getFormation(match.fieldType, match.formation);
    if (!formation) return null;

    const saved = GamePlanModel.getScenario(_currentMatchId, _possession, _zone);
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

  function _update() {
    const base = _getBasePositions();
    if (!base) return;
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
    // On first move, snapshot current base positions into _promptPositions
    if (!_promptPositions) {
      const base = _getBasePositions();
      if (!base) return;
      _promptPositions = base.positions.map(p => ({ ...p }));
    }
    if (_promptPositions[idx]) {
      _promptPositions[idx] = { ..._promptPositions[idx], x, y };
    }
  }

  function _onBallDrop(x, y) {
    _ballPos = { x, y };
    _zone = FieldView._coordsToZone(x, y);
    // Keep player positions — don't clear _promptPositions
    _update();
  }

  function _saveScenario() {
    if (!_currentMatchId) return alert('Selecteer eerst een wedstrijd.');
    const base = _getBasePositions();
    if (!base) return;
    const description = document.getElementById('gameplan-description')?.value?.trim() || '';
    const coords = (_promptPositions || base.positions)
      .map(p => ({ positionCode: p.positionCode, x: Math.round(p.x), y: Math.round(p.y) }));
    GamePlanModel.saveScenario(_currentMatchId, _possession, _zone, _ballPos, coords, description);
    const scenarios = GamePlanModel.listScenarios(_currentMatchId);
    _activeScenarioIdx = scenarios.findIndex(s => s.possession === _possession && s.zone === _zone);
    _renderScenarios();
  }

  function deleteScenario(idx) {
    if (!_currentMatchId) return;
    GamePlanModel.deleteScenario(_currentMatchId, idx);
    if (_activeScenarioIdx === idx) {
      _activeScenarioIdx = null;
      _promptPositions = null;
      _update();
    } else if (_activeScenarioIdx !== null && _activeScenarioIdx > idx) {
      _activeScenarioIdx--;
    }
    _renderScenarios();
  }

  function refresh() {
    _refreshMatchSelect();
  }

  return { init, refresh, showMinute, loadScenario, deleteScenario };
})();
